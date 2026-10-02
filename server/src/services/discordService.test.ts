import { afterEach, describe, expect, it, vi } from "vitest";
import { botProfileRepository } from "../repositories/profileRepository.js";
import { editChannelMessage, getBotGuilds, getGuildChannels } from "./discordService.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("editChannelMessage", () => {
  it("uses the selected profile token and preserves Components V2 payload flags", async () => {
    vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue("profile-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "message-id", channel_id: "channel-id" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const message = await editChannelMessage(
      "channel-id",
      "message-id",
      { flags: 32768, components: [{ type: 10, content: "Updated" }] },
      { profileId: 42 },
    );

    expect(botProfileRepository.revealToken).toHaveBeenCalledWith(42);
    expect(message).toEqual({ id: "message-id", channel_id: "channel-id" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/channels/channel-id/messages/message-id"),
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: "Bot profile-token" }),
        body: expect.stringContaining('"flags":32768'),
      }),
    );
  });
});

describe("profile-scoped channel reads", () => {
  it("uses the selected profile for guild and channel discovery", async () => {
    vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue("profile-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "guild-id", name: "Guild" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: "channel-id", name: "general", type: 0 }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const guilds = await getBotGuilds(42);
    const channels = await getGuildChannels(guilds[0]!.id, 42);

    expect(guilds).toEqual([{ id: "guild-id", name: "Guild" }]);
    expect(channels).toEqual([{ id: "channel-id", name: "general", type: 0 }]);
    expect(botProfileRepository.revealToken).toHaveBeenNthCalledWith(1, 42);
    expect(botProfileRepository.revealToken).toHaveBeenNthCalledWith(2, 42);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options?.headers).toMatchObject({ Authorization: "Bot profile-token" });
    }
  });
});