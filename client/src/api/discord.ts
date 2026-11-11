import type { DiscordMessagePayload } from "@dmb/shared";

/**
 * Direct Discord webhook sending from the browser.
 *
 * Webhook URLs are designed to be used client-side  anyone holding the URL can
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
