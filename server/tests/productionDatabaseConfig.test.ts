import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("production database configuration", () => {
  it("refuses to fall back to local SQLite when Turso credentials are missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURSO_DATABASE_URL", "");
    vi.stubEnv("TURSO_AUTH_TOKEN", "");

    await expect(import("../src/config/database.js")).rejects.toThrow(
      "Production requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN",
    );
  });

  it("continues to allow local SQLite when running automated tests", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("TURSO_DATABASE_URL", "");
    vi.stubEnv("TURSO_AUTH_TOKEN", "");

    await expect(import("../src/config/database.js")).resolves.toBeDefined();
  });
});
