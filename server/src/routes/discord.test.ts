import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../config/env.js";
import * as discord from "../services/discordService.js";
import discordRouter from "./discord.js";

vi.mock("../services/discordService.js", () => ({
  getBotGuilds: vi.fn(),
  getGuildChannels: vi.fn(),
  getGuildRoles: vi.fn(),
  searchGuildMembers: vi.fn(),
  getBotIdentity: vi.fn(),
  resolveBotToken: vi.fn(),
}));

const app = express();
app.use(express.json());
app.use("/api/discord", discordRouter);
app.use((error: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(error.status ?? 500).json({ error: error.message ?? "Unexpected error" });
});

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

beforeAll(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Test server has no TCP address");
  baseUrl = `http://127.0.0.1:${address.port}/api/discord`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("Discord routes (/api/discord)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/discord/guilds", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const res = await fetch(`${baseUrl}/guilds`);
      expect(res.status).toBe(401);
      expect(discord.getBotGuilds).not.toHaveBeenCalled();
    });

    it("returns guilds live via discordService", async () => {
      vi.mocked(discord.getBotGuilds).mockResolvedValue([
        { id: "guild-1", name: "Guild One", icon: "icon1" },
        { id: "guild-2", name: "Guild Two", icon: null },
      ]);

      const res = await fetch(`${baseUrl}/guilds`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.guilds).toHaveLength(2);
      expect(data.guilds[0].id).toBe("guild-1");
      expect(discord.getBotGuilds).toHaveBeenCalled();
    });
  });

  describe("GET /api/discord/guilds/:guildId/channels", () => {
    it("returns channels for the guild", async () => {
      vi.mocked(discord.getGuildChannels).mockResolvedValue([
        { id: "ch-1", name: "general", type: 0, parent_id: null },
        { id: "ch-2", name: "voice", type: 2, parent_id: "cat-1" },
      ]);

      const res = await fetch(`${baseUrl}/guilds/guild-1/channels`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.channels).toHaveLength(2);
      expect(discord.getGuildChannels).toHaveBeenCalledWith("guild-1", null);
    });
  });

  describe("GET /api/discord/guilds/:guildId/roles", () => {
    it("returns roles for the guild", async () => {
      vi.mocked(discord.getGuildRoles).mockResolvedValue([
        { id: "role-1", name: "Admin", color: 0xff0000, position: 10, hoist: true },
        { id: "role-2", name: "Member", color: 0x00ff00, position: 1, hoist: false },
      ]);

      const res = await fetch(`${baseUrl}/guilds/guild-1/roles`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.roles).toHaveLength(2);
      expect(data.roles[0].name).toBe("Admin");
      expect(discord.getGuildRoles).toHaveBeenCalledWith("guild-1", null);
    });
  });

  describe("GET /api/discord/guilds/:guildId/members/search", () => {
    it("searches members with query parameter", async () => {
      vi.mocked(discord.searchGuildMembers).mockResolvedValue([
        { id: "user-1", username: "alice", global_name: "Alice", nickname: null, avatar: "av1" },
      ]);

      const res = await fetch(`${baseUrl}/guilds/guild-1/members/search?query=alice`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.members).toHaveLength(1);
      expect(data.members[0].username).toBe("alice");
      expect(discord.searchGuildMembers).toHaveBeenCalledWith("guild-1", "alice", null);
    });
  });

  describe("GET /api/discord/identity", () => {
    it("auto-fetches bot identity", async () => {
      vi.mocked(discord.resolveBotToken).mockResolvedValue("mock-token");
      vi.mocked(discord.getBotIdentity).mockResolvedValue({
        id: "bot-id-123",
        username: "HoHo Bot",
        avatar: "avatar_hash",
      });

      const res = await fetch(`${baseUrl}/identity`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.id).toBe("bot-id-123");
      expect(data.username).toBe("HoHo Bot");
      expect(data.avatar).toContain("avatar_hash");
    });
  });
});
