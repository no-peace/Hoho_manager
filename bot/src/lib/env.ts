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
  readonly devGuildId: string | undefined;
}

export const env: BotEnv = Object.freeze({
  nodeEnv,
  isProd: nodeEnv === "production",
  token: str("DISCORD_BOT_TOKEN"),
  apiBaseUrl: str("API_BASE_URL", `http://127.0.0.1:${activePort}`).replace(/\/$/, ""),
  adminApiKey: str("ADMIN_API_KEY", "dev-admin-key"),
  devGuildId: str("DEV_GUILD_ID") || undefined,
});

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