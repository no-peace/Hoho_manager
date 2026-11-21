import { describe, expect, it } from "vitest";
import { filterMentionableRoles } from "../mentionPermissions";

const roles = [
  { id: "role-a", name: "Allowed" },
  { id: "role-b", name: "Blocked" },
];

describe("filterMentionableRoles", () => {
  it("restricts roles to an explicit allowlist even when broad role mentions are enabled", () => {
    expect(filterMentionableRoles(roles, {
      can_mention_roles: true,
      allowed_role_mention_ids: ["role-a"],
    })).toEqual([roles[0]]);
  });

  it("allows only explicitly selected roles when broad role mentions are disabled", () => {
    expect(filterMentionableRoles(roles, {
      can_mention_roles: false,
      allowed_role_mention_ids: ["role-b"],
    })).toEqual([roles[1]]);
  });

  it("allows every role for a wildcard or an enabled broad permission with no allowlist", () => {
    expect(filterMentionableRoles(roles, {
      can_mention_roles: false,
      allowed_role_mention_ids: ["*"],
    })).toEqual(roles);
    expect(filterMentionableRoles(roles, {
      can_mention_roles: true,
      allowed_role_mention_ids: [],
    })).toEqual(roles);
  });

  it("returns no roles when no permission or allowlist grants access", () => {
    expect(filterMentionableRoles(roles, {
      can_mention_roles: false,
      allowed_role_mention_ids: [],
    })).toEqual([]);
    expect(filterMentionableRoles(roles, null)).toEqual([]);
  });

  it("keeps head-admin access unrestricted", () => {
    expect(filterMentionableRoles(roles, null, true)).toBe(roles);
  });
});
