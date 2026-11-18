import { env } from "./env.js";

export const BOT_COMMAND_ADMIN_DENIED_MESSAGE =
  "This command is restricted to configured bot operators. Ask an owner to add your Discord user ID to BOT_COMMAND_ADMIN_IDS (or OWNER_DISCORD_IDS).";

export const isBotCommandAdmin = (userId: string): boolean =>
  env.commandAdminIds.includes(userId);
