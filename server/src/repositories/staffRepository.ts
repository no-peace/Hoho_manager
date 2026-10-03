import { db } from "../config/database.js";

export interface StaffRecord {
  id: number;
  discord_user_id: string;
  discord_username: string;
  granted_by_discord_id: string;
  is_active: number;
  expires_at: string | null;
  cooldown_seconds: number;
  can_send_messages: number;
  can_edit_messages: number;
  can_delete_messages: number;
  can_manage_templates: number;
  allowed_channel_ids: string; // JSON
  can_mention_everyone: number;
  can_mention_here: number;
  can_mention_roles: number;
  allowed_role_mention_ids: string; // JSON
  max_messages_per_hour: number;
  granular_cooldowns?: string; // JSON
  granular_rate_limits?: string; // JSON
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffCooldownRecord {
  discord_user_id: string;
  action: string;
  last_at: string;
  count_this_hour: number;
  hour_bucket: string;
}

export const staffRepository = {
  async findAll(): Promise<StaffRecord[]> {
    return db.query<StaffRecord>("SELECT * FROM staff_access ORDER BY created_at DESC");
  },

  async findByDiscordId(discordUserId: string): Promise<StaffRecord | undefined> {
    return db.get<StaffRecord>("SELECT * FROM staff_access WHERE discord_user_id = ?", [discordUserId]);
  },

  async create(data: {
    discord_user_id: string;
    discord_username: string;
    granted_by_discord_id: string;
    is_active?: number;
    expires_at?: string | null;
    cooldown_seconds?: number;
    can_send_messages?: number;
    can_edit_messages?: number;
    can_delete_messages?: number;
    can_manage_templates?: number;
    allowed_channel_ids?: string;
    can_mention_everyone?: number;
    can_mention_here?: number;
    can_mention_roles?: number;
    allowed_role_mention_ids?: string;
    max_messages_per_hour?: number;
    granular_cooldowns?: string;
    granular_rate_limits?: string;
    notes?: string | null;
  }): Promise<StaffRecord> {
    await db.run(`
      INSERT INTO staff_access (
        discord_user_id, discord_username, granted_by_discord_id,
        is_active, expires_at, cooldown_seconds,
        can_send_messages, can_edit_messages, can_delete_messages, can_manage_templates,
        allowed_channel_ids,
        can_mention_everyone, can_mention_here, can_mention_roles, allowed_role_mention_ids,
        max_messages_per_hour, granular_cooldowns, granular_rate_limits, notes
      ) VALUES (
        @discord_user_id, @discord_username, @granted_by_discord_id,
        @is_active, @expires_at, @cooldown_seconds,
        @can_send_messages, @can_edit_messages, @can_delete_messages, @can_manage_templates,
        @allowed_channel_ids,
        @can_mention_everyone, @can_mention_here, @can_mention_roles, @allowed_role_mention_ids,
        @max_messages_per_hour, @granular_cooldowns, @granular_rate_limits, @notes
      )
    `, {
      discord_user_id: data.discord_user_id,
      discord_username: data.discord_username,
      granted_by_discord_id: data.granted_by_discord_id,
      is_active: data.is_active ?? 1,
      expires_at: data.expires_at ?? null,
      cooldown_seconds: data.cooldown_seconds ?? 30,
      can_send_messages: data.can_send_messages ?? 1,
      can_edit_messages: data.can_edit_messages ?? 0,
      can_delete_messages: data.can_delete_messages ?? 0,
      can_manage_templates: data.can_manage_templates ?? 0,
      allowed_channel_ids: data.allowed_channel_ids ?? '[]',
      can_mention_everyone: data.can_mention_everyone ?? 0,
      can_mention_here: data.can_mention_here ?? 0,
      can_mention_roles: data.can_mention_roles ?? 0,
      allowed_role_mention_ids: data.allowed_role_mention_ids ?? '[]',
      max_messages_per_hour: data.max_messages_per_hour ?? 10,
      granular_cooldowns: data.granular_cooldowns ?? '{}',
      granular_rate_limits: data.granular_rate_limits ?? '{}',
      notes: data.notes ?? null,
    });
    return (await this.findByDiscordId(data.discord_user_id))!;
  },

  async update(discordUserId: string, data: Partial<Omit<StaffRecord, 'id' | 'discord_user_id' | 'created_at'>>): Promise<StaffRecord | undefined> {
    const fields = Object.keys(data)
      .filter((k) => k !== 'id' && k !== 'discord_user_id' && k !== 'created_at')
      .map((k) => `${k} = @${k}`);
    if (fields.length === 0) return this.findByDiscordId(discordUserId);
    fields.push("updated_at = CURRENT_TIMESTAMP");
    await db.run(
      `UPDATE staff_access SET ${fields.join(", ")} WHERE discord_user_id = @discord_user_id`,
      { ...data, discord_user_id: discordUserId }
    );
    return this.findByDiscordId(discordUserId);
  },

  async delete(discordUserId: string): Promise<void> {
    await db.run("DELETE FROM staff_access WHERE discord_user_id = ?", [discordUserId]);
  },

  async getCooldown(discordUserId: string, action: string): Promise<StaffCooldownRecord | undefined> {
    return db.get<StaffCooldownRecord>(
      "SELECT * FROM staff_cooldowns WHERE discord_user_id = ? AND action = ?",
      [discordUserId, action]
    );
  },

  async upsertCooldown(discordUserId: string, action: string): Promise<void> {
    const now = new Date().toISOString();
    const hourBucket = now.slice(0, 13);
    const existing = await this.getCooldown(discordUserId, action);
    if (!existing) {
      await db.run(`
        INSERT INTO staff_cooldowns (discord_user_id, action, last_at, count_this_hour, hour_bucket)
        VALUES (?, ?, ?, 1, ?)
      `, [discordUserId, action, now, hourBucket]);
    } else {
      const sameHour = existing.hour_bucket === hourBucket;
      await db.run(`
        UPDATE staff_cooldowns
        SET last_at = ?, count_this_hour = ?, hour_bucket = ?
        WHERE discord_user_id = ? AND action = ?
      `, [
        now,
        sameHour ? existing.count_this_hour + 1 : 1,
        hourBucket,
        discordUserId,
        action,
      ]);
    }
  },

  async getHourlyCount(discordUserId: string, action: string): Promise<number> {
    const now = new Date().toISOString();
    const hourBucket = now.slice(0, 13);
    const record = await this.getCooldown(discordUserId, action);
    if (!record || record.hour_bucket !== hourBucket) return 0;
    return record.count_this_hour;
  },
};
