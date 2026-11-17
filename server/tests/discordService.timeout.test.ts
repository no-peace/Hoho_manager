
import { describe, it, expect, vi, afterEach } from "vitest";
import discord, { createInteractionResponse } from "../src/services/discordService.js";
import { ApiError } from "../src/utils/errors.js";
import { InteractionResponseType } from "@dmb/shared";

describe("PERF-02: Discord REST API Request Timeouts", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("does not expose a webhook URL sender", () => {
    expect("sendWebhook" in discord).toBe(false);
  });

  it("sets a 1s attempt timeout and retries interaction callbacks once", async () => {
    let callCount = 0;
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = vi.fn().mockImplementation(
      async (_url: string, init?: RequestInit) => {
        callCount++;
        capturedInit = init;

        throw new DOMException(
          "The operation was aborted due to timeout",
          "TimeoutError",
        );
      },
    );

    let thrownError: unknown;

    try {
      await createInteractionResponse("int_123", "token_abc", {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: { content: "reply" } as any,
      });
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).toBeInstanceOf(ApiError);
    expect((thrownError as ApiError).status).toBe(504);
    expect((thrownError as ApiError).code).toBe("gateway_timeout");
    expect((thrownError as Error).message).toContain(
      "Discord request timed out after 1000ms",
    );
    expect((thrownError as Error).message).not.toContain("token_abc");
    expect(JSON.stringify((thrownError as ApiError).details)).not.toContain("token_abc");
    expect(capturedInit?.signal).toBeInstanceOf(AbortSignal);
    expect(callCount).toBe(2);
  });
});
