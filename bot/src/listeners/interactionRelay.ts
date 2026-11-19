// bot/src/listeners/interactionRelay.ts
import { Listener } from "@sapphire/framework";
import { InteractionResponseType, MessageFlags, Routes } from "discord.js";
import { env } from "../lib/env.js";

export class RawInteractionRelay extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, {
      ...options,
      event: "raw",
    });
  }

  public async run(packet: any) {
    if (packet.t !== "INTERACTION_CREATE") return;

    const rawInteraction = packet.d;

    // Only relay MessageComponent (3) and ModalSubmit (5) to the Express action engine.
    // Slash commands (2) and Autocomplete (4) are handled in-process by Sapphire.
    if (rawInteraction?.type !== 3 && rawInteraction?.type !== 5) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2_600);

    try {
      const res = await fetch(`${env.apiBaseUrl}/api/interactions/relay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": env.adminApiKey,
        },
        body: JSON.stringify(rawInteraction, (_, v) =>
          typeof v === "bigint" ? v.toString() : v,
        ),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text();
        this.container.logger.warn(`API rejected relay: ${res.status} - ${text}`);
        await this.sendFallbackResponse(rawInteraction);
      } else {
        await res.body?.cancel().catch(() => undefined);
        this.container.logger.info("Successfully relayed component/modal interaction to API.");
      }
    } catch (error) {
      this.container.logger.error(`Failed to reach the API at ${env.apiBaseUrl}`, error);
      await this.sendFallbackResponse(rawInteraction);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Dispatches an ephemeral error callback to Discord before the 3,000ms deadline expires
   * when the central Express API fails to answer or times out.
   */
  private async sendFallbackResponse(rawInteraction: any): Promise<void> {
    if (!rawInteraction?.id || !rawInteraction?.token) return;

    try {
      await this.container.client.rest.post(
        Routes.interactionCallback(rawInteraction.id, rawInteraction.token),
        {
          body: {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content:
                "⚠️ The action service is temporarily unavailable. Please try again later.",
              flags: MessageFlags.Ephemeral,
            },
          },
          auth: false,
        },
      );
      this.container.logger.info(
        `Dispatched fallback ephemeral error response for interaction ${rawInteraction.id}`,
      );
    } catch (fallbackError) {
      this.container.logger.error(
        `Failed to send fallback response to Discord for interaction ${rawInteraction.id}:`,
        fallbackError,
      );
    }
  }
}