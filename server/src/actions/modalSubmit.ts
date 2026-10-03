import type { ActionType } from "@dmb/shared";
import { ephemeral } from "./responses.js";
import type { ActionContext, ActionResponse } from "./types.js";

export const type: ActionType = "modal_submit" as ActionType;
export const description = "Acknowledge modal submission";

export const run = async (_context: ActionContext): Promise<ActionResponse | undefined> => {
  return ephemeral("✅ Thank you! Your submission has been received.");
};

export default run;