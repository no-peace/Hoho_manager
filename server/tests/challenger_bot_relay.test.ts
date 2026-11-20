import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { container } from "@sapphire/framework";
import { InteractionResponseType, MessageFlags, Routes } from "discord.js";
import { RawInteractionRelay } from "../../bot/src/listeners/interactionRelay.js";
import { api } from "../../bot/src/lib/api.js";

describe("Empirical Challenger: Bot Interaction Relay Timeout Fallback & Clean BigInt Serialization", () => {
  let listener: RawInteractionRelay;
  let mockRestPost: ReturnType<typeof vi.fn>;
  let mockLogger: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    mockRestPost = vi.fn().mockResolvedValue({});
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    container.logger = mockLogger as any;
    container.client = {
      rest: {
        post: mockRestPost,
      },
    } as any;

    listener = new RawInteractionRelay(
      { name: "interactionRelay", path: "", root: "", store: {} as any },
      {},
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("BigInt Prototype Cleanliness & Scoped Serialization (RB-21)", () => {
    it("guarantees BigInt.prototype is NOT polluted globally", () => {
      // Must not define BigInt.prototype.toJSON
      expect((BigInt.prototype as any).toJSON).toBeUndefined();

      // Standard JSON.stringify MUST throw TypeError on BigInt without replacer
      expect(() => JSON.stringify({ snowflake: 123456789012345678n })).toThrow(TypeError);
    });

    it("correctly serializes BigInt values using scoped replacer without global pollution", () => {
      const interactionPayload = {
        id: 112233445566778899n,
        channel_id: 998877665544332211n,
        guild_id: 554433221100998877n,
        member: {
          permissions: 8n,
          user: {
            id: 123456789n,
            username: "ChallengerBot",
          },
        },
        data: {
          component_type: 2,
          custom_id: "action:dud:{}",
        },
      };

      const replacer = (_: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);
      const serialized = JSON.stringify(interactionPayload, replacer);
      const parsed = JSON.parse(serialized);

      expect(parsed.id).toBe("112233445566778899");
      expect(parsed.channel_id).toBe("998877665544332211");
      expect(parsed.guild_id).toBe("554433221100998877");
      expect(parsed.member.permissions).toBe("8");
      expect(parsed.member.user.id).toBe("123456789");
      expect(parsed.member.user.username).toBe("ChallengerBot");

      // Verify BigInt.prototype remains strictly clean and unpolluted
      expect((BigInt.prototype as any).toJSON).toBeUndefined();
    });
  });

  describe("Interaction Filter Logic", () => {
    it("ignores non-INTERACTION_CREATE gateway packets", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      await listener.run({
        t: "MESSAGE_CREATE",
        d: { id: "123" },
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mockRestPost).not.toHaveBeenCalled();
    });

    it("ignores slash command (type 2) and autocomplete (type 4) packets", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      await listener.run({
        t: "INTERACTION_CREATE",
        d: { type: 2, id: "123", token: "tok123" },
      });

      await listener.run({
        t: "INTERACTION_CREATE",
        d: { type: 4, id: "456", token: "tok456" },
      });

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mockRestPost).not.toHaveBeenCalled();
    });
  });

  describe("Relay Success Path", () => {
    it("successfully relays component interaction (type 3) and serializes BigInt without fallback", async () => {
      let capturedBody = "";
      let capturedHeaders: Record<string, string> = {};

      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, opts: any) => {
        capturedBody = opts.body;
        capturedHeaders = opts.headers;
        return new Response(JSON.stringify({ ok: true, delivered: true }), { status: 200 });
      });

      const interaction = {
        type: 3,
        id: "923456789012345678",
        token: "token-btn-1",
        data: { custom_id: "action:dud:{}" },
        member: { user: { id: 123456789n } },
      };

      await listener.run({
        t: "INTERACTION_CREATE",
        d: interaction,
      });

      expect(capturedHeaders["Content-Type"]).toBe("application/json");
      expect(capturedHeaders["x-admin-key"]).toBeDefined();

      const parsed = JSON.parse(capturedBody);
      expect(parsed.id).toBe("923456789012345678");
      expect(parsed.member.user.id).toBe("123456789"); // BigInt serialized to string!

      // Fallback response must NOT be sent on success
      expect(mockRestPost).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Successfully relayed component/modal interaction to API"),
      );
    });
  });

  describe("Relay Timeout & Failure Fallback (RB-19)", () => {
    it("dispatches ephemeral fallback response when API relay times out (2,600ms abort deadline)", async () => {
      // Simulate slow API where fetch rejects when the AbortSignal fires
      globalThis.fetch = vi.fn().mockImplementation((_url: string, opts: any) => {
        return new Promise((_, reject) => {
          if (opts?.signal) {
            opts.signal.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }
        });
      });

      const interaction = {
        type: 3,
        id: "103456789012345678",
        token: "timeout-token-1",
        data: { custom_id: "action:check:{}" },
      };

      const start = Date.now();
      await listener.run({
        t: "INTERACTION_CREATE",
        d: interaction,
      });
      const elapsed = Date.now() - start;

      // AbortController in interactionRelay triggers at 2,600ms
      expect(elapsed).toBeGreaterThanOrEqual(2500);
      expect(elapsed).toBeLessThan(3500);

      // Verify fallback response was dispatched to Discord before 3,000ms deadline
      expect(mockRestPost).toHaveBeenCalledTimes(1);
      const [calledRoute, calledPayload] = mockRestPost.mock.calls[0];

      expect(calledRoute).toBe(Routes.interactionCallback("103456789012345678", "timeout-token-1"));
      expect(calledPayload).toEqual({
        body: {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: "⚠️ The action service is temporarily unavailable. Please try again later.",
            flags: MessageFlags.Ephemeral,
          },
        },
        auth: false,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to reach the API"),
        expect.any(Error),
      );
    }, 10_000);

    it("dispatches fallback response when API responds with HTTP 500 error", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response("Internal Action Executor Crash", { status: 500, statusText: "Internal Server Error" }),
      );

      const interaction = {
        type: 5, // ModalSubmit
        id: "113456789012345678",
        token: "error-token-500",
      };

      await listener.run({
        t: "INTERACTION_CREATE",
        d: interaction,
      });

      expect(mockRestPost).toHaveBeenCalledTimes(1);
      const [calledRoute, calledPayload] = mockRestPost.mock.calls[0];

      expect(calledRoute).toBe(Routes.interactionCallback("113456789012345678", "error-token-500"));
      expect(calledPayload.body.type).toBe(InteractionResponseType.ChannelMessageWithSource);
      expect(calledPayload.body.data.flags).toBe(MessageFlags.Ephemeral);
      expect(calledPayload.auth).toBe(false);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("API rejected relay: 500 - Internal Action Executor Crash"),
      );
    });

    it("handles missing interaction id or token without crashing fallback", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response("Error", { status: 500 }));

      // Missing token
      await listener.run({
        t: "INTERACTION_CREATE",
        d: { type: 3, id: "missing-token" },
      });

      // Missing id
      await listener.run({
        t: "INTERACTION_CREATE",
        d: { type: 3, token: "missing-id" },
      });

      // Neither should call rest.post
      expect(mockRestPost).not.toHaveBeenCalled();
    });
  });

  describe("Bot API HTTP Client BigInt Serialization (RB-21)", () => {
    it("serializes BigInt payload fields in api.sendMessage without TypeError", async () => {
      let sentBody = "";
      globalThis.fetch = vi.fn().mockImplementation(async (_url: string, opts: any) => {
        sentBody = opts.body;
        return new Response(JSON.stringify({ ok: true, mode: "bot" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const res = await api.sendMessage({
        channelId: "123456789012345678",
        payload: {
          content: "Testing BigInt",
          flags: 32768n as any, // Passing a BigInt flag
        },
      });

      expect(res.ok).toBe(true);
      const parsed = JSON.parse(sentBody);
      expect(parsed.channelId).toBe("123456789012345678");
      expect(parsed.payload.flags).toBe("32768");
      expect((BigInt.prototype as any).toJSON).toBeUndefined();
    });
  });
});

