import { Command } from "@sapphire/framework";
import { MessageFlags } from "discord.js";
import { api } from "../lib/api.js";
import { commandRegistration } from "../lib/registration.js";
import { BOT_COMMAND_ADMIN_DENIED_MESSAGE, isBotCommandAdmin } from "../lib/commandPermissions.js";

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
    if (!isBotCommandAdmin(interaction.user.id)) {
      await interaction.reply({
        content: BOT_COMMAND_ADMIN_DENIED_MESSAGE,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { checkCommandCooldown } = await import("../lib/commandCooldown.js");
    const waitSec = checkCommandCooldown("sync", interaction.user.id, 10);
    if (waitSec > 0) {
      return interaction.reply({
        content: "⏳ Please wait **" + waitSec + "s** before running `/sync` again.",
        flags: MessageFlags.Ephemeral,
      });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const result = await api.syncTrackedMessages();

      await interaction.editReply({
        content: [
          `🔄 **Tracked Messages Synchronized**`,
          `> • **Checked:** \`${result.checked}\` message(s)`,
          `> • **Updated:** \`${result.updated}\` message(s)`,
          `> • **Pruned / Expired:** \`${result.removed}\` message(s)`,
          ...(result.errors > 0 ? [`> • ⚠️ **Errors:** \`${result.errors}\``] : []),
        ].join("\n"),
      });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await interaction.editReply({
        content: `❌ Synchronization failed: ${msg}`,
      });
    }
  }
}
