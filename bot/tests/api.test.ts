import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, listWeaoExploits } from "../src/lib/api.js";
import { env } from "../src/lib/env.js";

describe("bot/lib/api: Internal API Client Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls health check anonymously without x-admin-key header", async () => {
    let capturedHeaders: any;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      capturedHeaders = init?.headers;
      return {
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ status: "ok" }),
      } as any;
    });

    const res = await api.health();
    expect(res.status).toBe("ok");
    expect(capturedHeaders["x-admin-key"]).toBeUndefined();
  });

  it("applies a timeout signal to API requests", async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      capturedSignal = init?.signal as AbortSignal | undefined;
      return {
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ status: "ok" }),
      } as any;
    });

    await api.health();
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  it("attaches x-admin-key header on protected endpoints", async () => {
    let capturedHeaders: any;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      capturedHeaders = init?.headers;
      return {
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ ok: true, delivered: true }),
      } as any;
    });

    await api.relayInteraction({ type: 3 });
    expect(capturedHeaders["x-admin-key"]).toBe(env.adminApiKey);
  });

  it("forwards the invoking Discord actor with protected bot send requests", async () => {
    let capturedHeaders: Record<string, string> | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return {
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ ok: true, messageId: "msg_actor" }),
      } as any;
    });

    await api.sendMessage({
      channelId: "123456789012345678",
      content: "Hello",
      authorUserId: "987654321098765432",
      authorUsername: "staff-user",
    });

    expect(capturedHeaders?.["x-admin-key"]).toBe(env.adminApiKey);
    expect(capturedHeaders?.["x-staff-id"]).toBe("987654321098765432");
    expect(capturedHeaders?.["x-staff-username"]).toBe("staff-user");
  });

  it("throws ApiError with formatted error and details on HTTP error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        error: "Validation failed",
        details: ["channelId must be a snowflake", "content cannot be empty"],
      }),
    } as any);

    await expect(
      api.sendMessage({ channelId: "bad", content: "" }),
    ).rejects.toThrowError(ApiError);

    try {
      await api.sendMessage({ channelId: "bad", content: "" });
    } catch (err: any) {
      expect(err.status).toBe(400);
      expect(err.message).toContain("Validation failed");
      expect(err.message).toContain("channelId must be a snowflake");
    }
  });

  it("listWeaoExploits appends encoded query string", async () => {
    let capturedUrl: string = "";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      capturedUrl = url.toString();
      return {
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({ exploits: [{ title: "Delta" }] }),
      } as any;
    });

    const exploits = await listWeaoExploits("test query");
    expect(capturedUrl).toContain("/api/weao/exploits?q=test%20query");
    expect(exploits).toHaveLength(1);
    expect(exploits[0].title).toBe("Delta");
  });
});
