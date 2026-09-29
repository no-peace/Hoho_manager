import type { ActionType, DiscordMessagePayload, EmbedData } from "@dmb/shared";
import { actionFailed, ephemeral } from "./responses.js";
import { configString, type ActionContext, type ActionResponse } from "./types.js";

export const type: ActionType = "send_dm";
export const description = "DM the member who clicked";

export const run = async ({
  interaction,
  config,
  botToken,
  discord,
  logger,
}: ActionContext): Promise<ActionResponse | undefined> => {
  const userId =
    configString(config, "userId") ??
    interaction.member?.user?.id ??
    interaction.user?.id;
  const content = configString(config, "content") ?? "Thanks for clicking!";
  const embeds = Array.isArray(config.embeds) ? config.embeds : [];

  if (!userId) return actionFailed("I couldn't work out who to message.");
  if (!botToken) return actionFailed("The bot isn't configured on the server.");

  const payload: DiscordMessagePayload = { content };
  if (embeds.length > 0) payload.embeds = embeds as EmbedData[];

  try {
    await discord.sendDirectMessage(userId, payload, botToken);
    return ephemeral("\ud83d\udcec Sent you a direct message.");
  } catch (error) {
    // The most common cause is the user's privacy settings blocking DMs.
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn(`send_dm failed for ${userId}: ${reason}`);
    return actionFailed(
      "I couldn't DM you — your privacy settings may block direct messages.",
    );
  }
};

export default run;
