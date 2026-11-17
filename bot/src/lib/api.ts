import type { FlowRegistration, SendSuccessResponse } from "@dmb/shared";
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
  actor?: { id: string; username?: string };
}

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { method = "GET", body, anonymous = false, signal, actor } = options;

  let response: Response;
  try {
    const timeoutSignal = AbortSignal.timeout(15_000);
    const requestSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(anonymous ? {} : { "x-admin-key": env.adminApiKey }),
        ...(actor ? { "x-staff-id": actor.id, ...(actor.username ? { "x-staff-username": actor.username } : {}) } : {}),
      },
      body:
        body === undefined
          ? undefined
          : JSON.stringify(body, (_, v) => (typeof v === "bigint" ? v.toString() : v)),
      signal: requestSignal,
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

export const listWeaoExploits = async (query = "", actor?: { id: string; username?: string }): Promise<WeaoExploitChoice[]> => {
  const qs = query ? `?q=${encodeURIComponent(query)}` : "";
  const data = await request<{ exploits: WeaoExploitChoice[] }>(`/api/weao/exploits${qs}`, { actor });
  return data?.exploits ?? [];
};

export const resolveWeaoExploit = async (
  exploitName: string,
  actor?: { id: string; username?: string },
): Promise<{
  source: "backup_template" | "custom_executor";
  templateName: string | null;
  exploit: WeaoExploitChoice;
  payload: Record<string, unknown>;
  flows?: FlowRegistration[];
}> => {
  return request("/api/weao/resolve-exploit", {
    method: "POST",
    body: { exploit: exploitName },
    actor,
  });
};

export const syncTrackedMessages = async (): Promise<{
  checked: number;
  updated: number;
  removed: number;
  errors: number;
}> => {
  const data = await request<{ ok: boolean; result: { checked: number; updated: number; removed: number; errors: number } }>(
    "/api/tracking/sync",
    { method: "POST" },
  );
  return data?.result ?? { checked: 0, updated: 0, removed: 0, errors: 0 };
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
    channelId: string;
    payload?: Record<string, unknown>;
    content?: string;
    flows?: FlowRegistration[];
    templateId?: number | null;
    exploitName?: string | null;
    authorUserId?: string | null;
    authorUsername?: string | null;
  }) =>
    request<SendSuccessResponse>("/api/send", {
      method: "POST",
      body: {
        mode: "bot",
        channelId: body.channelId,
        payload: body.payload ?? {
          content: body.content ?? "",
        },
        ...(body.flows ? { flows: body.flows } : {}),
        ...(body.templateId ? { templateId: body.templateId } : {}),
        ...(body.exploitName ? { exploitName: body.exploitName } : {}),
        ...(body.authorUserId ? { authorUserId: body.authorUserId } : {}),
      },
      actor: body.authorUserId ? { id: body.authorUserId, username: body.authorUsername ?? undefined } : undefined,
    }),

  listWeaoExploits,
  resolveWeaoExploit,
  syncTrackedMessages,
};

export default api;