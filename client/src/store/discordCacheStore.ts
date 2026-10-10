import { create } from "zustand";
import api from "../api/client";

export interface DiscordEmoji {
  id: string;
  name: string;
  animated?: boolean;
  available?: boolean;
}

interface DiscordCacheState {
  guilds: { id: string; name: string; icon: string | null }[] | null;
  channels: Record<string, { id: string; name: string; type: number; parent_id?: string | null }[]>;
  roles: Record<string, { id: string; name: string; color: number }[]>;
  emojis: Record<string, DiscordEmoji[]>;
  fetchGuilds: () => Promise<void>;
  fetchChannels: (guildId: string) => Promise<void>;
  fetchRoles: (guildId: string) => Promise<void>;
  fetchEmojis: (guildId: string) => Promise<void>;
}

export const useDiscordCacheStore = create<DiscordCacheState>((set, get) => ({
  guilds: null,
  channels: {},
  roles: {},
  emojis: {},
  fetchGuilds: async () => {
    if (get().guilds) return;
    try {
      const { guilds } = await api.discord.guilds();
      set({ guilds });
    } catch {
      // Handle error
    }
  },
  fetchChannels: async (guildId: string) => {
    if (get().channels[guildId]) return;
    try {
      const { channels } = await api.discord.channels(guildId);
      set((state) => ({ channels: { ...state.channels, [guildId]: channels } }));
    } catch {
      // Handle error
    }
  },
  fetchRoles: async (guildId: string) => {
    if (get().roles[guildId]) return;
    try {
      const { roles } = await api.discord.roles(guildId);
      set((state) => ({ roles: { ...state.roles, [guildId]: roles } }));
    } catch {
      // Handle error
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
      // Handle error
    }
  },
}));