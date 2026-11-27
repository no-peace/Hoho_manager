import { createApp } from "./app.js";
import { db, initializeDatabase } from "./config/database.js";
import { env, validateEnv } from "./config/env.js";
import { runDatabaseMaintenance } from "./services/maintenanceService.js";
import { startMessageTrackerPolling, stopMessageTrackerPolling, waitForTrackedMessageSync } from "./services/messageTrackerService.js";
import { initializeAutomationService, runAutomationTick, waitForAutomationTick } from "./services/automationService.js";
import { logger } from "./utils/logger.js";
import type { Server } from "node:http";

const log = logger.child("server");

const start = async (): Promise<void> => {
  log.info(`Starting in ${env.nodeEnv} mode`);

  for (const warning of validateEnv()) log.warn(warning);

  if (env.isProd && (!env.adminApiKey || env.adminApiKey === "dev-admin-key" || env.adminApiKey.length < 32)) {
    throw new Error("CRITICAL: Set a unique ADMIN_API_KEY with at least 32 characters before starting in production.");
  }
  if (env.isProd && env.sessionSecret.trim().length < 32) {
    throw new Error("CRITICAL: Set a dedicated SESSION_SECRET with at least 32 characters, separate from ADMIN_API_KEY, before starting in production.");
  }
  if (env.isProd && env.sessionSecret === env.adminApiKey) {
    throw new Error("CRITICAL: SESSION_SECRET must not equal ADMIN_API_KEY in production.");
  }
  if (
    env.sessionLegacyAdminKeyUntilMs !== undefined &&
    !Number.isFinite(env.sessionLegacyAdminKeyUntilMs)
  ) {
    throw new Error("CRITICAL: SESSION_LEGACY_ADMIN_KEY_UNTIL must be a valid ISO-8601 UTC timestamp.");
  }
  if (
    env.sessionLegacyAdminKeyUntilMs !== undefined &&
    env.sessionLegacyAdminKeyUntilMs > Date.now() + 24 * 60 * 60 * 1000
  ) {
    throw new Error("CRITICAL: SESSION_LEGACY_ADMIN_KEY_UNTIL cannot be more than 24 hours in the future.");
  }
  if (env.isProd && (!env.encryptionKey || env.encryptionKey.length < 32)) {
    throw new Error("CRITICAL: Set a dedicated ENCRYPTION_KEY with at least 32 characters before starting in production.");
  }

  if (env.isProd && !env.discord.botToken) {
    throw new Error("CRITICAL: DISCORD_BOT_TOKEN is required for production bot-based message delivery.");
  }
  if (env.isProd && (!env.discord.applicationId || !env.discord.clientId || !env.discord.clientSecret)) {
    throw new Error("CRITICAL: DISCORD_APPLICATION_ID, DISCORD_CLIENT_ID, and DISCORD_CLIENT_SECRET are required for production bot access and Discord OAuth login.");
  }
  if (env.isProd) {
    const invalidClientOrigins = env.clientOrigins.filter((origin) => {
      try {
        const parsed = new URL(origin);
        return parsed.protocol !== "https:" || parsed.origin !== origin ||
          parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
      } catch {
        return true;
      }
    });
    if (env.clientOrigins.length === 0 || invalidClientOrigins.length > 0) {
      throw new Error("CRITICAL: Set CLIENT_ORIGIN to one or more exact HTTPS frontend origins in production; localhost, paths, and malformed origins are not allowed.");
    }
    let redirectUrl: URL;
    try {
      redirectUrl = new URL(env.discord.redirectUri);
    } catch {
      throw new Error("CRITICAL: DISCORD_REDIRECT_URI must be a valid absolute HTTPS URL in production.");
    }
    if (redirectUrl.protocol !== "https:") {
      throw new Error("CRITICAL: DISCORD_REDIRECT_URI must use HTTPS in production.");
    }
  }

  await initializeDatabase();
  log.info("Database ready");

  // Start background message tracker for dynamic auto-updates
  startMessageTrackerPolling();
  await initializeAutomationService();

  const app = createApp();

  const server: Server = app.listen(env.port, () => {
    log.info(`API listening on port ${env.port}`);
    log.info(`Health check: http://localhost:${env.port}/api/health`);
  });

  // Let the HTTP server warm up before background maintenance consumes CPU or Turso quota.
  const initialMaintenance = setTimeout(() => {
    runDatabaseMaintenance().catch((err: unknown) => {
      log.warn(
        `Initial maintenance sweep error: ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }, 45_000);
  initialMaintenance.unref();

  // Periodic maintenance sweep every 60 minutes
  const cleanup = setInterval(() => {
    runDatabaseMaintenance().catch((error: unknown) => {
      log.warn(
        `Cleanup sweep error: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }, 60 * 60 * 1000);
  cleanup.unref();

  const automationInterval = setInterval(() => {
    runAutomationTick().catch((error: unknown) => {
      log.warn(`Automation tick error: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, 60_000);
  automationInterval.unref();

  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    log.info(`Received ${signal}. Starting graceful shutdown...`);
    clearTimeout(initialMaintenance);
    clearInterval(cleanup);
    clearInterval(automationInterval);
    stopMessageTrackerPolling();

    await Promise.race([
      Promise.all([waitForAutomationTick(), waitForTrackedMessageSync()]),
      new Promise<void>((resolve) => setTimeout(resolve, 3_000)),
    ]);

    server.close(() => {
      log.info("HTTP server closed.");
      void db.close().finally(() => {
        process.exit(0);
      });
    });

    setTimeout(() => {
      log.warn("Forceful shutdown timeout reached.");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGINT", () => { void gracefulShutdown("SIGINT"); });
  process.on("SIGTERM", () => { void gracefulShutdown("SIGTERM"); });
};

process.on("unhandledRejection", (reason) => {
  log.error("Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  log.error("Uncaught Exception thrown:", error);
  process.exit(1);
});

start().catch((error: unknown) => {
  log.error("Failed to start server", error);
  process.exit(1);
});
