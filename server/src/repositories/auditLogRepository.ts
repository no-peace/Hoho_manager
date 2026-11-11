// Audit logs are stored directly in Discord log channels to conserve SQLite database storage.

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
    // Audit logs stream directly to Discord Log Channel to preserve SQLite storage
    return {
      id: 0,
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
    // Audit logs stream to Discord log channel; database table dropped to conserve space
    return {
      entries: [],
      total: 0,
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

  async deleteOlderThan(_maxAgeMs: number): Promise<number> {
    return 0;
  },
};
