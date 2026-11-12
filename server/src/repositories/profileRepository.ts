import type { WebhookProfileRecord } from "@dmb/shared";
import { BaseRepository, buildUpdate } from "./baseRepository.js";

/**
 * Webhook destinations.
 *
 * The URL contains a token, which is why a webhook can only ever *send*. It is
 * still treated as a credential: never logged, and only returned to the owner.
 */

export interface CreateWebhookInput {
  userId: number;
  name: string;
  url: string;
  guildId?: string | null;
  channelId?: string | null;
  avatarUrl?: string | null;
  isDefault?: number;
}

export type UpdateWebhookInput = Partial<
  Pick<WebhookProfileRecord, "name" | "url" | "guild_id" | "channel_id" | "avatar_url" | "is_default">
>;

const WEBHOOK_UPDATABLE = [
  "name",
  "url",
  "guild_id",
  "channel_id",
  "avatar_url",
  "is_default",
] as const;

export class WebhookProfileRepository extends BaseRepository {
  async create({
    userId,
    name,
    url,
    guildId = null,
    channelId = null,
    avatarUrl = null,
    isDefault = 0,
  }: CreateWebhookInput): Promise<WebhookProfileRecord | undefined> {
    const { lastInsertRowid } = await this.db.run(
      `INSERT INTO webhook_profiles (user_id, name, url, guild_id, channel_id, avatar_url, is_default)
       VALUES (@userId, @name, @url, @guildId, @channelId, @avatarUrl, @isDefault)`,
      { userId, name, url, guildId, channelId, avatarUrl, isDefault: isDefault ? 1 : 0 },
    );
    return this.findById(lastInsertRowid);
  }

  async findById(id: number): Promise<WebhookProfileRecord | undefined> {
    return this.db.get<WebhookProfileRecord>(
      "SELECT * FROM webhook_profiles WHERE id = @id",
      { id },
    );
  }

  async listByUser(userId: number): Promise<WebhookProfileRecord[]> {
    return this.db.query<WebhookProfileRecord>(
      `SELECT * FROM webhook_profiles
        WHERE user_id = @userId
        ORDER BY is_default DESC, created_at ASC`,
      { userId },
    );
  }

  async findDefault(userId: number): Promise<WebhookProfileRecord | undefined> {
    return this.db.get<WebhookProfileRecord>(
      "SELECT * FROM webhook_profiles WHERE user_id = @userId AND is_default = 1 LIMIT 1",
      { userId },
    );
  }

  async update(
    id: number,
    data: UpdateWebhookInput,
  ): Promise<WebhookProfileRecord | undefined> {
    const setClause = buildUpdate(data as Record<string, unknown>, WEBHOOK_UPDATABLE);
    if (!setClause) return this.findById(id);

    await this.db.run(
      `UPDATE webhook_profiles SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`,
      { ...data, id },
    );
    return this.findById(id);
  }

  /** Promote one profile to default, demoting any previous default. */
  async setDefault(id: number, userId: number): Promise<WebhookProfileRecord | undefined> {
    await this.db.run(
      "UPDATE webhook_profiles SET is_default = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = @userId",
      { userId },
    );
    await this.db.run(
      `UPDATE webhook_profiles
          SET is_default = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id AND user_id = @userId`,
      { id, userId },
    );
    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const { changes } = await this.db.run("DELETE FROM webhook_profiles WHERE id = @id", { id });
    return changes > 0;
  }
}

export const webhookProfileRepository = new WebhookProfileRepository();
