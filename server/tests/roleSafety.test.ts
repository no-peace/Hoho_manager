import { describe, expect, it, vi } from "vitest";
import { getSelfAssignableRoleError } from "../src/actions/roleSafety.js";

describe("self-assignable role permission safety", () => {
  it.each([
    ["KICK_MEMBERS", 1n << 1n],
    ["BAN_MEMBERS", 1n << 2n],
    ["ADMINISTRATOR", 1n << 3n],
    ["MANAGE_GUILD", 1n << 5n],
    ["MANAGE_MESSAGES", 1n << 13n],
    ["MUTE_MEMBERS", 1n << 22n],
    ["DEAFEN_MEMBERS", 1n << 23n],
    ["MOVE_MEMBERS", 1n << 24n],
    ["MANAGE_ROLES", 1n << 28n],
    ["MANAGE_WEBHOOKS", 1n << 29n],
    ["MANAGE_GUILD_EXPRESSIONS", 1n << 30n],
    ["MANAGE_EVENTS", 1n << 33n],
    ["MANAGE_THREADS", 1n << 34n],
    ["MODERATE_MEMBERS", 1n << 40n],
    ["CREATE_GUILD_EXPRESSIONS", 1n << 43n],
    ["CREATE_EVENTS", 1n << 44n],
  ])("blocks %s", async (_name, permission) => {
    const context = {
      botToken: "Bot.test",
      discord: {
        getGuildRolesWithToken: vi.fn().mockResolvedValue([
          { id: "role", permissions: String(permission), managed: false },
        ]),
      },
    } as any;

    const error = await getSelfAssignableRoleError(context, "guild", "role");
    expect(error).toContain("moderation or administration permissions");
  });

  it("allows a role with no permissions", async () => {
    const context = {
      botToken: "Bot.test",
      discord: {
        getGuildRolesWithToken: vi.fn().mockResolvedValue([
          { id: "role", permissions: "0", managed: false },
        ]),
      },
    } as any;

    await expect(getSelfAssignableRoleError(context, "guild", "role")).resolves.toBeNull();
  });

  it("fails closed for managed roles or unverifiable permissions", async () => {
    const managedContext = {
      botToken: "Bot.test",
      discord: {
        getGuildRolesWithToken: vi.fn().mockResolvedValue([
          { id: "role", permissions: "0", managed: true },
        ]),
      },
    } as any;
    const unknownContext = {
      botToken: "Bot.test",
      discord: {
        getGuildRolesWithToken: vi.fn().mockResolvedValue([
          { id: "role", managed: false },
        ]),
      },
    } as any;

    expect(await getSelfAssignableRoleError(managedContext, "guild", "role")).toContain("managed by an integration");
    expect(await getSelfAssignableRoleError(unknownContext, "guild", "role")).toContain("couldn't verify");
  });
});
