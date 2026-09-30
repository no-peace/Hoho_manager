import { Listener } from '@sapphire/framework';
import { env } from '../lib/env.js';

export class RawInteractionRelay extends Listener {
  public constructor(context: Listener.Context, options: Listener.Options) {
    // Omitting 'emitter' safely defaults to the standard Discord client
    super(context, {
      ...options,
      event: 'raw' 
    });
  }

  public async run(packet: any) {
    if (packet.t !== 'INTERACTION_CREATE') return;

    const rawInteraction = packet.d;

    try {
      // Using the strictly-typed camelCase properties from your env.ts
      const res = await fetch(`${env.apiBaseUrl}/api/interactions/relay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': env.adminApiKey,
        },
        // Safely convert BigInts to strings so Express doesn't crash
        body: JSON.stringify(rawInteraction, (_, v) => typeof v === 'bigint' ? v.toString() : v)
      });

      if (!res.ok) {
        const text = await res.text();
        this.container.logger.warn(`API rejected relay: ${res.status} - ${text}`);
      } else {
        this.container.logger.info(`✅ Successfully relayed button click to API!`);
      }
    } catch (error) {
      this.container.logger.error(`Failed to reach the API at ${env.apiBaseUrl}`, error);
    }
  }
}