import { env } from "./env.js";

/**
 * Where Sapphire should register application commands.
 *
 * Global registration can take up to an hour to propagate, which makes iterating
 * on a command painful. Setting `DEV_GUILD_ID` scopes registration to a single
 * guild, where changes appear immediately. Leave it unset in production so the
 * commands are available everywhere the bot is installed.
 *
 * Typed by inference on purpose: the value is passed straight to
 * `registry.registerChatInputCommand(...)`, so Sapphire's own option shape
 * validates it — no need to re-export their type here.
 */
export const commandRegistration = env.devGuildId
  ? { guildIds: [env.devGuildId] }
  : undefined;
