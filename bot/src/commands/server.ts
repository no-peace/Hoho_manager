import { Command } from "@sapphire/framework";
import { MessageFlags } from "discord.js";
import { commandRegistration } from "../lib/registration.js";

/**
 * `/server` — status of the server the command was run in.
 *
 * The gateway is the only place this information exists: it arrives over the
 * WebSocket as guild cache, so the API cannot answer it. Kept ephemeral so a
 * status check does not clutter the channel.
 *
 * `Guilds` is the only intent this needs — `memberCount` is the *approximate*
 * count Discord ships with the guild object, so the privileged `GuildMembers`
 * intent stays switched off.
 */

const BOOST_TIERS = ["None", "Tier 1", "Tier 2", "Tier 3"] as const;

export class ServerCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, { ...options, description: "Show status information about this server." });
  }

  public override registerApplicationCommands(registry: Command.Registry): void {
    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName("server")
          .setDescription("Show status information about this server."),
      commandRegistration,
    );
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ): Promise<void> {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        content: "\u26a0\ufe0f This command only works inside a server.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const { guild } = interaction;

    const body = [
      `**${guild.name}**`,
      `\u2022 ID: \`${guild.id}\``,
      `\u2022 Members: ${guild.memberCount}`,
      `\u2022 Channels: ${guild.channels.cache.size}`,
      `\u2022 Roles: ${guild.roles.cache.size}`,
      `\u2022 Boost: ${BOOST_TIERS[guild.premiumTier] ?? "Unknown"}`,
      `\u2022 Owner: <@${guild.ownerId}>`,
      `\u2022 Created: <t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
      `_Gateway latency: ${Math.round(this.container.client.ws.ping)}ms_`,
    ].join("\n");

    await interaction.reply({ content: body, flags: MessageFlags.Ephemeral });
  }
}
