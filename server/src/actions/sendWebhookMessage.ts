import type { ActionType } from "@dmb/shared";
import { actionFailed, ephemeral } from "./responses.js";
import {
  configNumber,
  configString,
  toMessagePayload,
  type ActionContext,
  type ActionResponse,
} from "./types.js";

export const type: ActionType = "send_webhook_message";
export const description = "Send a message through a saved webhook";

/**
 * Posts through a stored webhook profile, or a raw URL when supplied.
 *
 * Prefer a profile id: webhook URLs are credentials, so keeping them in the
 * database avoids embedding one in a `custom_id`.
 */
export const run = async ({
  config,
  discord,
  repositories,
  logger,
}: ActionContext): Promise<ActionResponse | undefined> => {
  const payload =
    toMessagePayload(config.message) ??
    (configString(config, "content") ? { content: configString(config, "content") } : null);

  if (!payload) return actionFailed("No message content configured.");

  let url = configString(config, "webhookUrl");
  const profileId = configNumber(config, "webhookProfileId");

  if (!url && profileId != null) {
    const profile = await repositories.webhookProfiles.findById(profileId);
    url = profile?.url;
  }

  if (!url) return actionFailed("No webhook configured for this action.");

  try {
    await discord.sendWebhook(url, payload, { wait: false });
    return ephemeral("\ud83d\udce8 Sent.");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn(`send_webhook_message failed: ${reason}`);
    return actionFailed("I couldn't send through that webhook.");
  }
};

export default run;
