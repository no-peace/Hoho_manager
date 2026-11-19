// client/src/store/discordCacheStore.ts
import { create } from "zustand";
import api, { request } from "../api/client";

export interface DiscordEmoji {
  id: string;
  name: string;
  animated?: boolean;
  available?: boolean;
}

export interface WeaoExploitItem {
  _id: string;
  title: string;
  version: string;
  updatedDate: string;
  uncStatus: boolean;
  free: boolean;
  detected: boolean;
  rbxversion: string;
  updateStatus: boolean;
  websitelink?: string;
  discordlink?: string;
  purchaselink?: string;
  platform?: string;
  cost?: string;
  decompiler?: boolean;
  multiInject?: boolean;
  suncPercentage?: number;
  uncPercentage?: number;
  keysystem?: boolean;
  sunc?: {
    suncScrap?: string;
    suncKey?: string;
  };
}

export interface WeaoMetaInfo {
  rateLimited: boolean;
  rateLimitedUntilMs: number;
  cachedCount: number;
  cacheAgeMs: number | null;
  stale?: boolean;
}

const WEAO_STORAGE_KEY = "hoho_weao_exploits_cache";
const GUILD_CACHE_TTL_MS = 5 * 60_000;
const WEAO_CLIENT_TTL_MS = 15 * 60_000;
const MAX_GUILD_CACHE_ENTRIES = 50;
let cacheGeneration = 0;
let guildsFetchedAt = 0;
let weaoLastFetchedAt = 0;
const channelsFetchedAt = new Map<string, number>();
const rolesFetchedAt = new Map<string, number>();
const emojisFetchedAt = new Map<string, number>();
const setFetchedAt = (cache: Map<string, number>, key: string): void => {
  cache.delete(key);
  if (cache.size >= MAX_GUILD_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, Date.now());
};
let inFlightWeaoPromise: Promise<void> | null = null;
let inFlightGuildsPromise: Promise<void> | null = null;
const inFlightChannelsMap = new Map<string, Promise<void>>();
const inFlightRolesMap = new Map<string, Promise<void>>();
const inFlightEmojisMap = new Map<string, Promise<void>>();

const loadCachedWeaoExploits = (): { exploits: WeaoExploitItem[]; fetchedAt: number } => {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(WEAO_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return { exploits: parsed, fetchedAt: 0 };
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.exploits)) {
          const fetchedAt = Number(parsed.fetchedAt);
          return { exploits: parsed.exploits as WeaoExploitItem[], fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : 0 };
        }
      }
    }
  } catch {
    // Ignore localStorage parse errors
  }
  return { exploits: [], fetchedAt: 0 };
};

const cachedWeao = loadCachedWeaoExploits();
weaoLastFetchedAt = cachedWeao.fetchedAt;

interface DiscordCacheState {
  guilds: { id: string; name: string; icon: string | null }[] | null;
  channels: Record<string, { id: string; name: string; type: number; parent_id?: string | null }[]>;
  roles: Record<string, { id: string; name: string; color: number }[]>;
  emojis: Record<string, DiscordEmoji[]>;
  weaoExploits: WeaoExploitItem[];
  weaoMeta: WeaoMetaInfo | null;
  weaoError: string | null;
  discordError: string | null;
  clearCache: () => void;
  fetchGuilds: () => Promise<void>;
  fetchChannels: (guildId: string) => Promise<void>;
  fetchRoles: (guildId: string) => Promise<void>;
  fetchEmojis: (guildId: string) => Promise<void>;
  fetchWeaoExploits: (force?: boolean) => Promise<void>;
}

export const useDiscordCacheStore = create<DiscordCacheState>((set, get) => ({
  guilds: null,
  channels: {},
  roles: {},
  emojis: {},
  weaoExploits: cachedWeao.exploits,
  weaoMeta: null,
  weaoError: null,
  discordError: null,

  clearCache: () => {
    cacheGeneration += 1;
    guildsFetchedAt = 0;
    weaoLastFetchedAt = 0;
    channelsFetchedAt.clear();
    rolesFetchedAt.clear();
    emojisFetchedAt.clear();
    inFlightWeaoPromise = null;
    inFlightGuildsPromise = null;
    inFlightChannelsMap.clear();
    inFlightRolesMap.clear();
    inFlightEmojisMap.clear();
    try { if (typeof localStorage !== "undefined") localStorage.removeItem(WEAO_STORAGE_KEY); } catch { /* Ignore storage errors. */ }
    set({ guilds: null, channels: {}, roles: {}, emojis: {}, weaoExploits: [], weaoMeta: null, weaoError: null, discordError: null });
  },

  fetchGuilds: async () => {
    if (get().guilds && Date.now() - guildsFetchedAt < GUILD_CACHE_TTL_MS) return;
    if (inFlightGuildsPromise) return inFlightGuildsPromise;
    const generation = cacheGeneration;
    inFlightGuildsPromise = (async () => {
      try {
        const { guilds } = await api.discord.guilds();
        if (generation !== cacheGeneration) return;
        guildsFetchedAt = Date.now();
        set({ guilds, discordError: null });
      } catch (error) {
        if (generation === cacheGeneration) set({ discordError: error instanceof Error ? error.message : "Could not load Discord servers." });
      } finally {
        inFlightGuildsPromise = null;
      }
    })();
    return inFlightGuildsPromise;
  },

  fetchChannels: async (guildId: string) => {
    if (get().channels[guildId] && Date.now() - (channelsFetchedAt.get(guildId) ?? 0) < GUILD_CACHE_TTL_MS) return;
    const existing = inFlightChannelsMap.get(guildId);
    if (existing) return existing;
    const generation = cacheGeneration;
    const promise = (async () => {
      try {
        const { channels } = await api.discord.channels(guildId);
        if (generation !== cacheGeneration) return;
        setFetchedAt(channelsFetchedAt, guildId);
        set((state) => ({ channels: { ...state.channels, [guildId]: channels }, discordError: null }));
      } catch (error) {
        if (generation === cacheGeneration) set({ discordError: error instanceof Error ? error.message : "Could not load Discord channels." });
      } finally {
        inFlightChannelsMap.delete(guildId);
      }
    })();
    inFlightChannelsMap.set(guildId, promise);
    return promise;
  },

  fetchRoles: async (guildId: string) => {
    if (get().roles[guildId] && Date.now() - (rolesFetchedAt.get(guildId) ?? 0) < GUILD_CACHE_TTL_MS) return;
    const existing = inFlightRolesMap.get(guildId);
    if (existing) return existing;
    const generation = cacheGeneration;
    const promise = (async () => {
      try {
        const { roles } = await api.discord.roles(guildId);
        if (generation !== cacheGeneration) return;
        setFetchedAt(rolesFetchedAt, guildId);
        set((state) => ({ roles: { ...state.roles, [guildId]: roles }, discordError: null }));
      } catch (error) {
        if (generation === cacheGeneration) set({ discordError: error instanceof Error ? error.message : "Could not load Discord roles." });
      } finally {
        inFlightRolesMap.delete(guildId);
      }
    })();
    inFlightRolesMap.set(guildId, promise);
    return promise;
  },

  fetchEmojis: async (guildId: string) => {
    if (get().emojis[guildId] && Date.now() - (emojisFetchedAt.get(guildId) ?? 0) < GUILD_CACHE_TTL_MS) return;
    const existing = inFlightEmojisMap.get(guildId);
    if (existing) return existing;
    const generation = cacheGeneration;
    const promise = (async () => {
      try {
        const res = await api.discord.emojis(guildId);
        if (generation !== cacheGeneration) return;
        setFetchedAt(emojisFetchedAt, guildId);
        set((state) => ({ emojis: { ...state.emojis, [guildId]: res.emojis }, discordError: null }));
      } catch (error) {
        if (generation === cacheGeneration) set({ discordError: error instanceof Error ? error.message : "Could not load Discord emojis." });
      } finally {
        inFlightEmojisMap.delete(guildId);
      }
    })();
    inFlightEmojisMap.set(guildId, promise);
    return promise;
  },

  fetchWeaoExploits: async (force = false) => {
    const now = Date.now();
    if (
      !force &&
      get().weaoExploits.length > 0 &&
      now - weaoLastFetchedAt < WEAO_CLIENT_TTL_MS
    ) {
      return;
    }
    if (inFlightWeaoPromise) return inFlightWeaoPromise;

    inFlightWeaoPromise = (async () => {
      try {
        const generation = cacheGeneration;
        const data = await request<{
          exploits?: WeaoExploitItem[];
          meta?: WeaoMetaInfo;
        }>("/api/weao/exploits");

        if (generation !== cacheGeneration) return;
        if (Array.isArray(data?.exploits)) {
          weaoLastFetchedAt = Date.now();
          try {
            if (typeof localStorage !== "undefined") {
              localStorage.setItem(WEAO_STORAGE_KEY, JSON.stringify({ fetchedAt: weaoLastFetchedAt, exploits: data.exploits }));
            }
          } catch {
            // Ignore quota errors
          }
          set({
            weaoExploits: data.exploits,
            weaoMeta: data.meta ?? null,
            weaoError: null,
          });
        }
      } catch (err) {
        console.warn("Failed to fetch WEAO exploits:", err);
        set({
          weaoError:
            err instanceof Error ? err.message : "Unable to reach WEAO status service",
        });
      } finally {
        inFlightWeaoPromise = null;
      }
    })();

    return inFlightWeaoPromise;
  },
}));