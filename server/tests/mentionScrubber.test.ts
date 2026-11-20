import { describe, expect, it } from "vitest";
import { sanitizeAllowedMentions } from "../src/utils/mentionScrubber.js";

describe("allowed mention payload sanitization", () => {
  it("uses Discord's everyone parser for an authorized @here mention", () => {
    const payload = { content: "@here maintenance notice" };
    const permissions = {
      can_mention_everyone: 0,
      can_mention_here: 1,
      can_mention_roles: 0,
      allowed_role_mention_ids: "[]",
    };

    expect(sanitizeAllowedMentions(payload, permissions)).toMatchObject({
      allowed_mentions: { parse: ["everyone"] },
    });
  });

  it("does not add an invalid parser value when @here is not allowed", () => {
    const payload = { content: "@here maintenance notice" };
    const permissions = {
      can_mention_everyone: 0,
      can_mention_here: 0,
      can_mention_roles: 0,
      allowed_role_mention_ids: "[]",
    };

    expect(sanitizeAllowedMentions(payload, permissions)).toMatchObject({
      allowed_mentions: { parse: [] },
    });
  });
});
