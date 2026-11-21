import type {
  ActionHandlerMeta,
  ActionType,
  SendMode,
  SendRequestBody,
  SendSuccessResponse,
  StoredActionDefinition,
} from "@dmb/shared";

/**
 * Backend API client.
 *
 * One `request()` helper handles base URL, JSON encoding, the admin key header
 * and error unwrapping, so every call site reads like a function call rather
 * than a fetch dance.
 *
 * An empty base URL is intentional and useful: in development Vite proxies `/api`
 * to the Express server, so relative requests just work.
 */

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
let staffIdProvider: () => string | null = () => null;
export const registerStaffIdProvider = (provider: () => string | null): void => { staffIdProvider = provider; };
const ADMIN_KEY = import.meta.env.DEV ? (import.meta.env.VITE_ADMIN_API_KEY ?? "") : "";
const ENV_STAFF_ID = import.meta.env.VITE_STAFF_DISCORD_ID ?? "";

/** Thrown for any non-2xx response; carries the server's error code. */
export class ApiRequestError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly details: unknown;

  constructor(
    message: string,
    { status, code, details }: { status?: number; code?: string; details?: unknown } = {},
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

import type { CurrentUser } from "../store/globalStore";

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
}

export const request = async <T>(path: string, { method = "GET", body, signal }: RequestOptions = {}): Promise<T> => {
  let response: Response;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  // Resolve active staff ID: store user (if authenticated) > localStorage > ENV_STAFF_ID
  const staffId = staffIdProvider() || (typeof localStorage !== "undefined" ? localStorage.getItem("staff_id") : "") || ENV_STAFF_ID || "";

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      credentials: "include", // CRITICAL: transmit session cookies for OAuth2
      headers: {
        ...(!isFormData && body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(ADMIN_KEY ? { "x-admin-key": ADMIN_KEY } : {}),
        ...(staffId && !ADMIN_KEY ? { "x-staff-id": staffId } : {}),
      },
      body: isFormData ? (body as FormData) : body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiRequestError(import.meta.env.DEV ? "Can't reach the server. Check that the development server is running on port 3001." : "Can't reach the server. Please try again in a moment.", {
      code: "network_error",
    });
  }

  if (response.status === 204) return null as T;

  const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
  const payload: unknown = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const record = (payload ?? {}) as Record<string, unknown>;
    throw new ApiRequestError(
      typeof record.error === "string" ? record.error : `Request failed (${response.status})`,
      {
        status: response.status,
        code: typeof record.code === "string" ? record.code : undefined,
        details: record.details,
      },
    );
  }

  return payload as T;
};

/* ── Response shapes ──────────────────────────────────────────────────────── */

export interface HealthResponse {
  status: string;
  environment: string;
  uptimeSeconds: number;
  time: string;
  database: { connected: boolean; users: number | null };
  discord: {
    publicKeyConfigured: boolean;
    botTokenConfigured: boolean;
    applicationIdConfigured: boolean;
  };
}

export interface ConfigResponse {
  actionTypes: ActionHandlerMeta[];
  features: { botSendAvailable: boolean; interactionsConfigured: boolean };
}

export interface TemplateListResponse {
  templates: TemplateSummary[];
}

export interface TemplateSummary {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  preview_image_url: string | null;
  is_public: number;
  is_tracked?: number,
  expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateDetailResponse {
  template: TemplateSummary & {
    data: unknown;
    actions: StoredActionDefinition[];
  };
}

export interface BotProfile {
  id: number;
  user_id: number;
  name: string;
  public_key: string;
  application_id: string;
  default_guild_id: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
  has_token: boolean;
}

export interface BotListResponse {
  profiles: BotProfile[];
}

export interface TemplateSaveBody {
  name: string;
  data?: unknown;
  actions?: unknown[];
  expiresAt?: string | null;
  isTracked?: boolean;
}

export const api = {
  health: () => request<HealthResponse>("/api/health"),
  weao: {
    changelogs: (exploit: string, selector = "changelogs") =>
      request<{ exploit: string; count: number; entries: unknown[]; formatted: string }>(
        `/api/weao/changelogs/${encodeURIComponent(exploit)}?selector=${encodeURIComponent(selector)}`,
      ),
  },
  config: () => request<ConfigResponse>("/api/config"),

  /** Send a message through the backend (required for bot-token mode or multipart uploads). */
  send: (body: SendRequestBody | FormData) =>
    request<SendSuccessResponse>("/api/send", { method: "POST", body }),

  templates: {
    list: (q?: string) =>
      request<TemplateListResponse>(
        `/api/templates${q ? `?q=${encodeURIComponent(q)}` : ""}`,
      ),
    get: (id: number) => request<TemplateDetailResponse>(`/api/templates/${encodeURIComponent(String(id))}`),
    create: (template: TemplateSaveBody) =>
      request<TemplateDetailResponse>("/api/templates", { method: "POST", body: template }),
    update: (id: number, template: TemplateSaveBody) =>
      request<TemplateDetailResponse>(`/api/templates/${encodeURIComponent(String(id))}`, { method: "PUT", body: template }),
    remove: (id: number) => request<null>(`/api/templates/${encodeURIComponent(String(id))}`, { method: "DELETE" }),
  },

  profiles: {
    listBots: () => request<BotListResponse>("/api/profiles/bots"),
    createBot: (profile: Record<string, unknown>) =>
      request<{ profile: BotProfile }>("/api/profiles/bots", { method: "POST", body: profile }),
    updateBot: (id: number, profile: Record<string, unknown>) =>
      request<{ profile: BotProfile }>(`/api/profiles/bots/${encodeURIComponent(String(id))}`, {
        method: "PATCH",
        body: profile,
      }),
    removeBot: (id: number) => request<null>(`/api/profiles/bots/${encodeURIComponent(String(id))}`, { method: "DELETE" }),
  },

  discord: {
    identity: (profileId?: number) =>
      request<{ id: string; username: string; avatar: string | null } | null>(
        `/api/discord/identity${profileId ? `?profileId=${encodeURIComponent(String(profileId))}` : ""}`
      ),
    resolveUsers: (ids: string[], signal?: AbortSignal, guildId?: string) =>
      request<{
        users: Record<
          string,
          {
            id: string;
            username: string;
            globalName: string | null;
            nickname: string | null;
            clanTag: string | null;
            avatarUrl: string;
            profileUrl: string;
          }
        >;
        failedIds: string[];
      }>(
        `/api/discord/users/resolve?ids=${encodeURIComponent(ids.join(","))}${guildId ? `&guildId=${encodeURIComponent(guildId)}` : ""}`,
        { signal },
      ),
    guilds: (profileId?: number) =>
      request<{ guilds: { id: string; name: string; icon: string | null }[] }>(
        `/api/discord/guilds${profileId ? `?profileId=${encodeURIComponent(String(profileId))}` : ""}`
      ),
    channels: (guildId: string, profileId?: number) =>
      request<{ channels: { id: string; name: string; type: number; parent_id?: string | null }[] }>(
        `/api/discord/guilds/${encodeURIComponent(guildId)}/channels${profileId ? `?profileId=${encodeURIComponent(String(profileId))}` : ""}`
      ),
    roles: (guildId: string, profileId?: number) =>
      request<{ roles: { id: string; name: string; color: number }[] }>(
        `/api/discord/guilds/${encodeURIComponent(guildId)}/roles${profileId ? `?profileId=${encodeURIComponent(String(profileId))}` : ""}`
      ),
    searchMembers: (guildId: string, query: string, profileId?: number) =>
      request<{
        members: Array<{
          id: string;
          username: string;
          global_name: string | null;
          nickname: string | null;
          avatar: string | null;
        }>;
      }>(
        `/api/discord/guilds/${encodeURIComponent(guildId)}/members/search?query=${encodeURIComponent(query)}${profileId ? `&profileId=${encodeURIComponent(String(profileId))}` : ""}`
      ),
    emojis: (guildId: string, profileId?: number) =>
      request<{
        emojis: Array<{
          id: string;
          name: string;
          animated?: boolean;
          available?: boolean;
        }>;
      }>(
        `/api/discord/guilds/${encodeURIComponent(guildId)}/emojis${profileId ? `?profileId=${encodeURIComponent(String(profileId))}` : ""}`
      ),
    auditLogs: (guildId: string, params?: { limit?: number; page?: number; action?: string; channelId?: string; webhookId?: string; userId?: string }) => {
      const sp = new URLSearchParams();
      if (params?.limit) sp.set("limit", String(params.limit));
      if (params?.page) sp.set("page", String(params.page));
      if (params?.action) sp.set("action", params.action);
      if (params?.channelId) sp.set("channelId", params.channelId);
      if (params?.webhookId) sp.set("webhookId", params.webhookId);
      if (params?.userId) sp.set("userId", params.userId);
      const query = sp.toString() ? `?${sp.toString()}` : "";
      return request<{
        entries: Array<{
          id: string;
          guild_id: string;
          channel_id?: string | null;
          user_id?: string | null;
          user_name?: string | null;
          type: string;
          reason?: string | null;
          details?: string | null;
          created_at: string;
        }>;
        total: number;
        query: { limit: number; page: number };
      }>(`/api/discord/guilds/${encodeURIComponent(guildId)}/audit-logs${query}`);
    },
    sessions: (guildId: string, params?: { channelId?: string; cursor?: number }) => {
      const sp = new URLSearchParams();
      if (params?.channelId) sp.set("channelId", params.channelId);
      if (params?.cursor !== undefined) sp.set("cursor", String(params.cursor));
      const query = sp.toString() ? `?${sp.toString()}` : "";
      return request<{
        cursor: number;
        channelId: string | null;
        results: Array<{
          tokenId: string;
          createdAt: number;
          expiresAt: number;
          permissions: string;
          owner: boolean;
          me: boolean;
          channelId?: string | null;
        }>;
      }>(`/api/discord/guilds/${encodeURIComponent(guildId)}/sessions${query}`);
    },
    revokeSession: (guildId: string, tokenId: string) =>
      request<{ ok: boolean; revoked: number }>(`/api/discord/guilds/${encodeURIComponent(guildId)}/sessions/${encodeURIComponent(tokenId)}`, { method: "DELETE" }),
  },

  auth: {
    me: () => request<{ user: CurrentUser | null }>("/api/auth/me"),
    devLogin: () => request<{ ok: boolean; user: CurrentUser }>("/api/auth/dev-login", { method: "POST" }),
    logout: () => request<{ success: boolean; ok: boolean }>("/api/auth/logout", { method: "POST" }),
  },

  executors: {
    list: (includeAll = false) =>
      request<{
        executors: Array<{
          id: string;
          title: string;
          enabled: number;
          author_id: string | null;
          template_id: number | null;
          custom_payload: string | null;
          created_at: number;
          updated_at: number;
        }>;
      }>(`/api/executors${includeAll ? "?all=true" : ""}`),
    upsert: (body: {
      id: string;
      title: string;
      enabled?: boolean;
      author_id?: string | null;
      template_id?: number | null;
      custom_payload?: unknown;
    }) =>
      request<{ ok: boolean; executor: any }>("/api/executors", {
        method: "POST",
        body,
      }),
    delete: (id: string) =>
      request<{ ok: boolean }>(`/api/executors/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
  },

  tracking: {
    list: () => request<{ messages: any[] }>("/api/tracking/messages"),
    sync: () =>
      request<{
        ok: boolean;
        total: number;
        updated: number;
        removed: number;
        errors: number;
      }>("/api/tracking/sync", {
        method: "POST",
      }),
    track: (body: {
      channelId: string;
      messageId: string;
      templateId?: number | null;
      exploitName?: string | null;
      authorUserId?: string | null;
      rawPayload?: any;
    }) =>
      request<{ ok: boolean }>("/api/tracking/track", {
        method: "POST",
        body,
      }),
    update: (id: number, body: { name?: string | null; expiresAt?: string | null; track?: boolean }) =>
      request<{ ok: boolean; tracked: boolean; message?: any }>(`/api/tracking/messages/${encodeURIComponent(String(id))}`, {
        method: "PATCH",
        body,
      }),
    untrack: (id: number) =>
      request<{ ok: boolean; deletedId: number }>(`/api/tracking/messages/${encodeURIComponent(String(id))}`, {
        method: "DELETE",
      }),
  },
};

export type { ActionType, SendMode };

export default api;
