import type { ActionType } from "@dmb/shared";
import { ephemeral } from "./responses.js";
import { configString, type ActionContext, type ActionResponse } from "./types.js";

export const type: ActionType = "send_ephemeral_reply";
export const description = "Show the clicker a private message";

export const run = async ({
  config,
}: ActionContext): Promise<ActionResponse | undefined> => {
  const content = configString(config, "content") ?? "\ud83d\udc4b";
  const embeds = Array.isArray(config.embeds) ? config.embeds : [];

  return ephemeral(content, embeds.length > 0 ? { embeds } : {});
};

export default run;
