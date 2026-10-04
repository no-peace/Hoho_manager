import { afterEach, describe, expect, it, vi } from "vitest";
import { botProfileRepository } from "../repositories/profileRepository.js";
import { editChannelMessage, getBotGuilds, getGuildChannels, searchGuildMembers } from "./discordService.js";

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

describe("searchGuildMembers", () => {
  it("returns empty array immediately for empty query", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const members = await searchGuildMembers("123456", "   ");
    expect(members).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("attempts direct member lookup for snowflake queries", async () => {
    vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue("bot-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          user: { id: "123456789012345678", username: "alice", global_name: "Alice" },
          nick: "Ally",
          avatar: "avatar_hash",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const members = await searchGuildMembers("999888777", "123456789012345678", 42);
    expect(members).toEqual([
      {
        id: "123456789012345678",
        username: "alice",
        global_name: "Alice",
        nickname: "Ally",
        avatar: "avatar_hash",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/guilds/999888777/members/123456789012345678"),
      expect.any(Object),
    );
  });

  it("falls back to REST name search if snowflake lookup returns 404", async () => {
    vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue("bot-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Unknown Member", code: 10007 }), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              user: { id: "123456789012345678", username: "alice_snow" },
              nick: null,
            },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const members = await searchGuildMembers("999888777", "123456789012345678", 42);
    expect(members).toHaveLength(1);
    expect(members[0]!.username).toBe("alice_snow");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("handles 400/404 errors gracefully without throwing", async () => {
    vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue("bot-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Unknown Guild", code: 10004 }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const members = await searchGuildMembers("invalid_guild", "alice", 42);
    expect(members).toEqual([]);
  });
});