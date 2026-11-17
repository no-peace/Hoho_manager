import { describe, expect, it } from "vitest";
import { validateApiBaseUrl } from "../src/lib/env.js";

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
