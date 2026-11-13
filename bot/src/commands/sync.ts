import { Command } from "@sapphire/framework";
import { MessageFlags } from "discord.js";
import { api } from "../lib/api.js";
import { commandRegistration } from "../lib/registration.js";

export class SyncCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, {
      ...options,
      name: "sync",
      description: "Synchronize and update all tracked messages across channels",
    });
  }

  public override registerApplicationCommands(registry: Command.Registry) {
    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName(this.name)
          .setDescription(this.description),
      commandRegistration,
    );
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ) {
    const { checkCommandCooldown } = await import("../lib/commandCooldown.js");
    const waitSec = checkCommandCooldown("sync", interaction.user.id, 10);
    if (waitSec > 0) {
      return interaction.reply({
        content: `⏳ Please wait **${waitSec}s** before running `/sync` again.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const result = await api.syncTrackedMessages();

      await interaction.editReply({
        content: `🔄 **Tracked Messages Synchronized**\n• Checked: **${result.checked}**\n• Updated: **${result.updated}**\n• Removed: **${result.removed}**${result.errors > 0 ? `\n• Errors: **${result.errors}**` : ""}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await interaction.editReply({
        content: `❌ Synchronization failed: ${msg}`,
      });
    }
  }
}
