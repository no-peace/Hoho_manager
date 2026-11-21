import { describe, expect, it } from "vitest";
import { sanitizeAllowedMentions, scrubMentions } from "../src/utils/mentionScrubber.js";

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

  it("keeps explicit user IDs separate from parser-wide mention types", () => {
    const payload = {
      content: "@everyone <@123456789012345678>",
      allowed_mentions: { users: ["123456789012345678"] },
    };
    const permissions = {
      can_mention_everyone: 1,
      can_mention_here: 1,
      can_mention_roles: 1,
      allowed_role_mention_ids: "[]",
    };

    expect(sanitizeAllowedMentions(payload, permissions)).toMatchObject({
      allowed_mentions: { users: ["123456789012345678"] },
    });
    expect(sanitizeAllowedMentions(payload, permissions).allowed_mentions).not.toHaveProperty("parse");
  });

  it("intersects explicit role IDs with the staff role allowlist", () => {
    const allowedRoleId = "123456789012345678";
    const blockedRoleId = "223456789012345678";
    const payload = {
      content: `<@&${allowedRoleId}> <@&${blockedRoleId}>`,
      allowed_mentions: { roles: [allowedRoleId, blockedRoleId] },
    };
    const permissions = {
      can_mention_everyone: 1,
      can_mention_here: 0,
      can_mention_roles: 0,
      allowed_role_mention_ids: JSON.stringify([allowedRoleId]),
    };

    const scrubbed = scrubMentions(payload, permissions).payload;
    const result = sanitizeAllowedMentions(scrubbed, permissions);

    expect(result).toMatchObject({
      content: `<@&${allowedRoleId}> @\u200b${blockedRoleId}`,
      allowed_mentions: { roles: [allowedRoleId] },
    });
    expect(result.allowed_mentions).not.toHaveProperty("parse");
  });

  it("uses valid parser types for specific role allowlists after mention scrubbing", () => {
    const payload = { content: "<@&123456789012345678>" };
    const permissions = {
      can_mention_everyone: 1,
      can_mention_here: 0,
      can_mention_roles: 0,
      allowed_role_mention_ids: '["123456789012345678"]',
    };

    expect(sanitizeAllowedMentions(payload, permissions)).toMatchObject({
      allowed_mentions: { parse: ["everyone", "roles"] },
    });
    expect(sanitizeAllowedMentions(payload, permissions).allowed_mentions).not.toHaveProperty("roles");
  });

  it("keeps an explicit role allowlist restrictive when broad role mentions are enabled", () => {
    const allowedRoleId = "123456789012345678";
    const blockedRoleId = "223456789012345678";
    const payload = {
      content: `<@&${allowedRoleId}> <@&${blockedRoleId}>`,
      allowed_mentions: { roles: [allowedRoleId, blockedRoleId] },
    };
    const permissions = {
      can_mention_everyone: 0,
      can_mention_here: 0,
      can_mention_roles: 1,
      allowed_role_mention_ids: JSON.stringify([allowedRoleId]),
    };

    const scrubbed = scrubMentions(payload, permissions).payload;
    const result = sanitizeAllowedMentions(scrubbed, permissions);

    expect(result).toMatchObject({
      content: `<@&${allowedRoleId}> @\u200b${blockedRoleId}`,
      allowed_mentions: { roles: [allowedRoleId] },
    });
    expect(result.allowed_mentions).not.toHaveProperty("parse");
  });
});
