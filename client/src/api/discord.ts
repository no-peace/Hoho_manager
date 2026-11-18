import type { DiscordMessagePayload } from "@dmb/shared";

/**
 * Legacy direct-webhook API stub retained for backwards-compatible imports.
 * Arbitrary webhook URL delivery is disabled; messages must use the configured
 * server bot through the authenticated backend.
 */
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

export interface WebhookSendOptions {
  threadId?: string;
  wait?: boolean;
  signal?: AbortSignal;
}

/** Arbitrary Discord webhook URL sending is disabled on this client. */
export const sendWebhookDirect = async (
  _webhookUrl: string,
  _payload: DiscordMessagePayload,
  _options: WebhookSendOptions = {},
): Promise<never> => {
  throw new WebhookError(
    "Arbitrary Discord webhook URL sending is disabled. Use the configured server bot.",
  );
};

export default { sendWebhookDirect };
