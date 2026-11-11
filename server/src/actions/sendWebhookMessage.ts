import type { ActionType } from "@dmb/shared";
import { actionFailed } from "./responses.js";
import type { ActionContext, ActionResponse } from "./types.js";

export const type: ActionType = "send_webhook_message";
export const description = "Deprecated: webhook URL message sending is disabled";

/**
 * Keep the handler registered so old saved flows fail clearly instead of
 * silently skipping a step or attempting to use a stored webhook credential.
 */
export const run = async (_context: ActionContext): Promise<ActionResponse> =>
  actionFailed(
    "Webhook URL message sending is disabled. Replace this step with send_message to use the configured server bot.",
  );

export default run;
