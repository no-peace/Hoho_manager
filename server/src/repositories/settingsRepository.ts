import { db } from "../config/database.js";
import type { SettingsRecord, UpdateSettingsInput } from "@dmb/shared";

export interface RawSettingsRecord {
  guild_id: string;
  log_channel_id: string | null;
  head_admin_ids: string;
  bot_profile_id: string | null;
  extra_settings: string;
  created_at: number;
  updated_at: number;
}

const parseSettingsRecord = (raw: RawSettingsRecord): SettingsRecord => {
  let headAdminIds: string[] = [];
  try {
    headAdminIds = JSON.parse(raw.head_admin_ids);
    if (!Array.isArray(headAdminIds)) headAdminIds = [];
  } catch {
    headAdminIds = [];
  }

  let extraSettings: Record<string, unknown> = {};
  try {
    extraSettings = JSON.parse(raw.extra_settings);
    if (typeof extraSettings !== "object" || extraSettings === null || Array.isArray(extraSettings)) {
      extraSettings = {};
    }
  } catch {
    extraSettings = {};
  }

  return {
    guild_id: raw.guild_id,
    log_channel_id: raw.log_channel_id ?? null,
    head_admin_ids: headAdminIds,
    bot_profile_id: raw.bot_profile_id ?? null,
    extra_settings: extraSettings,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
};

export const settingsRepository = {
  async findByGuildId(guildId: string): Promise<SettingsRecord | undefined> {
    const raw = await db.get<RawSettingsRecord>(
      "SELECT * FROM settings WHERE guild_id = @guildId",
      { guildId },
    );
    return raw ? parseSettingsRecord(raw) : undefined;
  },

  async listAll(): Promise<SettingsRecord[]> {
    const rows = await db.query<RawSettingsRecord>("SELECT * FROM settings ORDER BY guild_id ASC");
    return rows.map(parseSettingsRecord);
  },

  async upsert(guildId: string, data: UpdateSettingsInput): Promise<SettingsRecord> {
    const now = Date.now();
    const headAdminIdsJson = data.head_admin_ids !== undefined ? JSON.stringify(data.head_admin_ids) : null;
    const extraSettingsJson = data.extra_settings !== undefined ? JSON.stringify(data.extra_settings) : null;

    await db.run(
      `INSERT INTO settings (guild_id, log_channel_id, head_admin_ids, bot_profile_id, extra_settings, created_at, updated_at)
       VALUES (
         @guildId,
         @logChannelId,
         COALESCE(@headAdminIds, '[]'),
         @botProfileId,
         COALESCE(@extraSettings, '{}'),
         @now,
         @now
       )
       ON CONFLICT(guild_id) DO UPDATE SET
         log_channel_id = CASE WHEN @hasLogChannelId = 1 THEN @logChannelId ELSE settings.log_channel_id END,
         head_admin_ids = CASE WHEN @hasHeadAdminIds = 1 THEN @headAdminIds ELSE settings.head_admin_ids END,
         bot_profile_id = CASE WHEN @hasBotProfileId = 1 THEN @botProfileId ELSE settings.bot_profile_id END,
         extra_settings = CASE WHEN @hasExtraSettings = 1 THEN @extraSettings ELSE settings.extra_settings END,
         updated_at = @now`,
      {
        guildId,
        logChannelId: data.log_channel_id !== undefined ? data.log_channel_id : null,
        hasLogChannelId: data.log_channel_id !== undefined ? 1 : 0,
        headAdminIds: headAdminIdsJson,
        hasHeadAdminIds: data.head_admin_ids !== undefined ? 1 : 0,
        botProfileId: data.bot_profile_id !== undefined ? data.bot_profile_id : null,
        hasBotProfileId: data.bot_profile_id !== undefined ? 1 : 0,
        extraSettings: extraSettingsJson,
        hasExtraSettings: data.extra_settings !== undefined ? 1 : 0,
        now,
      },
    );

    const updated = await this.findByGuildId(guildId);
    return updated!;
  },

  async delete(guildId: string): Promise<boolean> {
    const result = await db.run("DELETE FROM settings WHERE guild_id = @guildId", { guildId });
    return result.changes > 0;
  },
};
