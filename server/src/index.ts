import { createApp } from "./app.js";
import { db, initializeDatabase } from "./config/database.js";
import { env, validateEnv } from "./config/env.js";
import { flowRepository, interactionReceiptRepository } from "./repositories/index.js";
import { logger } from "./utils/logger.js";
import type { Server } from "node:http";

const log = logger.child("server");

const start = async (): Promise<void> => {
  log.info(`Starting in ${env.nodeEnv} mode`);

  for (const warning of validateEnv()) log.warn(warning);

  await initializeDatabase();
  log.info("Database ready");

  const app = createApp();

  const server: Server = app.listen(env.port, () => {
    log.info(`API listening on port ${env.port}`);
    log.info(`Health check: http://localhost:${env.port}/api/health`);
  });

  // Sweep expired flows and interaction receipts every 10 minutes
  const cleanup = setInterval(() => {
    Promise.all([
      flowRepository.pruneExpired(),
      interactionReceiptRepository.pruneExpired(),
    ]).catch((error: unknown) => {
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