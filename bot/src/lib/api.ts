import type { SendSuccessResponse } from "@dmb/shared";
import { env } from "./env.js";

/**
 * Thin client for the existing Express API.
 *
 * The gateway does **not** duplicate sending, validation or action execution —
 * it calls the same endpoints the web editor does. That means one implementation
 * of the payload rules, one place that holds the bot token, and no second SQLite
 * writer. Everything here is just HTTP.
 *
 * `x-admin-key` is the machine credential the API already expects
 * (`server/src/middleware/auth.ts`).
 */

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
  /** True when this API posted the reply to Discord on our behalf. */
  delivered: boolean;
  /** The `InteractionResponseType` that was sent. */
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

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** No admin key: used for the public health endpoint. */
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

export const api = {
  health: (signal?: AbortSignal) =>
    request<HealthResponse>("/api/health", { anonymous: true, signal }),

  /**
   * Hand a gateway interaction to the API so it can execute the flow and reply.
   *
   * This is what lets the action system work on a host with **no public
   * address**: Discord delivers the interaction over the gateway (an outbound
   * WebSocket), and the API — which owns the flows and the bot token — posts the
   * reply back to Discord using the interaction token. Nothing needs to be
   * reachable from the internet.
   *
   * `interaction` is the raw `interaction.toJSON()` payload, forwarded as-is so
   * the API sees the same shape Discord's webhook delivery would have given it.
   */
  relayInteraction: (interaction: unknown) =>
    request<RelayResult>("/api/interactions/relay", { method: "POST", body: interaction }),

  /** Send a message as the bot. Mirrors `client/src/api/client.ts`. */
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
};

export default api;
