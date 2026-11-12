import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { initializeDatabase } from "../src/config/database.js";
import * as discordService from "../src/services/discordService.js";
import { staffRepository } from "../src/repositories/staffRepository.js";
import { trackedMessageRepository } from "../src/repositories/trackedMessageRepository.js";

vi.mock("../src/services/discordService.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/services/discordService.js")>();

  return {
    ...actual,
    getBotGuilds: vi.fn().mockResolvedValue([
      { id: "guild_allowed", name: "Allowed Guild" },
      { id: "guild_denied", name: "Denied Guild" },
    ]),
    getGuildChannels: vi.fn().mockResolvedValue([
      { id: "channel_123", name: "Allowed Channel" },
      { id: "channel_456", name: "Other Channel" },
    ]),
    getChannelGuildId: vi.fn().mockResolvedValue("guild_denied"),
    getBotIdentity: vi.fn().mockResolvedValue({
      id: "bot_123456789012345678",
      username: "HoHo Bot",
    }),
    getChannelMessage: vi.fn().mockResolvedValue({
      id: "message_123",
      author: { id: "bot_123456789012345678" },
    }),
    getChannelMessages: vi.fn().mockResolvedValue([]),
    sendChannelMessage: vi.fn().mockResolvedValue({ id: "sent_123" }),
    editChannelMessage: vi.fn().mockResolvedValue({ id: "edited_123" }),
    resolveBotToken: vi.fn().mockResolvedValue("Bot.FakeToken"),
  };
});

describe("Phase 2 staff security regressions", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
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
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(discordService.getChannelGuildId).mockResolvedValue("guild_denied");
  });

  const createStaff = async (
    discordUserId: string,
    overrides: Record<string, unknown> = {},
  ) => {
    await staffRepository.create({
      discord_user_id: discordUserId,
      discord_username: "phase2_test",
      granted_by_discord_id: "987654321098765432",
      is_active: 1,
      cooldown_seconds: 0,
      max_messages_per_hour: 20,
      can_send_messages: 1,
      can_edit_messages: 1,
      can_delete_messages: 0,
      can_manage_templates: 0,
      allowed_channel_ids: JSON.stringify(["channel_123"]),
      allowed_guild_ids: JSON.stringify(["guild_allowed"]),
      ...overrides,
    } as any);
  };

  it("rejects anonymous access to all tracking endpoints", async () => {
    const list = await fetch(`${baseUrl}/api/tracking/messages`);
    const sync = await fetch(`${baseUrl}/api/tracking/sync`, {
      method: "POST",
    });
    const track = await fetch(`${baseUrl}/api/tracking/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId: "channel_123",
        messageId: "message_123",
        rawPayload: { content: "test" },
      }),
    });

    expect(list.status).toBe(401);
    expect(sync.status).toBe(401);
    expect(track.status).toBe(401);
  });

  it("allows the bot's admin-key client to run global tracking sync", async () => {
    const response = await fetch(`${baseUrl}/api/tracking/sync`, {
      method: "POST",
      headers: { "x-admin-key": env.adminApiKey },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
  });

  it("blocks staff from tracking a message in a disallowed guild", async () => {
    const staffId = "123456789012345678";
    await createStaff(staffId);

    try {
      vi.mocked(discordService.getChannelGuildId).mockResolvedValue("guild_denied");

      const response = await fetch(`${baseUrl}/api/tracking/track`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-staff-id": staffId,
        },
        body: JSON.stringify({
          channelId: "channel_123",
          messageId: "message_123",
          rawPayload: { content: "tracked message" },
        }),
      });

      expect(response.status).toBe(403);
      expect(discordService.getChannelMessage).not.toHaveBeenCalled();
    } finally {
      await staffRepository.delete(staffId);
    }
  });

  it("does not reveal tracked records from a disallowed guild to staff", async () => {
    const staffId = "123456789012345679";
    await createStaff(staffId);

    await trackedMessageRepository.upsert({
      channel_id: "channel_123",
      message_id: "tracked_123",
      last_payload_hash: "test-hash",
    });

    try {
      vi.mocked(discordService.getChannelGuildId).mockResolvedValue("guild_denied");

      const response = await fetch(`${baseUrl}/api/tracking/messages`, {
        headers: { "x-staff-id": staffId },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.messages).toHaveLength(0);
    } finally {
      await trackedMessageRepository.delete("channel_123", "tracked_123");
      await staffRepository.delete(staffId);
    }
  });

  it("blocks staff from fetching a channel's messages in a disallowed guild", async () => {
    const staffId = "123456789012345680";
    await createStaff(staffId);

    try {
      vi.mocked(discordService.getChannelGuildId).mockResolvedValue("guild_denied");

      const response = await fetch(
        `${baseUrl}/api/send/channels/channel_123/messages`,
        { headers: { "x-staff-id": staffId } },
      );

      expect(response.status).toBe(403);
      expect(discordService.getChannelMessages).not.toHaveBeenCalled();
    } finally {
      await staffRepository.delete(staffId);
    }
  });

  it("blocks staff from fetching a specific message in a disallowed guild", async () => {
    const staffId = "123456789012345681";
    await createStaff(staffId);

    try {
      vi.mocked(discordService.getChannelGuildId).mockResolvedValue("guild_denied");

      const response = await fetch(
        `${baseUrl}/api/send/channels/channel_123/messages/message_123`,
        { headers: { "x-staff-id": staffId } },
      );

      expect(response.status).toBe(403);
      expect(discordService.getChannelMessage).not.toHaveBeenCalled();
    } finally {
      await staffRepository.delete(staffId);
    }
  });

  it("requires send permission to enumerate bot guilds", async () => {
    const staffId = "123456789012345682";
    await createStaff(staffId, { can_send_messages: 0 });

    try {
      const response = await fetch(`${baseUrl}/api/discord/guilds`, {
        headers: { "x-staff-id": staffId },
      });

      expect(response.status).toBe(403);
    } finally {
      await staffRepository.delete(staffId);
    }
  });

  it("filters guild discovery to the staff member's guild allowlist", async () => {
    const staffId = "123456789012345683";
    await createStaff(staffId);

    try {
      const response = await fetch(`${baseUrl}/api/discord/guilds`, {
        headers: { "x-staff-id": staffId },
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.guilds.map((guild: { id: string }) => guild.id)).toEqual([
        "guild_allowed",
      ]);
    } finally {
      await staffRepository.delete(staffId);
    }
  });

  it("restricts session records to Head Admins", async () => {
    const staffId = "123456789012345684";
    await createStaff(staffId);

    try {
      const response = await fetch(
        `${baseUrl}/api/discord/guilds/guild_allowed/sessions`,
        { headers: { "x-staff-id": staffId } },
      );

      expect(response.status).toBe(403);
    } finally {
      await staffRepository.delete(staffId);
    }
  });

  it("restricts audit-log access to Head Admins", async () => {
    const staffId = "123456789012345685";
    await createStaff(staffId);

    try {
      const response = await fetch(
        `${baseUrl}/api/discord/guilds/guild_allowed/audit-logs`,
        { headers: { "x-staff-id": staffId } },
      );

      expect(response.status).toBe(403);
    } finally {
      await staffRepository.delete(staffId);
    }
  });

  it("allows an admin-key request to bypass staff allowlists", async () => {
    const response = await fetch(`${baseUrl}/api/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-key": env.adminApiKey,
      },
      body: JSON.stringify({
        mode: "bot",
        channelId: "channel_123",
        payload: { content: "Admin bypass regression test" },
      }),
    });

    expect(response.status).toBe(200);
    expect(discordService.sendChannelMessage).toHaveBeenCalled();
    expect(discordService.getChannelGuildId).not.toHaveBeenCalled();
  });

  it("allows an edit-only staff member to edit without send permission", async () => {
    const staffId = "123456789012345686";
    await createStaff(staffId, {
      can_send_messages: 0,
      can_edit_messages: 1,
    });

    try {
      vi.mocked(discordService.getChannelGuildId).mockResolvedValue("guild_allowed");

      const response = await fetch(`${baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-staff-id": staffId,
        },
        body: JSON.stringify({
          mode: "bot",
          channelId: "channel_123",
          editMessageId: "message_123",
          payload: { content: "Edited by edit-only staff" },
        }),
      });

      expect(response.status).toBe(200);
      expect(discordService.editChannelMessage).toHaveBeenCalled();
      expect(discordService.sendChannelMessage).not.toHaveBeenCalled();
    } finally {
      await staffRepository.delete(staffId);
    }
  });
});