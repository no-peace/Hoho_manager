import { WEBHOOK_URL_REGEX } from "@dmb/shared";
import type { DiscordMessagePayload } from "@dmb/shared";

/**
 * Direct Discord webhook sending from the browser.
 *
 * Webhook URLs are designed to be used client-side — anyone holding the URL can
 * post, which is exactly why the bot-token path instead goes through the backend
 * proxy. Sending directly here avoids a round trip through our server.
 *
 * Trade-off: Discord's CORS policy allows this, but it does expose the webhook to
 * the network tab, so only ever do it with URLs the user themselves supplied.
 */

/** Error carrying Discord's own message plus retry guidance. */
export class WebhookError extends Error {
  readonly status: number | undefined;
  readonly retryAfterMs: number | undefined;

  constructor(
    message: string,
    { status, retryAfterMs }: { status?: number; retryAfterMs?: number } = {},
  ) {
    super(message);
    this.name = "WebhookError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

interface WebhookIds {
  id: string;
  token: string;
}

const parseWebhook = (url: string): WebhookIds => {
  const match = typeof url === "string" ? url.match(WEBHOOK_URL_REGEX) : null;
  const [, id, token] = match ?? [];
  if (!id || !token) throw new WebhookError("That isn't a valid Discord webhook URL.");
  return { id, token };
};

export interface WebhookSendOptions {
  threadId?: string;
  wait?: boolean;
  signal?: AbortSignal;
}

interface DiscordApiError {
  message?: string;
  retry_after?: number;
}

/**
 * POST a message straight to a webhook.
 *
 * @returns the created message when `wait` is true, otherwise `null`
 */
export const sendWebhookDirect = async (
  webhookUrl: string,
  payload: DiscordMessagePayload,
  options: WebhookSendOptions = {},
): Promise<unknown> => {
  const { threadId, wait = true, signal } = options;
  const { id, token } = parseWebhook(webhookUrl);

  const params = new URLSearchParams();
  if (wait) params.set("wait", "true");
  if (threadId) params.set("thread_id", threadId);

  let response: Response;
  try {
    response = await fetch(
      `https://discord.com/api/v10/webhooks/${id}/${token}?${params.toString()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          // Never let a message ping a whole server by accident.
          allowed_mentions: payload.allowed_mentions ?? { parse: [] },
        }),
        signal,
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new WebhookError(
      "Could not reach Discord. The webhook may have been deleted, or a browser extension blocked the request.",
    );
  }

  if (response.status === 204) return null;

  const data = (await response.json().catch(() => null)) as DiscordApiError | null;

  if (response.status === 429) {
    const retryAfterMs = Math.ceil((data?.retry_after ?? 1) * 1000);
    throw new WebhookError(
      `Rate limited by Discord — try again in ${Math.ceil(retryAfterMs / 1000)}s.`,
      { status: 429, retryAfterMs },
    );
  }

  if (!response.ok) {
    throw new WebhookError(
      data?.message ?? `Discord rejected the message (${response.status}).`,
      { status: response.status },
    );
  }

  return data;
};

export default { sendWebhookDirect };
