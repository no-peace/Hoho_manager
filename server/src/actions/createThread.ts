import type { ActionType } from "@dmb/shared";
import { actionFailed, ephemeral } from "./responses.js";
import { configString, type ActionContext, type ActionResponse } from "./types.js";

export const type: ActionType = "create_thread";
export const description = "Start a thread from the message";

/**
 * Opens a thread on the message that carried the clicked component.
 *
 * The thread name comes from `config.name`; `{{user}}` and `{{user.tag}}` are
 * substituted with the clicker's name, which is the common use ("ticket – alice").
 * Requires the bot to have **Create Public Threads** in the channel.
 */
export const run = async ({
  interaction,
  config,
  botToken,
  discord,
  logger,
}: ActionContext): Promise<ActionResponse | undefined> => {
  const rawName = configString(config, "name") ?? "Thread";
  const channelId = interaction.channel_id;
  const messageId = interaction.message?.id;
  const user = interaction.member?.user ?? interaction.user;

  if (!channelId || !messageId) {
    return actionFailed("I couldn't find the message to thread from.");
  }
  if (!botToken) return actionFailed("The bot isn't configured on the server.");

  const name = rawName
    .replace(/\{\{\s*user\.tag\s*\}\}/g, user?.username ?? "user")
    .replace(/\{\{\s*user(?:\.name)?\s*\}\}/g, user?.global_name ?? user?.username ?? "user")
    .slice(0, 100);

  try {
    const thread = await discord.createThreadFromMessage(channelId, messageId, name, botToken);
    return ephemeral(
      thread?.id ? `\ud83e\uddf5 Started <#${thread.id}>.` : "\ud83e\uddf5 Thread started.",
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn(`create_thread failed in ${channelId}: ${reason}`);
    return actionFailed("I couldn't start a thread — check my permissions here.");
  }
};

export default run;
