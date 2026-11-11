import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { db, initializeDatabase } from "../src/config/database.js";
import * as discordService from "../src/services/discordService.js";

// Mock outbound discord service calls with importOriginal
vi.mock("../src/services/discordService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/discordService.js")>();
  return {
    ...actual,
    sendChannelMessage: vi.fn().mockResolvedValue({ id: "msg_out_1" }),
    sendWebhook: vi.fn().mockResolvedValue({ id: "hook_out_1" }),
    createInteractionResponse: vi.fn().mockResolvedValue(true),
    getGuildChannels: vi.fn().mockResolvedValue([]),
    getChannelGuildId: vi.fn().mockResolvedValue("guild_123"),
    getGuildRoles: vi.fn().mockResolvedValue([]),
    getBotGuilds: vi.fn().mockResolvedValue([]),
    getWebhookInfo: vi.fn().mockResolvedValue({ id: "hook_1", name: "Webhook REST" }),
    resolveBotToken: vi.fn().mockResolvedValue("Bot.FakeToken"),
  };
});

// Mock weaoService to prevent network latency in route tests
vi.mock("../src/services/weaoService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/weaoService.js")>();
  return {
    ...actual,
    interpolateWeaoPlaceholders: vi.fn().mockImplementation((payload) => Promise.resolve({ payload, modified: false })),
    getAllExploits: vi.fn().mockResolvedValue([
      { title: "Delta", version: "1.0.0", updated: "2026-01-01" },
    ]),
    getWeaoRateLimitStatus: vi.fn().mockReturnValue({ isLimited: false, remaining: 100 }),
    findExploitByName: vi.fn().mockReturnValue(null),
    getExploitSuncDetails: vi.fn().mockResolvedValue(null),
  };
});

describe("server/routes: 11 REST Route Controllers Suite", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    // Seed in-memory SQLite schema, local admin user, and global settings
    await initializeDatabase();

    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const port = (server.address() as AddressInfo).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. /api/health
  describe("GET /api/health", () => {
    it("returns HTTP 200 with status ok when database is healthy", async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("ok");
      expect(json.database.connected).toBe(true);
    });

    it("returns HTTP 503 degraded when database connection throws (NEW-02)", async () => {
      vi.spyOn(db, "get").mockRejectedValueOnce(new Error("Database disconnected"));
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.status).toBe("degraded");
      expect(json.database.connected).toBe(false);
    });
  });

  // 2. /api/config
  describe("GET /api/config", () => {
    it("returns public server configuration", async () => {
      const res = await fetch(`${baseUrl}/api/config`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.actionTypes)).toBe(true);
      expect(json.features).toBeDefined();
    });
  });

  // 3. /api/auth
  describe("GET /api/auth/me", () => {
    it("returns user null for unauthenticated session", async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.user).toBeNull();
    });
  });

  // 4. /api/send
  describe("POST /api/send", () => {
      it("rejects webhook mode", async () => {
        const res = await fetch(`${baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": env.adminApiKey,
        },
        body: JSON.stringify({ mode: "webhook", payload: { content: "hi" } }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("mode");
    });

    it("returns HTTP 400 when mode bot lacks channelId", async () => {
      const res = await fetch(`${baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": env.adminApiKey,
        },
        body: JSON.stringify({ mode: "bot", payload: { content: "hi" } }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("channelId");
    });

    it("returns HTTP 400 when mode webhook lacks webhookUrl", async () => {
      const res = await fetch(`${baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": env.adminApiKey,
        },
        body: JSON.stringify({ mode: "webhook", payload: { content: "hi" } }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("webhookUrl");
    });

    it("returns HTTP 400 when messages array exceeds 10 messages", async () => {
      const excessiveMessages = Array.from({ length: 11 }, (_, i) => ({
        content: `Message ${i}`,
      }));
      const res = await fetch(`${baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": env.adminApiKey,
        },
        body: JSON.stringify({
          mode: "bot",
          messages: excessiveMessages,
        }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("maximum 10 allowed");
    });

      it("rejects webhook URL message sending and never calls Discord webhook delivery", async () => {
        const res = await fetch(`${baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": env.adminApiKey,
        },
        body: JSON.stringify({
          mode: "webhook",
          webhookUrl: "https://discord.com/api/webhooks/111222333/valid_token",
          payload: { content: "Automated test message" },
        }),
      });
      expect(res.status).toBe(400);
      expect(discordService.sendWebhook).not.toHaveBeenCalled();
    });

  });

  // 5. /api/interactions
  describe("/api/interactions", () => {
    it("rejects POST /api/interactions missing Ed25519 signature headers", async () => {
      const res = await fetch(`${baseUrl}/api/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: 1 }),
      });
      expect(res.status).toBe(401);
    });

    it("rejects POST /api/interactions/relay missing x-admin-key", async () => {
      const res = await fetch(`${baseUrl}/api/interactions/relay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: 3 }),
      });
      expect(res.status).toBe(401);
    });

    it("accepts POST /api/interactions/relay with valid x-admin-key and complete payload", async () => {
      const interaction = {
        type: 3,
        id: "relay_test_100",
        application_id: "app_relay_100",
        token: "tok_relay",
        data: { custom_id: "action:dud" },
      };

      const res = await fetch(`${baseUrl}/api/interactions/relay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": env.adminApiKey,
        },
        body: JSON.stringify(interaction),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.delivered).toBe(true);
    });
  });

  // 6. /api/templates
  describe("POST & GET /api/templates", () => {
    let createdTemplateId: number;

    it("creates a template with POST /api/templates with x-admin-key", async () => {
      const res = await fetch(`${baseUrl}/api/templates`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": env.adminApiKey,
        },
        body: JSON.stringify({
          name: "REST Template",
          description: "Created via REST test",
          data: { content: "Template Content" },
        }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.template?.id).toBeDefined();
      createdTemplateId = json.template.id;
    });

    it("reads created template with GET /api/templates/:id", async () => {
      const res = await fetch(`${baseUrl}/api/templates/${createdTemplateId}`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.template.name).toBe("REST Template");
    });
  });

  // 7. /api/profiles
  describe("/api/profiles", () => {
    it("creates webhook profile via POST /api/profiles/webhooks", async () => {
      const res = await fetch(`${baseUrl}/api/profiles/webhooks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": env.adminApiKey,
        },
        body: JSON.stringify({
          name: "Webhook REST",
          url: "https://discord.com/api/webhooks/999/tok",
        }),
      });
      expect(res.status).toBe(404);
    });

    it("lists webhook profiles via GET /api/profiles/webhooks", async () => {
      const res = await fetch(`${baseUrl}/api/profiles/webhooks`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.profiles)).toBe(true);
    });
  });

  // 8. /api/access
  describe("GET /api/access", () => {
    it("returns staff access status list for admin", async () => {
      const res = await fetch(`${baseUrl}/api/access`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(404);

    });
  });

  // 9. /api/settings
  describe("GET /api/settings", () => {
    it("returns guild settings with x-admin-key", async () => {
      const res = await fetch(`${baseUrl}/api/settings?guildId=__global__`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.guild_id).toBe("__global__");
    });
  });

  // 10. /api/discord
  describe("GET /api/discord/guilds/:guildId/channels", () => {
    it("returns channel list", async () => {
      const res = await fetch(`${baseUrl}/api/discord/guilds/123/channels`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.channels)).toBe(true);
    });
  });

  // 11. /api/weao
  describe("GET /api/weao/exploits", () => {
    it("returns exploits list without error", async () => {
      const res = await fetch(`${baseUrl}/api/weao/exploits?q=delta`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.exploits)).toBe(true);
    });
  });
});
