import crypto from "node:crypto";
import type { ActionType } from "@dmb/shared";
import { modal } from "./responses.js";
import { configString, type ActionContext, type ActionResponse } from "./types.js";

export const type: ActionType = "open_modal";
export const description = "Open a form the user can fill in";

/**
 * Modals must be acknowledged within 3 seconds, so we return the modal payload
 * directly and let the `MODAL_SUBMIT` interaction (handled in the interaction
 * route) do the actual work.
 */
export const run = async ({
  config,
}: ActionContext): Promise<ActionResponse | undefined> => {
  const components = Array.isArray(config.components) ? config.components : [];

  // A modal with no inputs is rejected by Discord.
  if (components.length === 0) return undefined;

  return modal({
    customId: configString(config, "customId") ?? `modal:${crypto.randomUUID()}`,
    title: configString(config, "title") ?? "Input",
    components,
  });
};

export default run;
