import type { ActionType } from "@dmb/shared";
import { acknowledge, actionFailed } from "./responses.js";
import { configString, type ActionContext, type ActionResponse } from "./types.js";

export const type: ActionType = "delete_message";
export const description = "Delete the message carrying the component";

export const run = async ({
  interaction,
  config,
  botToken,
  discord,
  logger,
}: ActionContext): Promise<ActionResponse | undefined> => {
  const channelId = interaction.channel_id;
  const messageId = configString(config, "messageId") ?? interaction.message?.id;

  if (!messageId || !channelId) return actionFailed("Nothing to delete.");
  if (!botToken) return actionFailed("The bot isn't configured on the server.");

  try {
    await discord.deleteChannelMessage(channelId, messageId, botToken);
    // The message is gone, so a normal reply would reference nothing.
    return acknowledge();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn(`delete_message failed for ${messageId}: ${reason}`);
    return actionFailed("I couldn't delete that message.");
  }
};

export default run;
