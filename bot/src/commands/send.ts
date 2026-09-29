import { Command } from "@sapphire/framework";
import { ChannelType, MessageFlags } from "discord.js";
import api from "../lib/api.js";
import { commandRegistration } from "../lib/registration.js";

/**
 * `/send` — post a message as the bot, through the builder's own API.
 *
 * Why route through the API instead of calling Discord directly? The API owns the
 * bot token, the payload validation and the audit log. Sending from here would
 * duplicate all three and put a second copy of the token on disk.
 */
export class SendCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, { ...options, description: "Send a message as the bot." });
  }

  public override registerApplicationCommands(registry: Command.Registry): void {
    registry.registerChatInputCommand(
      (builder) =>
        builder
          .setName("send")
          .setDescription("Send a message as the bot.")
          .addChannelOption((option) =>
            option
              .setName("channel")
              .setDescription("Where to post the message.")
              .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
              .setRequired(true),
          )
          .addStringOption((option) =>
            option
              .setName("message")
              .setDescription("Message content. Markdown is supported.")
              .setMaxLength(2000)
              .setRequired(true),
          ),
      commandRegistration,
    );
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ): Promise<void> {
    const channel = interaction.options.getChannel("channel", true);
    const message = interaction.options.getString("message", true);

    // Defer first: the API round trip can exceed Discord's 3-second ack window.
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      await api.sendMessage({ content: message, channelId: channel.id });
      await interaction.editReply(`\u2705 Sent to <#${channel.id}>.`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await interaction.editReply(`\u26a0\ufe0f Could not send:\n${reason}`);
    }
  }
}
