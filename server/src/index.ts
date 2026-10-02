import { createApp } from "./app.js";
import { db, initializeDatabase } from "./config/database.js";
import { env, validateEnv } from "./config/env.js";
import { flowRepository, interactionReceiptRepository } from "./repositories/index.js";
import { logger } from "./utils/logger.js";

const log = logger.child("server");

/**
 * Boot sequence:
 *   validate env -> connect + migrate -> start listening -> schedule cleanup.
 *
 * The server refuses to start if the database cannot be opened, because a
 * half-working API is harder to debug than a loud failure at boot.
 */
const start = async (): Promise<void> => {
  log.info(`Starting in ${env.nodeEnv} mode`);

  for (const warning of validateEnv()) log.warn(warning);

  await initializeDatabase();
  log.info("Database ready");

  const app = createApp();

  const server = app.listen(env.port, () => {
    log.info(`API listening on http://localhost:${env.port}`);
    log.info(`Health: http://localhost:${env.port}/api/health`);
    log.info("Interactions endpoint (set this in the Discord Developer Portal): /api/interactions");
  });

  // Expired flow state is dead weight; sweep it periodically.
  const cleanup = setInterval(
    () => {
      Promise.all([flowRepository.pruneExpired(), interactionReceiptRepository.pruneExpired()])
        .catch((error: unknown) =>
          log.warn(
            `Flow state cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
    },
    10 * 60 * 1000,
  );
  cleanup.unref(); // don't hold the process open on its own

  const shutdown = (signal: string): void => {
    log.info(`${signal} received — shutting down`);
    clearInterval(cleanup);

    server.close(() => {
      void db.close().then(() => process.exit(0));
    });

    // Don't hang forever if a connection refuses to drain.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

start().catch((error: unknown) => {
  log.error("Failed to start server", error);
  process.exit(1);
});
