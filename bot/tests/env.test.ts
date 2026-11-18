import { describe, expect, it, vi } from "vitest";
import { parseDiscordIdList, validateApiBaseUrl } from "../src/lib/env.js";

describe("bot command administrator ID parsing", () => {
  it("keeps unique valid Discord snowflakes and ignores invalid values", () => {
    expect(parseDiscordIdList("111111111111111111, bad, 222222222222222222, 111111111111111111")).toEqual([
      "111111111111111111",
      "222222222222222222",
    ]);
  });
});

describe("bot production environment validation", () => {
  it("rejects an insecure API origin and a development admin key", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DISCORD_BOT_TOKEN", "test-bot-token");
    vi.stubEnv("API_BASE_URL", "http://api.example.com");
    vi.stubEnv("ADMIN_API_KEY", "dev-admin-key");
    vi.stubEnv("BOT_COMMAND_ADMIN_IDS", "111111111111111111");

    vi.resetModules();
    try {
      const { validateEnv } = await import("../src/lib/env.js");
      const errors = validateEnv();
      expect(errors.some((error) => error.includes("must use HTTPS"))).toBe(true);
      expect(errors.some((error) => error.includes("development default"))).toBe(true);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

describe("bot API base URL security", () => {
  it("allows the local HTTP API in development and tests", () => {
    expect(validateApiBaseUrl("http://127.0.0.1:3001", false)).toBeNull();
  });

  it("requires HTTPS for deployed bot-to-API traffic", () => {
    expect(validateApiBaseUrl("https://api.example.com", true)).toBeNull();
    expect(validateApiBaseUrl("http://api.example.com", true)).toContain("must use HTTPS");
  });

  it("rejects malformed origins and embedded credentials or paths", () => {
    expect(validateApiBaseUrl("not a URL", false)).toContain("valid absolute URL");
    expect(validateApiBaseUrl("https://user:secret@example.com", true)).toContain("without credentials");
    expect(validateApiBaseUrl("https://example.com/api", true)).toContain("without credentials");
  });
});
