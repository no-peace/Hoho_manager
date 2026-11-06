import { create } from "zustand";
import api from "../api/client";

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
const WEAO_CLIENT_TTL_MS = 60_000;
let weaoLastFetchedAt = 0;
let inFlightWeaoPromise: Promise<void> | null = null;

const loadCachedWeaoExploits = (): WeaoExploitItem[] => {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(WEAO_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {
    // Ignore localStorage parse errors
  }
  return [];
};

interface DiscordCacheState {
  guilds: { id: string; name: string; icon: string | null }[] | null;
  channels: Record<string, { id: string; name: string; type: number; parent_id?: string | null }[]>;
  roles: Record<string, { id: string; name: string; color: number }[]>;
  emojis: Record<string, DiscordEmoji[]>;
  weaoExploits: WeaoExploitItem[];
  weaoMeta: WeaoMetaInfo | null;
  weaoError: string | null;
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
  weaoExploits: loadCachedWeaoExploits(),
  weaoMeta: null,
  weaoError: null,

  fetchGuilds: async () => {
    if (get().guilds) return;
    try {
      const { guilds } = await api.discord.guilds();
      set({ guilds });
    } catch {
      // Ignore error
    }
  },

  fetchChannels: async (guildId: string) => {
    if (get().channels[guildId]) return;
    try {
      const { channels } = await api.discord.channels(guildId);
      set((state) => ({ channels: { ...state.channels, [guildId]: channels } }));
    } catch {
      // Ignore error
    }
  },

  fetchRoles: async (guildId: string) => {
    if (get().roles[guildId]) return;
    try {
      const { roles } = await api.discord.roles(guildId);
      set((state) => ({ roles: { ...state.roles, [guildId]: roles } }));
    } catch {
      // Ignore error
    }
  },

  fetchEmojis: async (guildId: string) => {
    if (get().emojis[guildId]) return;
    try {
      const res = await (api.discord as any).emojis?.(guildId);
      if (res?.emojis) {
        set((state) => ({ emojis: { ...state.emojis, [guildId]: res.emojis } }));
      }
    } catch {
      // Ignore error
    }
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
        const res = await fetch("/api/weao/exploits");
        if (!res.ok) {
          throw new Error(`WEAO endpoint returned HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          exploits?: WeaoExploitItem[];
          meta?: WeaoMetaInfo;
        };
        if (Array.isArray(data?.exploits)) {
          weaoLastFetchedAt = Date.now();
          try {
            if (typeof localStorage !== "undefined") {
              localStorage.setItem(WEAO_STORAGE_KEY, JSON.stringify(data.exploits));
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