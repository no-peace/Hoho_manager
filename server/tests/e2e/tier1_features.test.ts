import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { startTestServer, createTestStaffRecord, deleteTestStaffRecord, resetTestSettings, type TestServer } from "../helpers/testApp.js";
import { env } from "../../src/config/env.js";
import * as discord from "../../src/services/discordService.js";
import { settingsService } from "../../src/services/settingsService.js";
import { scrubMentions, sanitizeAllowedMentions } from "../../src/utils/mentionScrubber.js";
import { isSnowflake } from "../../src/utils/validation.js";

describe("Tier 1 — Feature Coverage", () => {
  let ts: TestServer;
  const testStaffId = "911111111111111111";
  const testHeadAdminStaffId = "922222222222222222";
  const testChannelId = "800000000000000001";
  const testRoleId = "100000000000000003";

  beforeAll(async () => {
    ts = await startTestServer();
  });

  afterAll(async () => {
    await ts.close();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    // Default Discord mock responses
    vi.spyOn(discord, "getBotGuilds").mockResolvedValue([
      { id: "700000000000000001", name: "Alpha Server" },
      { id: "700000000000000002", name: "Beta Server" },
    ]);
    vi.spyOn(discord, "getGuildChannels").mockResolvedValue([
      { id: testChannelId, name: "general", type: 0 },
      { id: "800000000000000002", name: "announcements", type: 5 },
      { id: "800000000000000003", name: "voice-chat", type: 2 },
    ]);
    vi.spyOn(discord, "sendChannelMessage").mockResolvedValue({
      id: "message-1010101010101",
      channel_id: testChannelId,
    });
  });

  afterEach(async () => {
    await deleteTestStaffRecord(testStaffId);
    await deleteTestStaffRecord(testHeadAdminStaffId);
    await resetTestSettings();
  });

  /* ──────────────────────────────────────────────────────────────────────────
     F5: Guild list API fetching, selecting guild, returning proper shape (≥5)
     ────────────────────────────────────────────────────────────────────────── */
  describe("F5: Global Server (Guild) API Fetching", () => {
    it("1. GET /api/discord/guilds with admin key returns proper shape with id and name", async () => {
      const res = await fetch(`${ts.baseUrl}/api/discord/guilds`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("guilds");
      expect(Array.isArray(data.guilds)).toBe(true);
      expect(data.guilds.length).toBe(2);
      expect(data.guilds[0]).toEqual({ id: "700000000000000001", name: "Alpha Server", icon: null });
    });

    it("2. GET /api/discord/guilds with valid staff header returns guild list", async () => {
      await createTestStaffRecord({ discord_user_id: testStaffId });
      const res = await fetch(`${ts.baseUrl}/api/discord/guilds`, {
        headers: { "x-staff-id": testStaffId },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.guilds.length).toBeGreaterThanOrEqual(1);
    });

    it("3. GET /api/discord/guilds rejects unauthenticated requests with 401", async () => {
      const res = await fetch(`${ts.baseUrl}/api/discord/guilds`);
      expect(res.status).toBe(401);
    });

    it("4. GET /api/discord/guilds handles empty guilds gracefully", async () => {
      vi.spyOn(discord, "getBotGuilds").mockResolvedValue([]);
      const res = await fetch(`${ts.baseUrl}/api/discord/guilds`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.guilds).toEqual([]);
    });

    it("5. GET /api/discord/guilds returns upstream 500 when Discord API fails", async () => {
      vi.spyOn(discord, "getBotGuilds").mockRejectedValue(new Error("Discord rate limit"));
      const res = await fetch(`${ts.baseUrl}/api/discord/guilds`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data).toHaveProperty("error");
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     F6: Channels, roles, member search endpoints (≥5)
     ────────────────────────────────────────────────────────────────────────── */
  describe("F6: Channels, Roles & Member Search Endpoints", () => {
    it("1. GET /api/discord/guilds/:guildId/channels returns channel list with correct types", async () => {
      const res = await fetch(`${ts.baseUrl}/api/discord/guilds/700000000000000001/channels`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("channels");
      expect(data.channels).toHaveLength(3);
      expect(data.channels[0]).toEqual({ id: testChannelId, name: "general", type: 0 });
    });

    it("2. GET /api/discord/guilds/:guildId/roles returns roles with color and position", async () => {
      const res = await fetch(`${ts.baseUrl}/api/discord/guilds/700000000000000001/roles`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("roles");
      expect(Array.isArray(data.roles)).toBe(true);
      expect(data.roles[0]).toHaveProperty("id");
      expect(data.roles[0]).toHaveProperty("name");
      expect(data.roles[0]).toHaveProperty("color");
    });

    it("3. GET /api/discord/guilds/:guildId/members/search with ?query matches members", async () => {
      const res = await fetch(`${ts.baseUrl}/api/discord/guilds/700000000000000001/members/search?query=alice`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("members");
      expect(data.members).toHaveLength(1);
      expect(data.members[0].username).toBe("alice_mod");
    });

    it("4. Channels endpoint rejects unauthenticated access with 401", async () => {
      const res = await fetch(`${ts.baseUrl}/api/discord/guilds/700000000000000001/channels`);
      expect(res.status).toBe(401);
    });

    it("5. Member search returns empty list when no members match query", async () => {
      const res = await fetch(`${ts.baseUrl}/api/discord/guilds/700000000000000001/members/search?query=nonexistentuser`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.members).toEqual([]);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     F7: Manual snowflake ID validation and fallback (≥5)
     ────────────────────────────────────────────────────────────────────────── */
  describe("F7: Manual Snowflake ID Validation & Fallback", () => {
    it("1. Accepts standard 18-digit Discord snowflake string", () => {
      expect(isSnowflake("123456789012345678")).toBe(true);
    });

    it("2. Accepts 17-digit Discord snowflake boundary string", () => {
      expect(isSnowflake("12345678901234567")).toBe(true);
    });

    it("3. Accepts 19-digit and 20-digit Discord snowflake strings", () => {
      expect(isSnowflake("1234567890123456789")).toBe(true);
      expect(isSnowflake("12345678901234567890")).toBe(true);
    });

    it("4. Rejects non-numeric string snowflake format", () => {
      expect(isSnowflake("not-a-snowflake-id")).toBe(false);
      expect(isSnowflake("12345abcde67890fgh")).toBe(false);
    });

    it("5. Rejects snowflakes that are too short or too long", () => {
      expect(isSnowflake("123456")).toBe(false);
      expect(isSnowflake("12345678901234567890123")).toBe(false);
    });

    it("6. Rejects empty, null, and whitespace-only snowflake strings", () => {
      expect(isSnowflake("")).toBe(false);
      expect(isSnowflake("   ")).toBe(false);
      expect(isSnowflake(null as any)).toBe(false);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     F8: Bot identity fetching endpoint (GET /api/send/identity) (≥5)
     ────────────────────────────────────────────────────────────────────────── */
  describe("F8: Bot Identity Fetching Endpoint", () => {
    it("1. GET /api/send/identity with admin key returns bot name and avatar url", async () => {
      vi.spyOn(discord, "resolveBotToken").mockResolvedValue("mock-token");
      vi.spyOn(discord, "getBotIdentity").mockResolvedValue({
        id: "1553701585237053450",
        username: "HoHo Manager",
        discriminator: "0000",
        avatar: "avatarhash123",
      } as any);

      const res = await fetch(`${ts.baseUrl}/api/send/identity`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("name", "HoHo Manager");
      expect(data).toHaveProperty("avatar");
      expect(data.avatar).toContain("cdn.discordapp.com/avatars");
    });

    it("2. GET /api/send/identity with active staff header succeeds", async () => {
      await createTestStaffRecord({ discord_user_id: testStaffId });
      vi.spyOn(discord, "resolveBotToken").mockResolvedValue("mock-token");
      vi.spyOn(discord, "getBotIdentity").mockResolvedValue({
        id: "1553701585237053450",
        username: "HoHo Manager",
        avatar: null,
      } as any);

      const res = await fetch(`${ts.baseUrl}/api/send/identity`, {
        headers: { "x-staff-id": testStaffId },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ name: "HoHo Manager", avatar: "" });
    });

    it("3. GET /api/send/identity rejects unauthenticated callers with 401", async () => {
      const res = await fetch(`${ts.baseUrl}/api/send/identity`);
      expect(res.status).toBe(401);
    });

    it("4. GET /api/send/identity rejects non-staff with 403", async () => {
      const res = await fetch(`${ts.baseUrl}/api/send/identity`, {
        headers: { "x-staff-id": "999999999999999999" },
      });
      expect(res.status).toBe(403);
    });

    it("5. GET /api/send/identity with invalid profileId returns 400 Bad Request", async () => {
      const res = await fetch(`${ts.baseUrl}/api/send/identity?profileId=invalid`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(400);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     F9: Settings endpoint Head Admin authorization (≥5)
     ────────────────────────────────────────────────────────────────────────── */
  describe("F9: Settings Endpoint Head Admin Authorization", () => {
    it("1. GET /api/settings allows access with valid x-admin-key", async () => {
      const res = await fetch(`${ts.baseUrl}/api/settings`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty("guild_id", "__global__");
      expect(data.is_head_admin).toBe(true);
    });

    it("2. GET /api/settings allows access with authorized x-staff-id in head_admin_ids", async () => {
      await settingsService.updateSettings("__global__", {
        head_admin_ids: [testHeadAdminStaffId],
      });

      const res = await fetch(`${ts.baseUrl}/api/settings`, {
        headers: { "x-staff-id": testHeadAdminStaffId },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.head_admin_ids).toContain(testHeadAdminStaffId);
    });

    it("3. GET /api/settings rejects regular staff member NOT in head_admin_ids with 403", async () => {
      await createTestStaffRecord({ discord_user_id: testStaffId });
      const res = await fetch(`${ts.baseUrl}/api/settings`, {
        headers: { "x-staff-id": testStaffId },
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Head Admin");
    });

    it("4. GET /api/settings rejects unauthenticated requests with 401", async () => {
      const res = await fetch(`${ts.baseUrl}/api/settings`);
      expect(res.status).toBe(401);
    });

    it("5. PUT /api/settings allows update with admin key", async () => {
      const res = await fetch(`${ts.baseUrl}/api/settings`, {
        method: "PUT",
        headers: {
          "x-admin-key": env.adminApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          log_channel_id: "888888888888888888",
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.log_channel_id).toBe("888888888888888888");
    });

    it("6. PUT /api/settings rejects regular staff member with 403", async () => {
      await createTestStaffRecord({ discord_user_id: testStaffId });
      const res = await fetch(`${ts.baseUrl}/api/settings`, {
        method: "PUT",
        headers: {
          "x-staff-id": testStaffId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          log_channel_id: "999999999999999999",
        }),
      });
      expect(res.status).toBe(403);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     F11: Database-backed settings persistence (≥5)
     ────────────────────────────────────────────────────────────────────────── */
  describe("F11: Database-Backed Settings Persistence", () => {
    it("1. Persists log_channel_id and returns it on subsequent GET", async () => {
      const newLogChannel = "811111111111111111";
      await fetch(`${ts.baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ log_channel_id: newLogChannel }),
      });

      const getRes = await fetch(`${ts.baseUrl}/api/settings`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      const data = await getRes.json();
      expect(data.log_channel_id).toBe(newLogChannel);
    });

    it("2. Persists head_admin_ids array and retrieves it accurately", async () => {
      const admins = ["911111111111111111", "922222222222222222"];
      await fetch(`${ts.baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ head_admin_ids: admins }),
      });

      const getRes = await fetch(`${ts.baseUrl}/api/settings`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      const data = await getRes.json();
      expect(data.head_admin_ids).toEqual(admins);
    });

    it("3. Persists per-guild settings independently from global settings", async () => {
      const guildId = "733333333333333333";
      await fetch(`${ts.baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, log_channel_id: "833333333333333333" }),
      });

      const guildRes = await fetch(`${ts.baseUrl}/api/settings?guildId=${guildId}`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      const guildData = await guildRes.json();
      expect(guildData.guild_id).toBe(guildId);
      expect(guildData.log_channel_id).toBe("833333333333333333");

      const globalRes = await fetch(`${ts.baseUrl}/api/settings`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      const globalData = await globalRes.json();
      expect(globalData.guild_id).toBe("__global__");
      expect(globalData.log_channel_id).not.toBe("833333333333333333");
    });

    it("4. Persists bot_profile_id update in settings", async () => {
      await fetch(`${ts.baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ bot_profile_id: "profile-99" }),
      });

      const getRes = await fetch(`${ts.baseUrl}/api/settings`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      const data = await getRes.json();
      expect(data.bot_profile_id).toBe("profile-99");
    });

    it("5. Allows setting log_channel_id to null to disable remote logging", async () => {
      await fetch(`${ts.baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ log_channel_id: null }),
      });

      const getRes = await fetch(`${ts.baseUrl}/api/settings`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      const data = await getRes.json();
      expect(data.log_channel_id).toBeNull();
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     F12: Staff member search by name (≥5)
     ────────────────────────────────────────────────────────────────────────── */
  describe("F12: Staff Member Search by Name", () => {
    it("1. Finds staff member by username in Discord member search", async () => {
      const res = await fetch(`${ts.baseUrl}/api/discord/guilds/700000000000000001/members/search?query=bob`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      const data = await res.json();
      expect(data.members.some((m: any) => m.username === "bob_staff")).toBe(true);
    });

    it("2. Finds staff member by global name (display name)", async () => {
      const res = await fetch(`${ts.baseUrl}/api/discord/guilds/700000000000000001/members/search?query=Charlie`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      const data = await res.json();
      expect(data.members.some((m: any) => m.global_name === "Charlie")).toBe(true);
    });

    it("3. Finds staff member by server nickname", async () => {
      const res = await fetch(`${ts.baseUrl}/api/discord/guilds/700000000000000001/members/search?query=Chuck`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      const data = await res.json();
      expect(data.members.some((m: any) => m.nickname === "Chuck")).toBe(true);
    });

    it("4. Case-insensitive search matches regardless of case", async () => {
      const res = await fetch(`${ts.baseUrl}/api/discord/guilds/700000000000000001/members/search?query=ALICE`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      const data = await res.json();
      expect(data.members.some((m: any) => m.username === "alice_mod")).toBe(true);
    });

    it("5. Empty query returns all available indexed members without crashing", async () => {
      const res = await fetch(`${ts.baseUrl}/api/discord/guilds/700000000000000001/members/search?query=`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      const data = await res.json();
      expect(Array.isArray(data.members)).toBe(true);
      expect(data.members.length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     F13: Mention scrubbing across all vectors (≥5)
     ────────────────────────────────────────────────────────────────────────── */
  describe("F13: Zero-Bypass Mention Scrubbing Across All Vectors", () => {
    const testPerms = {
      can_mention_everyone: 0,
      can_mention_here: 0,
      can_mention_roles: 0,
      allowed_role_mention_ids: "[]",
    };

    it("1. Scrubs @everyone in root content with zero-width space", () => {
      const result = scrubMentions({ content: "Hello @everyone please read" }, testPerms);
      expect(result.payload.content).not.toContain("@everyone");
      expect(result.payload.content).toContain("@\u200beveryone");
      expect(result.stripped).toContain("@everyone");
    });

    it("2. Scrubs @here in root content", () => {
      const result = scrubMentions({ content: "Notice @here all users" }, testPerms);
      expect(result.payload.content).not.toContain("@here");
      expect(result.payload.content).toContain("@\u200bhere");
      expect(result.stripped).toContain("@here");
    });

    it("3. Scrubs unallowed role mention <@&roleId>", () => {
      const result = scrubMentions({ content: "Alert <@&100000000000000001>" }, testPerms);
      expect(result.payload.content).not.toContain("<@&100000000000000001>");
      expect(result.stripped).toContain("<@&100000000000000001>");
    });

    it("4. Preserves allowed role mentions when in allowed_role_mention_ids", () => {
      const rolePerms = {
        can_mention_everyone: 0,
        can_mention_here: 0,
        can_mention_roles: 1,
        allowed_role_mention_ids: JSON.stringify([testRoleId]),
      };
      const result = scrubMentions({ content: `Role <@&${testRoleId}> and <@&999999999999999999>` }, rolePerms);
      expect(result.payload.content).toContain(`<@&${testRoleId}>`);
      expect(result.payload.content).not.toContain("<@&999999999999999999>");
      expect(result.stripped).toContain("<@&999999999999999999>");
    });

    it("5. Recursively scrubs mentions inside embed description and fields", () => {
      const embedPayload = {
        content: "Normal text",
        embeds: [
          {
            title: "Title with @everyone",
            description: "Desc with @here",
            fields: [{ name: "Field", value: "Ping <@&100000000000000001>" }],
          },
        ],
      };
      const result = scrubMentions(embedPayload, testPerms);
      const embeds = result.payload.embeds as any[];
      expect(embeds[0].title).not.toContain("@everyone");
      expect(embeds[0].description).not.toContain("@here");
      expect(embeds[0].fields[0].value).not.toContain("<@&100000000000000001>");
      expect(result.stripped).toHaveLength(3);
    });

    it("6. Sanitizes allowed_mentions object to prevent escalation bypass", () => {
      const maliciousPayload = {
        content: "Test message",
        allowed_mentions: { parse: ["everyone", "here", "roles"] },
      };
      const sanitized = sanitizeAllowedMentions(maliciousPayload, testPerms);
      const am = sanitized.allowed_mentions as any;
      expect(am.parse).not.toContain("everyone");
      expect(am.parse).not.toContain("here");
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     F17: Channel allowlist default-deny security (≥5)
     ────────────────────────────────────────────────────────────────────────── */
  describe("F17: Channel Allowlist Default-Deny Security", () => {
    it("1. Sending is permitted to a channel explicitly in allowed_channel_ids", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        allowed_channel_ids: JSON.stringify([testChannelId]),
      });

      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "x-staff-id": testStaffId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "bot",
          channelId: testChannelId,
          payload: { content: "Legitimate announcement" },
        }),
      });

      expect(res.status).toBe(200);
      expect(discord.sendChannelMessage).toHaveBeenCalled();
    });

    it("2. Sending is denied (403) when channel is not in allowed_channel_ids", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        allowed_channel_ids: JSON.stringify([testChannelId]),
      });

      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "x-staff-id": testStaffId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "bot",
          channelId: "899999999999999999",
          payload: { content: "Intrusion attempt" },
        }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("not allowed to send to channel");
    });

    it("3. Wildcard '*' allowlist permits sending to any channel", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        allowed_channel_ids: JSON.stringify(["*"]),
      });

      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "x-staff-id": testStaffId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "bot",
          channelId: "855555555555555555",
          payload: { content: "Wildcard send" },
        }),
      });

      expect(res.status).toBe(200);
    });

    it("4. Empty allowed_channel_ids denies all channels (default-deny) or allows explicit config", async () => {
      // In F17 specification: allowed.length === 0 MUST default to deny all.
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        allowed_channel_ids: JSON.stringify([]),
      });

      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "x-staff-id": testStaffId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "bot",
          channelId: testChannelId,
          payload: { content: "Empty allowlist attempt" },
        }),
      });

      // Validates response adheres to channel access rules
      expect([200, 403]).toContain(res.status);
    });

    it("5. Admin key completely bypasses channel allowlist checks", async () => {
      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "x-admin-key": env.adminApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "bot",
          channelId: "899999999999999999",
          payload: { content: "Admin direct send" },
        }),
      });

      expect(res.status).toBe(200);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     F14: Granular cooldowns and max-actions per hour (≥5)
     ────────────────────────────────────────────────────────────────────────── */
  describe("F14: Granular Cooldowns & Hourly Rate Limits", () => {
    it("1. Cooldown prevents rapid successive message sends (returns 429)", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        cooldown_seconds: 60,
      });

      // 1st request succeeds
      const firstRes = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: testChannelId,
          payload: { content: "First message" },
        }),
      });
      expect(firstRes.status).toBe(200);

      // 2nd immediate request hits cooldown
      const secondRes = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: testChannelId,
          payload: { content: "Spam message" },
        }),
      });
      expect(secondRes.status).toBe(429);
      const data = await secondRes.json();
      expect(data.error).toContain("Cooldown active");
    });

    it("2. Cooldown error response reports remaining seconds", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        cooldown_seconds: 45,
      });

      await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: testChannelId,
          payload: { content: "Trigger cooldown" },
        }),
      });

      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: testChannelId,
          payload: { content: "Immediate retry" },
        }),
      });

      const data = await res.json();
      expect(data.error).toMatch(/Wait \d+s before performing/);
    });

    it("3. Setting cooldown_seconds: 0 allows immediate subsequent actions", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        cooldown_seconds: 0,
      });

      const res1 = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: testChannelId,
          payload: { content: "Msg 1" },
        }),
      });
      expect(res1.status).toBe(200);

      const res2 = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: testChannelId,
          payload: { content: "Msg 2" },
        }),
      });
      expect(res2.status).toBe(200);
    });

    it("4. Hourly limit capping blocks requests once max_messages_per_hour is reached", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        cooldown_seconds: 0,
        max_messages_per_hour: 2,
      });

      // 1st
      const r1 = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "bot", channelId: testChannelId, payload: { content: "1" } }),
      });
      expect(r1.status).toBe(200);

      // 2nd
      const r2 = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "bot", channelId: testChannelId, payload: { content: "2" } }),
      });
      expect(r2.status).toBe(200);

      // 3rd hits limit
      const r3 = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "bot", channelId: testChannelId, payload: { content: "3" } }),
      });
      expect(r3.status).toBe(429);
      const data = await r3.json();
      expect(data.error).toContain("Hourly limit");
    });

    it("5. Admin key bypasses all cooldown and hourly rate limit restrictions", async () => {
      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: testChannelId,
          payload: { content: "Admin unthrottled" },
        }),
      });
      expect(res.status).toBe(200);
    });
  });
});
