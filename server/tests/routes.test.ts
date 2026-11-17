import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { db, initializeDatabase } from "../src/config/database.js";
import * as discordService from "../src/services/discordService.js";
import * as weaoService from "../src/services/weaoService.js";
import * as actionExecutor from "../src/services/actionExecutor.js";
import { staffRepository } from "../src/repositories/staffRepository.js";
import { userRepository } from "../src/repositories/userRepository.js";
import { templateRepository } from "../src/repositories/templateRepository.js";

// Mock outbound discord service calls with importOriginal
vi.mock("../src/services/discordService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/discordService.js")>();
  return {
    ...actual,
    sendChannelMessage: vi.fn().mockResolvedValue({ id: "msg_out_1" }),
    createInteractionResponse: vi.fn().mockResolvedValue(true),
    getGuildChannels: vi.fn().mockResolvedValue([]),
    getChannelGuildId: vi.fn().mockResolvedValue("guild_123"),
    getGuildRoles: vi.fn().mockResolvedValue([]),
    getGuildMember: vi.fn().mockResolvedValue({ user: { username: "staff", global_name: "Staff" }, nick: "Staff" }),
    getBotGuilds: vi.fn().mockResolvedValue([]),
    getDiscordUser: vi.fn(),
    getDiscordUserAvatarUrl: vi.fn((user: { id: string; avatar: string | null }) =>
      user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=1024`
        : "https://cdn.discordapp.com/embed/avatars/0.png",
    ),
    resolveBotToken: vi.fn().mockResolvedValue("Bot.FakeToken"),
  };
});

// Mock weaoService to prevent network latency in route tests
vi.mock("../src/services/weaoService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/weaoService.js")>();
  return {
    ...actual,
    interpolateWeaoPlaceholders: vi.fn().mockImplementation((payload) => {
      const serialized = JSON.stringify(payload).replace(/\{\s*exploit(?:\.|:)[^}]+\}/gi, "Updated");
      return Promise.resolve({ payload: JSON.parse(serialized), modified: true });
    }),
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("applies retired dispatch cleanup and interaction receipt migrations", async () => {
    const [botProfileColumn, webhookPermissionColumn, overridePermissionColumn, duplicateColumn, webhookTable, botProfileTable] =
      await Promise.all([
        db.get("SELECT name FROM pragma_table_info('settings') WHERE name = 'bot_profile_id'"),
        db.get("SELECT name FROM pragma_table_info('staff_access') WHERE name = 'can_use_webhooks'"),
        db.get("SELECT name FROM pragma_table_info('staff_access') WHERE name = 'can_override_profile'"),
        db.get("SELECT name FROM pragma_table_info('interaction_receipts') WHERE name = 'duplicate_delivery'"),
        db.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'webhook_profiles'"),
        db.get("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'bot_profiles'"),
      ]);

    expect(botProfileColumn).toBeFalsy();
    expect(webhookPermissionColumn).toBeFalsy();
    expect(overridePermissionColumn).toBeFalsy();
    expect(duplicateColumn).toBeDefined();
    expect(webhookTable).toBeFalsy();
    expect(botProfileTable).toBeFalsy();
  });

  // 1. /api/health
  describe("GET /api/health", () => {
    it("returns HTTP 200 with status ok when database is healthy", async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("ok");
      expect(json.database.connected).toBe(true);
      expect(json.database).not.toHaveProperty("users");
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

    it("sends directly to an existing thread when threadId is supplied", async () => {
      const threadId = "123456789012345678";
      const res = await fetch(`${baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": env.adminApiKey,
        },
        body: JSON.stringify({
          mode: "bot",
          threadId,
          payload: { content: "Thread destination regression test" },
        }),
      });

      expect(res.status).toBe(200);
      expect(discordService.sendChannelMessage).toHaveBeenCalledWith(
        threadId,
        expect.objectContaining({ content: "Thread destination regression test" }),
        expect.objectContaining({ files: expect.any(Array) }),
      );
    });

    it("rejects malformed thread IDs before dispatch", async () => {
      const res = await fetch(`${baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": env.adminApiKey,
        },
        body: JSON.stringify({
          mode: "bot",
          threadId: "not-a-discord-id",
          payload: { content: "Must not send" },
        }),
      });

      expect(res.status).toBe(400);
      expect(discordService.sendChannelMessage).not.toHaveBeenCalled();
    });

    it("checks staff channel allowlists against the destination thread ID", async () => {
      const staffId = "223456789012345678";
      const threadId = "323456789012345678";

      await staffRepository.create({
        discord_user_id: staffId,
        discord_username: "thread_permission_test",
        granted_by_discord_id: "987654321098765432",
        can_send_messages: 1,
        cooldown_seconds: 0,
        max_messages_per_hour: 10,
        allowed_channel_ids: JSON.stringify(["parent_channel"]),
        allowed_guild_ids: JSON.stringify(["*"]),
      });

      try {
        const res = await fetch(`${baseUrl}/api/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-staff-id": staffId,
          },
          body: JSON.stringify({
            mode: "bot",
            channelId: "parent_channel",
            threadId,
            payload: { content: "Must be blocked" },
          }),
        });

        expect(res.status).toBe(403);
        expect(discordService.sendChannelMessage).not.toHaveBeenCalled();
      } finally {
        await staffRepository.delete(staffId);
      }
    });

    it("rejects webhook mode even when webhookUrl is missing", async () => {
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
      expect(discordService.sendChannelMessage).not.toHaveBeenCalled();
    });

    it("blocks staff from sending to a channel in a unauthoried guild", async () =>{
      const staffId = "123456789012345678";

      await staffRepository.create({
        discord_user_id: staffId,
        discord_username: "regression_test",
        granted_by_discord_id: "987654321098765432",
        can_send_messages: 1,
        cooldown_seconds: 0,
        max_messages_per_hour: 10,
        allowed_channel_ids: JSON.stringify(["channel_123"]),
        allowed_guild_ids: JSON.stringify(["guild_allowed"]),
      });

      try {
        // The mocked Discord service resolves this channel to guild_123.
        // The staff member is only allowed in guild_allowed.
        vi.mocked(discordService.getChannelGuildId).mockResolvedValue("guild_123");

        const res = await fetch(`${baseUrl}/api/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-staff-id": staffId,
          },
          body: JSON.stringify({
            mode: "bot",
            channelId: "channel_123",
            payload: { content: "Regression test message" },
          }),
        });

        expect(res.status).toBe(403);
        expect(discordService.sendChannelMessage).not.toHaveBeenCalled();
      } finally {
        await staffRepository.delete(staffId);
      }
    });
    it("rejects URL attachments before downloading when staff attachment permission is disabled", async () => {
      const staffId = "523456789012345678";
      await staffRepository.create({
        discord_user_id: staffId,
        discord_username: "no_attachment_permission",
        granted_by_discord_id: "987654321098765432",
        can_send_messages: 1,
        can_attach_files: 0,
        cooldown_seconds: 0,
        max_messages_per_hour: 10,
        allowed_channel_ids: JSON.stringify(["channel_123"]),
        allowed_guild_ids: JSON.stringify(["*"]),
      });

      try {
        const res = await fetch(`${baseUrl}/api/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-staff-id": staffId,
          },
          body: JSON.stringify({
            mode: "bot",
            channelId: "channel_123",
            payload: { content: "No attachments allowed" },
            attachments: [{ url: "http://127.0.0.1/private" }],
          }),
        });

        expect(res.status).toBe(403);
        expect((await res.json()).error).toContain("not permitted to attach files");
        expect(discordService.sendChannelMessage).not.toHaveBeenCalled();
      } finally {
        await staffRepository.delete(staffId);
      }
    });

    it("blocks WEAO placeholders in both modern and legacy syntax when staff permission is disabled", async () => {
      const staffId = "423456789012345678";
      await staffRepository.create({
        discord_user_id: staffId,
        discord_username: "no_weao_permission",
        granted_by_discord_id: "987654321098765432",
        can_send_messages: 1,
        can_use_weao_exploits: 0,
        cooldown_seconds: 0,
        max_messages_per_hour: 10,
        allowed_channel_ids: JSON.stringify(["channel_123"]),
        allowed_guild_ids: JSON.stringify(["*"]),
      });

      try {
        for (const content of ["{exploit.Delta.status}", "{exploit:Delta:status}", "{ exploit:Delta:status}"]) {
          const res = await fetch(`${baseUrl}/api/send`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-staff-id": staffId,
            },
            body: JSON.stringify({
              mode: "bot",
              channelId: "channel_123",
              payload: { content },
            }),
          });
          expect(res.status).toBe(403);
          expect((await res.json()).error).toContain("not permitted to use WEAO");
        }
        expect(discordService.sendChannelMessage).not.toHaveBeenCalled();
        expect(weaoService.interpolateWeaoPlaceholders).not.toHaveBeenCalled();
      } finally {
        await staffRepository.delete(staffId);
      }
    });

    it("revalidates message limits after external placeholders are expanded", async () => {
      vi.mocked(weaoService.interpolateWeaoPlaceholders).mockImplementationOnce(async (payload) => ({
        payload: { ...payload, content: "x".repeat(2001) },
        modified: true,
      }));

      const response = await fetch(`${baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": env.adminApiKey,
        },
        body: JSON.stringify({
          mode: "bot",
          channelId: "channel_123",
          payload: { content: "safe before interpolation" },
        }),
      });

      expect(response.status).toBe(400);
      expect(discordService.sendChannelMessage).not.toHaveBeenCalled();
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

    it("keeps a deferred result alive when the gateway callback reports a duplicate ACK", async () => {
      vi.spyOn(actionExecutor, "executeCustomId").mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1_300));
        return {
          handled: true,
          response: {
            type: 4,
            data: { content: "The original action completed." },
          },
        } as any;
      });
      vi.mocked(discordService.createInteractionResponse).mockRejectedValueOnce(
        new Error("Unknown interaction: already acknowledged"),
      );
      const followupSpy = vi.spyOn(discordService, "createFollowupMessage").mockResolvedValue({
        id: "late_followup",
      } as any);

      const interaction = {
        type: 3,
        id: "123456789012345679",
        application_id: env.discord.applicationId ?? "223456789012345678",
        token: "tok_duplicate_ack_1234567890",
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

      expect(res.status).toBe(502);
      await vi.waitFor(() => expect(followupSpy).toHaveBeenCalled());
    });

    it("accepts POST /api/interactions/relay with valid x-admin-key and complete payload", async () => {
      const interaction = {
        type: 3,
        id: "123456789012345678",
        application_id: env.discord.applicationId ?? "223456789012345678",
        token: "tok_relay_1234567890",
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
    it("rejects requests to the removed webhook profiles route", async () => {
      const res = await fetch(`${baseUrl}/api/profiles/webhooks`, {
        headers: { "x-admin-key": env.adminApiKey },
      });

      expect(res.status).toBe(404);
    });
  });

  // 8. /api/access
  describe("GET /api/access", () => {
    it("returns staff access status list for admin", async () => {
      const res = await fetch(`${baseUrl}/api/access`, {
        headers: { "x-admin-key": env.adminApiKey },
      });

      expect(res.status).toBe(200);

      const json = await res.json();
      expect(Array.isArray(json)).toBe(true);
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
  describe("GET /api/discord", () => {
    const USER_A = "123456789012345678";
    const USER_B = "223456789012345678";

    const makeUser = (id: string, username: string) => ({
      id,
      username,
      global_name: username === "peace" ? "Peace" : null,
      nickname: null,
      avatar: "avatar_hash",
    });

    it("returns channel list", async () => {
      const res = await fetch(`${baseUrl}/api/discord/guilds/123/channels`, {
        headers: { "x-admin-key": env.adminApiKey },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.channels)).toBe(true);
    });

    describe("GET /api/discord/users/resolve", () => {
      const adminHeaders = {
        "x-admin-key": env.adminApiKey,
      };

      it("rejects a request without IDs", async () => {
        const res = await fetch(`${baseUrl}/api/discord/users/resolve`, {
          headers: adminHeaders,
        });

        expect(res.status).toBe(400);
      });

      it("rejects invalid Discord user IDs", async () => {
        const res = await fetch(
          `${baseUrl}/api/discord/users/resolve?ids=not-a-discord-id`,
          { headers: adminHeaders },
        );

        expect(res.status).toBe(400);
      });

      it("rejects more than 10 unique IDs", async () => {
        const ids = Array.from(
          { length: 11 },
          (_, index) => `${String(index + 1).padStart(17, "0")}`,
        );

        const res = await fetch(
          `${baseUrl}/api/discord/users/resolve?ids=${ids.join(",")}`,
          { headers: adminHeaders },
        );

        expect(res.status).toBe(400);
      });

      it("deduplicates IDs and returns safe user profile data", async () => {
        vi.mocked(discordService.getDiscordUser).mockResolvedValue(
          makeUser(USER_A, "peace") as any,
        );

        const res = await fetch(
          `${baseUrl}/api/discord/users/resolve?ids=${USER_A},${USER_A}`,
          { headers: adminHeaders },
        );

        expect(res.status).toBe(200);

        const json = await res.json();

        expect(Object.keys(json.users)).toEqual([USER_A]);
        expect(json.failedIds).toEqual([]);

        expect(json.users[USER_A]).toEqual({
          id: USER_A,
          username: "peace",
          globalName: "Peace",
          avatarUrl: `https://cdn.discordapp.com/avatars/${USER_A}/avatar_hash.png?size=1024`,
          profileUrl: `https://discord.com/users/${USER_A}`,
          nickname: null,
          clanTag: null,
        });

        expect(discordService.getDiscordUser).toHaveBeenCalledTimes(1);
        expect(discordService.getDiscordUser).toHaveBeenCalledWith(USER_A);
      });

      it("returns successful users and reports failed lookups separately", async () => {
        vi.mocked(discordService.getDiscordUser).mockImplementation(
          async (id) => {
            if (id === USER_A) return makeUser(USER_A, "peace") as any;
            throw new Error("Discord API unavailable");
          },
        );

        const res = await fetch(
          `${baseUrl}/api/discord/users/resolve?ids=${USER_A},${USER_B}`,
          { headers: adminHeaders },
        );

        expect(res.status).toBe(200);

        const json = await res.json();

        expect(json.users[USER_A]).toBeDefined();
        expect(json.users[USER_B]).toBeUndefined();
        expect(json.failedIds).toContain(USER_B);
      });

      it("does not expose raw Discord errors or bot credentials", async () => {
        vi.mocked(discordService.getDiscordUser).mockRejectedValue(
          new Error("Bot token SECRET_TOKEN Discord API failure"),
        );

        const res = await fetch(
          `${baseUrl}/api/discord/users/resolve?ids=${USER_A}`,
          { headers: adminHeaders },
        );

        const body = await res.text();

        expect(body).not.toContain("SECRET_TOKEN");
        expect(body).not.toContain("Bot token");
        expect(body).not.toContain("Discord API failure");
      });
    });
  });

  // 11. /api/weao
  describe("GET /api/weao/exploits", () => {
    it("does not expose another user’s private template as an exploit backup", async () => {
      const owner = await userRepository.upsert({
        discordId: "323456789012345678",
        username: "private-template-owner",
        role: "editor",
      });
      expect(owner).toBeDefined();
      await templateRepository.create({
        userId: owner!.id,
        name: "Delta",
        data: { content: "PRIVATE TEMPLATE CONTENT" },
        isPublic: 0,
      });

      const res = await fetch(`${baseUrl}/api/weao/exploits?q=delta`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.exploits)).toBe(true);
      // Delta is part of the mocked public WEAO catalogue. Its matching private
      // template must not be attached to the catalogue entry or exposed as a backup.
      const delta = json.exploits.find((exploit: { title: string }) => exploit.title === "Delta");
      expect(delta).toBeDefined();
      expect(delta.hasBackupTemplate).toBe(false);
      expect(delta.backupTemplateId).toBeNull();
      expect(delta.backupTemplateName).toBeNull();
      expect(JSON.stringify(json)).not.toContain("PRIVATE TEMPLATE CONTENT");
    });
  });
});
