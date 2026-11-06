// bot/src/listeners/interactionRelay.ts
import { Listener } from "@sapphire/framework";
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
      });

      if (!res.ok) {
        const text = await res.text();
        this.container.logger.warn(`API rejected relay: ${res.status} - ${text}`);
      } else {
        this.container.logger.info("✅ Successfully relayed component/modal interaction to API!");
      }
    } catch (error) {
      this.container.logger.error(`Failed to reach the API at ${env.apiBaseUrl}`, error);
    }
  }
}