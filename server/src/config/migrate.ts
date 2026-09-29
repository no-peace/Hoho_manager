/**
 * Migration CLI: `npm run migrate`
 *
 * Creates the SQLite file if needed, applies pending migrations, seeds the local
 * admin user, then exits. Safe to run repeatedly.
 */
import { countUsers, db, initializeDatabase } from "./database.js";
import { env, validateEnv } from "./env.js";
import { logger } from "../utils/logger.js";

const main = async (): Promise<void> => {
  logger.info(`Environment: ${env.nodeEnv}`);
  for (const warning of validateEnv()) logger.warn(warning);

  await initializeDatabase();

  logger.info(`Database ready — ${await countUsers()} user(s) present.`);
  await db.close();
};

main().catch((error: unknown) => {
  logger.error("Migration failed", error);
  process.exitCode = 1;
});
