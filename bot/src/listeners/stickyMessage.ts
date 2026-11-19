import { Listener } from "@sapphire/framework";
import { Events, type Message } from "discord.js";
import { env } from "../lib/env.js";

interface StickyChannel {
  channelId: string;
  interval: number;
  currentMessageId: string | null;
}

const stickyChannels = new Map<string, StickyChannel & { count: number }>();
let lastCacheRefresh = 0;
let cacheRefresh: Promise<void> | null = null;

const refreshStickyCache = async (): Promise<void> => {
  if (cacheRefresh) return cacheRefresh;
  cacheRefresh = (async () => {
    try {
      const response = await fetch(`${env.apiBaseUrl}/api/automation/sticky/active`, {
        headers: { "x-admin-key": env.adminApiKey },
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw new Error(`API returned ${response.status}`);
      const rows = await response.json() as StickyChannel[];
      const next = new Map<string, StickyChannel & { count: number }>();
      for (const row of rows) {
        const previous = stickyChannels.get(row.channelId);
        next.set(row.channelId, { ...row, count: previous?.count ?? 0 });
      }
      stickyChannels.clear();
      next.forEach((value, key) => stickyChannels.set(key, value));
      lastCacheRefresh = Date.now();
    } catch (error) {
      console.warn("[sticky] Could not refresh sticky-message cache:", error);
    } finally {
      cacheRefresh = null;
    }
  })();
  return cacheRefresh;
};

export class StickyMessageListener extends Listener {
  public constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.MessageCreate });
  }

  public override run(...args: unknown[]): void {
    const message = args[0] as Message;
    if (!message || message.author?.bot || !message.guildId || !message.channelId) return;

    if (Date.now() - lastCacheRefresh > 60_000) {
      void refreshStickyCache();
    }

    const sticky = stickyChannels.get(message.channelId);
    if (!sticky) return;
    sticky.count += 1;
    if (sticky.count < Math.max(5, sticky.interval)) return;

    sticky.count = 0;
    void fetch(`${env.apiBaseUrl}/api/automation/sticky/${encodeURIComponent(message.channelId)}/refresh`, {
      method: "POST",
      headers: { "x-admin-key": env.adminApiKey },
      signal: AbortSignal.timeout(8_000),
    }).then(async (response) => {
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`API returned ${response.status}: ${detail}`);
      }
      const result = await response.json() as { messageId?: string };
      sticky.currentMessageId = result.messageId ?? sticky.currentMessageId;
    }).catch((error) => {
      console.warn(`[sticky] Could not refresh sticky message in ${message.channelId}:`, error);
    });
  }
}
