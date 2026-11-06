import type { SendSuccessResponse } from "@dmb/shared";
import { env } from "./env.js";

export class ApiError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface RelayResult {
  ok: boolean;
  delivered: boolean;
  type?: number;
}

export interface HealthResponse {
  status: string;
  environment: string;
  uptimeSeconds: number;
  database: { connected: boolean; users: number | null };
  discord: {
    publicKeyConfigured: boolean;
    botTokenConfigured: boolean;
    applicationIdConfigured: boolean;
  };
}

export interface WeaoExploitChoice {
  title: string;
  version: string;
  updateStatus: boolean;
  suncPercentage?: number;
  platform?: string;
  hasBackupTemplate?: boolean;
  backupTemplateName?: string | null;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  anonymous?: boolean;
  signal?: AbortSignal;
}

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { method = "GET", body, anonymous = false, signal } = options;

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(anonymous ? {} : { "x-admin-key": env.adminApiKey }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ApiError(`Can't reach the API at ${env.apiBaseUrl}: ${reason}`);
  }

  const isJson = (response.headers.get("content-type") ?? "").includes("application/json");
  const payload: unknown = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const record = (payload ?? {}) as Record<string, unknown>;
    const details = Array.isArray(record.details) ? (record.details as string[]) : [];
    const message =
      typeof record.error === "string"
        ? [record.error, ...details].join("\n")
        : `API request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
};

export const listWeaoExploits = async (query = ""): Promise<WeaoExploitChoice[]> => {
  const qs = query ? `?q=${encodeURIComponent(query)}` : "";
  const data = await request<{ exploits: WeaoExploitChoice[] }>(`/api/weao/exploits${qs}`);
  return data?.exploits ?? [];
};

export const resolveWeaoExploit = async (
  exploitName: string,
): Promise<{
  source: "backup_template" | "adaptive_default";
  templateName: string | null;
  exploit: WeaoExploitChoice;
  payload: Record<string, unknown>;
}> => {
  return request("/api/weao/resolve-exploit", {
    method: "POST",
    body: { exploit: exploitName },
  });
};

export const api = {
  health: (signal?: AbortSignal) =>
    request<HealthResponse>("/api/health", { anonymous: true, signal }),

  relayInteraction: (interaction: unknown) =>
    request<RelayResult>("/api/interactions/relay", {
      method: "POST",
      body: interaction,
    }),

  sendMessage: (body: {
    content: string;
    channelId: string;
    username?: string;
    avatarUrl?: string;
  }) =>
    request<SendSuccessResponse>("/api/send", {
      method: "POST",
      body: {
        mode: "bot",
        channelId: body.channelId,
        payload: {
          content: body.content,
          ...(body.username ? { username: body.username } : {}),
          ...(body.avatarUrl ? { avatar_url: body.avatarUrl } : {}),
        },
      },
    }),

  listWeaoExploits,
  resolveWeaoExploit,
};

export default api;