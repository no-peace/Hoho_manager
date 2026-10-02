import { InteractionResponseType, InteractionType, MessageFlags } from "@dmb/shared";
import type { DiscordInteraction, DiscordMessagePayload, InteractionResponse } from "@dmb/shared";
import { ephemeral } from "../actions/responses.js";
import { interactionReceiptRepository } from "../repositories/index.js";
import { executeCustomId } from "./actionExecutor.js";
import * as discord from "./discordService.js";
import { logger } from "../utils/logger.js";

const log = logger.child("interactions");
const ACK_DEADLINE_MS = 2_200;
const pendingLateResponses = new Map<string, Promise<InteractionResponse>>();

const deferredResponse = (interaction: DiscordInteraction): InteractionResponse => ({
  type:
    interaction.type === InteractionType.MessageComponent
      ? InteractionResponseType.DeferredUpdateMessage
      : InteractionResponseType.DeferredChannelMessageWithSource,
});

const executeInteraction = async (
  interaction: DiscordInteraction,
): Promise<InteractionResponse> => {
  const customId = interaction.data?.custom_id;

  try {
    if (!customId) {
      log.debug(`Unhandled interaction type ${interaction.type}`);
      return { type: InteractionResponseType.DeferredChannelMessageWithSource };
    }

    const result = await executeCustomId(customId, interaction);
    if (result.response) return result.response;
    if (result.handled) return deferredResponse(interaction);

    log.warn(
      `Ignoring unrecognised custom_id from ${interaction.user?.id ?? "?"}: ${customId}`,
    );
    return ephemeral("This component isn't wired up to an action.");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    log.error(`Failed to handle interaction ${interaction.id}: ${reason}`, stack);
    return ephemeral("\u26a0\ufe0f Something went wrong handling that interaction.");
  }
};

const deliverLateResponse = async (
  interaction: DiscordInteraction,
  response: InteractionResponse,
): Promise<void> => {
  if (response.type === InteractionResponseType.ChannelMessageWithSource && response.data) {
    await discord.createFollowupMessage(
      interaction.application_id,
      interaction.token,
      response.data as DiscordMessagePayload,
    );
    return;
  }

  if (response.type === InteractionResponseType.UpdateMessage && response.data) {
    await discord.editOriginalResponse(
      interaction.application_id,
      interaction.token,
      response.data as DiscordMessagePayload,
    );
    return;
  }

  if (response.type === InteractionResponseType.Modal) {
    await discord.createFollowupMessage(interaction.application_id, interaction.token, {
      content: "This form took too long to open. Please click the component and try again.",
      flags: MessageFlags.Ephemeral,
    });
  }
};

export const completeDeferredInteraction = async (
  interaction: DiscordInteraction,
): Promise<void> => {
  const execution = pendingLateResponses.get(interaction.id);
  if (!execution) return;
  pendingLateResponses.delete(interaction.id);

  try {
    await deliverLateResponse(interaction, await execution);
  } catch (error) {
    log.error(
      `Could not deliver the late response for interaction ${interaction.id}: ${String(error)}`,
    );
  }
};

/**
 * Turn one interaction into the callback body Discord expects.
 *
 * This is the single decision point for *what* to reply, deliberately separated
 * from *how the reply is delivered*. There are two deliveries, and they must
 * behave identically:
 *
 *   1. **Webhook** — Discord POSTs to `POST /api/interactions`; the body we return
 *      here is the HTTP response, which Discord reads directly. Requires the app's
 *      Interactions Endpoint URL to be set (Cloudflare Tunnel, or any public
 *      HTTPS address).
 *   2. **Gateway relay** — the app has no public URL, so the gateway worker
 *      receives `INTERACTION_CREATE` and forwards the payload to
 *      `POST /api/interactions/relay`; we then POST this body to Discord's
 *      callback endpoint using the interaction token. See
 *      {@link file://./../routes/interactions.ts}.
 *
 * Discord gives the app **3 seconds** to reply or the user sees "This
 * interaction failed", so no path may return without an answer — including the
 * error path, which is why the catch lives here rather than in a route.
 */
export const handleInteraction = async (
  interaction: DiscordInteraction,
): Promise<InteractionResponse> => {
  // Discord's endpoint-validation handshake (webhook mode only).
  if (interaction.type === InteractionType.Ping) {
    return { type: InteractionResponseType.Pong };
  }

  let claimed: boolean;
  try {
    claimed = await interactionReceiptRepository.claim(interaction.id);
  } catch (error) {
    log.error(`Could not claim interaction ${interaction.id}: ${String(error)}`);
    return ephemeral("This interaction could not be processed safely. Please try again.");
  }

  if (!claimed) {
    try {
      const cachedResponse = await interactionReceiptRepository.getResponse(interaction.id);
      if (cachedResponse) return cachedResponse;
    } catch (error) {
      log.error(`Could not load cached response for interaction ${interaction.id}: ${String(error)}`);
    }

    log.warn(`Duplicate interaction ${interaction.id} arrived while its first delivery is running`);
    return {
      type:
        interaction.type === InteractionType.MessageComponent
          ? InteractionResponseType.DeferredUpdateMessage
          : InteractionResponseType.DeferredChannelMessageWithSource,
    };
  }

  const execution = executeInteraction(interaction);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const outcome = await Promise.race([
    execution.then((response) => ({ kind: "complete" as const, response })),
    new Promise<{ kind: "timeout" }>((resolve) => {
      timeout = setTimeout(() => resolve({ kind: "timeout" }), ACK_DEADLINE_MS);
    }),
  ]);
  if (timeout) clearTimeout(timeout);

  if (outcome.kind === "complete") {
    try {
      await interactionReceiptRepository.complete(interaction.id, outcome.response);
    } catch (error) {
      log.error(`Could not cache response for interaction ${interaction.id}: ${String(error)}`);
    }
    return outcome.response;
  }

  const deferred = deferredResponse(interaction);
  try {
    await interactionReceiptRepository.complete(interaction.id, deferred);
  } catch (error) {
    log.error(`Could not cache deferred response for interaction ${interaction.id}: ${String(error)}`);
  }

  pendingLateResponses.set(interaction.id, execution);
  return deferred;
};

export default handleInteraction;
