import { afterEach, describe, expect, it, vi } from "vitest";
import { botProfileRepository } from "../src/repositories/profileRepository.js";
import { searchGuildMembers } from "../src/services/discordService.js";
import { ApiError } from "../src/utils/errors.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Adversarial Test Harness: Discord Member Search & REST API Probing", () => {
  const guildId = "906426036772818954";
  const validToken = "mock-bot-token-12345";

  /* ──────────────────────────────────────────────────────────────────────────
     1. Empty and Whitespace-Only Queries
     ────────────────────────────────────────────────────────────────────────── */
  describe("1. Empty and Whitespace Queries", () => {
    it("returns empty array immediately without making network calls for empty string", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const res = await searchGuildMembers(guildId, "");
      expect(res).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns empty array for spaces, tabs, newlines, and carriage returns", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const whitespaceInputs = [" ", "   ", "\t", "\n", "\r\n", " \t \n "];
      for (const input of whitespaceInputs) {
        const res = await searchGuildMembers(guildId, input);
        expect(res).toEqual([]);
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("handles null and undefined query safely without throwing", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const res1 = await searchGuildMembers(guildId, null as unknown as string);
      const res2 = await searchGuildMembers(guildId, undefined as unknown as string);
      expect(res1).toEqual([]);
      expect(res2).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     2. Snowflake Validation Boundaries (17-20 digits vs invalid lengths)
     ────────────────────────────────────────────────────────────────────────── */
  describe("2. Snowflake Validation Boundaries", () => {
    it.each([
      ["17 digits", "12345678901234567"],
      ["18 digits", "123456789012345678"],
      ["19 digits", "1234567890123456789"],
      ["20 digits", "12345678901234567890"],
    ])("triggers direct snowflake member lookup for %s: %s", async (_, snowflake) => {
      vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue(validToken);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            user: { id: snowflake, username: `user_${snowflake}`, global_name: "Test Global", avatar: "hash123" },
            nick: "Nickname",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const members = await searchGuildMembers(guildId, snowflake, 42);
      expect(members).toHaveLength(1);
      expect(members[0]).toEqual({
        id: snowflake,
        username: `user_${snowflake}`,
        global_name: "Test Global",
        nickname: "Nickname",
        avatar: "hash123",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/guilds/${guildId}/members/${snowflake}`),
        expect.any(Object),
      );
    });

    it("trims surrounding whitespace on snowflakes and triggers direct lookup", async () => {
      vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue(validToken);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            user: { id: "123456789012345678", username: "spaced_user" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const members = await searchGuildMembers(guildId, "  123456789012345678 \t\n ", 42);
      expect(members).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/guilds/${guildId}/members/123456789012345678`),
        expect.any(Object),
      );
    });

    it.each([
      ["16 digits (too short)", "1234567890123456"],
      ["21 digits (too long)", "123456789012345678901"],
      ["alphanumeric snowflake prefix", "123456789012345678a"],
      ["negative snowflake", "-123456789012345678"],
      ["float snowflake", "123456789012345.678"],
    ])("routes %s (%s) directly to REST name search instead of direct snowflake lookup", async (_, query) => {
      vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue(validToken);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            { user: { id: "999", username: "found_by_name" } },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const members = await searchGuildMembers(guildId, query, 42);
      expect(members).toHaveLength(1);
      expect(members[0]!.username).toBe("found_by_name");
      // MUST NOT call /members/{query}
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(`/guilds/${guildId}/members/search?query=`),
        expect.any(Object),
      );
      expect(fetchMock).not.toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`/guilds/${guildId}/members/${encodeURIComponent(query)}$`)),
        expect.any(Object),
      );
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     3. Special Characters, SQL Injection & Path Traversal Vectors
     ────────────────────────────────────────────────────────────────────────── */
  describe("3. Special Characters, Injection & Sanitization", () => {
    it.each([
      ["SQL injection single quote", "' OR '1'='1"],
      ["SQL injection union drop", "admin'; DROP TABLE users; --"],
      ["Path traversal unix", "../../../../etc/passwd"],
      ["Path traversal windows", "..\\..\\..\\windows\\system32"],
      ["XSS script payload", "<script>alert('xss')</script>"],
      ["Null byte injection", "user\u0000admin"],
      ["URL encoded null byte", "%00"],
      ["Special punctuation", "!@#$%^&*()_+~|}{[]:;?><,./"],
    ])("safely encodes %s in query string without crash or traversal", async (_, attackVector) => {
      vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue(validToken);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const res = await searchGuildMembers(guildId, attackVector, 42);
      expect(res).toEqual([]);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent(attackVector.trim())),
        expect.any(Object),
      );
    });

    it("safely handles international unicode, emoji, and RTL text", async () => {
      vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue(validToken);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            { user: { id: "101", username: "日本語ユーザー", global_name: "🚀✨" } },
          ]),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      const unicodeQuery = "日本語 🚀 \u202E RTL";
      const members = await searchGuildMembers(guildId, unicodeQuery, 42);
      expect(members).toHaveLength(1);
      expect(members[0]!.username).toBe("日本語ユーザー");
      expect(members[0]!.global_name).toBe("🚀✨");
    });

    it("safely handles extreme query length (10,000 characters) without buffer overflow", async () => {
      vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue(validToken);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const giantQuery = "a".repeat(10_000);
      const res = await searchGuildMembers(guildId, giantQuery, 42);
      expect(res).toEqual([]);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     4. Non-Existent Guilds & Non-Existent Member IDs
     ────────────────────────────────────────────────────────────────────────── */
  describe("4. Non-Existent Guilds and Members", () => {
    it("falls through from 404 Unknown Member on snowflake to name search", async () => {
      vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue(validToken);
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 10007, message: "Unknown Member" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify([]), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      vi.stubGlobal("fetch", fetchMock);

      const res = await searchGuildMembers(guildId, "123456789012345678", 42);
      expect(res).toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("returns empty array safely when both snowflake lookup and name search return 404 Unknown Guild", async () => {
      vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue(validToken);
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 10004, message: "Unknown Guild" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 10004, message: "Unknown Guild" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          }),
        );
      vi.stubGlobal("fetch", fetchMock);

      const res = await searchGuildMembers("nonexistent_guild_id", "123456789012345678", 42);
      expect(res).toEqual([]);
    });

    it("returns empty array safely when guild does not exist on general name search", async () => {
      vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue(validToken);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 10004, message: "Unknown Guild" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const res = await searchGuildMembers("nonexistent_guild", "alice", 42);
      expect(res).toEqual([]);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     5. Discord API Error & Rate Limit Simulation (400, 404, 429, 500, Network)
     ────────────────────────────────────────────────────────────────────────── */
  describe("5. Discord API Error & Rate Limit Simulation", () => {
    it("handles 400 Bad Request from Discord without crashing or throwing", async () => {
      vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue(validToken);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 50035, message: "Invalid Form Body" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const res = await searchGuildMembers(guildId, "malformed_search", 42);
      expect(res).toEqual([]);
    });

    it("recovers from Discord 429 Rate Limit when retry_after is provided", async () => {
      vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue(validToken);
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ message: "You are being rate limited.", retry_after: 0.01 }), {
            status: 429,
            headers: { "content-type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              { user: { id: "888", username: "rate_limited_recovered" } },
            ]),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      vi.stubGlobal("fetch", fetchMock);

      const res = await searchGuildMembers(guildId, "rate_test", 42);
      expect(res).toHaveLength(1);
      expect(res[0]!.username).toBe("rate_limited_recovered");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("exhausts 429 retries and catches error safely without server crash", async () => {
      vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue(validToken);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "You are being rate limited.", retry_after: 0.005 }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const res = await searchGuildMembers(guildId, "persistent_rate_limit", 42);
      expect(res).toEqual([]);
      // Should attempt 1 initial + 3 retries = 4 attempts total
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("handles Discord 500/503 internal server errors across retries and returns empty array", async () => {
      vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue(validToken);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Internal Server Error" }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const res = await searchGuildMembers(guildId, "server_error", 42);
      expect(res).toEqual([]);
    });

    it("handles total network outage (fetch throws TypeError/ECONNREFUSED) gracefully", async () => {
      vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue(validToken);
      const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed: ECONNREFUSED"));
      vi.stubGlobal("fetch", fetchMock);

      const res = await searchGuildMembers(guildId, "network_down", 42);
      expect(res).toEqual([]);
    });

    it("handles Discord returning Cloudflare HTML error page instead of JSON", async () => {
      vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue(validToken);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response("<html><head><title>502 Bad Gateway</title></head><body>502 Bad Gateway</body></html>", {
          status: 502,
          headers: { "content-type": "text/html" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const res = await searchGuildMembers(guildId, "html_error", 42);
      expect(res).toEqual([]);
    });

    it("handles Discord returning non-array JSON object safely", async () => {
      vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue(validToken);
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Unexpected object payload instead of array" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const res = await searchGuildMembers(guildId, "object_not_array", 42);
      expect(res).toEqual([]);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     6. Bot Profile Scoping & Token Resolution Security
     ────────────────────────────────────────────────────────────────────────── */
  describe("6. Bot Profile Scoping & Token Security", () => {
    it("throws 404 when requested bot profile does not exist", async () => {
      vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue(null);

      await expect(searchGuildMembers(guildId, "alice", 999999)).rejects.toThrow(ApiError);
    });

    it("uses custom bot profile token when profile is valid", async () => {
      vi.spyOn(botProfileRepository, "revealToken").mockResolvedValue("custom-profile-token-77");
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      await searchGuildMembers(guildId, "alice", 77);
      expect(botProfileRepository.revealToken).toHaveBeenCalledWith(77);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bot custom-profile-token-77",
          }),
        }),
      );
    });
  });
});
