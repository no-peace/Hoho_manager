import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { evaluateCheck } from "../src/actions/check.js";
import type { Express } from "express";

describe("Discohook R1-R4 Backend Endpoints & Evaluator", () => {
  let app: Express;
  let server: ReturnType<Express["listen"]>;
  let baseUrl: string;
  const testGuildId = "998877665544332211";
  const adminKey = env.adminApiKey || "test_admin_key";

  beforeAll(async () => {
    const { initializeDatabase } = await import("../src/config/database.js");
    await initializeDatabase();
    app = createApp();
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No TCP address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  });

  describe("R1: Audit Logs Endpoints", () => {
    it("POST /api/discord/guilds/:guildId/audit-logs creates an entry", async () => {
      const res = await fetch(`${baseUrl}/api/discord/guilds/${testGuildId}/audit-logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          type: "SEND_MESSAGE",
          channelId: "811111111111111111",
          reason: "Automated test audit log entry",
          details: "Message sent to announcement channel",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json() as any;
      expect(data.ok).toBe(true);
      expect(data.entry.type).toBe("SEND_MESSAGE");
      expect(data.entry.id).toBeDefined();
    });

    it("GET /api/discord/guilds/:guildId/audit-logs returns entries matching Discohook shape", async () => {
      const res = await fetch(`${baseUrl}/api/discord/guilds/${testGuildId}/audit-logs`, {
        headers: { "x-admin-key": adminKey },
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(Array.isArray(data.entries)).toBe(true);
      expect(data.entries.length).toBeGreaterThanOrEqual(1);
      expect(data.query).toBeDefined();
      expect(data.total).toBeGreaterThanOrEqual(1);
    });

    it("GET /api/discord/guilds/:guildId/log is an alias for audit-logs", async () => {
      const res = await fetch(`${baseUrl}/api/discord/guilds/${testGuildId}/log`, {
        headers: { "x-admin-key": adminKey },
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(Array.isArray(data.entries)).toBe(true);
    });

    it("GET /api/v1/guilds/:guildId/log supports Discohook v1 API routing path", async () => {
      const res = await fetch(`${baseUrl}/api/v1/guilds/${testGuildId}/log`, {
        headers: { "x-admin-key": adminKey },
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(Array.isArray(data.entries)).toBe(true);
    });
  });

  describe("R1: Active Sessions Endpoints", () => {
    let createdTokenId = "";

    it("POST /api/discord/guilds/:guildId/sessions creates a new active session", async () => {
      const res = await fetch(`${baseUrl}/api/discord/guilds/${testGuildId}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          userId: "900000000000000001",
          permissions: "send,manage_messages",
          channelId: "811111111111111111",
        }),
      });

      expect(res.status).toBe(201);
      const data = await res.json() as any;
      expect(data.ok).toBe(true);
      expect(data.session.tokenId).toBeDefined();
      createdTokenId = data.session.tokenId;
    });

    it("GET /api/discord/guilds/:guildId/sessions returns session listing", async () => {
      const res = await fetch(`${baseUrl}/api/discord/guilds/${testGuildId}/sessions`, {
        headers: { "x-admin-key": adminKey },
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(Array.isArray(data.results)).toBe(true);
      expect(data.results.length).toBeGreaterThanOrEqual(1);
      expect(data.cursor).toBeDefined();
      const found = data.results.find((s: any) => s.tokenId === createdTokenId);
      expect(found).toBeDefined();
    });

    it("GET /api/v1/guilds/:guildId/sessions provides Discohook API v1 parity", async () => {
      const res = await fetch(`${baseUrl}/api/v1/guilds/${testGuildId}/sessions`, {
        headers: { "x-admin-key": adminKey },
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(Array.isArray(data.results)).toBe(true);
    });

    it("DELETE /api/discord/guilds/:guildId/sessions/:tokenId revokes specific session", async () => {
      const res = await fetch(`${baseUrl}/api/discord/guilds/${testGuildId}/sessions/${createdTokenId}`, {
        method: "DELETE",
        headers: { "x-admin-key": adminKey },
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.ok).toBe(true);
      expect(data.revoked).toBe(1);
    });
  });

  describe("R4: Flow Triggers 'Member has role' Check Evaluator", () => {
    it("evaluates Static mode: member has role returns true", () => {
      const config = {
        checkType: "member_has_role",
        roleMode: "static",
        roleId: "777777777777777777",
      };
      const variables = {
        "member.role_ids": ["111111111111111111", "777777777777777777"],
      };

      expect(evaluateCheck(config, variables)).toBe(true);
    });

    it("evaluates Static mode: member does not have role returns false", () => {
      const config = {
        checkType: "member_has_role",
        roleMode: "static",
        roleId: "999999999999999999",
      };
      const variables = {
        "member.role_ids": ["111111111111111111", "777777777777777777"],
      };

      expect(evaluateCheck(config, variables)).toBe(false);
    });

    it("evaluates Adaptive mode: resolves role ID from variables", () => {
      const config = {
        checkType: "member_has_role",
        roleMode: "adaptive",
        roleId: "target_role",
      };
      const variables = {
        target_role: "555555555555555555",
        "member.role_ids": ["555555555555555555", "111111111111111111"],
      };

      expect(evaluateCheck(config, variables)).toBe(true);
    });

    it("evaluates Mirror mode: mirrors role from context variable", () => {
      const config = {
        checkType: "member_has_role",
        roleMode: "mirror",
        roleId: "context.required_role",
      };
      const variables = {
        context: {
          required_role: "333333333333333333",
        },
        "member.role_ids": ["333333333333333333"],
      };

      expect(evaluateCheck(config, variables)).toBe(true);
    });

    it("evaluates Adaptive mode with curly braces in variable name", () => {
      const config = {
        checkType: "member_has_role",
        roleMode: "adaptive",
        roleId: "{{custom_role_var}}",
      };
      const variables = {
        custom_role_var: "888888888888888888",
        "member.role_ids": ["888888888888888888"],
      };

      expect(evaluateCheck(config, variables)).toBe(true);
    });

    it("evaluates comma-separated string format in member roles", () => {
      const config = {
        checkType: "member_has_role",
        roleMode: "static",
        roleId: "444444444444444444",
      };
      const variables = {
        "member.role_ids": "111111111111111111, 444444444444444444, 999999999999999999",
      };

      expect(evaluateCheck(config, variables)).toBe(true);
    });

    it("security: empty or undefined role never passes check even if member has no roles", () => {
      const configEmpty = {
        checkType: "member_has_role",
        roleMode: "static",
        roleId: "",
      };
      const variablesEmpty = {
        "member.role_ids": "",
      };
      expect(evaluateCheck(configEmpty, variablesEmpty)).toBe(false);

      const configUndefined = {
        checkType: "member_has_role",
        roleMode: "static",
        roleId: undefined,
      };
      expect(evaluateCheck(configUndefined, { "member.role_ids": [] })).toBe(false);
    });
  });

  describe("R1 & R2: Adversarial Backend API Edge Cases", () => {
    it("returns 0 active sessions when all sessions are revoked without infinite re-seeding", async () => {
      const revGuild = "887766554433221100";
      // 1. First fetch auto-seeds
      const res1 = await fetch(`${baseUrl}/api/discord/guilds/${revGuild}/sessions`, {
        headers: { "x-admin-key": adminKey },
      });
      const data1 = await res1.json() as any;
      expect(data1.results.length).toBe(1);
      const tokId = data1.results[0].tokenId;

      // 2. Revoke it
      const delRes = await fetch(`${baseUrl}/api/discord/guilds/${revGuild}/sessions/${tokId}`, {
        method: "DELETE",
        headers: { "x-admin-key": adminKey },
      });
      expect(delRes.status).toBe(200);

      // 3. Second fetch must return 0 results
      const res2 = await fetch(`${baseUrl}/api/discord/guilds/${revGuild}/sessions`, {
        headers: { "x-admin-key": adminKey },
      });
      const data2 = await res2.json() as any;
      expect(data2.results).toHaveLength(0);
    });

    it("DELETE /api/discord/guilds/:guildId/sessions rejects empty token IDs with 400", async () => {
      const res = await fetch(`${baseUrl}/api/discord/guilds/${testGuildId}/sessions`, {
        method: "DELETE",
        headers: { "x-admin-key": adminKey },
      });
      expect(res.status).toBe(400);
    });

    it("POST /api/send rejects more than 10 messages with 400", async () => {
      const elevenMessages = Array.from({ length: 11 }, (_, i) => ({
        content: `Message ${i + 1}`,
      }));
      const res = await fetch(`${baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          mode: "webhook",
          webhookUrl: "https://discord.com/api/webhooks/123/abc",
          messages: elevenMessages,
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.error).toContain("maximum 10 allowed");
    });

    it("POST /api/send rejects missing payload when not in multi-message mode", async () => {
      const res = await fetch(`${baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          mode: "webhook",
          webhookUrl: "https://discord.com/api/webhooks/123/abc",
        }),
      });
      expect(res.status).toBe(400);
      const data = await res.json() as any;
      expect(data.error).toContain("payload is required");
    });
  });
});
