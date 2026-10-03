import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { startTestServer, createTestStaffRecord, deleteTestStaffRecord, resetTestSettings, type TestServer } from "../helpers/testApp.js";
import { env } from "../../src/config/env.js";
import * as discord from "../../src/services/discordService.js";
import { settingsService } from "../../src/services/settingsService.js";
import { staffRepository } from "../../src/repositories/staffRepository.js";
import { actionRepository } from "../../src/repositories/actionRepository.js";

describe("Tier 3 — Cross-Feature Interaction", () => {
  let ts: TestServer;
  const testStaffId = "944444444444444444";
  const guildChannelA = "800000000000000001";
  const guildChannelB = "800000000000000002";

  beforeAll(async () => {
    ts = await startTestServer();
  });

  afterAll(async () => {
    await ts.close();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.spyOn(discord, "getBotGuilds").mockResolvedValue([
      { id: "700000000000000001", name: "Primary Server" },
    ]);
    vi.spyOn(discord, "getGuildChannels").mockResolvedValue([
      { id: guildChannelA, name: "allowed-channel", type: 0 },
      { id: guildChannelB, name: "restricted-channel", type: 0 },
    ]);
    vi.spyOn(discord, "sendChannelMessage").mockResolvedValue({
      id: "cf-msg-12345",
      channel_id: guildChannelA,
    });
  });

  afterEach(async () => {
    await deleteTestStaffRecord(testStaffId);
    await resetTestSettings();
  });

  /* ──────────────────────────────────────────────────────────────────────────
     Interaction 1: Guild Context Driving Channel/Role Resolution + Staff Allowlist
     ────────────────────────────────────────────────────────────────────────── */
  describe("Interaction 1: Guild Context + Staff Allowlist Resolution", () => {
    it("1.1 Scoped staff member only sees their allowed channels for the guild", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        allowed_channel_ids: JSON.stringify([guildChannelA]),
      });

      const res = await fetch(`${ts.baseUrl}/api/send/channels`, {
        headers: { "x-staff-id": testStaffId },
      });
      expect(res.status).toBe(200);
      const channels = await res.json();
      expect(channels).toHaveLength(1);
      expect(channels[0].id).toBe(guildChannelA);
    });

    it("1.2 Staff can send to allowed guild channel, but blocked from other guild channel", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        allowed_channel_ids: JSON.stringify([guildChannelA]),
      });

      // Allowed channel succeeds
      const allowRes = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: guildChannelA,
          payload: { content: "Announcement in allowed channel" },
        }),
      });
      expect(allowRes.status).toBe(200);

      // Other channel denied with 403
      const denyRes = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: guildChannelB,
          payload: { content: "Intrusion in restricted channel" },
        }),
      });
      expect(denyRes.status).toBe(403);
    });

    it("1.3 Wildcard allowlist staff receives all available text channels of the guild", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        allowed_channel_ids: JSON.stringify(["*"]),
      });

      const res = await fetch(`${ts.baseUrl}/api/send/channels`, {
        headers: { "x-staff-id": testStaffId },
      });
      expect(res.status).toBe(200);
      const channels = await res.json();
      expect(channels).toHaveLength(2);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     Interaction 2: Mention Scrubbing + Component V2 Flows Registration
     ────────────────────────────────────────────────────────────────────────── */
  describe("Interaction 2: Mention Scrubbing + Component V2 Flows Registration", () => {
    it("2.1 Disallowed pings in message content are scrubbed before flow registration", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        can_mention_everyone: 0,
        allowed_channel_ids: JSON.stringify([guildChannelA]),
      });

      const registerSpy = vi.spyOn(actionRepository, "registerFlows").mockResolvedValue(undefined as any);

      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: guildChannelA,
          payload: {
            content: "Click button below @everyone",
            components: [
              {
                type: 1, // ActionRow
                components: [
                  {
                    type: 2, // Button
                    style: 1,
                    label: "Join",
                    custom_id: "flow_join_btn",
                  },
                ],
              },
            ],
          },
          flows: [
            {
              custom_id: "flow_join_btn",
              actions: [
                {
                  action_type: "send_message",
                  config: { content: "Welcome @everyone!" },
                },
              ],
            },
          ],
        }),
      });

      expect(res.status).toBe(200);
      expect(discord.sendChannelMessage).toHaveBeenCalled();
      const sentPayload = vi.mocked(discord.sendChannelMessage).mock.calls[0][1];
      expect(sentPayload.content).not.toContain("@everyone");
      expect(sentPayload.content).toContain("@\u200beveryone");
      expect(registerSpy).toHaveBeenCalled();
    });

    it("2.2 Allowed role mention is preserved in message and flows are registered", async () => {
      const allowedRole = "100000000000000003";
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        can_mention_roles: 1,
        allowed_role_mention_ids: JSON.stringify([allowedRole]),
        allowed_channel_ids: JSON.stringify([guildChannelA]),
      });

      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: guildChannelA,
          payload: { content: `Event for <@&${allowedRole}>` },
        }),
      });

      expect(res.status).toBe(200);
      const sentPayload = vi.mocked(discord.sendChannelMessage).mock.calls[0][1];
      expect(sentPayload.content).toContain(`<@&${allowedRole}>`);
    });

    it("2.3 Sanitizes allowed_mentions object while keeping action button payloads intact", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        allowed_channel_ids: JSON.stringify([guildChannelA]),
      });

      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: guildChannelA,
          payload: {
            content: "Action Row Test",
            allowed_mentions: { parse: ["everyone", "roles"] },
            components: [
              {
                type: 1,
                components: [{ type: 2, style: 2, label: "Help", custom_id: "help_btn" }],
              },
            ],
          },
        }),
      });

      expect(res.status).toBe(200);
      const sentPayload = vi.mocked(discord.sendChannelMessage).mock.calls[0][1];
      expect(sentPayload.allowed_mentions?.parse).toEqual([]);
      expect(sentPayload.components).toBeDefined();
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     Interaction 3: Dynamic log_channel_id Updating + Audit Log Destination
     ────────────────────────────────────────────────────────────────────────── */
  describe("Interaction 3: Dynamic Log Channel Updating & Resolution", () => {
    it("3.1 Updating global log channel updates effective log channel immediately", async () => {
      await settingsService.updateSettings("__global__", {
        log_channel_id: "899999999999999999",
      });

      const effective = await settingsService.getEffectiveLogChannelId();
      expect(effective).toBe("899999999999999999");
    });

    it("3.2 Per-guild log channel overrides global log channel for that guild", async () => {
      const specificGuild = "755555555555555555";
      await settingsService.updateSettings("__global__", { log_channel_id: "888888888888888888" });
      await settingsService.updateSettings(specificGuild, { log_channel_id: "877777777777777777" });

      const guildEffective = await settingsService.getEffectiveLogChannelId(specificGuild);
      expect(guildEffective).toBe("877777777777777777");

      const globalEffective = await settingsService.getEffectiveLogChannelId();
      expect(globalEffective).toBe("888888888888888888");
    });

    it("3.3 Clearing guild log channel cleanly falls back to global log channel", async () => {
      const specificGuild = "766666666666666666";
      await settingsService.updateSettings("__global__", { log_channel_id: "888888888888888888" });
      await settingsService.updateSettings(specificGuild, { log_channel_id: null });

      const effective = await settingsService.getEffectiveLogChannelId(specificGuild);
      expect(effective).toBe("888888888888888888");
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     Interaction 4: Staff Permission Dynamic Toggle Lifecycle
     ────────────────────────────────────────────────────────────────────────── */
  describe("Interaction 4: Staff Permission Dynamic Update Lifecycle", () => {
    it("4.1 Disabling can_send_messages immediately rejects next send request", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        can_send_messages: 1,
        allowed_channel_ids: JSON.stringify([guildChannelA]),
        cooldown_seconds: 0,
      });

      // 1st request: permitted
      const res1 = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "bot", channelId: guildChannelA, payload: { content: "OK" } }),
      });
      expect(res1.status).toBe(200);

      // Admin revokes can_send_messages via PATCH
      await fetch(`${ts.baseUrl}/api/access/${testStaffId}`, {
        method: "PATCH",
        headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ can_send_messages: 0 }),
      });

      // 2nd request: immediately forbidden
      const res2 = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "bot", channelId: guildChannelA, payload: { content: "Denied" } }),
      });
      expect(res2.status).toBe(403);
      const data = await res2.json();
      expect(data.error).toContain("send");
    });

    it("4.2 Dynamically updating allowed_channel_ids takes effect on next call", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        allowed_channel_ids: JSON.stringify([guildChannelA]),
        cooldown_seconds: 0,
      });

      // Send to channelB denied
      const res1 = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "bot", channelId: guildChannelB, payload: { content: "Fail" } }),
      });
      expect(res1.status).toBe(403);

      // Admin updates allowlist to include channelB
      await fetch(`${ts.baseUrl}/api/access/${testStaffId}`, {
        method: "PATCH",
        headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ allowed_channel_ids: [guildChannelA, guildChannelB] }),
      });

      // Send to channelB now succeeds
      const res2 = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "bot", channelId: guildChannelB, payload: { content: "Success" } }),
      });
      expect(res2.status).toBe(200);
    });

    it("4.3 Revoking staff access completely (DELETE) immediately blocks check endpoint", async () => {
      await createTestStaffRecord({ discord_user_id: testStaffId });

      const check1 = await fetch(`${ts.baseUrl}/api/access/${testStaffId}/check`);
      const data1 = await check1.json();
      expect(data1.hasAccess).toBe(true);

      // Delete staff
      await fetch(`${ts.baseUrl}/api/access/${testStaffId}`, {
        method: "DELETE",
        headers: { "x-admin-key": env.adminApiKey },
      });

      const check2 = await fetch(`${ts.baseUrl}/api/access/${testStaffId}/check`);
      const data2 = await check2.json();
      expect(data2.hasAccess).toBe(false);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     Interaction 5: Bot Identity & Resolution Coupling
     ────────────────────────────────────────────────────────────────────────── */
  describe("Interaction 5: Bot Identity Resolution Coupling", () => {
    it("5.1 Identity endpoint correctly reflects current bot username and avatar", async () => {
      vi.spyOn(discord, "resolveBotToken").mockResolvedValue("test-token");
      vi.spyOn(discord, "getBotIdentity").mockResolvedValue({
        id: "1553701585237053450",
        username: "Live HoHo Bot",
        discriminator: "0000",
        avatar: "avatar123",
      } as any);

      const res = await fetch(`${ts.baseUrl}/api/send/identity`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe("Live HoHo Bot");
      expect(data.avatar).toContain("avatar123.png");
    });

    it("5.2 When identity lookup returns null, endpoint returns null gracefully", async () => {
      vi.spyOn(discord, "resolveBotToken").mockResolvedValue("test-token");
      vi.spyOn(discord, "getBotIdentity").mockResolvedValue(null);

      const res = await fetch(`${ts.baseUrl}/api/send/identity`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toBeNull();
    });

    it("5.3 Setting bot_profile_id in settings associates with guild profile selection", async () => {
      await fetch(`${ts.baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ bot_profile_id: "profile-1" }),
      });

      const res = await fetch(`${ts.baseUrl}/api/settings`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      const data = await res.json();
      expect(data.bot_profile_id).toBe("profile-1");
    });
  });
});
