import { DISCORD_API_BASE, InteractionResponseType, MessageFlags } from "@dmb/shared";
import type { DiscordMessagePayload, DiscordUser, InteractionResponse } from "@dmb/shared";
import { env } from "../config/env.js";
import { ApiError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { parseWebhookUrl } from "../utils/validation.js";

const log = logger.child("discord");

/**
 * Everything that talks to Discord's REST API lives here.
 *
 * Two things are kept strictly separate:
 *   - **Webhook calls** need no bot token and may be made with a URL supplied by
 *     the browser (they can only ever post to that one webhook).
 *   - **Bot calls** need the token, which is resolved server-side only.
 *
 * The token is *never* accepted from a request body  callers pass a profile id
 * or fall back to the environment variable.
 */

/** A guild member, as far as this app cares. */
export interface GuildMember {
  roles?: string[];
  user?: DiscordUser;
}

/** A created message, as far as this app cares. */
export interface DiscordMessage {
  id: string;
  channel_id: string;
}

export interface DiscordGuildSummary {
  id: string;
  name: string;
  icon?: string | null;
}

export interface DiscordChannelSummary {
  id: string;
  name: string;
  type: number;
  parent_id?: string | null;
}

export interface DiscordRoleSummary {
  id: string;
  name: string;
  color: number;
  position: number;
  hoist?: boolean;
  permissions?: string;
  managed?: boolean;
}

export type DiscordRole = DiscordRoleSummary;

export interface DiscordMemberSummary {
  id: string;
  username: string;
  global_name: string | null;
  nickname: string | null;
  avatar: string | null;
  primary_guild?: {
    identity_guild_id?: string | null;
    identity_enabled?: boolean | null;
    tag?: string | null;
    badge?: string | null;
  } | null;
}

export type DiscordMember = DiscordMemberSummary;

export interface DiscordMessageRecord {
  id: string;
  content: string;
  timestamp?: string;
  author?: { id: string };
  interaction?: unknown;
  interaction_metadata?: unknown;
  [key: string]: unknown;
}

export interface DiscordEmojiSummary {
  id: string;
  name: string;
  animated?: boolean;
  available?: boolean;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

/** Pull Discord's own error message out of an error body, with a fallback. */
const readErrorMessage = (data: unknown, status: number): string => {
  const record = asRecord(data);
  const message = record.message;
  const code = record.code;
  if (typeof message === "string") {
    return code ? `${message} (code ${code})` : message;
  }
  return `Discord responded with ${status}`;
};

/**
 * Resolve the only bot token this instance is allowed to use.
 * The optional argument is retained temporarily for legacy internal callers,
 * but is deliberately ignored so stored custom tokens can never be selected.
 */
export const resolveBotToken = async (_legacyProfileId?: number | null): Promise<string> => {
  if (!env.discord.botToken) {
    throw new ApiError(503, "No bot token is configured on the server", {
      code: "bot_token_missing",
      expose: true,
    });
  }
  return env.discord.botToken;
};


export const resolveBotTokenForApplication = async (
  applicationId: string,
): Promise<string | null> => {
  if (!env.discord.botToken) return null;
  if (!env.discord.applicationId || applicationId === env.discord.applicationId) {
    return env.discord.botToken;
  }
  return null;
};


interface ApiRequestOptions {
  body?: unknown;
  /** Sent as `Authorization: <auth> <token>`. Omit for interaction callbacks. */
  token?: string;
  auth?: string;
  retries?: number;
  /** Explicitly opt a request into retries when its operation is idempotent. */
  idempotent?: boolean;
  /** Skip the base-URL join (used for webhook endpoints). */
  absoluteUrl?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_REST_TIMEOUT_MS = 10_000;
const DEFAULT_MULTIPART_TIMEOUT_MS = 30_000;

/**
 * Low-level fetch against the Discord API with retry/backoff.
 *
 * Discord signals throttling with 429 and a `retry_after` (seconds). Only
 * idempotent requests are retried after network or 5xx failures; 4xx is never
 * retried except for an explicit 429 rate-limit response.
 */
const apiRequest = async <T>(
  method: string,
  path: string | null,
  {
    body,
    token,
    auth = "Bot",
    retries = 3,
    idempotent,
    absoluteUrl,
    timeoutMs,
    signal: callerSignal,
  }: ApiRequestOptions = {},
): Promise<T | null> => {
  const url = absoluteUrl ?? `${DISCORD_API_BASE}${path ?? ""}`;
  const normalizedMethod = method.toUpperCase();
  const retryableRequest = idempotent ?? ["GET", "HEAD", "PUT", "DELETE"].includes(normalizedMethod);
  let attempt = 0;

  for (;;) {
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    const headers: Record<string, string> = {};
    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }
    if (token) headers.Authorization = `${auth} ${token}`;

    const effectiveTimeout =
      timeoutMs ?? (isFormData ? DEFAULT_MULTIPART_TIMEOUT_MS : DEFAULT_REST_TIMEOUT_MS);
    const timeoutSignal = AbortSignal.timeout(effectiveTimeout);
    const signal = callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: isFormData ? (body as FormData) : body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (error) {
      const isTimeout =
        error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      const reason = error instanceof Error ? error.message : String(error);
      if (callerSignal?.aborted) throw error;
      if (!retryableRequest || attempt >= retries) {
        if (isTimeout) {
          // Discord interaction/webhook tokens can appear in request paths. Never
          // include the URL in a client-visible error or structured error details.
          throw ApiError.gatewayTimeout(
            `Discord request timed out after ${effectiveTimeout}ms (${method})`,
            { method, timeoutMs: effectiveTimeout },
          );
        }
        throw ApiError.upstream(`Could not reach Discord: ${reason}`);
      }
      await sleep(2 ** attempt * 500);
      attempt += 1;
      continue;
    }

    // 204 No Content (most webhook sends) has no body to parse.
    if (response.status === 204) return null;

    const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
    const data: unknown = isJson
      ? await response.json().catch(() => null)
      : await response.text();

    if (response.ok) return data as T;

    // Throttled  honour Discord's own retry hint.
    if (response.status === 429 && attempt < retries) {
      const retryAfter = asRecord(data).retry_after;
      const headerValue = response.headers.get("retry-after");
      const headerSeconds = headerValue === null
        ? NaN
        : Number.isFinite(Number(headerValue))
          ? Number(headerValue)
          : Math.max(0, (Date.parse(headerValue) - Date.now()) / 1000);
      const retryAfterSeconds =
        typeof retryAfter === "number" && Number.isFinite(retryAfter)
          ? retryAfter
          : Number.isFinite(headerSeconds)
            ? headerSeconds
            : 1;
      const retryAfterMs = Math.max(0, Math.ceil(retryAfterSeconds * 1000));
      if (retryAfterMs > 10_000) {
        throw new ApiError(429, `Discord rate limit requires waiting ${Math.ceil(retryAfterMs / 1000)} seconds; request was not retried.`, {
          code: "discord_rate_limited",
          details: { retryAfterMs },
          expose: true,
        });
      }
      log.warn(`Rate limited by Discord; retrying in ${retryAfterMs}ms`);
      await sleep(retryAfterMs);
      attempt += 1;
      continue;
    }

    // Only idempotent operations may be retried after a server-side failure.
    if (retryableRequest && response.status >= 500 && attempt < retries) {
      await sleep(2 ** attempt * 500);
      attempt += 1;
      continue;
    }

    const message = readErrorMessage(data, response.status);

    if (response.status === 401) {
      throw new ApiError(401, `Discord rejected the credentials: ${message}`, {
        code: "discord_unauthorized",
        details: data,
        expose: true,
      });
    }

    if (response.status >= 400 && response.status < 500) {
      throw new ApiError(response.status, `Discord error: ${message}`, {
        code: "discord_bad_request",
        details: data,
        expose: true,
      });
    }

    throw ApiError.upstream(
      `Discord error: ${message}`,
      {
        status: response.status,
        discord: data,
      },
      true,
    );
  }
};

/* ── Webhooks (no bot token required) ─────────────────────────────────────── */

export interface DiscordAttachmentFile {
  file: File | Blob;
  filename: string;
  key?: string;
}

export interface WebhookSendOptions {
  wait?: boolean;
  threadId?: string | null;
  files?: DiscordAttachmentFile[];
}

const buildMultipartPayload = (
  payload: DiscordMessagePayload,
  files: DiscordAttachmentFile[],
): FormData => {
  const fd = new FormData();
  const finalPayload: DiscordMessagePayload = {
    ...payload,
    allowed_mentions: payload.allowed_mentions ?? { parse: [] },
  };

  if (!finalPayload.attachments || finalPayload.attachments.length === 0) {
    finalPayload.attachments = files.map((f, idx) => ({
      id: idx,
      filename: f.filename,
    }));
  }

  fd.append("payload_json", JSON.stringify(finalPayload));
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const key = f.key || `files[${i}]`;
    fd.append(key, f.file, f.filename);
  }
  return fd;
};

/**
 * Legacy compatibility stub. Arbitrary webhook-URL message sending is disabled.
 * Keep this export so old callers fail explicitly instead of sending externally.
 */
export const sendWebhook = async (
  _webhookUrl: string,
  _payload: DiscordMessagePayload,
  _options: WebhookSendOptions = {},
): Promise<DiscordMessage | null> => {
  throw ApiError.forbidden(
    "Webhook URL message sending is disabled. Use the configured server bot.",
  );
};


/** Inspect a webhook without sending (used to validate a URL before saving). */
export const getWebhookInfo = async (webhookUrl: string): Promise<unknown> => {
  const parsed = parseWebhookUrl(webhookUrl);
  if (!parsed) throw ApiError.badRequest("Not a valid Discord webhook URL");

  return apiRequest<unknown>("GET", null, {
    absoluteUrl: `${DISCORD_API_BASE}/webhooks/${parsed.id}/${parsed.token}`,
  });
};

/* ── Bot (token required, server-side only) ───────────────────────────────── */

/** Return the owning guild for a Discord channel using the configured bot. */
export const getChannelGuildId = async (channelId: string): Promise<string | null> => {
  const token = await resolveBotToken();
  const channel = await apiRequest<{ guild_id?: string | null }>(
    "GET",
    `/channels/${encodeURIComponent(channelId)}`,
    { token },
  );
  return typeof channel?.guild_id === "string" ? channel.guild_id : null;
};

export const getGuildEmojis = async (
  guildId: string,
  profileId: number | string | null = null,
): Promise<DiscordEmojiSummary[]> => {
  const pid = profileId != null ? Number(profileId) : null;
  const token = await resolveBotToken(pid);
  const emojis = await apiRequest<DiscordEmojiSummary[]>(
    "GET",
    `/guilds/${encodeURIComponent(guildId)}/emojis`,
    { token },
  );
  if (!emojis) return [];
  return emojis.map((e) => ({
    id: e.id,
    name: e.name,
    animated: Boolean(e.animated),
    available: e.available !== false,
  }));
};

export interface BotSendOptions {
  profileId?: number | null;
  files?: DiscordAttachmentFile[];
}

/** Send a message to a channel as the bot. */
export const sendChannelMessage = async (
  channelId: string,
  payload: DiscordMessagePayload,
  { profileId = null, files }: BotSendOptions = {},
): Promise<DiscordMessage | null> => {
  const token = await resolveBotToken(profileId);

  const hasFiles = files && files.length > 0;
  const body = hasFiles
    ? buildMultipartPayload(payload, files)
    : { ...payload, allowed_mentions: payload.allowed_mentions ?? { parse: [] } };

  const message = await apiRequest<DiscordMessage>("POST", `/channels/${encodeURIComponent(channelId)}/messages`, {
    token,
    body,
  });

  log.info(`Bot sent message ${message?.id} to channel ${channelId}`);
  return message;
};

export const sendChannelMessageWithToken = async (
  channelId: string,
  payload: DiscordMessagePayload,
  token: string,
  files?: DiscordAttachmentFile[],
): Promise<DiscordMessage | null> => {
  const hasFiles = files && files.length > 0;
  const body = hasFiles
    ? buildMultipartPayload(payload, files)
    : { ...payload, allowed_mentions: payload.allowed_mentions ?? { parse: [] } };

  const message = await apiRequest<DiscordMessage>("POST", `/channels/${encodeURIComponent(channelId)}/messages`, {
    token,
    body,
  });
  log.info(`Bot sent message ${message?.id} to channel ${channelId}`);
  return message;
};

export const editChannelMessage = async (
  channelId: string,
  messageId: string,
  payload: DiscordMessagePayload,
  { profileId = null, files }: BotSendOptions = {},
): Promise<DiscordMessage | null> => {
  const token = await resolveBotToken(profileId);
  const hasFiles = files && files.length > 0;
  const body = hasFiles
    ? buildMultipartPayload(payload, files)
    : { ...payload, allowed_mentions: payload.allowed_mentions ?? { parse: [] } };

  return apiRequest<DiscordMessage>(
    "PATCH",
    `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`,
    {
      token,
      body,
    },
  );
};

export const getBotGuilds = async (
  profileId: number | null = null,
): Promise<DiscordGuildSummary[]> => {
  const token = await resolveBotToken(profileId);
  return (await apiRequest<DiscordGuildSummary[]>("GET", "/users/@me/guilds", { token })) ?? [];
};

const guildResourceCache = new Map<string, { value: Record<string, unknown>; expiresAt: number }>();
const guildResourceInflight = new Map<string, Promise<Record<string, unknown> | null>>();
const GUILD_RESOURCE_CACHE_TTL_MS = 60_000;
const GUILD_RESOURCE_CACHE_MAX_ENTRIES = 500;

/**
 * Fetch the full Discord Guild resource, including approximate member counts.
 * Results are cached briefly because guild settings change infrequently and
 * interaction handlers may request several placeholders in quick succession.
 */
export const getGuild = async (
  guildId: string,
  token?: string,
): Promise<Record<string, unknown> | null> => {
  const cached = guildResourceCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) guildResourceCache.delete(guildId);

  const pending = guildResourceInflight.get(guildId);
  if (pending) return pending;

  const request = (async () => {
    const authToken = token ?? await resolveBotToken();
    const guild = await apiRequest<Record<string, unknown>>(
      "GET",
      `/guilds/${encodeURIComponent(guildId)}?with_counts=true`,
      { token: authToken },
    );
    if (!guild) return null;

    if (guildResourceCache.size >= GUILD_RESOURCE_CACHE_MAX_ENTRIES) {
      const oldestKey = guildResourceCache.keys().next().value;
      if (oldestKey) guildResourceCache.delete(oldestKey);
    }
    guildResourceCache.set(guildId, {
      value: guild,
      expiresAt: Date.now() + GUILD_RESOURCE_CACHE_TTL_MS,
    });
    return guild;
  })();

  guildResourceInflight.set(guildId, request);
  try {
    return await request;
  } finally {
    guildResourceInflight.delete(guildId);
  }
};


const guildPreviewCache = new Map<string, { value: Record<string, unknown>; expiresAt: number }>();
const guildPreviewInflight = new Map<string, Promise<Record<string, unknown> | null>>();

/**
 * Fetch Discord's public Guild Preview resource. Discord only exposes previews
 * for discoverable guilds to bots that are not members.
 */
export const getGuildPreview = async (
  guildId: string,
  token?: string,
): Promise<Record<string, unknown> | null> => {
  const cached = guildPreviewCache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) guildPreviewCache.delete(guildId);

  const pending = guildPreviewInflight.get(guildId);
  if (pending) return pending;

  const request = (async () => {
    const authToken = token ?? await resolveBotToken();
    const preview = await apiRequest<Record<string, unknown>>(
      "GET",
      `/guilds/${encodeURIComponent(guildId)}/preview`,
      { token: authToken },
    );
    if (!preview) return null;

    if (guildPreviewCache.size >= GUILD_RESOURCE_CACHE_MAX_ENTRIES) {
      const oldestKey = guildPreviewCache.keys().next().value;
      if (oldestKey) guildPreviewCache.delete(oldestKey);
    }
    guildPreviewCache.set(guildId, {
      value: preview,
      expiresAt: Date.now() + GUILD_RESOURCE_CACHE_TTL_MS,
    });
    return preview;
  })();

  guildPreviewInflight.set(guildId, request);
  try {
    return await request;
  } finally {
    guildPreviewInflight.delete(guildId);
  }
};

export const getGuildChannels = async (
  guildId: string,
  profileId: number | string | null = null,
): Promise<DiscordChannelSummary[]> => {
  const pid = profileId != null ? Number(profileId) : null;
  const token = await resolveBotToken(pid);
  return (
    (await apiRequest<DiscordChannelSummary[]>(
      "GET",
      `/guilds/${encodeURIComponent(guildId)}/channels`,
      { token },
    )) ?? []
  );
};

export const getGuildRolesWithToken = async (
  guildId: string,
  token: string,
): Promise<DiscordRoleSummary[]> => {
  const roles = await apiRequest<DiscordRoleSummary[]>(
    "GET",
    `/guilds/${encodeURIComponent(guildId)}/roles`,
    { token },
  );
  if (!roles) return [];
  return roles
    .map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color ?? 0,
      position: role.position ?? 0,
      hoist: role.hoist ?? false,
      permissions: role.permissions,
      managed: role.managed ?? false,
    }))
    .sort((a, b) => (b.position ?? 0) - (a.position ?? 0));
};

export const getGuildRoles = async (
  guildId: string,
  profileId: number | string | null = null,
): Promise<DiscordRoleSummary[]> => {
  const pid = profileId != null ? Number(profileId) : null;
  const token = await resolveBotToken(pid);
  return getGuildRolesWithToken(guildId, token);
};

// ============================================================================
// PERF-05: Bounded LRU + TTL Cache for Member Searches
// ============================================================================

export interface CacheStats {
  size: number;
  maxEntries: number;
  ttlMs: number;
  hits: number;
  misses: number;
}

export class BoundedTtlCache<T> {
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly map = new Map<string, { value: T; expiresAt: number }>();
  private hits = 0;
  private misses = 0;

  constructor(maxEntries = 500, ttlMs = 60_000) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      this.misses++;
      return undefined;
    }
    // Refresh LRU order (re-insert at tail)
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits++;
    return entry.value;
  }

  set(key: string, value: T, customTtlMs?: number): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      // Evict oldest entry (head of map iterator)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }
    const expiresAt = Date.now() + (customTtlMs ?? this.ttlMs);
    this.map.set(key, { value, expiresAt });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
    this.hits = 0;
    this.misses = 0;
  }

  size(): number {
    return this.map.size;
  }

  getStats(): CacheStats {
    return {
      size: this.map.size,
      maxEntries: this.maxEntries,
      ttlMs: this.ttlMs,
      hits: this.hits,
      misses: this.misses,
    };
  }

  pruneExpired(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.map.entries()) {
      if (now > entry.expiresAt) {
        this.map.delete(key);
        pruned++;
      }
    }
    return pruned;
  }
}

export const memberSearchCache = new BoundedTtlCache<DiscordMemberSummary[]>(500, 60_000);
const inFlightMemberSearches = new Map<string, Promise<DiscordMemberSummary[]>>();
export const userCache = new BoundedTtlCache<DiscordMemberSummary>(1000, 10 * 60_000);
const inFlightUserLookups = new Map<string, Promise<DiscordMemberSummary>>();

export const getDiscordUserAvatarUrl = (user: {
  id: string;
  avatar: string | null;
}): string => {
  if (user.avatar) {
    const ext = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=1024`;
  }
  const defaultIndex = (BigInt(user.id) >> 22n) % 6n;
  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
};

export const getDiscordUser = async (
  userId: string,
  profileId: number | null = null,
): Promise<DiscordMemberSummary> => {
  if (!/^\d{17,20}$/.test(userId)) {
    throw ApiError.badRequest("Invalid Discord user ID");
  }

  const cached = userCache.get(userId);
  if (cached) return cached;

  const existing = inFlightUserLookups.get(userId);
  if (existing) return existing;

  let lookupPromise: Promise<DiscordMemberSummary>;

  lookupPromise = (async () => {
    const token = await resolveBotToken(profileId);
    const data = await apiRequest<{
      id?: string;
      username?: string;
      global_name?: string | null;
      avatar?: string | null;
      primary_guild?: {
        identity_guild_id?: string | null;
        identity_enabled?: boolean | null;
        tag?: string | null;
        badge?: string | null;
      } | null;
    }>("GET", `/users/${encodeURIComponent(userId)}`, { token });

    if (
      !data ||
      data.id !== userId ||
      typeof data.username !== "string" ||
      data.username.length === 0
    ) {
      throw ApiError.notFound(`User ${userId} was not returned by Discord`);
    }

    const summary: DiscordMemberSummary = {
      id: data.id,
      username: data.username,
      global_name: data.global_name ?? null,
      nickname: null,
      avatar: data.avatar ?? null,
      primary_guild: data.primary_guild ?? null,
    };

    // Only successful, validated responses enter the TTL cache.
    userCache.set(userId, summary);
    return summary;
  })().finally(() => {
    if (inFlightUserLookups.get(userId) === lookupPromise) {
      inFlightUserLookups.delete(userId);
    }
  });

  inFlightUserLookups.set(userId, lookupPromise);
  return lookupPromise;
};

export const clearMemberSearchCache = (): void => {
  memberSearchCache.clear();
  inFlightMemberSearches.clear();
};

export const getMemberSearchCacheStats = (): CacheStats => {
  return memberSearchCache.getStats();
};

export const searchGuildMembers = async (
  guildId: string,
  query: string,
  profileId: number | string | null = null,
): Promise<DiscordMemberSummary[]> => {
  const trimmed = (query ?? "").trim();
  if (!trimmed) return [];

  const pid = profileId != null ? Number(profileId) : null;
  const cacheKey = `${pid ?? "default"}:${guildId}:${trimmed.toLowerCase()}`;

  // 1. Check LRU/TTL Cache
  const cached = memberSearchCache.get(cacheKey);
  if (cached) return cached;

  // 2. Coalesce concurrent in-flight requests (Thundering Herd protection)
  const existing = inFlightMemberSearches.get(cacheKey);
  if (existing) return existing;

  const searchPromise = (async () => {
    try {
      const token = await resolveBotToken(pid);

      // If query is a snowflake ID, attempt direct member lookup via REST API
      if (/^\d{17,20}$/.test(trimmed)) {
        try {
          const member = await apiRequest<any>(
            "GET",
            `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(trimmed)}`,
            { token },
          );
          if (member) {
            const singleMember: DiscordMemberSummary[] = [
              {
                id: member.user?.id ?? trimmed,
                username: member.user?.username ?? member.username ?? "",
                global_name: member.user?.global_name ?? member.global_name ?? null,
                nickname: member.nick ?? member.nickname ?? null,
                avatar: member.user?.avatar ?? member.avatar ?? null,
                roles: Array.isArray(member.roles) ? member.roles : [],
              } as any,
            ];
            memberSearchCache.set(cacheKey, singleMember);
            return singleMember;
          }
        } catch {
          // Not found by ID or user not in guild, fall through to name search
        }
      }

      const rawMembers = await apiRequest<any[]>(
        "GET",
        `/guilds/${encodeURIComponent(guildId)}/members/search?query=${encodeURIComponent(trimmed)}&limit=25`,
        { token },
      );
      if (!rawMembers || !Array.isArray(rawMembers)) {
        memberSearchCache.set(cacheKey, []);
        return [];
      }
      const results: DiscordMemberSummary[] = rawMembers.map((m) => ({
        id: m.user?.id ?? m.id,
        username: m.user?.username ?? m.username ?? "",
        global_name: m.user?.global_name ?? null,
        nickname: m.nick ?? null,
        avatar: m.user?.avatar ?? m.avatar ?? null,
        roles: Array.isArray(m.roles) ? m.roles : [],
      }));
      memberSearchCache.set(cacheKey, results);
      return results;
    } catch (err) {
      log.warn(
        `Member search failed for guild ${guildId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    } finally {
      inFlightMemberSearches.delete(cacheKey);
    }
  })();

  inFlightMemberSearches.set(cacheKey, searchPromise);
  return searchPromise;
};

export const getChannelMessages = async (
  channelId: string,
  profileId: number | null = null,
): Promise<DiscordMessageRecord[]> => {
  const token = await resolveBotToken(profileId);
  return (
    (await apiRequest<DiscordMessageRecord[]>(
      "GET",
      `/channels/${encodeURIComponent(channelId)}/messages?limit=50`,
      { token },
    )) ?? []
  );
};

export const getChannelMessage = async (
  channelId: string,
  messageId: string,
  profileId: number | null = null,
): Promise<DiscordMessageRecord | null> => {
  const token = await resolveBotToken(profileId);
  return apiRequest<DiscordMessageRecord>(
    "GET",
    `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`,
    { token },
  );
};

/** Resolve who a token belongs to  doubles as a validity check. */
export const getBotIdentity = async (token: string): Promise<DiscordUser | null> =>
  apiRequest<DiscordUser>("GET", "/users/@me", { token });

export const addGuildMemberRole = async (
  guildId: string,
  userId: string,
  roleId: string,
  token: string,
): Promise<boolean> => {
  await apiRequest("PUT", `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`, { token });
  return true;
};

export const removeGuildMemberRole = async (
  guildId: string,
  userId: string,
  roleId: string,
  token: string,
): Promise<boolean> => {
  await apiRequest("DELETE", `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`, { token });
  return true;
};

export const getGuildMember = async (
  guildId: string,
  userId: string,
  token: string,
): Promise<GuildMember | null> =>
  apiRequest<GuildMember>("GET", `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`, { token });

export const hasRole = async (
  guildId: string,
  userId: string,
  roleId: string,
  token: string,
): Promise<boolean> => {
  const member = await getGuildMember(guildId, userId, token);
  return Array.isArray(member?.roles) && member.roles.includes(roleId);
};

/** Open (or reuse) a DM channel with a user, then send `payload` to it. */
export const sendDirectMessage = async (
  userId: string,
  payload: DiscordMessagePayload,
  token: string,
): Promise<DiscordMessage | null> => {
  const channel = await apiRequest<{ id: string }>("POST", "/users/@me/channels", {
    token,
    body: { recipient_id: userId },
  });
  if (!channel) throw ApiError.upstream("Discord did not return a DM channel");

  return apiRequest<DiscordMessage>("POST", `/channels/${encodeURIComponent(channel.id)}/messages`, {
    token,
    body: { ...payload, allowed_mentions: payload.allowed_mentions ?? { parse: [] } },
  });
};

export const crosspostMessage = async (
  channelId: string,
  messageId: string,
): Promise<void> => {
  const token = await resolveBotToken();
  await apiRequest(
    "POST",
    `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}/crosspost`,
    { token, body: {} },
  );
};

export const deleteChannelMessage = async (
  channelId: string,
  messageId: string,
  token: string,
): Promise<boolean> => {
  await apiRequest("DELETE", `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`, { token });
  return true;
};

/**
 * Start a thread on an existing message.
 *
 * Discord threads off the *message*, not the channel, which is why this needs
 * both ids. Used by the `create_thread` flow action.
 */
export const createThreadFromMessage = async (
  channelId: string,
  messageId: string,
  name: string,
  token: string,
): Promise<{ id: string } | null> =>
  apiRequest<{ id: string }>("POST", `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}/threads`, {
    token,
    body: { name },
  });

/* ── Interaction responses ────────────────────────────────────────────────── */

/**
 * Respond to an interaction using its `application_id` + `token`.
 *
 * These calls need no bot token  the interaction token *is* the credential, and
 * it expires 15 minutes after the interaction was created.
 */
export const createInteractionResponse = async (
  interactionId: string,
  interactionToken: string,
  response: InteractionResponse,
  options?: { timeoutMs?: number },
): Promise<unknown> =>
  apiRequest("POST", `/interactions/${encodeURIComponent(interactionId)}/${encodeURIComponent(interactionToken)}/callback`, {
    auth: "",
    body: response,
    retries: 1,
    // Keep the first attempt + retry + backoff below Discord's 3-second initial-response deadline.
    timeoutMs: options?.timeoutMs ?? 1_000,
  });

export const createFollowupMessage = async (
  applicationId: string,
  interactionToken: string,
  payload: DiscordMessagePayload,
): Promise<unknown> => {
  const params = new URLSearchParams();
  if (payload.components && payload.components.length > 0) {
    params.set("with_components", "true");
  }
  const query = params.toString();
  return apiRequest("POST", `/webhooks/${encodeURIComponent(applicationId)}/${encodeURIComponent(interactionToken)}${query ? `?${query}` : ""}`, { body: payload });
};

export const editOriginalResponse = async (
  applicationId: string,
  interactionToken: string,
  payload: DiscordMessagePayload,
): Promise<unknown> => {
  const params = new URLSearchParams();
  if (payload.components && payload.components.length > 0) {
    params.set("with_components", "true");
  }
  const query = params.toString();
  return apiRequest("PATCH", `/webhooks/${encodeURIComponent(applicationId)}/${encodeURIComponent(interactionToken)}/messages/@original${query ? `?${query}` : ""}`, {
    body: payload,
  });
};

/** Defer a response so we still have time to do slow work before replying. */
export const deferResponse = async (
  interactionId: string,
  interactionToken: string,
  { ephemeral = false }: { ephemeral?: boolean } = {},
): Promise<unknown> =>
  createInteractionResponse(interactionId, interactionToken, {
    type: InteractionResponseType.DeferredChannelMessageWithSource,
    data: ephemeral ? { flags: MessageFlags.Ephemeral } : {},
  });

export default {
  resolveBotToken,
  resolveBotTokenForApplication,
  sendWebhook,
  getWebhookInfo,
  sendChannelMessage,
  sendChannelMessageWithToken,
  editChannelMessage,
  getBotGuilds,
  getGuildChannels,
  getGuildRoles,
  getGuildEmojis,
  searchGuildMembers,
  clearMemberSearchCache,
  getMemberSearchCacheStats,
  getChannelMessages,
  getBotIdentity,
  addGuildMemberRole,
  removeGuildMemberRole,
  getGuildMember,
  hasRole,
  sendDirectMessage,
  deleteChannelMessage,
  crosspostMessage,
  createThreadFromMessage,
  createInteractionResponse,
  createFollowupMessage,
  editOriginalResponse,
  deferResponse,
  getDiscordUser,
  getDiscordUserAvatarUrl,
};
