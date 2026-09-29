import type { ActionType } from "@dmb/shared";
import type { ActionContext, ActionResponse } from "./types.js";

export const type: ActionType = "dud";
export const description = "Do nothing";

/**
 * The explicit no-op.
 *
 * Every new button starts life as `action:dud`, so this handler exists mostly to
 * make that default honest: clicking an unconfigured button does nothing visible
 * rather than tripping the "no handler registered" warning in the executor.
 */
export const run = async (_context: ActionContext): Promise<ActionResponse | undefined> => {
  // `undefined` tells the executor to acknowledge quietly.
  return undefined;
};

export default run;
