import type { ActionType } from "@dmb/shared";
import { acknowledge, ephemeral } from "./responses.js";
import { configString, type ActionContext, type ActionResponse } from "./types.js";

export const type: ActionType = "stop";
export const description = "End the flow here";

/**
 * Ends the chain and replies.
 *
 * The executor stops at the first step that returns a response, so "stopping" is
 * just returning one:
 *
 *   - with `content` set, the clicker gets an ephemeral message;
 *   - with nothing set, the interaction is acknowledged silently (no visible
 *     change), which is what you want at the end of a branch that did its work
 *     through role edits or DMs.
 *
 * This is how a `check` branch says "done" without falling through into the
 * steps that follow the check.
 */
export const run = async ({
  config,
}: ActionContext): Promise<ActionResponse | undefined> => {
  const content = configString(config, "content", "message");
  return content ? ephemeral(content) : acknowledge();
};

export default run;
