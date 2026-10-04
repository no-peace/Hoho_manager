import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

/**
 * Centralised, validated environment configuration.
 *
 * Every other module imports `env` from here instead of touching
 * `process.env` directly, so a missing value surfaces in one place with a
 * useful message rather than as `undefined` deep inside a request handler.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
/** `server/` — the package root (config/ -> src/ -> server/). */
export const serverRoot = path.resolve(here, "../..");

// Load `server/.env` explicitly so the app behaves the same no matter which
// directory it was started from.
loadDotenv({ path: path.join(serverRoot, ".env") });

const str = (key: string, fallback?: string): string | undefined => {
  const raw = process.env[key];
  return raw === undefined || raw === "" ? fallback : raw;
};

const int = (key: string, fallback: number): number => {
  const raw = str(key);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const nodeEnv = str("NODE_ENV", "development") ?? "development";
const isProd = nodeEnv === "production";

/** Resolve `DATABASE_URL` to an absolute path (Postgres URLs are passed through). */
const resolveDatabase = (): string => {
  const value = str("DATABASE_URL", "./data/dev.sqlite") ?? "./data/dev.sqlite";
  if (/^postgres(ql)?:\/\//i.test(value)) return value;
  return path.isAbsolute(value) ? value : path.join(serverRoot, value);
};

export interface DiscordEnv {
  readonly publicKey: string | undefined;
  readonly applicationId: string | undefined;
  readonly botToken: string | undefined;
  readonly clientId: string | undefined;
  readonly clientSecret: string | undefined;
  readonly redirectUri: string;
}

export interface RateLimitEnv {
  readonly windowMs: number;
  readonly max: number;
}

export interface Env {
  readonly nodeEnv: string;
  readonly isProd: boolean;
  readonly isDev: boolean;
  readonly port: number;
  readonly clientOrigins: readonly string[];
  readonly databaseUrl: string;
  readonly discord: DiscordEnv;
  readonly adminApiKey: string;
  readonly sessionSecret: string;
  readonly encryptionKey: string | undefined;
  readonly rateLimit: RateLimitEnv;
  /** Discord channel ID for audit logs. Bot posts structured embeds here. */
  readonly logChannelId: string | undefined;
  /** Owner Discord user IDs (comma-separated) who bypass staff checks. */
  readonly ownerDiscordIds: readonly string[];
}

export const env: Env = Object.freeze({
  logChannelId: str("LOG_CHANNEL_ID"),
  ownerDiscordIds: Object.freeze(
    (str("OWNER_DISCORD_IDS", "") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  ),
  nodeEnv,
  isProd,
  isDev: !isProd,
  port: int("PORT", 3001),
  clientOrigins: Object.freeze(
    (str("CLIENT_ORIGIN", "http://localhost:5173") ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ),
  databaseUrl: resolveDatabase(),
  discord: Object.freeze({
    publicKey: str("DISCORD_PUBLIC_KEY"),
    applicationId: str("DISCORD_APPLICATION_ID"),
    botToken: str("DISCORD_BOT_TOKEN"),
    clientId: str("DISCORD_CLIENT_ID", str("DISCORD_APPLICATION_ID")),
    clientSecret: str("DISCORD_CLIENT_SECRET"),
    redirectUri: str("DISCORD_REDIRECT_URI", "http://localhost:3001/api/auth/discord/callback")!,
  }),
  adminApiKey: str("ADMIN_API_KEY", "dev-admin-key") ?? "dev-admin-key",
  sessionSecret: str("SESSION_SECRET", str("ADMIN_API_KEY", "dev-session-secret")) ?? "dev-session-secret",
  encryptionKey: str("ENCRYPTION_KEY"),
  rateLimit: Object.freeze({
    windowMs: int("RATE_LIMIT_WINDOW_MS", 60_000),
    max: int("RATE_LIMIT_MAX", 120),
  }),
});

/**
 * Validate the environment and return human-readable warnings.
 *
 * We warn instead of throwing so the editor can still be developed against a
 * server that has no Discord credentials yet.
 */
export const validateEnv = (): string[] => {
  const warnings: string[] = [];

  if (!env.discord.publicKey) {
    warnings.push(
      "DISCORD_PUBLIC_KEY is not set — /api/interactions will reject every request. " +
        "Set it before pointing Discord at this server.",
    );
  }
  if (!env.discord.botToken) {
    warnings.push(
      "DISCORD_BOT_TOKEN is not set — bot-mode sending and all actions are disabled.",
    );
  }
  if (!env.discord.applicationId) {
    warnings.push(
      "DISCORD_APPLICATION_ID is not set — application command routes are limited.",
    );
  }
  if (env.isProd && env.adminApiKey === "dev-admin-key") {
    warnings.push(
      "ADMIN_API_KEY is still the development default. Change it before deploying.",
    );
  }
  if (env.isProd && !env.encryptionKey) {
    warnings.push(
      "ENCRYPTION_KEY is not set. Stored bot tokens are encrypted with a key derived " +
        "from ADMIN_API_KEY; set a dedicated key before deploying.",
    );
  }

  return warnings;
};
