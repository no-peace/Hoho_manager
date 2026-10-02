import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { env } from "../config/env.js";
import * as discord from "../services/discordService.js";
import sendRouter from "./send.js";

vi.mock("../middleware/auth.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware/auth.js")>();
  return {
    ...actual,
    attachUser: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  };
});

vi.mock("../repositories/actionRepository.js", () => ({
  actionRepository: { registerFlows: vi.fn() },
}));

vi.mock("../services/discordService.js", () => ({
  getBotGuilds: vi.fn(),
  getGuildChannels: vi.fn(),
  resolveBotToken: vi.fn(),
  getBotIdentity: vi.fn(),
  getChannelMessages: vi.fn(),
  sendWebhook: vi.fn(),
  sendChannelMessage: vi.fn(),
  editChannelMessage: vi.fn(),
}));

const app = express();
app.use(express.json());
app.use(sendRouter);
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
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("bot-backed read routes", () => {
  it("rejects channel listing without an admin key before calling Discord", async () => {
    const response = await fetch(`${baseUrl}/channels`);
    expect(response.status).toBe(401);
    expect(discord.getBotGuilds).not.toHaveBeenCalled();
  });

  it("loads channels with the authorized selected bot profile", async () => {
    vi.mocked(discord.getBotGuilds).mockResolvedValue([{ id: "guild-id", name: "Guild" }]);
    vi.mocked(discord.getGuildChannels).mockResolvedValue([
      { id: "text-id", name: "general", type: 0 },
      { id: "voice-id", name: "voice", type: 2 },
    ]);

    const response = await fetch(`${baseUrl}/channels?profileId=42`, {
      headers: { "x-admin-key": env.adminApiKey },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "text-id", name: "general" }]);
    expect(discord.getBotGuilds).toHaveBeenCalledWith(42);
    expect(discord.getGuildChannels).toHaveBeenCalledWith("guild-id", 42);
  });

  it("rejects recent-message listing without an admin key before calling Discord", async () => {
    const response = await fetch(`${baseUrl}/channels/channel-id/messages?profileId=42`);
    expect(response.status).toBe(401);
    expect(discord.resolveBotToken).not.toHaveBeenCalled();
  });
});