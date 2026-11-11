import { describe, it, expect, vi, beforeEach } from "vitest";
import { findUnauthorizedMentions } from "../src/utils/mentionScrubber.js";
import type { StaffMentionPermissions } from "@dmb/shared";
import { resolveActionVariables } from "../src/services/actionExecutor.js";

describe("Staff Mention Permissions & Unauthorized Mention Detection", () => {
  const strictPerms: StaffMentionPermissions = {
    can_mention_everyone: false,
    can_mention_here: false,
    can_mention_roles: false,
    allowed_role_mention_ids: ["111222333444555666"],
  };

  it("detects unauthorized role mentions like <@&999888777666555444>", () => {
    const payload = {
      content: "Hello <@&999888777666555444> please review!",
    };
    const unauthorized = findUnauthorizedMentions(payload, strictPerms);
    expect(unauthorized.map((u) => u.mention)).toContain("<@&999888777666555444>");
  });

  it("allows role mentions that are explicitly in allowed_role_mention_ids", () => {
    const payload = {
      content: "Hello <@&111222333444555666> you are permitted to be pinged!",
    };
    const unauthorized = findUnauthorizedMentions(payload, strictPerms);
    expect(unauthorized).toEqual([]);
  });

  it("detects unauthorized @everyone and @here mentions", () => {
    const payload = {
      content: "Attention @everyone and @here!",
    };
    const unauthorized = findUnauthorizedMentions(payload, strictPerms);
    const mentions = unauthorized.map((u) => u.mention);
    expect(mentions).toContain("@everyone");
    expect(mentions).toContain("@here");
  });

  it("allows @everyone and @here when staff has permission", () => {
    const adminPerms: StaffMentionPermissions = {
      can_mention_everyone: true,
      can_mention_here: true,
      can_mention_roles: true,
      allowed_role_mention_ids: [],
    };
    const payload = {
      content: "Attention @everyone and @here and <@&999888777666555444>!",
    };
    const unauthorized = findUnauthorizedMentions(payload, adminPerms);
    expect(unauthorized).toEqual([]);
  });

  it("detects mentions nested deep inside embed titles, descriptions, and fields", () => {
    const payload = {
      content: "Clean content",
      embeds: [
        {
          title: "Alert @everyone",
          description: "Pinging role <@&888888888888888888>",
          fields: [
            { name: "Field 1", value: "Nothing" },
            { name: "Field 2", value: "Sneaky <@&999999999999999999>" },
          ],
        },
      ],
    };
    const unauthorized = findUnauthorizedMentions(payload, strictPerms);
    const mentions = unauthorized.map((u) => u.mention);
    expect(mentions).toContain("@everyone");
    expect(mentions).toContain("<@&888888888888888888>");
    expect(mentions).toContain("<@&999999999999999999>");
  });
});

describe("{user.clantag} Variable Resolution in Action Flows", () => {
  it("resolves official Discord clan tag when available", () => {
    const interaction: any = {
      id: "int_1",
      token: "tok_1",
      member: {
        clan: { tag: "FAZE" },
        user: { id: "123456", username: "gamer123" },
      },
    };

    const text = "Your clan is {user.clantag}!";
    const resolved = resolveActionVariables(text, interaction);
    expect(resolved).toBe("Your clan is FAZE!");
  });

  it("resolves bracketed tag [TAG] anywhere in display name or username", () => {
    const interaction: any = {
      id: "int_2",
      token: "tok_2",
      member: {
        nick: "Ada Lovelace [HOHO]",
        user: { id: "123456", username: "adalove" },
      },
    };

    const text = "Welcome {user.clantag} member!";
    const resolved = resolveActionVariables(text, interaction);
    expect(resolved).toBe("Welcome HOHO member!");
  });

  it("resolves parenthesized tag (TAG) or braced {TAG} in nickname", () => {
    const interaction: any = {
      id: "int_3",
      token: "tok_3",
      member: {
        nick: "(CLAN) John Doe",
        user: { id: "789101", username: "johndoe" },
      },
    };

    const text = "Tag: {user.clantag}";
    const resolved = resolveActionVariables(text, interaction);
    expect(resolved).toBe("Tag: CLAN");
  });

  it("resolves to empty string when no clan tag or bracketed tag is found without breaking message", () => {
    const interaction: any = {
      id: "int_4",
      token: "tok_4",
      member: {
        nick: "Plain User",
        user: { id: "789101", username: "plainuser" },
      },
    };

    const text = "Your clantag is {user.clantag}";
    const resolved = resolveActionVariables(text, interaction);
    expect(resolved).toBe("Your clantag is ");
  });
});
