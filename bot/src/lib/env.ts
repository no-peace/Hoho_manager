import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

/**
 * Environment configuration for the gateway worker.
 *
 * Mirrors `server/src/config/env.ts`: one module reads `process.env`, everything
 * else imports the frozen object. `bot/.env` is loaded explicitly so the process
 * behaves the same whichever directory PM2 or `npm` launches it from.
 *
 * Note the worker deliberately owns **no** database credentials. It talks to the
 * API over HTTP, so the SQLite/Postgres file stays single-writer and the action
 * system has exactly one executor.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
/** `bot/` — the package root (`src/lib/` -> `src/` -> `bot/`). */
export const botRoot = path.resolve(here, "../..");

loadDotenv({ path: path.join(botRoot, ".env") });

const str = (key: string, fallback = ""): string => process.env[key]?.trim() || fallback;

const nodeEnv = str("NODE_ENV", "development");

export interface BotEnv {
  readonly nodeEnv: string;
  readonly isProd: boolean;
  /** Discord bot token. Required — the process exits without it. */
  readonly token: string;
  /** Origin of the Express API (no trailing slash). */
  readonly apiBaseUrl: string;
  /** Shared secret for privileged API routes (`x-admin-key`). */
  readonly adminApiKey: string;
  /**
   * Optional guild id. When set, slash commands are registered to that guild
   * only, which updates instantly — far nicer while developing than waiting up
   * to an hour for global command propagation.
   */
  readonly devGuildId: string | undefined;
}

export const env: BotEnv = Object.freeze({
  nodeEnv,
  isProd: nodeEnv === "production",
  token: str("DISCORD_BOT_TOKEN"),
  apiBaseUrl: str("API_BASE_URL", "http://localhost:3001").replace(/\/$/, ""),
  adminApiKey: str("ADMIN_API_KEY", "dev-admin-key"),
  devGuildId: str("DEV_GUILD_ID") || undefined,
});

/** Human-readable problems, so a misconfigured boot explains itself. */
export const validateEnv = (): string[] => {
  const errors: string[] = [];

  if (!env.token) {
    errors.push("DISCORD_BOT_TOKEN is not set — the gateway worker cannot log in.");
  }
  if (env.isProd && env.adminApiKey === "dev-admin-key") {
    errors.push("ADMIN_API_KEY is still the development default. Change it before deploying.");
  }

  return errors;
};
