import { ACTION_PREFIX, ACTION_SEPARATOR, Limits } from "./constants.js";
import type { ActionConfig, ParsedCustomId } from "./types.js";

/**
 * Custom-id codec for the action system.
 *
 * Wire format:  action:<type>:<jsonParams>
 * Examples:     action:add_role:{"roleId":"123"}
 *               action:send_dm:{"content":"hi"}
 *               action:dud
 *
 * Imported by both the client (when a user builds a button) and the server (when
 * an interaction arrives), so the two can never drift apart.
 *
 * NOTE: Discord caps `custom_id` at 100 characters. Keep params short — pass an
 * id rather than an entire message payload.
 */

/**
 * Build a custom id.
 * @throws if the result would exceed Discord's 100-character limit.
 */
export const buildCustomId = (type: string, params?: ActionConfig | null): string => {
  const parts = [ACTION_PREFIX, type];
  if (params && Object.keys(params).length > 0) {
    parts.push(JSON.stringify(params));
  }
  const value = parts.join(ACTION_SEPARATOR);

  if (value.length > Limits.components.customId) {
    throw new Error(
      `custom_id is ${value.length} chars, over Discord's ${Limits.components.customId} limit. ` +
        "Store large payloads server-side and reference them by id.",
    );
  }
  return value;
};

/**
 * Parse a custom id.
 *
 * Returns `null` for anything that is not one of ours, which lets the
 * interaction router ignore ids it does not own instead of throwing.
 */
export const parseCustomId = (value: unknown): ParsedCustomId | null => {
  if (typeof value !== "string" || !value.startsWith(`${ACTION_PREFIX}${ACTION_SEPARATOR}`)) {
    return null;
  }

  const firstSplit = value.indexOf(ACTION_SEPARATOR, ACTION_PREFIX.length + 1);
  // No second separator means a bare id with no params (e.g. `action:dud`) —
  // that is exactly what buildCustomId produces for empty params, so it is
  // valid, not foreign. Only an EMPTY type is malformed.
  const type =
    firstSplit === -1
      ? value.slice(ACTION_PREFIX.length + 1)
      : value.slice(ACTION_PREFIX.length + 1, firstSplit);
  if (!type) return null;

  const rawParams = firstSplit === -1 ? "" : value.slice(firstSplit + 1);

  if (!rawParams) return { type, params: {} };

  try {
    const parsed: unknown = JSON.parse(rawParams);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { type, params: {} };
    }
    return { type, params: parsed as ActionConfig };
  } catch {
    // Malformed payload: treat as not-ours rather than throwing.
    return null;
  }
};

/** Human label used in the editor UI for a custom id. */
export const describeCustomId = (value: unknown): string => {
  const parsed = parseCustomId(value);
  if (!parsed) return "No action";
  const label = parsed.type.replace(/_/g, " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
};
