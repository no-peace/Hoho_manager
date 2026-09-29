import { fileURLToPath } from "node:url";
import { SapphireClient } from "@sapphire/framework";
import { GatewayIntentBits } from "discord.js";
import { env, validateEnv } from "./lib/env.js";


/**
 * Gateway worker entry point.
 *
 * Sapphire scans `commands/` and `listeners/` **relative to this file**, so
 * `baseUserDirectory` is derived from the module URL rather than hardcoded. That
 * makes the same code work under `tsx watch src/index.ts` (dir = `src`) and under
 * `node dist/index.js` (dir = `dist`), with no build-specific branching.
 *
 * See https://sapphirejs.dev/docs/Guide/getting-started/getting-started-with-sapphire/
 *
 * ── Scope ─────────────────────────────────────────────────────────────────────
 * Discord delivers button/select/modal interactions over HTTP to
 * `POST /api/interactions`, which the Express server already handles — a gateway
 * connection is *not* required for the action system to work. This worker exists
 * for the things only a persistent connection can do: slash commands, presence,
 * and (with the extra intents below) member/reaction events.
 */
const baseUserDirectory = fileURLToPath(new URL(".", import.meta.url));

const errors = validateEnv();
if (errors.length > 0) {
  for (const error of errors) console.error(`[config] ${error}`);
  if (!env.token) process.exit(1);
}

const client = new SapphireClient({
  baseUserDirectory,
  // `Guilds` is all slash commands need. Member/reaction features would also
  // require `GuildMembers` / `GuildMessageReactions` — both *privileged*, so
  // they must be switched on under "Privileged Gateway Intents" in the Developer
  // Portal first, and the bot will fail to log in if it asks for an intent that
  // is not enabled there.
  intents: [GatewayIntentBits.Guilds],
});

/**
 * Close the gateway politely, then let Node exit on its own.
 *
 * `process.exit()` is deliberately avoided here and below: calling it while
 * libuv is still closing handles trips an assertion on Windows
 * (`UV_HANDLE_CLOSING` in async.c). Setting `exitCode` and returning lets normal
 * shutdown finish, and PM2's `kill_timeout` covers anything that refuses to end.
 */
const shutdown = async (signal: string): Promise<void> => {
  console.log(`[bot] ${signal} received — shutting down`);
  await client.destroy().catch(() => undefined);
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

client
  .login(env.token)
  .then(() => {
    console.log(`[bot] logged in as ${client.user?.tag ?? "unknown"}`);
    console.log(`[bot] API base: ${env.apiBaseUrl}`);
  })
  .catch(async (error: unknown) => {
    console.error("[bot] login failed:", error instanceof Error ? error.message : error);
    // Tear down before exiting so no gateway/REST handles are left mid-close.
    await client.destroy().catch(() => undefined);
    process.exitCode = 1;
  });
