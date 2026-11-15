import { createApp } from "./app.js";
import { db, initializeDatabase } from "./config/database.js";
import { env, validateEnv } from "./config/env.js";
import { runDatabaseMaintenance } from "./services/maintenanceService.js";
import { startMessageTrackerPolling, stopMessageTrackerPolling } from "./services/messageTrackerService.js";
import { logger } from "./utils/logger.js";
import type { Server } from "node:http";

const log = logger.child("server");

const start = async (): Promise<void> => {
  log.info(`Starting in ${env.nodeEnv} mode`);

  for (const warning of validateEnv()) log.warn(warning);

  if (env.isProd && (!env.adminApiKey || env.adminApiKey === "dev-admin-key" || env.adminApiKey.length < 32)) {
    throw new Error("CRITICAL: Set a unique ADMIN_API_KEY with at least 32 characters before starting in production.");
  }
  if (env.isProd && process.env.SESSION_SECRET?.trim() && env.sessionSecret.length < 32) {
    throw new Error("CRITICAL: SESSION_SECRET must contain at least 32 characters in production.");
  }

  await initializeDatabase();
  log.info("Database ready");

  // Immediate maintenance sweep on startup
  runDatabaseMaintenance().catch((err: unknown) => {
    log.warn(
      `Initial maintenance sweep error: ${err instanceof Error ? err.message : String(err)}`,
    );
  });

  // Start background message tracker for dynamic auto-updates
  startMessageTrackerPolling();

  const app = createApp();

  const server: Server = app.listen(env.port, () => {
    log.info(`API listening on port ${env.port}`);
    log.info(`Health check: http://localhost:${env.port}/api/health`);
  });

  // Periodic maintenance sweep every 10 minutes
  const cleanup = setInterval(() => {
    runDatabaseMaintenance().catch((error: unknown) => {
      log.warn(
        `Cleanup sweep error: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }, 10 * 60 * 1000);
  cleanup.unref();

  let isShuttingDown = false;
  const gracefulShutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    log.info(`Received ${signal}. Starting graceful shutdown...`);
    clearInterval(cleanup);
    stopMessageTrackerPolling();

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

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
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