import { Command } from "@sapphire/framework";
import {
  ActionRowBuilder,
  ApplicationCommandType,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type MessageContextMenuCommandInteraction,
} from "discord.js";
import { commandRegistration } from "../lib/registration.js";
import { env } from "../lib/env.js";

export class RestoreToStudioCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, { ...options, name: "Edit in HoHo Studio" });
  }

  public override registerApplicationCommands(registry: Command.Registry): void {
    registry.registerContextMenuCommand(
      (builder) => builder
        .setName("Edit in HoHo Studio")
        .setType(ApplicationCommandType.Message),
      commandRegistration,
    );
  }

  public override async contextMenuRun(
    interaction: MessageContextMenuCommandInteraction,
  ): Promise<void> {
    if (!env.commandAdminIds.includes(interaction.user.id)) {
      await interaction.reply({
        content: "This Studio restore action is restricted to configured bot command admins.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    let restoreUrl: URL;
    try {
      restoreUrl = new URL("/", env.clientOrigin);
    } catch {
      await interaction.reply({
        content: "The Studio client URL is not configured correctly. Contact a bot administrator.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    restoreUrl.searchParams.set("importChannel", interaction.targetMessage.channelId);
    restoreUrl.searchParams.set("importMessage", interaction.targetMessage.id);

    const button = new ButtonBuilder()
      .setLabel("Restore to HoHo Studio")
      .setStyle(ButtonStyle.Link)
      .setURL(restoreUrl.toString());

    await interaction.reply({
      content: "Open HoHo Studio to restore this Discord message into the editor.",
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
      flags: MessageFlags.Ephemeral,
    });
  }
}
