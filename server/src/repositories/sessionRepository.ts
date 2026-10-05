import crypto from "node:crypto";
import { db } from "../config/database.js";

export interface ActiveSessionRecord {
  id: string; // tokenId
  guild_id: string;
  user_id: string;
  permissions: string;
  channel_id: string | null;
  created_at: number;
  expires_at: number;
  is_active: number;
}

export interface FormattedSessionResult {
  tokenId: string;
  createdAt: number;
  expiresAt: number;
  permissions: string;
  channelId?: string | null;
  owner?: boolean;
  me?: boolean;
}

export interface CreateSessionInput {
  id?: string;
  guildId: string;
  userId: string;
  permissions?: string;
  channelId?: string | null;
  createdAt?: number;
  expiresAt?: number;
}

export interface FindSessionsOptions {
  guildId: string;
  channelId?: string;
  currentUserId?: string;
  limit?: number;
  cursor?: number;
}

const GUILD_TOKEN_TTL = 21_600_000; // 6 hours (matching Discohook)

export const sessionRepository = {
  async create(input: CreateSessionInput): Promise<FormattedSessionResult> {
    const id = input.id ?? `tok_${crypto.randomBytes(12).toString("hex")}`;
    const createdAt = input.createdAt ?? Date.now();
    const expiresAt = input.expiresAt ?? (createdAt + GUILD_TOKEN_TTL);
    const permissions = input.permissions ?? "8"; // Administrator default

    await db.run(
      `INSERT OR REPLACE INTO active_sessions
        (id, guild_id, user_id, permissions, channel_id, created_at, expires_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        id,
        input.guildId,
        input.userId,
        permissions,
        input.channelId ?? null,
        createdAt,
        expiresAt,
      ],
    );

    return {
      tokenId: id,
      createdAt,
      expiresAt,
      permissions,
      channelId: input.channelId ?? null,
      owner: true,
      me: input.userId === input.userId,
    };
  },

  async findActive(options: FindSessionsOptions): Promise<{
    cursor: number;
    channelId: string | null;
    results: FormattedSessionResult[];
  }> {
    const limit = Math.max(1, Math.min(100, options.limit ?? 50));
    const now = Date.now();

    const whereClauses: string[] = [
      "guild_id = ?",
      "is_active = 1",
      "expires_at > ?",
    ];
    const params: unknown[] = [options.guildId, now];

    if (options.channelId) {
      whereClauses.push("channel_id = ?");
      params.push(options.channelId);
    }

    const whereSql = whereClauses.join(" AND ");

    const rows = await db.query<ActiveSessionRecord>(
      `SELECT * FROM active_sessions WHERE ${whereSql} ORDER BY created_at DESC LIMIT ?`,
      [...params, limit],
    );

    // If no active sessions exist for this guild yet, auto-seed a default owner session for demo/Discohook compatibility only if guild has never had sessions
    if (rows.length === 0) {
      const anyRows = await db.query<{ count: number }>(
        "SELECT COUNT(*) as count FROM active_sessions WHERE guild_id = ?",
        [options.guildId],
      );
      if ((anyRows[0]?.count ?? 0) === 0) {
        const defaultUserId = options.currentUserId || "900000000000000001";
        const seeded = await this.create({
          guildId: options.guildId,
          userId: defaultUserId,
          permissions: "8",
          channelId: options.channelId ?? null,
        });

        return {
          cursor: 0,
          channelId: options.channelId ?? null,
          results: [seeded],
        };
      }

      return {
        cursor: 0,
        channelId: options.channelId ?? null,
        results: [],
      };
    }

    const results: FormattedSessionResult[] = rows.map((row) => ({
      tokenId: row.id,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      permissions: row.permissions,
      channelId: row.channel_id,
      owner: true,
      me: options.currentUserId ? row.user_id === options.currentUserId : true,
    }));

    return {
      cursor: 0,
      channelId: options.channelId ?? null,
      results,
    };
  },

  async revoke(guildId: string, tokenIds: string[]): Promise<number> {
    if (tokenIds.length === 0) return 0;
    const placeholders = tokenIds.map(() => "?").join(", ");
    const result = await db.run(
      `UPDATE active_sessions SET is_active = 0 WHERE guild_id = ? AND id IN (${placeholders})`,
      [guildId, ...tokenIds],
    );
    return result.changes ?? 0;
  },
};
