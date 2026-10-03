import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { startTestServer, createTestStaffRecord, deleteTestStaffRecord, resetTestSettings, type TestServer } from "../helpers/testApp.js";
import { env } from "../../src/config/env.js";
import * as discord from "../../src/services/discordService.js";
import { settingsService } from "../../src/services/settingsService.js";
import { actionRepository } from "../../src/repositories/actionRepository.js";
import { staffRepository } from "../../src/repositories/staffRepository.js";
import { db } from "../../src/config/database.js";

describe("Tier 4 — Real-World Application Workloads", () => {
  let ts: TestServer;
  const adminStaffId = "955555555555555555";
  const modStaffId = "966666666666666666";
  const publicChannelId = "811111111111111111";
  const privateChannelId = "822222222222222222";
  const newsRoleId = "100000000000000003";

  beforeAll(async () => {
    ts = await startTestServer();
  });

  afterAll(async () => {
    await ts.close();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.spyOn(discord, "getBotGuilds").mockResolvedValue([
      { id: "700000000000000001", name: "Production Guild" },
    ]);
    vi.spyOn(discord, "getGuildChannels").mockResolvedValue([
      { id: publicChannelId, name: "announcements", type: 5 },
      { id: privateChannelId, name: "staff-internal", type: 0 },
    ]);
    vi.spyOn(discord, "sendChannelMessage").mockResolvedValue({
      id: "prod-msg-9999",
      channel_id: publicChannelId,
    });
  });

  afterEach(async () => {
    await deleteTestStaffRecord(adminStaffId);
    await deleteTestStaffRecord(modStaffId);
    await resetTestSettings();
  });

  /* ──────────────────────────────────────────────────────────────────────────
     Scenario 1: Head Admin Configures Guild Settings & Logs
     ────────────────────────────────────────────────────────────────────────── */
  it("Scenario 1: Head Admin Configures Guild Settings, Delegation & Logging", async () => {
    // 1. Initial Head Admin check via x-admin-key
    const authRes = await fetch(`${ts.baseUrl}/api/settings/auth`, {
      headers: { "x-admin-key": env.adminApiKey },
    });
    expect(authRes.status).toBe(200);
    const authData = await authRes.json();
    expect(authData.isHeadAdmin).toBe(true);

    // 2. Head Admin configures global log channel and delegates admin access to adminStaffId
    const updateRes = await fetch(`${ts.baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        log_channel_id: "899999999999999999",
        head_admin_ids: [adminStaffId],
      }),
    });
    expect(updateRes.status).toBe(200);
    const updateData = await updateRes.json();
    expect(updateData.log_channel_id).toBe("899999999999999999");
    expect(updateData.head_admin_ids).toContain(adminStaffId);

    // 3. Delegated Head Admin (adminStaffId) can now configure guild-specific settings using x-staff-id without admin key
    const guildUpdateRes = await fetch(`${ts.baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "x-staff-id": adminStaffId, "Content-Type": "application/json" },
      body: JSON.stringify({
        guildId: "700000000000000001",
        log_channel_id: "877777777777777777",
      }),
    });
    expect(guildUpdateRes.status).toBe(200);

    // 4. Verify effective log channel for this guild is the guild-specific one
    const effectiveLogChannel = await settingsService.getEffectiveLogChannelId("700000000000000001");
    expect(effectiveLogChannel).toBe("877777777777777777");
  });

  /* ──────────────────────────────────────────────────────────────────────────
     Scenario 2: Staff Member Granted Scoped Channels & Roles Sends Announcement
     ────────────────────────────────────────────────────────────────────────── */
  it("Scenario 2: Scoped Staff Announcement Workflow", async () => {
    // 1. Admin creates staff record granting permissions to announcements channel only and newsRoleId mention
    await createTestStaffRecord({
      discord_user_id: modStaffId,
      discord_username: "mod_alice",
      can_send_messages: 1,
      can_mention_everyone: 0,
      can_mention_roles: 1,
      allowed_role_mention_ids: JSON.stringify([newsRoleId]),
      allowed_channel_ids: JSON.stringify([publicChannelId]),
      cooldown_seconds: 0,
      max_messages_per_hour: 5,
    });

    // 2. Mod checks their accessible channels: only publicChannelId is returned
    const channelsRes = await fetch(`${ts.baseUrl}/api/send/channels`, {
      headers: { "x-staff-id": modStaffId },
    });
    expect(channelsRes.status).toBe(200);
    const channels = await channelsRes.json();
    expect(channels.map((c: any) => c.id)).toEqual([publicChannelId]);

    // 3. Mod attempts to send announcement to privateChannelId -> blocked (403)
    const blockedRes = await fetch(`${ts.baseUrl}/api/send`, {
      method: "POST",
      headers: { "x-staff-id": modStaffId, "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "bot",
        channelId: privateChannelId,
        payload: { content: "Confidential leak attempt" },
      }),
    });
    expect(blockedRes.status).toBe(403);

    // 4. Set cooldown to 15s and clear pre-existing cooldown table entry to test fresh send + throttle
    await staffRepository.update(modStaffId, { cooldown_seconds: 15 });
    await db.run("DELETE FROM staff_cooldowns WHERE discord_user_id = ?", [modStaffId]);

    // 5. Mod sends valid announcement to publicChannelId with allowed role ping -> succeeds, allowed role retained
    const successRes = await fetch(`${ts.baseUrl}/api/send`, {
      method: "POST",
      headers: { "x-staff-id": modStaffId, "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "bot",
        channelId: publicChannelId,
        payload: { content: `Important update for <@&${newsRoleId}>!` },
      }),
    });
    expect(successRes.status).toBe(200);
    expect(discord.sendChannelMessage).toHaveBeenCalled();
    const sent = vi.mocked(discord.sendChannelMessage).mock.calls[0][1];
    expect(sent.content).toContain(`<@&${newsRoleId}>`);

    // 6. Mod immediately attempts second send -> throttled by cooldown (429)
    const throttledRes = await fetch(`${ts.baseUrl}/api/send`, {
      method: "POST",
      headers: { "x-staff-id": modStaffId, "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "bot",
        channelId: publicChannelId,
        payload: { content: "Duplicate blast" },
      }),
    });
    expect(throttledRes.status).toBe(429);
  });

  /* ──────────────────────────────────────────────────────────────────────────
     Scenario 3: Malicious Mention Injection Attempt Blocked Across All Channels
     ────────────────────────────────────────────────────────────────────────── */
  it("Scenario 3: Multi-Vector Malicious Mention Injection Defense", async () => {
    await createTestStaffRecord({
      discord_user_id: modStaffId,
      can_mention_everyone: 0,
      can_mention_here: 0,
      can_mention_roles: 0,
      allowed_role_mention_ids: "[]",
      allowed_channel_ids: JSON.stringify([publicChannelId]),
      cooldown_seconds: 0,
    });

    const maliciousPayload = {
      mode: "bot",
      channelId: publicChannelId,
      payload: {
        content: "Sneaky @everyone ping and <@&999999999999999999>",
        embeds: [
          {
            title: "Embed @here attempt",
            description: "Deep text with @everyone alert",
            fields: [
              { name: "Field 1", value: "Nested ping <@&111111111111111111>" },
            ],
          },
        ],
        allowed_mentions: {
          parse: ["everyone", "here"],
          roles: ["999999999999999999"],
        },
      },
    };

    const res = await fetch(`${ts.baseUrl}/api/send`, {
      method: "POST",
      headers: { "x-staff-id": modStaffId, "Content-Type": "application/json" },
      body: JSON.stringify(maliciousPayload),
    });

    expect(res.status).toBe(200);
    const sent = vi.mocked(discord.sendChannelMessage).mock.calls[0][1];

    // Root content sanitized
    expect(sent.content).not.toContain("@everyone");
    expect(sent.content).toContain("@\u200beveryone");
    expect(sent.content).not.toContain("<@&999999999999999999>");

    // Embeds sanitized
    expect(sent.embeds[0].title).not.toContain("@here");
    expect(sent.embeds[0].description).not.toContain("@everyone");
    expect(sent.embeds[0].fields[0].value).not.toContain("<@&111111111111111111>");

    // allowed_mentions sanitized
    expect(sent.allowed_mentions?.parse).toEqual([]);
    expect(sent.allowed_mentions?.roles).toBeUndefined();
  });

  /* ──────────────────────────────────────────────────────────────────────────
     Scenario 4: Component V2 Multi-Button Workflow Design & Verification
     ────────────────────────────────────────────────────────────────────────── */
  it("Scenario 4: Component V2 Multi-Button Workflow Design & Registration", async () => {
    const flowsSpy = vi.spyOn(actionRepository, "registerFlows").mockResolvedValue(undefined as any);

    const v2Payload = {
      mode: "bot",
      channelId: publicChannelId,
      payload: {
        content: "Community Hub Menu",
        components: [
          {
            type: 1, // Action Row
            components: [
              { type: 2, style: 1, label: "Verify", custom_id: "hub_verify" },
              { type: 2, style: 2, label: "Help", custom_id: "hub_help" },
              { type: 2, style: 5, label: "Docs", url: "https://example.com" },
            ],
          },
        ],
      },
      flows: [
        {
          custom_id: "hub_verify",
          actions: [
            {
              action_type: "send_message",
              config: { content: "You have verified!" },
            },
          ],
        },
        {
          custom_id: "hub_help",
          actions: [
            {
              action_type: "open_modal",
              config: { title: "Support Ticket" },
            },
          ],
        },
      ],
    };

    const res = await fetch(`${ts.baseUrl}/api/send`, {
      method: "POST",
      headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
      body: JSON.stringify(v2Payload),
    });

    expect(res.status).toBe(200);
    expect(discord.sendChannelMessage).toHaveBeenCalled();
    const sent = vi.mocked(discord.sendChannelMessage).mock.calls[0][1];
    expect(sent.components[0].components).toHaveLength(3);
    expect(sent.components[0].components[0].custom_id).toBe("hub_verify");
    expect(sent.components[0].components[1].custom_id).toBe("hub_help");
    expect(flowsSpy).toHaveBeenCalledWith("prod-msg-9999", expect.any(Array));
  });

  /* ──────────────────────────────────────────────────────────────────────────
     Scenario 5: Staff Access Full Lifecycle & Granular Rate Limiting
     ────────────────────────────────────────────────────────────────────────── */
  it("Scenario 5: Staff Access Full Lifecycle: Search, Grant, Enforce Rate Limits, Revoke", async () => {
    // 1. Search member in guild to find their Discord ID
    const searchRes = await fetch(`${ts.baseUrl}/api/discord/guilds/700000000000000001/members/search?query=bob`, {
      headers: { "x-admin-key": env.adminApiKey },
    });
    const searchData = await searchRes.json();
    const targetMember = searchData.members.find((m: any) => m.username === "bob_staff");
    expect(targetMember).toBeDefined();
    const bobId = targetMember.id;

    // 2. Grant staff access to Bob with 2 messages per hour limit and 0 cooldown
    const grantRes = await fetch(`${ts.baseUrl}/api/access`, {
      method: "POST",
      headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        discord_user_id: bobId,
        discord_username: targetMember.username,
        can_send_messages: 1,
        allowed_channel_ids: [publicChannelId],
        cooldown_seconds: 0,
        max_messages_per_hour: 2,
      }),
    });
    expect(grantRes.status).toBe(201);

    // 3. Bob verifies their permissions via /check endpoint
    const checkRes = await fetch(`${ts.baseUrl}/api/access/${bobId}/check`);
    expect(checkRes.status).toBe(200);
    const checkData = await checkRes.json();
    expect(checkData.hasAccess).toBe(true);
    expect(checkData.permissions.max_messages_per_hour).toBe(2);

    // 4. Bob sends 1st message -> OK
    const send1 = await fetch(`${ts.baseUrl}/api/send`, {
      method: "POST",
      headers: { "x-staff-id": bobId, "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "bot", channelId: publicChannelId, payload: { content: "Bob 1" } }),
    });
    expect(send1.status).toBe(200);

    // 5. Bob sends 2nd message -> OK
    const send2 = await fetch(`${ts.baseUrl}/api/send`, {
      method: "POST",
      headers: { "x-staff-id": bobId, "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "bot", channelId: publicChannelId, payload: { content: "Bob 2" } }),
    });
    expect(send2.status).toBe(200);

    // 6. Bob sends 3rd message -> hits hourly limit (429)
    const send3 = await fetch(`${ts.baseUrl}/api/send`, {
      method: "POST",
      headers: { "x-staff-id": bobId, "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "bot", channelId: publicChannelId, payload: { content: "Bob 3" } }),
    });
    expect(send3.status).toBe(429);

    // 7. Admin updates Bob's limit to 10 messages per hour
    await fetch(`${ts.baseUrl}/api/access/${bobId}`, {
      method: "PATCH",
      headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ max_messages_per_hour: 10 }),
    });

    // 8. Bob can now send again
    const send4 = await fetch(`${ts.baseUrl}/api/send`, {
      method: "POST",
      headers: { "x-staff-id": bobId, "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "bot", channelId: publicChannelId, payload: { content: "Bob 4" } }),
    });
    expect(send4.status).toBe(200);

    // 9. Admin revokes Bob's access
    const revokeRes = await fetch(`${ts.baseUrl}/api/access/${bobId}`, {
      method: "DELETE",
      headers: { "x-admin-key": env.adminApiKey },
    });
    expect(revokeRes.status).toBe(200);

    // 10. Bob's subsequent send is blocked (403)
    const send5 = await fetch(`${ts.baseUrl}/api/send`, {
      method: "POST",
      headers: { "x-staff-id": bobId, "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "bot", channelId: publicChannelId, payload: { content: "Bob blocked" } }),
    });
    expect(send5.status).toBe(403);

    // Cleanup
    await deleteTestStaffRecord(bobId);
  });
});
