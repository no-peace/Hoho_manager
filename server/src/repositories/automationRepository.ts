import { BaseRepository, parseJson } from "./baseRepository.js";

export interface ScheduledMessageRow {
  id: number;
  guild_id: string;
  channel_id: string;
  thread_id: string | null;
  template_id: number | null;
  target_message_id: string | null;
  payload_json: string | Record<string, unknown>;
  cron_expr: string | null;
  run_at: string | null;
  timezone: string;
  enabled: number;
  last_run_at: string | null;
  next_run_at: string | null;
  retry_count?: number;
  created_by: string;
  created_at: string;
}

export interface ExpiringMessageRow {
  id: number;
  guild_id: string;
  channel_id: string;
  message_id: string;
  delete_at: string;
  created_by: string;
  created_at: string;
}

export interface StickyMessageRow {
  id: number;
  guild_id: string;
  channel_id: string;
  current_message_id: string | null;
  payload_json: string | Record<string, unknown>;
  interval_messages: number;
  enabled: number;
  created_by: string;
  created_at: string;
}

const hydratePayload = <T extends { payload_json: unknown }>(row: T): T => {
  const parsed = parseJson(row, ["payload_json"]);
  return parsed ?? row;
};

export class AutomationRepository extends BaseRepository {
  async listSchedules(guildId?: string): Promise<ScheduledMessageRow[]> {
    const rows = await this.db.query<ScheduledMessageRow>(
      `SELECT * FROM scheduled_messages
       WHERE (@guildId IS NULL OR guild_id = @guildId)
       ORDER BY next_run_at ASC`,
      { guildId: guildId ?? null },
    );
    return rows.map(hydratePayload);
  }

  async findScheduleById(id: number): Promise<ScheduledMessageRow | undefined> {
    const row = await this.db.get<ScheduledMessageRow>("SELECT * FROM scheduled_messages WHERE id = @id", { id });
    return row ? hydratePayload(row) : undefined;
  }

  async findDueSchedules(now: string): Promise<ScheduledMessageRow[]> {
    const rows = await this.db.query<ScheduledMessageRow>(
      "SELECT * FROM scheduled_messages WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= @now ORDER BY next_run_at ASC LIMIT 50",
      { now },
    );
    return rows.map(hydratePayload);
  }

  async createSchedule(input: Omit<ScheduledMessageRow, "id" | "created_at" | "last_run_at">): Promise<ScheduledMessageRow | undefined> {
    const result = await this.db.run(
      `INSERT INTO scheduled_messages
       (guild_id, channel_id, thread_id, template_id, target_message_id, payload_json, cron_expr, run_at, timezone, enabled, next_run_at, created_by)
       VALUES (@guild_id, @channel_id, @thread_id, @template_id, @target_message_id, @payload_json, @cron_expr, @run_at, @timezone, @enabled, @next_run_at, @created_by)`,
      { ...input, payload_json: JSON.stringify(input.payload_json) },
    );
    return this.db.get<ScheduledMessageRow>("SELECT * FROM scheduled_messages WHERE id = @id", { id: result.lastInsertRowid });
  }

  async updateSchedule(id: number, patch: Partial<Pick<ScheduledMessageRow, "enabled" | "next_run_at" | "last_run_at" | "payload_json" | "target_message_id" | "retry_count">>): Promise<void> {
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
    if (!entries.length) return;
    const setSql = entries.map(([key]) => `${key} = @${key}`).join(", ");
    const params: Record<string, unknown> = { id };
    entries.forEach(([key, value]) => { params[key] = key === "payload_json" ? JSON.stringify(value) : value; });
    await this.db.run(`UPDATE scheduled_messages SET ${setSql} WHERE id = @id`, params);
  }

  async deleteSchedule(id: number): Promise<void> {
    await this.db.run("DELETE FROM scheduled_messages WHERE id = @id", { id });
  }

  async getNextScheduleAt(): Promise<string | null> {
    const row = await this.db.get<{ next_run_at: string | null }>(
      "SELECT MIN(next_run_at) AS next_run_at FROM scheduled_messages WHERE enabled = 1 AND next_run_at IS NOT NULL",
    );
    return row?.next_run_at ?? null;
  }

  async countSchedules(): Promise<number> {
    const row = await this.db.get<{ count: number }>("SELECT COUNT(*) AS count FROM scheduled_messages WHERE enabled = 1");
    return Number(row?.count ?? 0);
  }

  async findDueExpiring(now: string): Promise<ExpiringMessageRow[]> {
    return this.db.query<ExpiringMessageRow>(
      "SELECT * FROM expiring_messages WHERE delete_at <= @now ORDER BY delete_at ASC LIMIT 100",
      { now },
    );
  }

  async listExpiring(): Promise<ExpiringMessageRow[]> {
    return this.db.query<ExpiringMessageRow>("SELECT * FROM expiring_messages ORDER BY delete_at ASC");
  }

  async getNextExpiringAt(): Promise<string | null> {
    const row = await this.db.get<{ next_delete_at: string | null }>("SELECT MIN(delete_at) AS next_delete_at FROM expiring_messages");
    return row?.next_delete_at ?? null;
  }

  async addExpiring(input: Omit<ExpiringMessageRow, "id" | "created_at">): Promise<void> {
    await this.db.run(
      `INSERT OR REPLACE INTO expiring_messages (guild_id, channel_id, message_id, delete_at, created_by)
       VALUES (@guild_id, @channel_id, @message_id, @delete_at, @created_by)`,
      input,
    );
  }

  async retryExpiring(id: number, deleteAt: string): Promise<void> {
    await this.db.run("UPDATE expiring_messages SET delete_at = @deleteAt WHERE id = @id", { id, deleteAt });
  }

  async removeExpiring(id: number): Promise<void> {
    await this.db.run("DELETE FROM expiring_messages WHERE id = @id", { id });
  }

  async countExpiring(): Promise<number> {
    const row = await this.db.get<{ count: number }>("SELECT COUNT(*) AS count FROM expiring_messages");
    return Number(row?.count ?? 0);
  }

  async listActiveSticky(): Promise<StickyMessageRow[]> {
    const rows = await this.db.query<StickyMessageRow>("SELECT * FROM sticky_messages WHERE enabled = 1");
    return rows.map(hydratePayload);
  }

  async findSticky(channelId: string): Promise<StickyMessageRow | undefined> {
    const row = await this.db.get<StickyMessageRow>("SELECT * FROM sticky_messages WHERE channel_id = @channelId AND enabled = 1", { channelId });
    return row ? hydratePayload(row) : undefined;
  }

  async upsertSticky(input: Omit<StickyMessageRow, "id" | "created_at" | "current_message_id">): Promise<void> {
    await this.db.run(
      `INSERT INTO sticky_messages (guild_id, channel_id, payload_json, interval_messages, enabled, created_by)
       VALUES (@guild_id, @channel_id, @payload_json, @interval_messages, @enabled, @created_by)
       ON CONFLICT(channel_id) DO UPDATE SET guild_id = excluded.guild_id, payload_json = excluded.payload_json, interval_messages = excluded.interval_messages, enabled = excluded.enabled, created_by = excluded.created_by`,
      { ...input, payload_json: JSON.stringify(input.payload_json) },
    );
  }

  async setStickyMessageId(channelId: string, messageId: string | null): Promise<void> {
    await this.db.run("UPDATE sticky_messages SET current_message_id = @messageId WHERE channel_id = @channelId", { channelId, messageId });
  }

  async deleteSticky(channelId: string): Promise<void> {
    await this.db.run("DELETE FROM sticky_messages WHERE channel_id = @channelId", { channelId });
  }
}

export const automationRepository = new AutomationRepository();
