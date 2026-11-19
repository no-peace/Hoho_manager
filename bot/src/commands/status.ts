import { Command } from "@sapphire/framework";
import { MessageFlags } from "discord.js";
import api from "../lib/api.js";
import { commandRegistration } from "../lib/registration.js";
import { BOT_COMMAND_ADMIN_DENIED_MESSAGE, isBotCommandAdmin } from "../lib/commandPermissions.js";
import { checkCommandCooldown } from "../lib/commandCooldown.js";

/**
 * `/status`  shows whether the API and its Discord integrations are configured.
 *
 * This is the pattern for the worker's real purpose: the webhook/interaction
 * machinery lives in the Express API, and the gateway reads it over HTTP rather
 * than reaching into the database itself.
 */
export class StatusCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, { ...options, description: "Report API and integration health." });
  }

  public override registerApplicationCommands(registry: Command.Registry): void {
    registry.registerChatInputCommand(
      (builder) =>
        builder.setName("status").setDescription("Report API and integration health."),
      commandRegistration,
    );
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ): Promise<void> {
    if (!isBotCommandAdmin(interaction.user.id)) {
      await interaction.reply({ content: BOT_COMMAND_ADMIN_DENIED_MESSAGE, flags: MessageFlags.Ephemeral });
      return;
    }
    const waitSec = checkCommandCooldown("status", interaction.user.id, 15);
    if (waitSec > 0) {
      await interaction.reply({ content: `Please wait ${waitSec}s before running /status again.`, flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const health = await api.health();

      const line = (label: string, ok: boolean): string =>
        `> ${ok ? "✅" : "❌"} ${label}`;

      const statusBadge = health.status === "ok" ? "🟢 Operational" : "🟡 Degraded";
      const body = [
        `### 🛠️ HoHo Manager System Status — ${statusBadge}`,
        `**API** • **${health.status}**`,
        line("Database connected", health.database.connected),
        line("Bot token configured", health.discord.botTokenConfigured),
        line("Public key configured", health.discord.publicKeyConfigured),
        line("Application id configured", health.discord.applicationIdConfigured),
        `_Uptime: ${Math.round(health.uptimeSeconds)}s_`,
      ].join("\n");

      await interaction.editReply(body);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await interaction.editReply(`\u26a0\ufe0f ${reason}`);
    }
  }
}
