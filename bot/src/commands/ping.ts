import { Command } from "@sapphire/framework";
import { commandRegistration } from "../lib/registration.js";

/**
 * `/ping` — the smallest useful Sapphire command.
 *
 * Kept as a reference for the shape of every command in this worker:
 *   - the constructor supplies metadata,
 *   - `registerApplicationCommands` declares the Discord-side schema,
 *   - `chatInputRun` is the handler.
 */
export class PingCommand extends Command {
  public constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, { ...options, description: "Check that the bot is alive." });
  }

  public override registerApplicationCommands(registry: Command.Registry): void {
    registry.registerChatInputCommand(
      (builder) => builder.setName("ping").setDescription("Check that the bot is alive."),
      commandRegistration,
    );
  }

  public override async chatInputRun(
    interaction: Command.ChatInputCommandInteraction,
  ): Promise<void> {
    const started = Date.now();
    await interaction.reply("Pong!");
    const roundTrip = Date.now() - started;
    const gateway = Math.round(this.container.client.ws.ping);

    await interaction.editReply(`Pong! Round trip **${roundTrip}ms** · gateway **${gateway}ms**`);
  }
}
