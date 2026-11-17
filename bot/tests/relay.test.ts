import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractionResponseType, MessageFlags, Routes } from "discord.js";
import { container } from "@sapphire/framework";
import { RawInteractionRelay } from "../src/listeners/interactionRelay.js";
import { env } from "../src/lib/env.js";

const mockContext: any = {
  root: "/mock/root",
  path: "/mock/listeners/relay.ts",
  name: "interactionRelay",
};

describe("bot/listeners: RawInteractionRelay Gateway & Fallback Suite", () => {
  let relay: RawInteractionRelay;
  let mockLogger: any;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
    mockClient = {
      options: {},
      rest: {
        post: vi.fn().mockResolvedValue({}),
      },
    };

    (container as any).logger = mockLogger;
    (container as any).client = mockClient;

    relay = new RawInteractionRelay(mockContext, {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("Packet Filtering", () => {
    it("ignores non-INTERACTION_CREATE gateway packets", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      await relay.run({ t: "MESSAGE_CREATE", d: {} });
      await relay.run({ t: "GUILD_CREATE", d: {} });
      await relay.run({ t: null, d: null });

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("ignores slash command (type 2) and autocomplete (type 4) interactions", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      // Slash command (handled by Sapphire command system)
      await relay.run({ t: "INTERACTION_CREATE", d: { type: 2, id: "1" } });
      // Autocomplete (handled by Sapphire autocomplete system)
      await relay.run({ t: "INTERACTION_CREATE", d: { type: 4, id: "2" } });
      // Ping
      await relay.run({ t: "INTERACTION_CREATE", d: { type: 1, id: "3" } });

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("relays MessageComponent (type 3) and ModalSubmit (type 5) interactions", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      } as any);

      await relay.run({
        t: "INTERACTION_CREATE",
        d: { type: 3, id: "btn_1", token: "tok_1" },
      });

      await relay.run({
        t: "INTERACTION_CREATE",
        d: { type: 5, id: "modal_1", token: "tok_2" },
      });

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("API Relay Protocol & Headers", () => {
    it("sends request with x-admin-key header and serialized JSON body", async () => {
      let capturedRequest: any;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
        capturedRequest = { url, init };
        return { ok: true, json: async () => ({ ok: true }) } as any;
      });

      const interaction = {
        type: 3,
        id: "1234567890",
        token: "secret_token",
        data: { custom_id: "action:dud" },
      };

      await relay.run({ t: "INTERACTION_CREATE", d: interaction });

      expect(capturedRequest.url).toBe(`${env.apiBaseUrl}/api/interactions/relay`);
      expect(capturedRequest.init.method).toBe("POST");
      expect(capturedRequest.init.headers).toEqual({
        "Content-Type": "application/json",
        "x-admin-key": env.adminApiKey,
      });

      const parsedBody = JSON.parse(capturedRequest.init.body);
      expect(parsedBody.id).toBe("1234567890");
      expect(parsedBody.data.custom_id).toBe("action:dud");
    });

    it("safely serializes BigInt snowflake properties to strings", async () => {
      let capturedBody: string = "";
      vi.spyOn(globalThis, "fetch").mockImplementation(async (_, init) => {
        capturedBody = init?.body as string;
        return { ok: true, json: async () => ({ ok: true }) } as any;
      });

      const interactionWithBigInt = {
        type: 3,
        id: "100",
        token: "tok",
        guild_id: 123456789012345678n, // BigInt
      };

      await relay.run({ t: "INTERACTION_CREATE", d: interactionWithBigInt });

      const parsed = JSON.parse(capturedBody);
      expect(parsed.guild_id).toBe("123456789012345678");
    });
  });

  describe("2,700ms Gateway Relay Fallback Deadline", () => {
    it("aborts the outbound request when the API takes > 2,700ms", async () => {
      vi.useFakeTimers();

      let abortSignal: AbortSignal | undefined;
      vi.spyOn(globalThis, "fetch").mockImplementation((_, init) => {
        abortSignal = init?.signal as AbortSignal;
        return new Promise((_, reject) => {
          abortSignal?.addEventListener("abort", () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      });

      const interaction = { type: 3, id: "late_1", token: "tok_late" };
      const relayPromise = relay.run({ t: "INTERACTION_CREATE", d: interaction });

      // Fast-forward past the 2,700ms abort deadline
      await vi.advanceTimersByTimeAsync(2750);
      await relayPromise;

      expect(abortSignal?.aborted).toBe(true);
      expect(mockClient.rest.post).toHaveBeenCalledWith(
        Routes.interactionCallback("late_1", "tok_late"),
        expect.anything(),
      );
    });
  });

  describe("Discord REST Fallback Callback Dispatch", () => {
    it("dispatches fallback ephemeral error response when API returns non-200 status", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 504,
        text: async () => "Gateway Timeout",
      } as any);

      const interaction = { type: 3, id: "fail_1", token: "tok_fail" };

      await relay.run({ t: "INTERACTION_CREATE", d: interaction });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("API rejected relay: 504"),
      );
      expect(mockClient.rest.post).toHaveBeenCalledTimes(1);
      expect(mockClient.rest.post).toHaveBeenCalledWith(
        Routes.interactionCallback("fail_1", "tok_fail"),
        {
          body: {
            type: InteractionResponseType.ChannelMessageWithSource,
            data: {
              content:
                "⚠️ The action service is temporarily unavailable. Please try again later.",
              flags: MessageFlags.Ephemeral,
            },
          },
          auth: false,
        },
      );
    });

    it("dispatches fallback response when API connection throws network exception", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

      const interaction = { type: 5, id: "err_1", token: "tok_err" };

      await relay.run({ t: "INTERACTION_CREATE", d: interaction });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to reach the API"),
        expect.any(Error),
      );
      expect(mockClient.rest.post).toHaveBeenCalledWith(
        Routes.interactionCallback("err_1", "tok_err"),
        expect.objectContaining({ auth: false }),
      );
    });

    it("does not throw if rawInteraction has missing id or token", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Error",
      } as any);

      // Missing id/token
      await relay.run({ t: "INTERACTION_CREATE", d: { type: 3 } });

      expect(mockClient.rest.post).not.toHaveBeenCalled();
    });

    it("safely catches and logs error if Discord fallback REST call itself fails", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network drop"));
      mockClient.rest.post.mockRejectedValueOnce(new Error("Unknown interaction"));

      const interaction = { type: 3, id: "ghost_1", token: "tok_ghost" };

      await expect(
        relay.run({ t: "INTERACTION_CREATE", d: interaction }),
      ).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to send fallback response to Discord"),
        expect.any(Error),
      );
    });
  });
});
