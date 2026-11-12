import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/services/discordService.js", () => ({
    getDiscordUser: vi.fn(),
    getDiscordUserAvatarUrl: vi.fn((user: { id: string; avatar: string | null }) =>
        user.avatar
            ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=1024`
            : `https://cdn.discordapp.com/embed/avatars/0.png`,
    ),
}));

import {
    getDiscordUser,
    getDiscordUserAvatarUrl,
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
});

describe("authorService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

    it("resolves supported user variables including avatarurl", async () => {
        const result = await resolveAuthorPlaceholders({
            content: [
                `{user.${USER_A}.name}`,
                `{user.${USER_A}.username}`,
                `{user.${USER_A}.id}`,
                `{user.${USER_A}.url}`,
                `{user.${USER_A}.mention}`,
                `{user.${USER_A}.avatarurl}`,
                `{user.${USER_A}.unknown}`,
            ].join("|"),
        } as any);

        expect((result.payload as any).content).toBe(
            [
                "Peace",
                "peace",
                USER_A,
                `https://discord.com/users/${USER_A}`,
                `<@${USER_A}>`,
                `https://cdn.discordapp.com/avatars/${USER_A}/avatar_hash.png?size=1024`,
                `{user.${USER_A}.unknown}`,
            ].join("|"),
        );
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