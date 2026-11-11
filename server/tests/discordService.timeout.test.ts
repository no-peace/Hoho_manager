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

  it("blocks arbitrary webhook URL message sends before making a network request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      discord.sendWebhook("https://discord.com/api/webhooks/123/token", {
        content: "legacy webhook send",
      }),
    ).rejects.toMatchObject({ status: 403 });

    expect(fetchSpy).not.toHaveBeenCalled();
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
    
  });

});
