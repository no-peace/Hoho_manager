import crypto from "node:crypto";
import type { ActionType } from "@dmb/shared";
import { buildCustomId } from "@dmb/shared";
import { modal } from "./responses.js";
import { configString, type ActionContext, type ActionResponse } from "./types.js";

export const type: ActionType = "open_modal";
export const description = "Open a form the user can fill in";

export const run = async ({
  config,
}: ActionContext): Promise<ActionResponse | undefined> => {
  const components = Array.isArray(config.components) ? config.components : [];

  // A modal with no inputs is rejected by Discord
  if (components.length === 0) return undefined;

  // Use the configured customId, or build a valid action: customId using buildCustomId
  const modalId =
    configString(config, "customId") ??
    buildCustomId("modal_submit", { id: crypto.randomUUID() });

  return modal({
    customId: modalId,
    title: configString(config, "title") ?? "Submission Form",
    components,
  });
};

export default run;