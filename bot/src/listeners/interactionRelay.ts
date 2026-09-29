import { Listener } from "@sapphire/framework";
import { Events, MessageFlags, type Interaction } from "discord.js";
import api from "../lib/api.js";
import { env } from "../lib/env.js";

/**
 * The bridge that makes button clicks work without a public URL.
 *
 * Discord delivers interactions in one of two mutually exclusive ways, decided by
 * whether the application has an *Interactions Endpoint URL*:
 *
 *   - **URL set** (laptop + Cloudflare Tunnel): Discord POSTs to the API
 *     directly, and this listener never fires.
 *   - **No URL** (the Pterodactyl server, which has no tunnel): Discord sends
 *     `INTERACTION_CREATE` down the gateway — an *outbound* WebSocket, so no
 *     inbound port is needed — and this listener forwards the payload to the API
 *     over localhost.
 *
 * The API then executes the flow and posts the reply to Discord itself using the
 * interaction token, which is the same mechanism the webhook path uses. So this
 * listener sends nothing back to Discord on the happy path; it only reports
 * whether the reply landed.
 *
 * Slash commands are deliberately **not** relayed — Sapphire's own command
 * handlers own those, and they live in this process.
 */
export class InteractionRelayListener extends Listener<Events.InteractionCreate> {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.InteractionCreate });
  }

  public override async run(interaction: Interaction): Promise<void> {
    if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) return;

    try {
      const result = await api.relayInteraction(interaction.toJSON());
      if (!result.ok) {
        await this.replyWithError(interaction, "The API could not deliver a reply.");
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      // Reaching here means the API never answered, so nothing has been sent to
      // Discord yet — answering in-process is safe and gives the user a real
      // message instead of "This interaction failed".
      this.container.logger.error(`[bot] interaction relay failed: ${reason}`);
      await this.replyWithError(interaction, reason);
    }
  }

  /** Best-effort apology. A timeout or an already-acknowledged reply is unrecoverable. */
  private async replyWithError(
    interaction: Interaction,
    reason: string,
  ): Promise<void> {
    if (!interaction.isRepliable()) return;

    const content = `\u26a0\ufe0f ${reason}\n_Tried to reach the API at \`${env.apiBaseUrl}\`._`;

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      }
    } catch {
      // Discord has already given up on this interaction (3-second window).
      // There is nothing left to say to the user.
    }
  }
}
