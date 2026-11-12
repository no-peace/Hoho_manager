import { db } from "../config/database.js";

export interface TrackedMessageRecord {
  id: number;
  channel_id: string;
  message_id: string;
  template_id: number | null;
  exploit_name: string | null;
  author_user_id: string | null;
  raw_payload: string | null;
  last_payload_hash: string;
  created_at: number;
  updated_at: number;
  last_checked_at: number;
  name?: string | null;
  expires_at?: string | null;
}

export interface UpsertTrackedMessageInput {
  channel_id: string;
  message_id: string;
  template_id?: number | null;
  exploit_name?: string | null;
  author_user_id?: string | null;
  raw_payload?: string | null;
  last_payload_hash: string;
  name?: string | null;
  expires_at?: string | null;
}

export const trackedMessageRepository = {
  async upsert(data: UpsertTrackedMessageInput): Promise<TrackedMessageRecord> {
    const now = Date.now();
    const existing = await db.get<TrackedMessageRecord>(
      `SELECT * FROM tracked_messages WHERE channel_id = @channel_id AND message_id = @message_id`,
      { channel_id: data.channel_id, message_id: data.message_id },
    );

    if (existing) {
      await db.run(
        `UPDATE tracked_messages
            SET template_id = @template_id,
                exploit_name = @exploit_name,
                author_user_id = @author_user_id,
                raw_payload = @raw_payload,
                last_payload_hash = @last_payload_hash,
                name = @name,
                expires_at = @expires_at,
                updated_at = @now,
                last_checked_at = @now
          WHERE id = @id`,
        {
          id: existing.id,
          template_id: data.template_id ?? existing.template_id,
          exploit_name: data.exploit_name ?? existing.exploit_name,
          author_user_id: data.author_user_id ?? existing.author_user_id,
          raw_payload: data.raw_payload !== undefined ? data.raw_payload : existing.raw_payload,
          last_payload_hash: data.last_payload_hash,
          name: data.name !== undefined ? data.name : existing.name ?? null,
          expires_at: data.expires_at !== undefined ? data.expires_at : existing.expires_at ?? null,
          now,
        },
      );
      return {
        ...existing,
        template_id: data.template_id ?? existing.template_id,
        exploit_name: data.exploit_name ?? existing.exploit_name,
        author_user_id: data.author_user_id ?? existing.author_user_id,
        raw_payload: data.raw_payload !== undefined ? data.raw_payload : existing.raw_payload,
        last_payload_hash: data.last_payload_hash,
        name: data.name !== undefined ? data.name : existing.name ?? null,
        expires_at: data.expires_at !== undefined ? data.expires_at : existing.expires_at ?? null,
        updated_at: now,
        last_checked_at: now,
      };
    }

    const result = await db.run(
      `INSERT INTO tracked_messages (
         channel_id, message_id, template_id, exploit_name, author_user_id, raw_payload, last_payload_hash, name, expires_at, created_at, updated_at, last_checked_at
       ) VALUES (
         @channel_id, @message_id, @template_id, @exploit_name, @author_user_id, @raw_payload, @last_payload_hash, @name, @expires_at, @now, @now, @now
       )`,
      {
        channel_id: data.channel_id,
        message_id: data.message_id,
        template_id: data.template_id ?? null,
        exploit_name: data.exploit_name ?? null,
        author_user_id: data.author_user_id ?? null,
        raw_payload: data.raw_payload ?? null,
        last_payload_hash: data.last_payload_hash,
        name: data.name ?? null,
        expires_at: data.expires_at ?? null,
        now,
      },
    );

    return {
      id: Number(result.lastInsertRowid),
      channel_id: data.channel_id,
      message_id: data.message_id,
      template_id: data.template_id ?? null,
      exploit_name: data.exploit_name ?? null,
      author_user_id: data.author_user_id ?? null,
      raw_payload: data.raw_payload ?? null,
      last_payload_hash: data.last_payload_hash,
      name: data.name ?? null,
      expires_at: data.expires_at ?? null,
      created_at: now,
      updated_at: now,
      last_checked_at: now,
    };
  },

  async listAll(): Promise<TrackedMessageRecord[]> {
    return db.query<TrackedMessageRecord>(
      `SELECT * FROM tracked_messages ORDER BY updated_at DESC`,
    );
  },

  async findByMessage(channelId: string, messageId: string): Promise<TrackedMessageRecord | undefined> {
    return db.get<TrackedMessageRecord>(
      `SELECT * FROM tracked_messages WHERE channel_id = @channelId AND message_id = @messageId`,
      { channelId, messageId },
    );
  },

  async updateHashAndCheck(id: number, hash: string): Promise<void> {
    const now = Date.now();
    await db.run(
      `UPDATE tracked_messages
          SET last_payload_hash = @hash,
              updated_at = @now,
              last_checked_at = @now
        WHERE id = @id`,
      { id, hash, now },
    );
  },

  async updateConfig(id: number, data: { name?: string | null; expires_at?: string | null }): Promise<void> {
    const fields: string[] = [];
    const params: Record<string, unknown> = { id, now: Date.now() };
    if (data.name !== undefined) { fields.push("name = @name"); params.name = data.name; }
    if (data.expires_at !== undefined) { fields.push("expires_at = @expires_at"); params.expires_at = data.expires_at; }
    if (fields.length === 0) return;
    fields.push("updated_at = @now");
    await db.run(`UPDATE tracked_messages SET ${fields.join(", ")} WHERE id = @id`, params);
  },

  async updateLastChecked(id: number): Promise<void> {
    const now = Date.now();
    await db.run(
      `UPDATE tracked_messages SET last_checked_at = @now WHERE id = @id`,
      { id, now },
    );
  },

  async delete(channelId: string, messageId: string): Promise<void> {
    await db.run(
      `DELETE FROM tracked_messages WHERE channel_id = @channelId AND message_id = @messageId`,
      { channelId, messageId },
    );
  },

  
  async deleteById(id: number): Promise<void> {
    await db.run(`DELETE FROM tracked_messages WHERE id = @id`, { id });
  },
};
