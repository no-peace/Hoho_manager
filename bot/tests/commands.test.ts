import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageFlags } from "discord.js";
import { container } from "@sapphire/framework";
import { PingCommand } from "../src/commands/ping.js";
import { StatusCommand } from "../src/commands/status.js";
import { ServerCommand } from "../src/commands/server.js";
import { SendCommand } from "../src/commands/send.js";
import { ExploitCommand } from "../src/commands/exploit.js";
import { SyncCommand } from "../src/commands/sync.js";
import api from "../src/lib/api.js";

// Mock api methods
vi.mock("../src/lib/api.js", () => ({
  default: {
    health: vi.fn(),
    sendMessage: vi.fn(),
    syncTrackedMessages: vi.fn(),
  },
  api: {
    health: vi.fn(),
    sendMessage: vi.fn(),
    syncTrackedMessages: vi.fn(),
  },
  listWeaoExploits: vi.fn(),
  resolveWeaoExploit: vi.fn(),
}));

const mockContext: any = {
  root: "/mock/root",
  path: "/mock/commands/test.ts",
  name: "test",
};

describe("bot/commands: Slash Command Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (container as any).client = {
      options: {},
      ws: { ping: 42 },
    };
  });

  describe("PingCommand", () => {
    it("registers chat input command with name 'ping'", () => {
      const command = new PingCommand(mockContext, {});
      const registry: any = { registerChatInputCommand: vi.fn() };

      command.registerApplicationCommands(registry);

      expect(registry.registerChatInputCommand).toHaveBeenCalledTimes(1);
      const builderFn = registry.registerChatInputCommand.mock.calls[0][0];
      const mockBuilder: any = {
        setName: vi.fn().mockReturnThis(),
        setDescription: vi.fn().mockReturnThis(),
      };
      builderFn(mockBuilder);
      expect(mockBuilder.setName).toHaveBeenCalledWith("ping");
      expect(mockBuilder.setDescription).toHaveBeenCalledWith("Check that the bot is alive.");
    });

    it("runs chatInputRun, replies 'Pong!', and edits reply with gateway ping", async () => {
      const command = new PingCommand(mockContext, {});

      const interaction: any = {
        reply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
      };

      await command.chatInputRun(interaction);

      expect(interaction.reply).toHaveBeenCalledWith("Pong!");
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringMatching(/Pong! Round trip \*\*\d+ms\*\* · gateway \*\*42ms\*\*/),
      );
    });
  });

  describe("StatusCommand", () => {
    it("registers chat input command with name 'status'", () => {
      const command = new StatusCommand(mockContext, {});
      const registry: any = { registerChatInputCommand: vi.fn() };

      command.registerApplicationCommands(registry);

      expect(registry.registerChatInputCommand).toHaveBeenCalledTimes(1);
    });

    it("defers reply ephemerally and reports healthy status", async () => {
      const command = new StatusCommand(mockContext, {});

      vi.mocked(api.health).mockResolvedValueOnce({
        status: "ok",
        environment: "production",
        uptimeSeconds: 125.6,
        database: { connected: true, users: 10 },
        discord: {
          publicKeyConfigured: true,
          botTokenConfigured: true,
          applicationIdConfigured: true,
        },
      });

      const interaction: any = {
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
      };

      await command.chatInputRun(interaction);

      expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining("✅ Database connected"),
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining("Uptime: 126s"),
      );
    });

    it("edits reply with warning when health check throws", async () => {
      const command = new StatusCommand(mockContext, {});
      vi.mocked(api.health).mockRejectedValueOnce(new Error("Connection refused"));

      const interaction: any = {
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
      };

      await command.chatInputRun(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining("⚠️ Connection refused"),
      );
    });
  });

  describe("ServerCommand", () => {
    it("rejects execution outside of a guild", async () => {
      const command = new ServerCommand(mockContext, {});
      const interaction: any = {
        inCachedGuild: vi.fn().mockReturnValue(false),
        reply: vi.fn().mockResolvedValue(undefined),
      };

      await command.chatInputRun(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: "⚠️ This command only works inside a server.",
        flags: MessageFlags.Ephemeral,
      });
    });

    it("formats guild statistics in cached guild", async () => {
      const command = new ServerCommand(mockContext, {});

      const interaction: any = {
        inCachedGuild: vi.fn().mockReturnValue(true),
        guild: {
          name: "Hoho Guild",
          id: "123456789012345678",
          memberCount: 500,
          channels: { cache: { size: 20 } },
          roles: { cache: { size: 10 } },
          premiumTier: 2,
          ownerId: "987654321098765432",
          createdTimestamp: 1600000000000,
        },
        reply: vi.fn().mockResolvedValue(undefined),
      };

      await command.chatInputRun(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining("**Hoho Guild**"),
        flags: MessageFlags.Ephemeral,
      });
      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining("Boost: Tier 2"),
        flags: MessageFlags.Ephemeral,
      });
      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining("Members: 500"),
        flags: MessageFlags.Ephemeral,
      });
    });
  });

  describe("SendCommand", () => {
    it("defers ephemeral and dispatches message via api.sendMessage", async () => {
      const command = new SendCommand(mockContext, {});
      vi.mocked(api.sendMessage).mockResolvedValueOnce({
        ok: true,
        messageId: "msg_123",
      } as any);

      const interaction: any = {
        user: { id: "test-user-123", username: "tester" },
        options: {
          getChannel: vi.fn().mockReturnValue({ id: "chan_99" }),
          getString: vi.fn().mockReturnValue("Hello from bot!"),
        },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
      };

      await command.chatInputRun(interaction);

      expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
      expect(api.sendMessage).toHaveBeenCalledWith({
        content: "Hello from bot!",
        channelId: "chan_99",
        authorUserId: "test-user-123",
        authorUsername: "tester",
      });
      expect(interaction.editReply).toHaveBeenCalledWith("✅ Sent to <#chan_99>.");
    });

    it("catches api error and informs user", async () => {
      const command = new SendCommand(mockContext, {});
      vi.mocked(api.sendMessage).mockRejectedValueOnce(new Error("Rate limited"));

      const interaction: any = {
        user: { id: "test-user-send-error", username: "sender" },
        options: {
          getChannel: vi.fn().mockReturnValue({ id: "chan_99" }),
          getString: vi.fn().mockReturnValue("Test"),
        },
        reply: vi.fn().mockResolvedValue(undefined),
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
      };

      await command.chatInputRun(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining("⚠️ Could not send:\nRate limited"),
      );
    });
  });

  describe("ExploitCommand", () => {
    it("handles autocomplete queries and responds with choices", async () => {
      const { listWeaoExploits } = await import("../src/lib/api.js");
      vi.mocked(listWeaoExploits).mockResolvedValueOnce([
        {
          title: "Delta",
          version: "v2.5",
          updateStatus: true,
          suncPercentage: 99,
          hasBackupTemplate: true,
        },
        {
          title: "Vega",
          version: "v1.0",
          updateStatus: false,
        },
      ]);

      const command = new ExploitCommand(mockContext, {});
      const interaction: any = {
        user: { id: "test-user-123", username: "tester" },
        options: {
          getFocused: vi.fn().mockReturnValue({ name: "exploit", value: "del" }),
        },
        respond: vi.fn().mockResolvedValue(undefined),
      };

      await command.autocompleteRun(interaction);

      expect(listWeaoExploits).toHaveBeenCalledWith("del", { id: "test-user-123", username: "tester" });
      expect(interaction.respond).toHaveBeenCalledWith([
        { name: "🟢 Delta (v2.5 • 99% sUNC) ★ Backup", value: "Delta" },
        { name: "🔴 Vega (v1.0)", value: "Vega" },
      ]);
    });

    it("rejects chat input if channel is not text-based", async () => {
      const { resolveWeaoExploit } = await import("../src/lib/api.js");
      const command = new ExploitCommand(mockContext, {});

      const interaction: any = {
        user: { id: "test-user-123" },
        options: { getString: vi.fn().mockReturnValue("Delta") },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        channel: { isTextBased: () => false },
      };

      await command.chatInputRun(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith({
        content: "❌ Cannot dispatch exploit message in this channel.",
      });
      expect(resolveWeaoExploit).toHaveBeenCalledWith("Delta", { id: "test-user-123", username: "tester" });
    });
  });

  describe("SyncCommand", () => {
    it("reports checked, updated, and pruned message counts", async () => {
      const { api: apiClient } = await import("../src/lib/api.js");
      vi.mocked(apiClient.syncTrackedMessages).mockResolvedValueOnce({
        checked: 12,
        updated: 8,
        removed: 2,
        errors: 0,
      });

      const command = new SyncCommand(mockContext, {});
      const interaction: any = {
        user: { id: "sync-success-user" },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
      };

      await command.chatInputRun(interaction);

      expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: [
          "🔄 **Tracked Messages Synchronized**",
          "> • **Checked:** `12` message(s)",
          "> • **Updated:** `8` message(s)",
          "> • **Pruned / Expired:** `2` message(s)",
        ].join("\n"),
      });
    });

    it("reports synchronization failures without throwing", async () => {
      const { api: apiClient } = await import("../src/lib/api.js");
      vi.mocked(apiClient.syncTrackedMessages).mockRejectedValueOnce(new Error("API unavailable"));

      const command = new SyncCommand(mockContext, {});
      const interaction: any = {
        user: { id: "sync-error-user" },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
      };

      await command.chatInputRun(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith({
        content: "❌ Synchronization failed: API unavailable",
      });
    });
  });
});
