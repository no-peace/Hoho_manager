import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
export const botRoot = path.resolve(here, "../..");

loadDotenv({ path: path.join(botRoot, ".env") });

const str = (key: string, fallback = ""): string => process.env[key]?.trim() || fallback;

const nodeEnv = str("NODE_ENV", "development");
const activePort = str("PORT", "3001");

export interface BotEnv {
  readonly nodeEnv: string;
  readonly isProd: boolean;
  readonly token: string;
  readonly apiBaseUrl: string;
  readonly adminApiKey: string;
  readonly commandAdminIds: readonly string[];
  readonly devGuildId: string | undefined;
}

export const parseDiscordIdList = (value: string): string[] =>
  [...new Set(value.split(",").map((id) => id.trim()).filter((id) => /^\d{17,20}$/.test(id)))];

const rawCommandAdminIds = str("BOT_COMMAND_ADMIN_IDS", str("OWNER_DISCORD_IDS", ""));

export const env: BotEnv = Object.freeze({
  nodeEnv,
  isProd: nodeEnv !== "development" && nodeEnv !== "test",
  token: str("DISCORD_BOT_TOKEN"),
  apiBaseUrl: str("API_BASE_URL", `http://127.0.0.1:${activePort}`).replace(/\/$/, ""),
  adminApiKey: str("ADMIN_API_KEY", "dev-admin-key"),
  commandAdminIds: Object.freeze(parseDiscordIdList(rawCommandAdminIds)),
  devGuildId: str("DEV_GUILD_ID") || undefined,
});

export const validateApiBaseUrl = (value: string, production: boolean): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return "API_BASE_URL must be a valid absolute URL.";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "API_BASE_URL must use HTTP or HTTPS.";
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") {
    return "API_BASE_URL must be an origin without credentials, path, query or fragment.";
  }
  if (production && parsed.protocol !== "https:") {
    return "API_BASE_URL must use HTTPS outside local development and tests because the bot sends ADMIN_API_KEY.";
  }
  return null;
};

export const validateEnv = (): string[] => {
  const errors: string[] = [];

  const apiUrlError = validateApiBaseUrl(env.apiBaseUrl, env.isProd);
  if (apiUrlError) errors.push(apiUrlError);

  if (!env.token) {
    errors.push("DISCORD_BOT_TOKEN is not set  the gateway worker cannot log in.");
  }
  if (env.isProd && env.adminApiKey === "dev-admin-key") {
    errors.push("ADMIN_API_KEY is still the development default. Change it before deploying.");
  }
  if (env.isProd && env.adminApiKey.length < 32) {
    errors.push("ADMIN_API_KEY must contain at least 32 characters outside local development and tests.");
  }
  const invalidCommandAdminIds = rawCommandAdminIds
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id && !/^\d{17,20}$/.test(id));
  if (invalidCommandAdminIds.length > 0) {
    errors.push("BOT_COMMAND_ADMIN_IDS must contain only valid 17–20 digit Discord user IDs.");
  }

  return errors;
};