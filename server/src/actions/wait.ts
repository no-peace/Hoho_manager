import type { ActionType } from "@dmb/shared";
import { configNumber, type ActionContext, type ActionResponse } from "./types.js";

export const type: ActionType = "wait";
export const description = "Pause before the next step";

const MAX_WAIT_SECONDS = 10;
const ACK_BUDGET_SECONDS = 3;

/**
 * Sleeps before continuing the chain.
 *
 * Discord expects an acknowledgement within 3 seconds, so anything longer must
 * be preceded by a deferral. The cap keeps a mis-set value from hanging the
 * request indefinitely.
 */
export const run = async ({
  config,
  logger,
}: ActionContext): Promise<ActionResponse | undefined> => {
  const requested = configNumber(config, "seconds") ?? 1;
  const seconds = Math.min(Math.max(requested, 0), MAX_WAIT_SECONDS);

  if (seconds > ACK_BUDGET_SECONDS) {
    logger.warn(
      `wait: ${seconds}s exceeds Discord's ${ACK_BUDGET_SECONDS}s ack window — make sure the flow defers first.`,
    );
  }

  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  return undefined; // continue to the next step
};

export default run;
