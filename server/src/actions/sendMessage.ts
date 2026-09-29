import type { ActionType } from "@dmb/shared";
import { actionFailed, ephemeral } from "./responses.js";
import {
  configString,
  toMessagePayload,
  type ActionContext,
  type ActionResponse,
} from "./types.js";

export const type: ActionType = "send_message";
export const description = "Send a message as the bot";

/**
 * Sends a stored message payload to a channel.
 *
 * `config.message` is a raw Discord message object (content/embeds/components).
 * This runs as a follow-up rather than an interaction reply so the click can be
 * acknowledged instantly — interaction tokens stay valid for 15 minutes, which
 * is plenty for this.
 */
export const run = async ({
  interaction,
  config,
  discord,
  logger,
}: ActionContext): Promise<ActionResponse | undefined> => {
  const channelId = configString(config, "channelId") ?? interaction.channel_id;
  const payload =
    toMessagePayload(config.message) ??
    (configString(config, "content") ? { content: configString(config, "content") } : null);

  if (!channelId) return actionFailed("No target channel configured.");
  if (!payload) return actionFailed("No message content configured.");

  try {
    await discord.sendChannelMessage(channelId, payload, {});
    return ephemeral("\ud83d\udce8 Message sent.");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn(`send_message failed in ${channelId}: ${reason}`);
    return actionFailed("I couldn't send that message — check my permissions there.");
  }
};

export default run;
