import { InteractionResponseType, InteractionType } from "@dmb/shared";
import type { DiscordInteraction, InteractionResponse } from "@dmb/shared";
import { ephemeral } from "../actions/responses.js";
import { executeCustomId } from "./actionExecutor.js";
import { logger } from "../utils/logger.js";

const log = logger.child("interactions");

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

  const customId = interaction.data?.custom_id;

  try {
    if (customId) {
      const { response, handled } = await executeCustomId(customId, interaction);

      if (response) return response;

      if (handled) {
        // The chain ran but produced no visible output — acknowledge quietly.
        //
        // Which "quiet" is valid depends on the interaction: "update the message
        // with no changes" only exists for components on a message, and Discord
        // rejects it for a modal submit, which must answer with a channel
        // response instead.
        return {
          type:
            interaction.type === InteractionType.MessageComponent
              ? InteractionResponseType.DeferredUpdateMessage
              : InteractionResponseType.DeferredChannelMessageWithSource,
        };
      }

      log.warn(
        `Ignoring unrecognised custom_id from ${interaction.user?.id ?? "?"}: ${customId}`,
      );
      return ephemeral("This component isn't wired up to an action.");
    }

    // Interaction types we receive but don't act on yet (e.g. an application
    // command). Defer so Discord doesn't time us out.
    log.debug(`Unhandled interaction type ${interaction.type}`);
    return { type: InteractionResponseType.DeferredChannelMessageWithSource };
  } catch (error) {
    // Never let an exception surface as a timeout — Discord would retry and the
    // user would just see "interaction failed".
    const reason = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    log.error(`Failed to handle interaction ${interaction.id}: ${reason}`, stack);
    return ephemeral("\u26a0\ufe0f Something went wrong handling that interaction.");
  }
};

export default handleInteraction;
