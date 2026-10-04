import { DISCORD_API_BASE, InteractionResponseType, MessageFlags } from "@dmb/shared";
import type { DiscordMessagePayload, DiscordUser, InteractionResponse } from "@dmb/shared";
import { env } from "../config/env.js";
import { botProfileRepository } from "../repositories/profileRepository.js";
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
 * The token is *never* accepted from a request body — callers pass a profile id
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
}

export type DiscordRole = DiscordRoleSummary;

export interface DiscordMemberSummary {
  id: string;
  username: string;
  global_name: string | null;
  nickname: string | null;
  avatar: string | null;
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

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

/** Pull Discord's own error message out of an error body, with a fallback. */
const readErrorMessage = (data: unknown, status: number): string => {
  const message = asRecord(data).message;
  return typeof message === "string" ? message : `Discord responded with ${status}`;
};

/**
 * Resolve the bot token to use for an outbound request.
 * Preference: explicit profile id -> the configured env token.
 */
export const resolveBotToken = async (profileId: number | null = null): Promise<string> => {
  if (profileId != null) {
    const token = await botProfileRepository.revealToken(profileId);
    if (!token) throw ApiError.notFound(`Bot profile ${profileId} not found`);
    return token;
  }

  if (!env.discord.botToken) {
    // Deliberately user-visible: "Internal server error" would send someone
    // hunting through logs for a one-line config fix.
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
  if (applicationId === env.discord.applicationId && env.discord.botToken) {
    return env.discord.botToken;
  }

  const profileToken = await botProfileRepository.revealTokenByApplicationId(applicationId);
  if (profileToken) return profileToken;

  if (!env.discord.applicationId) return env.discord.botToken ?? null;
  return null;
};

interface ApiRequestOptions {
  body?: unknown;
  /** Sent as `Authorization: <auth> <token>`. Omit for interaction callbacks. */
  token?: string;
  auth?: string;
  retries?: number;
  /** Skip the base-URL join (used for webhook endpoints). */
  absoluteUrl?: string;
}

/**
 * Low-level fetch against the Discord API with retry/backoff.
 *
 * Discord signals throttling with 429 and a `retry_after` (seconds); transient
 * 5xx responses are also retried. 4xx is never retried — that is our bug.
 */
const apiRequest = async <T>(
  method: string,
  path: string | null,
  {
    body,
    token,
    auth = "Bot",
    retries = 3,
    absoluteUrl,
  }: ApiRequestOptions = {},
): Promise<T | null> => {
  const url = absoluteUrl ?? `${DISCORD_API_BASE}${path ?? ""}`;
  let attempt = 0;

  for (;;) {
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    const headers: Record<string, string> = {};
    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }
    if (token) headers.Authorization = `${auth} ${token}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: isFormData ? (body as FormData) : body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (attempt >= retries) {
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

    // Throttled — honour Discord's own retry hint.
    if (response.status === 429 && attempt < retries) {
      const retryAfter = asRecord(data).retry_after;
      const retryAfterMs = Math.ceil((typeof retryAfter === "number" ? retryAfter : 1) * 1000);
      log.warn(`Rate limited by Discord; retrying in ${retryAfterMs}ms`);
      await sleep(Math.min(retryAfterMs, 10_000));
      attempt += 1;
      continue;
    }

    // Transient server errors are worth another shot.
    if (response.status >= 500 && attempt < retries) {
      await sleep(2 ** attempt * 500);
      attempt += 1;
      continue;
    }

    const message = readErrorMessage(data, response.status);

    if (response.status === 401) {
      throw new ApiError(401, `Discord rejected the credentials: ${message}`, {
        code: "discord_unauthorized",
        details: data,
      });
    }

    throw ApiError.upstream(`Discord error: ${message}`, {
      status: response.status,
      discord: data,
    });
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
 * POST a message through a webhook URL.
 *
 * @param webhookUrl full Discord webhook URL
 * @param payload    message payload (content/embeds/components)
 */
export const sendWebhook = async (
  webhookUrl: string,
  payload: DiscordMessagePayload,
  { wait = true, threadId, files }: WebhookSendOptions = {},
): Promise<DiscordMessage | null> => {
  const parsed = parseWebhookUrl(webhookUrl);
  if (!parsed) throw ApiError.badRequest("Not a valid Discord webhook URL");

  const params = new URLSearchParams();
  if (wait) params.set("wait", "true");
  if (threadId) params.set("thread_id", threadId);

  const query = params.toString();
  const absoluteUrl = `${DISCORD_API_BASE}/webhooks/${parsed.id}/${parsed.token}${
    query ? `?${query}` : ""
  }`;

  const hasFiles = files && files.length > 0;
  const body = hasFiles
    ? buildMultipartPayload(payload, files)
    : { ...payload, allowed_mentions: payload.allowed_mentions ?? { parse: [] } };

  const message = await apiRequest<DiscordMessage>("POST", null, {
    body,
    absoluteUrl,
  });

  log.info(`Sent webhook message${message?.id ? ` ${message.id}` : ""}`);
  return message;
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

  const message = await apiRequest<DiscordMessage>("POST", `/channels/${channelId}/messages`, {
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

  const message = await apiRequest<DiscordMessage>("POST", `/channels/${channelId}/messages`, {
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

export const getGuildRoles = async (
  guildId: string,
  profileId: number | string | null = null,
): Promise<DiscordRoleSummary[]> => {
  const pid = profileId != null ? Number(profileId) : null;
  const token = await resolveBotToken(pid);
  const roles = await apiRequest<DiscordRoleSummary[]>(
    "GET",
    `/guilds/${encodeURIComponent(guildId)}/roles`,
    { token },
  );
  if (!roles) return [];
  return roles
    .map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color ?? 0,
      position: r.position ?? 0,
      hoist: r.hoist ?? false,
    }))
    .sort((a, b) => (b.position ?? 0) - (a.position ?? 0));
};

export const searchGuildMembers = async (
  guildId: string,
  query: string,
  profileId: number | string | null = null,
): Promise<DiscordMemberSummary[]> => {
  const trimmed = (query ?? "").trim();
  if (!trimmed) return [];

  const pid = profileId != null ? Number(profileId) : null;
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
        return [{
          id: member.user?.id ?? trimmed,
          username: member.user?.username ?? member.username ?? "",
          global_name: member.user?.global_name ?? member.global_name ?? null,
          nickname: member.nick ?? member.nickname ?? null,
          avatar: member.user?.avatar ?? member.avatar ?? null,
        }];
      }
    } catch {
      // Not found by ID or user not in guild, fall through to name search
    }
  }

  try {
    const rawMembers = await apiRequest<any[]>(
      "GET",
      `/guilds/${encodeURIComponent(guildId)}/members/search?query=${encodeURIComponent(trimmed)}&limit=25`,
      { token },
    );
    if (!rawMembers || !Array.isArray(rawMembers)) return [];
    return rawMembers.map((m) => ({
      id: m.user?.id ?? m.id,
      username: m.user?.username ?? m.username ?? "",
      global_name: m.user?.global_name ?? null,
      nickname: m.nick ?? null,
      avatar: m.user?.avatar ?? m.avatar ?? null,
    }));
  } catch (err) {
    log.warn(`Member search failed for guild ${guildId}: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
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

/** Resolve who a token belongs to — doubles as a validity check. */
export const getBotIdentity = async (token: string): Promise<DiscordUser | null> =>
  apiRequest<DiscordUser>("GET", "/users/@me", { token });

export const addGuildMemberRole = async (
  guildId: string,
  userId: string,
  roleId: string,
  token: string,
): Promise<boolean> => {
  await apiRequest("PUT", `/guilds/${guildId}/members/${userId}/roles/${roleId}`, { token });
  return true;
};

export const removeGuildMemberRole = async (
  guildId: string,
  userId: string,
  roleId: string,
  token: string,
): Promise<boolean> => {
  await apiRequest("DELETE", `/guilds/${guildId}/members/${userId}/roles/${roleId}`, { token });
  return true;
};

export const getGuildMember = async (
  guildId: string,
  userId: string,
  token: string,
): Promise<GuildMember | null> =>
  apiRequest<GuildMember>("GET", `/guilds/${guildId}/members/${userId}`, { token });

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

  return apiRequest<DiscordMessage>("POST", `/channels/${channel.id}/messages`, {
    token,
    body: { ...payload, allowed_mentions: payload.allowed_mentions ?? { parse: [] } },
  });
};

export const deleteChannelMessage = async (
  channelId: string,
  messageId: string,
  token: string,
): Promise<boolean> => {
  await apiRequest("DELETE", `/channels/${channelId}/messages/${messageId}`, { token });
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
  apiRequest<{ id: string }>("POST", `/channels/${channelId}/messages/${messageId}/threads`, {
    token,
    body: { name },
  });

/* ── Interaction responses ────────────────────────────────────────────────── */

/**
 * Respond to an interaction using its `application_id` + `token`.
 *
 * These calls need no bot token — the interaction token *is* the credential, and
 * it expires 15 minutes after the interaction was created.
 */
export const createInteractionResponse = async (
  applicationId: string,
  interactionToken: string,
  response: InteractionResponse,
): Promise<unknown> =>
  apiRequest("POST", `/interactions/${applicationId}/${interactionToken}/callback`, {
    auth: "",
    body: response,
  });

export const createFollowupMessage = async (
  applicationId: string,
  interactionToken: string,
  payload: DiscordMessagePayload,
): Promise<unknown> =>
  apiRequest("POST", `/webhooks/${applicationId}/${interactionToken}`, { body: payload });

export const editOriginalResponse = async (
  applicationId: string,
  interactionToken: string,
  payload: DiscordMessagePayload,
): Promise<unknown> =>
  apiRequest("PATCH", `/webhooks/${applicationId}/${interactionToken}/messages/@original`, {
    body: payload,
  });

/** Defer a response so we still have time to do slow work before replying. */
export const deferResponse = async (
  applicationId: string,
  interactionToken: string,
  { ephemeral = false }: { ephemeral?: boolean } = {},
): Promise<unknown> =>
  createInteractionResponse(applicationId, interactionToken, {
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
  searchGuildMembers,
  getChannelMessages,
  getBotIdentity,
  addGuildMemberRole,
  removeGuildMemberRole,
  getGuildMember,
  hasRole,
  sendDirectMessage,
  deleteChannelMessage,
  createThreadFromMessage,
  createInteractionResponse,
  createFollowupMessage,
  editOriginalResponse,
  deferResponse,
};
