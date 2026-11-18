export type EditTargetParseResult =
  | { valid: true; ids: string[] }
  | { valid: false; message: string };

/**
 * Parse the comma-separated message IDs used when editing across channels.
 * Discord message IDs are snowflakes, and each selected channel needs its own
 * target ID because a message ID belongs to exactly one channel.
 */
export const parseEditTargetMessageIds = (
  rawValue: string,
  expectedChannelCount: number,
): EditTargetParseResult => {
  const ids = rawValue.split(",").map((value) => value.trim()).filter(Boolean);

  if (ids.length === 0) {
    return { valid: false, message: "Enter one target message ID for each selected channel." };
  }

  if (ids.length !== expectedChannelCount) {
    return {
      valid: false,
      message: `Provide exactly ${expectedChannelCount} target message ID(s), in the same order as the selected channels.`,
    };
  }

  if (!ids.every((id) => /^\d{17,20}$/.test(id))) {
    return { valid: false, message: "Each target message ID must be a 17–20 digit Discord snowflake." };
  }

  if (new Set(ids).size !== ids.length) {
    return { valid: false, message: "Each selected channel must have a different target message ID." };
  }

  return { valid: true, ids };
};
