import type { BotProfileRecord, WebhookProfileRecord } from "@dmb/shared";
import { decrypt, encrypt } from "../utils/crypto.js";
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

/* ── Bot profiles ─────────────────────────────────────────────────────────── */

/** A row as stored: includes the encrypted token. Never returned to clients. */
export interface BotRow extends BotProfileRecord {
  token_encrypted: string;
}

/** What the API returns: metadata plus a "is a token stored?" flag. */
export type PublicBotProfile = BotProfileRecord & { has_token: boolean };

export interface CreateBotInput {
  userId: number;
  name: string;
  /** Plaintext token; encrypted before it touches the database. */
  token: string;
  publicKey: string;
  applicationId: string;
  defaultGuildId?: string | null;
  isActive?: number;
}

export interface UpdateBotInput {
  name?: string;
  token?: string;
  public_key?: string;
  application_id?: string;
  default_guild_id?: string | null;
  is_active?: number;
}

const BOT_UPDATABLE = [
  "name",
  "public_key",
  "application_id",
  "default_guild_id",
  "is_active",
] as const;

/**
 * Bot credentials.
 *
 * The token is encrypted with AES-256-GCM before it touches the database, and
 * every read strips it. Use {@link revealToken} when a request genuinely needs to
 * authenticate against Discord — never to return to a client.
 */
export class BotProfileRepository extends BaseRepository {
  private toPublic(row: BotRow | undefined): PublicBotProfile | undefined {
    if (!row) return undefined;
    const { token_encrypted, ...safe } = row;
    return { ...safe, has_token: Boolean(token_encrypted) };
  }

  async create({
    userId,
    name,
    token,
    publicKey,
    applicationId,
    defaultGuildId = null,
    isActive = 1,
  }: CreateBotInput): Promise<PublicBotProfile | undefined> {
    const { lastInsertRowid } = await this.db.run(
      `INSERT INTO bot_profiles
         (user_id, name, token_encrypted, public_key, application_id, default_guild_id, is_active)
       VALUES
         (@userId, @name, @token, @publicKey, @applicationId, @defaultGuildId, @isActive)`,
      {
        userId,
        name,
        token: encrypt(token),
        publicKey,
        applicationId,
        defaultGuildId,
        isActive: isActive ? 1 : 0,
      },
    );
    return this.findById(lastInsertRowid);
  }

  async findById(id: number): Promise<PublicBotProfile | undefined> {
    const row = await this.db.get<BotRow>("SELECT * FROM bot_profiles WHERE id = @id", { id });
    return this.toPublic(row);
  }

  /** Raw row including the encrypted token — internal use only. */
  async findRawById(id: number): Promise<BotRow | undefined> {
    return this.db.get<BotRow>("SELECT * FROM bot_profiles WHERE id = @id", { id });
  }

  /** Decrypt and return the bot token for an outgoing Discord request. */
  async revealToken(id: number): Promise<string | null> {
    const row = await this.findRawById(id);
    if (!row) return null;
    return decrypt(row.token_encrypted);
  }

  async findActiveByUser(userId: number): Promise<PublicBotProfile | undefined> {
    const row = await this.db.get<BotRow>(
      `SELECT * FROM bot_profiles
        WHERE user_id = @userId AND is_active = 1
        ORDER BY id ASC
        LIMIT 1`,
      { userId },
    );
    return this.toPublic(row);
  }

  async listByUser(userId: number): Promise<PublicBotProfile[]> {
    const rows = await this.db.query<BotRow>(
      "SELECT * FROM bot_profiles WHERE user_id = @userId ORDER BY created_at ASC",
      { userId },
    );
    return rows.map((row) => this.toPublic(row) as PublicBotProfile);
  }

  async update(id: number, data: UpdateBotInput): Promise<PublicBotProfile | undefined> {
    const setClause = buildUpdate(data as Record<string, unknown>, BOT_UPDATABLE);
    const params: Record<string, unknown> = { ...data, id };
    let tokenClause = "";

    // A supplied token is re-encrypted; an absent one leaves the stored value alone.
    if (data.token) {
      tokenClause = ", token_encrypted = @token_encrypted";
      params.token_encrypted = encrypt(data.token);
    }

    if (!setClause && !tokenClause) return this.findById(id);

    await this.db.run(
      `UPDATE bot_profiles
          SET ${setClause ?? "id = id"}${tokenClause}, updated_at = CURRENT_TIMESTAMP
        WHERE id = @id`,
      params,
    );
    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const { changes } = await this.db.run("DELETE FROM bot_profiles WHERE id = @id", { id });
    return changes > 0;
  }
}

export const webhookProfileRepository = new WebhookProfileRepository();
export const botProfileRepository = new BotProfileRepository();
