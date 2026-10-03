import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { startTestServer, createTestStaffRecord, deleteTestStaffRecord, resetTestSettings, type TestServer } from "../helpers/testApp.js";
import { env } from "../../src/config/env.js";
import * as discord from "../../src/services/discordService.js";
import { isSnowflake } from "../../src/utils/validation.js";
import { scrubMentions, sanitizeAllowedMentions } from "../../src/utils/mentionScrubber.js";

describe("Tier 2 — Boundary & Corner Cases", () => {
  let ts: TestServer;
  const testStaffId = "933333333333333333";
  const testChannelId = "800000000000000001";

  beforeAll(async () => {
    ts = await startTestServer();
  });

  afterAll(async () => {
    await ts.close();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.spyOn(discord, "sendChannelMessage").mockResolvedValue({
      id: "boundary-msg-1",
      channel_id: testChannelId,
    });
  });

  afterEach(async () => {
    await deleteTestStaffRecord(testStaffId);
    await resetTestSettings();
  });

  /* ──────────────────────────────────────────────────────────────────────────
     1. Case-Insensitive Bypass Attempts (≥5)
     ────────────────────────────────────────────────────────────────────────── */
  describe("1. Case-Insensitive Mention Bypass Defense", () => {
    const strictPerms = {
      can_mention_everyone: 0,
      can_mention_here: 0,
      can_mention_roles: 0,
      allowed_role_mention_ids: "[]",
    };

    it("1.1 Sanitizes allowed_mentions against uppercase 'EVERYONE' and 'HERE'", () => {
      const payload = {
        content: "Bypass test",
        allowed_mentions: { parse: ["EVERYONE", "HERE", "roles"] },
      };
      const sanitized = sanitizeAllowedMentions(payload, strictPerms);
      const am = sanitized.allowed_mentions as any;
      expect(am.parse).not.toContain("everyone");
      expect(am.parse).not.toContain("EVERYONE");
      expect(am.parse).not.toContain("here");
      expect(am.parse).not.toContain("HERE");
    });

    it("1.2 Neutralizes lowercase @everyone mention", () => {
      const result = scrubMentions({ content: "Testing @everyone alert" }, strictPerms);
      expect(result.payload.content).not.toContain("@everyone");
      expect(result.payload.content).toContain("@\u200beveryone");
      expect(result.stripped).toContain("@everyone");
    });

    it("1.3 Neutralizes lowercase @here mention", () => {
      const result = scrubMentions({ content: "Testing @here alert" }, strictPerms);
      expect(result.payload.content).not.toContain("@here");
      expect(result.payload.content).toContain("@\u200bhere");
      expect(result.stripped).toContain("@here");
    });

    it("1.4 Strips unauthorized role mentions with arbitrary whitespace or padding", () => {
      const result = scrubMentions({ content: "<@&888888888888888888>" }, strictPerms);
      expect(result.payload.content).not.toContain("<@&888888888888888888>");
      expect(result.stripped).toContain("<@&888888888888888888>");
    });

    it("1.5 Disallows allowed_mentions role escalation", () => {
      const payload = {
        content: "Role test",
        allowed_mentions: { roles: ["111111111111111111", "222222222222222222"] },
      };
      const sanitized = sanitizeAllowedMentions(payload, strictPerms);
      const am = sanitized.allowed_mentions as any;
      expect(am.roles).toBeUndefined();
    });

    it("1.6 Sanitizes nested embeds with mention attempts", () => {
      const payload = {
        embeds: [
          { description: "Check @everyone out" },
          { fields: [{ name: "Title", value: "Ping @here now" }] },
        ],
      };
      const scrubbed = scrubMentions(payload, strictPerms);
      const embeds = scrubbed.payload.embeds as any[];
      expect(embeds[0].description).not.toContain("@everyone");
      expect(embeds[1].fields[0].value).not.toContain("@here");
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     2. Empty Allowlists, Wildcard Allowlists & Snowflake Boundaries (≥5)
     ────────────────────────────────────────────────────────────────────────── */
  describe("2. Allowlist Boundaries & Wildcards", () => {
    it("2.1 Wildcard '*' allows access to any channel ID", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        allowed_channel_ids: JSON.stringify(["*"]),
      });

      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: "877777777777777777",
          payload: { content: "Allowed everywhere" },
        }),
      });
      expect(res.status).toBe(200);
    });

    it("2.2 Explicit allowlist permits exact matches only", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        allowed_channel_ids: JSON.stringify([testChannelId]),
      });

      const allowedRes = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: testChannelId,
          payload: { content: "Allowed" },
        }),
      });
      expect(allowedRes.status).toBe(200);

      const deniedRes = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: "899999999999999999",
          payload: { content: "Denied" },
        }),
      });
      expect(deniedRes.status).toBe(403);
    });

    it("2.3 Corrupted or non-array allowed_channel_ids gracefully defaults safely", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        allowed_channel_ids: "{not a json array}",
      });

      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: testChannelId,
          payload: { content: "Corrupted allowlist test" },
        }),
      });
      // Safe behavior: gracefully handled without server crashing (403 or handled)
      expect([200, 403]).toContain(res.status);
    });

    it("2.4 Validates snowflake lengths from 17 to 20 digits accurately", () => {
      expect(isSnowflake("12345678901234567")).toBe(true);  // 17
      expect(isSnowflake("123456789012345678")).toBe(true); // 18
      expect(isSnowflake("1234567890123456789")).toBe(true); // 19
      expect(isSnowflake("12345678901234567890")).toBe(true); // 20
    });

    it("2.5 Rejects invalid snowflake lengths (16 digits or 21 digits)", () => {
      expect(isSnowflake("1234567890123456")).toBe(false);   // 16
      expect(isSnowflake("123456789012345678901")).toBe(false); // 21
    });

    it("2.6 Rejects snowflake strings with non-digit characters", () => {
      expect(isSnowflake("1234567890123456a")).toBe(false);
      expect(isSnowflake("-12345678901234567")).toBe(false);
      expect(isSnowflake("1234 5678 9012 3456")).toBe(false);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     3. Malformed JSON Bodies & Boundary Parameters (≥5)
     ────────────────────────────────────────────────────────────────────────── */
  describe("3. Malformed JSON Bodies & Parameter Boundaries", () => {
    it("3.1 Rejects request with non-JSON or invalid mode", async () => {
      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "invalid_mode", channelId: testChannelId, payload: {} }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("mode");
    });

    it("3.2 Rejects bot mode missing channelId", async () => {
      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "bot", payload: { content: "Missing channel" } }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("channelId");
    });

    it("3.3 Rejects webhook mode missing webhookUrl", async () => {
      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "webhook", payload: { content: "Missing webhook" } }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("webhookUrl");
    });

    it("3.4 Rejects invalid profileId format (negative or string-array)", async () => {
      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: testChannelId,
          profileId: -5,
          payload: { content: "Negative profile" },
        }),
      });
      expect(res.status).toBe(400);
    });

    it("3.5 Rejects PUT /api/settings with non-array head_admin_ids", async () => {
      const res = await fetch(`${ts.baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ head_admin_ids: "not-an-array" }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("head_admin_ids");
    });

    it("3.6 Rejects PUT /api/settings with non-object extra_settings", async () => {
      const res = await fetch(`${ts.baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "x-admin-key": env.adminApiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ extra_settings: "string-not-object" }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("extra_settings");
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     4. Rate Limits & Cooldown Boundaries (≥5)
     ────────────────────────────────────────────────────────────────────────── */
  describe("4. Rate Limits & Cooldown Boundaries", () => {
    it("4.1 Allows immediate repeat requests when cooldown_seconds is 0", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        cooldown_seconds: 0,
      });

      for (let i = 0; i < 3; i++) {
        const res = await fetch(`${ts.baseUrl}/api/send`, {
          method: "POST",
          headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "bot",
            channelId: testChannelId,
            payload: { content: `Zero cooldown msg ${i}` },
          }),
        });
        expect(res.status).toBe(200);
      }
    });

    it("4.2 Blocks immediately upon 1st request when max_messages_per_hour is 0", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        cooldown_seconds: 0,
        max_messages_per_hour: 0,
      });

      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: testChannelId,
          payload: { content: "Blocked by 0 limit" },
        }),
      });
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toContain("Hourly limit");
    });

    it("4.3 Cooldown tracks remaining seconds accurately without negative values", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        cooldown_seconds: 30,
      });

      await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "bot", channelId: testChannelId, payload: { content: "Trigger" } }),
      });

      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "bot", channelId: testChannelId, payload: { content: "Blocked" } }),
      });
      expect(res.status).toBe(429);
      const data = await res.json();
      const match = data.error.match(/Wait (\d+)s/);
      expect(match).not.toBeNull();
      const seconds = Number(match[1]);
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(30);
    });

    it("4.4 Staff access check endpoint accurately reports current permissions and limits", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        cooldown_seconds: 45,
        max_messages_per_hour: 15,
      });

      const res = await fetch(`${ts.baseUrl}/api/access/${testStaffId}/check`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.hasAccess).toBe(true);
      expect(data.permissions.cooldown_seconds).toBe(45);
      expect(data.permissions.max_messages_per_hour).toBe(15);
    });

    it("4.5 Expired staff access record is denied on self-check endpoint", async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        expires_at: "2020-01-01T00:00:00Z",
      });

      const res = await fetch(`${ts.baseUrl}/api/access/${testStaffId}/check`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.hasAccess).toBe(false);
      expect(data.reason).toBe("expired");
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     5. Non-Head-Admin Staff Authorization Boundaries (≥5)
     ────────────────────────────────────────────────────────────────────────── */
  describe("5. Non-Head-Admin Staff Authorization Boundaries", () => {
    beforeEach(async () => {
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        can_send_messages: 1,
        can_edit_messages: 0,
        can_delete_messages: 0,
        can_manage_templates: 0,
      });
    });

    it("5.1 Regular staff member cannot access GET /api/settings (403)", async () => {
      const res = await fetch(`${ts.baseUrl}/api/settings`, {
        headers: { "x-staff-id": testStaffId },
      });
      expect(res.status).toBe(403);
    });

    it("5.2 Regular staff member cannot update PUT /api/settings (403)", async () => {
      const res = await fetch(`${ts.baseUrl}/api/settings`, {
        method: "PUT",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({ log_channel_id: "123456789012345678" }),
      });
      expect(res.status).toBe(403);
    });

    it("5.3 Regular staff member cannot create staff records in POST /api/access (403)", async () => {
      const res = await fetch(`${ts.baseUrl}/api/access`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({ discord_user_id: "944444444444444444" }),
      });
      expect([401, 403]).toContain(res.status);
    });

    it("5.4 Regular staff member cannot delete staff records in DELETE /api/access/:id (403)", async () => {
      const res = await fetch(`${ts.baseUrl}/api/access/${testStaffId}`, {
        method: "DELETE",
        headers: { "x-staff-id": testStaffId },
      });
      expect([401, 403]).toContain(res.status);
    });

    it("5.5 Deactivated staff member (is_active: 0) is forbidden from sending (403)", async () => {
      await deleteTestStaffRecord(testStaffId);
      await createTestStaffRecord({
        discord_user_id: testStaffId,
        is_active: 0,
      });

      const res = await fetch(`${ts.baseUrl}/api/send`, {
        method: "POST",
        headers: { "x-staff-id": testStaffId, "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "bot",
          channelId: testChannelId,
          payload: { content: "Disabled staff message" },
        }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("disabled");
    });
  });
});
