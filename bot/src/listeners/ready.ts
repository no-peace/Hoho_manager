import { Listener } from "@sapphire/framework";
import { Events, type Client } from "discord.js";
import { env } from "../lib/env.js";

/**
 * Fires once when the gateway connection is established.
 *
 * Sustained `run(...args: unknown[])` rather than narrowing the parameter type:
 * Sapphire dispatches every listener through the same base signature, so a
 * narrower override would not be a valid subtype. The cast is the single place
 * where the event's real payload is recovered.
 */
export class ReadyListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, once: true, event: Events.ClientReady });
  }

  public override run(...args: unknown[]): void {
    const client = args[0] as Client<true>;

    console.log(`[bot] ready as ${client.user.tag} — ${client.guilds.cache.size} guild(s)`);
    console.log(
      env.devGuildId
        ? `[bot] application commands scoped to guild ${env.devGuildId}`
        : "[bot] application commands registered globally (may take up to an hour to appear)",
    );
  }
}
