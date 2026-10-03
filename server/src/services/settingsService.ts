import type { SettingsRecord, UpdateSettingsInput } from "@dmb/shared";
import { env } from "../config/env.js";
import { settingsRepository } from "../repositories/settingsRepository.js";
import { logger } from "../utils/logger.js";

const log = logger.child("settingsService");

// In-memory cache for fast lookups with instant invalidation on update
const settingsCache = new Map<string, { record: SettingsRecord; cachedAt: number }>();
const CACHE_TTL_MS = 30_000;

export const clearSettingsCache = (): void => {
  settingsCache.clear();
};

const getGlobalFallback = (): SettingsRecord => ({
  guild_id: "__global__",
  log_channel_id: env.logChannelId ?? null,
  head_admin_ids: [...env.ownerDiscordIds],
  bot_profile_id: null,
  extra_settings: {},
  created_at: 0,
  updated_at: 0,
});

export const settingsService = {
  clearCache: clearSettingsCache,

  async getSettings(guildId?: string): Promise<SettingsRecord> {
    const targetGuildId = guildId && guildId.trim() ? guildId.trim() : "__global__";

    const cached = settingsCache.get(targetGuildId);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.record;
    }

    const row = await settingsRepository.findByGuildId(targetGuildId);
    if (row) {
      settingsCache.set(targetGuildId, { record: row, cachedAt: Date.now() });
      return row;
    }

    if (targetGuildId === "__global__") {
      const fallback = getGlobalFallback();
      return fallback;
    }

    // Guild-specific row not found: return empty guild record initialized with defaults
    const fallback: SettingsRecord = {
      guild_id: targetGuildId,
      log_channel_id: null,
      head_admin_ids: [],
      bot_profile_id: null,
      extra_settings: {},
      created_at: 0,
      updated_at: 0,
    };
    return fallback;
  },

  async updateSettings(guildId: string = "__global__", data: UpdateSettingsInput): Promise<SettingsRecord> {
    const targetGuildId = guildId && guildId.trim() ? guildId.trim() : "__global__";
    log.info(`Updating settings for target: ${targetGuildId}`);

    const updated = await settingsRepository.upsert(targetGuildId, data);
    settingsCache.set(targetGuildId, { record: updated, cachedAt: Date.now() });
    return updated;
  },

  async getEffectiveLogChannelId(guildId?: string): Promise<string | undefined> {
    if (guildId && guildId.trim() && guildId !== "__global__") {
      const guildSettings = await this.getSettings(guildId.trim());
      if (guildSettings.log_channel_id && guildSettings.log_channel_id.trim()) {
        return guildSettings.log_channel_id.trim();
      }
    }

    const globalSettings = await this.getSettings("__global__");
    if (globalSettings.log_channel_id && globalSettings.log_channel_id.trim()) {
      return globalSettings.log_channel_id.trim();
    }

    if (env.logChannelId && env.logChannelId.trim()) {
      return env.logChannelId.trim();
    }

    return undefined;
  },

  async isHeadAdmin(discordUserId: string, guildId?: string): Promise<boolean> {
    if (!discordUserId) return false;

    // 1. Env owners
    if (env.ownerDiscordIds.includes(discordUserId)) {
      return true;
    }

    // 2. Global settings head admins
    const globalSettings = await this.getSettings("__global__");
    if (globalSettings.head_admin_ids.includes(discordUserId)) {
      return true;
    }

    // 3. Guild settings head admins (if guild specified)
    if (guildId && guildId.trim() && guildId !== "__global__") {
      const guildSettings = await this.getSettings(guildId.trim());
      if (guildSettings.head_admin_ids.includes(discordUserId)) {
        return true;
      }
    }

    return false;
  },
};
