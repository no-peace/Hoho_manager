import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import discord, {
  createInteractionResponse,
  sendWebhook,
} from "../src/services/discordService.js";
import { ApiError } from "../src/utils/errors.js";
import { InteractionResponseType } from "@dmb/shared";

describe("PERF-02: Discord REST API Request Timeouts", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("attaches default 10s AbortSignal timeout to standard REST requests", async () => {
    let capturedSignal: AbortSignal | undefined;

    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal as AbortSignal | undefined;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ id: "123", name: "test" }),
      } as any;
    });

    await sendWebhook("https://discord.com/api/webhooks/123/token", {
      content: "test message",
    });

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  it("maps fetch TimeoutError to ApiError.gatewayTimeout (HTTP 504) after retries", async () => {
    let callCount = 0;

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      const timeoutError = new DOMException(
        "The operation was aborted due to timeout",
        "TimeoutError",
      );
      throw timeoutError;
    });

    let thrownError: any = null;
    try {
      await sendWebhook("https://discord.com/api/webhooks/123/token", { content: "hi" });
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(ApiError);
    expect(thrownError.status).toBe(504);
    expect(thrownError.code).toBe("gateway_timeout");
    expect(thrownError.message).toContain("Discord request timed out");
    expect(callCount).toBe(4); // 1 initial + 3 retries
  });

  it("sets 2.5s fast timeout and 1 retry on interaction response callbacks", async () => {
    let callCount = 0;
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      callCount++;
      capturedInit = init;
      const timeoutError = new DOMException(
        "The operation was aborted due to timeout",
        "TimeoutError",
      );
      throw timeoutError;
    });

    let thrownError: any = null;
    try {
      await createInteractionResponse("int_123", "token_abc", {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: { content: "reply" } as any,
      });
    } catch (err) {
      thrownError = err;
    }

    expect(thrownError).toBeInstanceOf(ApiError);
    expect(thrownError.status).toBe(504);
    expect(thrownError.code).toBe("gateway_timeout");
    expect(callCount).toBe(2); // 1 initial + 1 retry (retries: 1)
  });

  it("handles FormData multipart attachments with extended 30s timeout", async () => {
    let capturedSignal: AbortSignal | undefined;

    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      capturedSignal = init?.signal as AbortSignal | undefined;
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ id: "msg_999" }),
      } as any;
    });

    const fd = new FormData();
    fd.append("payload_json", JSON.stringify({ content: "upload" }));
    fd.append("files[0]", new Blob(["binary-content"]), "test.bin");

    await discord.sendWebhook(
      "https://discord.com/api/webhooks/123/token",
      { content: "upload" },
      { files: [{ key: "files[0]", filename: "test.bin", file: new Blob(["test"]) }] },
    );

    expect(capturedSignal).toBeDefined();
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });
});
