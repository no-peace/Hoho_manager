import { db } from "../config/database.js";

export interface AuditLogDbRecord {
  id: number;
  guild_id: string;
  channel_id: string | null;
  message_id: string | null;
  webhook_id: string | null;
  thread_id: string | null;
  user_id: string | null;
  user_name: string | null;
  user_avatar: string | null;
  type: string;
  reason: string | null;
  details: string | null;
  created_at: number;
}

export interface FormattedAuditLogEntry {
  id: number;
  type: string;
  channelId: string | null;
  messageId: string | null;
  webhookId: string | null;
  threadId: string | null;
  reason: string | null;
  createdAt: number;
  user: {
    discordUser?: {
      id: string;
      name: string;
      avatar: string | null;
    };
  };
}

export interface CreateAuditLogEntryInput {
  guildId: string;
  channelId?: string | null;
  messageId?: string | null;
  webhookId?: string | null;
  threadId?: string | null;
  userId?: string | null;
  userName?: string | null;
  userAvatar?: string | null;
  type: string;
  reason?: string | null;
  details?: Record<string, unknown> | null;
  createdAt?: number;
}

export interface FindAuditLogsOptions {
  guildId: string;
  channelId?: string;
  webhookId?: string;
  userId?: string;
  action?: string;
  limit?: number;
  page?: number;
}

export const auditLogRepository = {
  async create(input: CreateAuditLogEntryInput): Promise<FormattedAuditLogEntry> {
    const createdAt = input.createdAt ?? Date.now();
    const detailsStr = input.details ? JSON.stringify(input.details) : null;

    const result = await db.run(
      `INSERT INTO audit_log_entries
        (guild_id, channel_id, message_id, webhook_id, thread_id, user_id, user_name, user_avatar, type, reason, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.guildId,
        input.channelId ?? null,
        input.messageId ?? null,
        input.webhookId ?? null,
        input.threadId ?? null,
        input.userId ?? null,
        input.userName ?? null,
        input.userAvatar ?? null,
        input.type,
        input.reason ?? null,
        detailsStr,
        createdAt,
      ],
    );

    return {
      id: Number(result.lastInsertRowid),
      type: input.type,
      channelId: input.channelId ?? null,
      messageId: input.messageId ?? null,
      webhookId: input.webhookId ?? null,
      threadId: input.threadId ?? null,
      reason: input.reason ?? null,
      createdAt,
      user: {
        discordUser: input.userId
          ? {
              id: input.userId,
              name: input.userName ?? "Unknown",
              avatar: input.userAvatar ?? null,
            }
          : undefined,
      },
    };
  },

  async findMany(options: FindAuditLogsOptions): Promise<{
    entries: FormattedAuditLogEntry[];
    total: number;
    query: {
      limit: number;
      page: number;
      action?: string;
      channelId?: string;
      webhookId?: string;
      userId?: string;
    };
  }> {
    const limit = Math.max(1, Math.min(100, options.limit ?? 50));
    const page = Math.max(0, options.page ?? 0);
    const offset = page * limit;

    const whereClauses: string[] = ["guild_id = ?"];
    const params: unknown[] = [options.guildId];

    if (options.channelId) {
      whereClauses.push("channel_id = ?");
      params.push(options.channelId);
    }
    if (options.webhookId) {
      whereClauses.push("webhook_id = ?");
      params.push(options.webhookId);
    }
    if (options.userId) {
      whereClauses.push("user_id = ?");
      params.push(options.userId);
    }
    if (options.action) {
      whereClauses.push("type = ?");
      params.push(options.action);
    }

    const whereSql = whereClauses.join(" AND ");

    const countRow = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM audit_log_entries WHERE ${whereSql}`,
      params,
    );
    const total = countRow?.count ?? 0;

    const rows = await db.query<AuditLogDbRecord>(
      `SELECT * FROM audit_log_entries WHERE ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const entries: FormattedAuditLogEntry[] = rows.map((row) => ({
      id: row.id,
      type: row.type,
      channelId: row.channel_id,
      messageId: row.message_id,
      webhookId: row.webhook_id,
      threadId: row.thread_id,
      reason: row.reason,
      createdAt: row.created_at,
      user: {
        discordUser: row.user_id
          ? {
              id: row.user_id,
              name: row.user_name || "Unknown",
              avatar: row.user_avatar,
            }
          : undefined,
      },
    }));

    return {
      entries,
      total,
      query: {
        limit,
        page,
        action: options.action,
        channelId: options.channelId,
        webhookId: options.webhookId,
        userId: options.userId,
      },
    };
  },
};
