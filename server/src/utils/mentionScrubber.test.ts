import { describe, it, expect } from "vitest";
import {
  scrubMentions,
  scrubFlows,
  sanitizeAllowedMentions,
  type MentionPermissions,
} from "./mentionScrubber.js";

describe("mentionScrubber", () => {
  const strictPerms: MentionPermissions = {
    can_mention_everyone: 0,
    can_mention_here: 0,
    can_mention_roles: 0,
    allowed_role_mention_ids: "[]",
  };

  describe("case-insensitive scrubbing", () => {
    it("scrubs @everyone, @Everyone, @EVERYONE and records in stripped", () => {
      const payload = {
        content: "Hello @Everyone and @EVERYONE and @everyone!",
      };
      const result = scrubMentions(payload, strictPerms);
      expect(result.payload.content).not.toContain("@everyone");
      expect(result.payload.content).not.toContain("@Everyone");
      expect(result.payload.content).not.toContain("@EVERYONE");
      expect(result.stripped).toContain("@everyone");
    });

    it("scrubs @here, @Here, @HERE and records in stripped", () => {
      const payload = {
        content: "Attention @Here and @HERE!",
      };
      const result = scrubMentions(payload, strictPerms);
      expect(result.payload.content).not.toContain("@here");
      expect(result.payload.content).not.toContain("@Here");
      expect(result.payload.content).not.toContain("@HERE");
      expect(result.stripped).toContain("@here");
    });
  });

  describe("role mention scrubbing and allowlist", () => {
    it("strips all role mentions when can_mention_roles is 0", () => {
      const payload = { content: "Pinging <@&123456789012345678> and <@&987654321098765432>" };
      const result = scrubMentions(payload, strictPerms);
      expect(result.payload.content).not.toContain("<@&123456789012345678>");
      expect(result.payload.content).not.toContain("<@&987654321098765432>");
      expect(result.stripped).toContain("<@&123456789012345678>");
    });

    it("preserves only allowed role IDs when specified in allowlist", () => {
      const rolePerms: MentionPermissions = {
        can_mention_everyone: 0,
        can_mention_here: 0,
        can_mention_roles: 1,
        allowed_role_mention_ids: JSON.stringify(["123456789012345678"]),
      };
      const payload = { content: "Allowed <@&123456789012345678> and blocked <@&999999999999999999>" };
      const result = scrubMentions(payload, rolePerms);
      expect(result.payload.content).toContain("<@&123456789012345678>");
      expect(result.payload.content).not.toContain("<@&999999999999999999>");
      expect(result.stripped).toContain("<@&999999999999999999>");
    });

    it("preserves all roles when can_mention_roles is 1 and allowlist is empty or wildcard", () => {
      const allRolesPerms: MentionPermissions = {
        can_mention_everyone: 0,
        can_mention_here: 0,
        can_mention_roles: 1,
        allowed_role_mention_ids: "[]",
      };
      const payload = { content: "<@&123456789012345678> and <@&999999999999999999>" };
      const result = scrubMentions(payload, allRolesPerms);
      expect(result.payload.content).toContain("<@&123456789012345678>");
      expect(result.payload.content).toContain("<@&999999999999999999>");
      expect(result.stripped).toHaveLength(0);
    });
  });

  describe("sanitizeAllowedMentions", () => {
    it("sanitizes parse and roles strictly according to perms", () => {
      const rolePerms: MentionPermissions = {
        can_mention_everyone: 0,
        can_mention_here: 0,
        can_mention_roles: 1,
        allowed_role_mention_ids: JSON.stringify(["123456789012345678"]),
      };
      const payload = {
        content: "Test",
        allowed_mentions: { parse: ["everyone", "here", "roles"], roles: ["999999999999999999"] },
      };
      const sanitized = sanitizeAllowedMentions(payload, rolePerms);
      const am = sanitized.allowed_mentions as any;
      expect(am.parse).not.toContain("everyone");
      expect(am.parse).not.toContain("here");
      expect(am.parse).not.toContain("roles");
      expect(am.roles).toEqual(["123456789012345678"]);
    });

    it("omits roles array when can_mention_roles is 0", () => {
      const payload = {
        content: "Test",
        allowed_mentions: { parse: ["everyone"], roles: ["123456789012345678"] },
      };
      const sanitized = sanitizeAllowedMentions(payload, strictPerms);
      const am = sanitized.allowed_mentions as any;
      expect(am.parse).toEqual([]);
      expect(am.roles).toBeUndefined();
    });
  });

  describe("scrubFlows", () => {
    it("scrubs nested action configurations inside flows", () => {
      const flows = [
        {
          customId: "btn-1",
          steps: [
            {
              type: "send_message",
              config: {
                content: "Sub-message with @Everyone and <@&999999999999999999>",
              },
            },
          ],
        },
      ];
      const { flows: scrubbedFlows, stripped } = scrubFlows(flows, strictPerms);
      expect(stripped).toContain("@everyone");
      expect(stripped).toContain("<@&999999999999999999>");
      const stepConfig = scrubbedFlows[0].steps[0].config as any;
      expect(stepConfig.content).not.toContain("@Everyone");
      expect(stepConfig.content).not.toContain("<@&999999999999999999>");
      expect(stepConfig.content).toContain("@\u200bEveryone");
    });
  });
});
