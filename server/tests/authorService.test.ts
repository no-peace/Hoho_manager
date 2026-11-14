import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/services/discordService.js", () => ({
    getDiscordUser: vi.fn(),
    getGuildMember: vi.fn(),
    resolveBotToken: vi.fn().mockResolvedValue("test-bot-token"),
    getDiscordUserAvatarUrl: vi.fn((user: { id: string; avatar: string | null }) =>
        user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=1024`
            : `https://cdn.discordapp.com/embed/avatars/0.png`,
    ),
}));

import {
    getDiscordUser,
    getDiscordUserAvatarUrl,
    getGuildMember,
} from "../src/services/discordService.js";
import { resolveAuthorPlaceholders } from "../src/services/authorService.js";

const USER_A = "123456789012345678";
const USER_B = "223456789012345678";

const makeUser = (id: string, username: string, globalName: string | null = null) => ({
    id,
    username,
    global_name: globalName,
    nickname: null,
    avatar: "avatar_hash",
    primary_guild: { identity_enabled: true, tag: "HOHO", identity_guild_id: "999999999999999999" },
});

describe("authorService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getGuildMember).mockResolvedValue(null);
        vi.mocked(getDiscordUser).mockImplementation(async (id) => {
            if (id === USER_A) return makeUser(USER_A, "peace", "Peace") as any;
            if (id === USER_B) return makeUser(USER_B, "other", "Other") as any;
            throw new Error("Unknown test user");
        });
        vi.mocked(getDiscordUserAvatarUrl).mockImplementation(
            (user) => `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=1024`,
        );
    });

    it("fills blank author fields from a valid Discord profile URL", async () => {
        const result = await resolveAuthorPlaceholders({
            embeds: [{ author: { url: `https://discord.com/users/${USER_A}` } }],
        } as any);

        expect((result.payload as any).embeds[0].author).toMatchObject({
            name: "Peace",
            url: `https://discord.com/users/${USER_A}`,
            icon_url: `https://cdn.discordapp.com/avatars/${USER_A}/avatar_hash.png?size=1024`,
        });
        expect(getDiscordUser).toHaveBeenCalledTimes(1);
        expect(getDiscordUser).toHaveBeenCalledWith(USER_A, null);
    });

    it("preserves manually entered author name and icon URL", async () => {
        const result = await resolveAuthorPlaceholders({
            embeds: [{
                author: {
                    name: "My custom label",
                    url: `https://discord.com/users/${USER_A}`,
                    icon_url: "https://example.com/custom.png",
                },
            }],
        } as any);

        expect((result.payload as any).embeds[0].author.name).toBe("My custom label");
        expect((result.payload as any).embeds[0].author.icon_url).toBe("https://example.com/custom.png");
    });

    it("does not apply one embed's author ID to another embed", async () => {
        const result = await resolveAuthorPlaceholders({
            embeds: [
                { author: { url: `https://discord.com/users/${USER_A}` } },
                { author: { name: "A different author" } },
            ],
        } as any);

        expect((result.payload as any).embeds[0].author.name).toBe("Peace");
        expect((result.payload as any).embeds[1].author.name).toBe("A different author");
        expect(getDiscordUser).toHaveBeenCalledTimes(1);
    });

    it("rejects lookalike profile URL hosts", async () => {
        await resolveAuthorPlaceholders({
            embeds: [{ author: { url: `https://discord.com.evil.example/users/${USER_A}` } }],
        } as any);

        expect(getDiscordUser).not.toHaveBeenCalled();
    });

    it("rejects non-HTTPS Discord profile URLs", async () => {
        await resolveAuthorPlaceholders({
            embeds: [{ author: { url: `http://discord.com/users/${USER_A}` } }],
        } as any);

        expect(getDiscordUser).not.toHaveBeenCalled();
    });

    it("resolves canonical avatar and leaves removed aliases unchanged", async () => {
        const result = await resolveAuthorPlaceholders({
            content: [
                `{user.${USER_A}.name}`,
                `{user.${USER_A}.username}`,
                `{user.${USER_A}.id}`,
                `{user.${USER_A}.url}`,
                `{user.${USER_A}.mention}`,
                `{user.${USER_A}.avatar}`,
                `{user.${USER_A}.avatarurl}`,
                `{user.${USER_A}.icon}`,
                `{user.${USER_A}.pfp}`,
                `{user.${USER_A}.unknown}`,
            ].join("|"),
        } as any);

        expect((result.payload as any).content).toBe(
            [
                "peace",
                "peace",
                USER_A,
                `https://discord.com/users/${USER_A}`,
                `<@${USER_A}>`,
                `https://cdn.discordapp.com/avatars/${USER_A}/avatar_hash.png?size=1024`,
                `{user.${USER_A}.avatarurl}`,
                `{user.${USER_A}.icon}`,
                `{user.${USER_A}.pfp}`,
                `{user.${USER_A}.unknown}`,
            ].join("|"),
        );
    });


    it("does not expose a primary guild tag when the user has disabled that identity", async () => {
        vi.mocked(getDiscordUser).mockResolvedValue({
            ...makeUser(USER_A),
            primary_guild: { identity_enabled: false, tag: "HOHO" },
        } as any);

        const result = await resolveAuthorPlaceholders({
            content: `{user.${USER_A}.clantag}`,
        } as any);

        expect((result.payload as any).content).toBe(`{user.${USER_A}.clantag}`);
    });

    it("resolves plain user name variables for tracked messages using the saved author ID", async () => {
        vi.mocked(getGuildMember).mockResolvedValue({
            user: { id: USER_A, username: "peace", global_name: "Peace", avatar: "avatar_hash" } as any,
            nick: "Server Nick",
        } as any);

        const result = await resolveAuthorPlaceholders(
            { content: "{user.name}|{user.displayname}" } as any,
            USER_A,
            null,
            "999999999999999999",
        );

        expect((result.payload as any).content).toBe("Server Nick|Peace");
    });

    it("uses the destination server nickname for name and the global name for displayname", async () => {
        vi.mocked(getGuildMember).mockResolvedValue({
            user: { id: USER_A, username: "peace", global_name: "Peace", avatar: "avatar_hash" } as any,
            nick: "Server Nick",
        } as any);

        const result = await resolveAuthorPlaceholders({
            content: `{user.${USER_A}.name}|{user.${USER_A}.displayname}`,
        } as any, null, null, "999999999999999999");

        expect((result.payload as any).content).toBe("Server Nick|Peace");
    });

    it("resolves guild-specific roles, clan tag, and join timestamps for an ID", async () => {
        vi.mocked(getGuildMember).mockResolvedValue({
            roles: ["111111111111111111", "222222222222222222"],
            user: { id: USER_A, username: "peace", global_name: "Peace", avatar: "avatar_hash" } as any,
            nick: "[HOHO] Peace",
            joined_at: "2024-06-15T12:00:00.000Z",
        } as any);

        const result = await resolveAuthorPlaceholders({
            content: [
                `{user.${USER_A}.roles}`,
                `{user.${USER_A}.clantag}`,
                `{user.${USER_A}.joined}`,
                `{user.${USER_A}.joined.date}`,
            ].join("|"),
        } as any, null, null, "999999999999999999");

        const joinedUnix = Math.floor(Date.parse("2024-06-15T12:00:00.000Z") / 1000);
        expect((result.payload as any).content).toBe([
            "<@&111111111111111111> <@&222222222222222222>",
            "HOHO",
            `<t:${joinedUnix}:R>`,
            `<t:${joinedUnix}:d>`,
        ].join("|"));
        expect(getGuildMember).toHaveBeenCalledWith("999999999999999999", USER_A, "test-bot-token");
    });

    it("resolves account creation timestamps from the Discord snowflake", async () => {
        const result = await resolveAuthorPlaceholders({
            content: `{user.${USER_A}.created}|{user.${USER_A}.created.relative}`,
        } as any);
        expect((result.payload as any).content).toMatch(/^<t:\d+:d>\|<t:\d+:R>$/);
    });

    it("leaves placeholders unchanged when Discord lookup fails", async () => {
        vi.mocked(getDiscordUser).mockRejectedValueOnce(new Error("Discord unavailable"));

        const result = await resolveAuthorPlaceholders({
            content: `{user.${USER_A}.username}`,
        } as any);

        expect((result.payload as any).content).toBe(`{user.${USER_A}.username}`);
    });

    it("deduplicates repeated user placeholders", async () => {
        await resolveAuthorPlaceholders({
            content: `{user.${USER_A}.name} {user.${USER_A}.username}`,
        } as any);

        expect(getDiscordUser).toHaveBeenCalledTimes(1);
    });

    it("does not use the legacy fallback ID across multiple authors", async () => {
        const result = await resolveAuthorPlaceholders(
            {
                embeds: [
                    { author: { name: "First" } },
                    { author: { name: "Second" } },
                ],
            } as any,
            USER_A,
        );

        expect(getDiscordUser).not.toHaveBeenCalled();
        expect((result.payload as any).embeds[0].author.name).toBe("First");
        expect((result.payload as any).embeds[1].author.name).toBe("Second");
    });
});