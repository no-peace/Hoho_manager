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
let lastCacheAttempt = 0;
let cacheRefresh: Promise<void> | null = null;
const CACHE_REFRESH_FAILURE_BACKOFF_MS = 30_000;
const refreshingChannels = new Set<string>();

export const refreshStickyCache = async (): Promise<void> => {
  if (cacheRefresh) return cacheRefresh;
  if (lastCacheRefresh < lastCacheAttempt && Date.now() - lastCacheAttempt < CACHE_REFRESH_FAILURE_BACKOFF_MS) return;
  cacheRefresh = (async () => {
    try {
      const response = await fetch(`${env.apiBaseUrl}/api/automation/sticky/active`, {
        headers: { "x-admin-key": env.adminApiKey },
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        const status = response.status;
        await response.body?.cancel().catch(() => undefined);
        throw new Error(`API returned ${status}`);
      }
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
      lastCacheAttempt = Date.now();
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

    if (
      Date.now() - lastCacheRefresh > 60_000 &&
      Date.now() - lastCacheAttempt >= CACHE_REFRESH_FAILURE_BACKOFF_MS
    ) {
      void refreshStickyCache();
    }

    const sticky = stickyChannels.get(message.channelId);
    if (!sticky) return;
    sticky.count += 1;
    if (sticky.count < Math.max(5, sticky.interval)) return;

    if (refreshingChannels.has(message.channelId)) return;
    sticky.count = 0;
    refreshingChannels.add(message.channelId);
    void (async () => {
      try {
        const response = await fetch(`${env.apiBaseUrl}/api/automation/sticky/${encodeURIComponent(message.channelId)}/refresh`, {
          method: "POST",
          headers: { "x-admin-key": env.adminApiKey },
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) {
          const detail = await response.text();
          throw new Error(`API returned ${response.status}: ${detail}`);
        }
        const result = await response.json() as { messageId?: string };
        const currentSticky = stickyChannels.get(message.channelId);
        if (currentSticky) {
          currentSticky.currentMessageId = result.messageId ?? currentSticky.currentMessageId;
        }
      } catch (error) {
        console.warn(`[sticky] Could not refresh sticky message in ${message.channelId}:`, error);
      } finally {
        refreshingChannels.delete(message.channelId);
      }
    })();
  }
}
