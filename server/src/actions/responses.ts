import { InteractionResponseType, MessageFlags } from "@dmb/shared";
import type { ActionResponse } from "./types.js";

/**
 * Small builders for interaction callback payloads.
 *
 * Handlers return one of these instead of hand-rolling the numeric type codes,
 * which keeps the action modules readable.
 */

/** A message only the invoking user can see. */
export const ephemeral = (
  content: string,
  extra: Record<string, unknown> = {},
): ActionResponse => ({
  type: InteractionResponseType.ChannelMessageWithSource,
  data: {
    content,
    flags: MessageFlags.Ephemeral,
    ...extra,
  },
});

/** A public reply in the channel. */
export const reply = (content: string, extra: Record<string, unknown> = {}): ActionResponse => ({
  type: InteractionResponseType.ChannelMessageWithSource,
  data: { content, ...extra },
});

/** Replace the message that carried the clicked component. */
export const updateMessage = (data: Record<string, unknown>): ActionResponse => ({
  type: InteractionResponseType.UpdateMessage,
  data,
});

/** Acknowledge the click without a visible reply. */
export const acknowledge = (): ActionResponse => ({
  type: InteractionResponseType.DeferredUpdateMessage,
});

/** Present a modal form. */
export const modal = ({
  customId,
  title,
  components,
}: {
  customId: string;
  title: string;
  components: unknown[];
}): ActionResponse => ({
  type: InteractionResponseType.Modal,
  data: { custom_id: customId, title, components },
});

/** Standard "this action failed" message used by handlers and the executor. */
export const actionFailed = (
  message = "That action could not be completed.",
): ActionResponse => ephemeral(`\u26a0\ufe0f ${message}`);
