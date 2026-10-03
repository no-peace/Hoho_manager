import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../config/env.js";
import { settingsService } from "../services/settingsService.js";
import settingsRouter from "./settings.js";

const app = express();
app.use(express.json());
app.use("/api/settings", settingsRouter);
app.use((error: { status?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(error.status ?? 500).json({ error: error.message ?? "Unexpected error" });
});

let server: ReturnType<typeof app.listen>;
let baseUrl: string;
const testHeadAdminId = "987654321012345678";

beforeAll(async () => {
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Test server has no TCP address");
  baseUrl = `http://127.0.0.1:${address.port}/api/settings`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("Settings routes (/api/settings)", () => {
  beforeEach(async () => {
    settingsService.clearCache();
    await settingsService.updateSettings("__global__", {
      log_channel_id: "800000000000000001",
      head_admin_ids: [testHeadAdminId],
    });
  });

  describe("GET /api/settings/auth", () => {
    it("returns isHeadAdmin: true for valid admin key", async () => {
      const res = await fetch(`${baseUrl}/auth`, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.isHeadAdmin).toBe(true);
      expect(data.isAdminKey).toBe(true);
    });

    it("returns isHeadAdmin: true for head admin staff ID", async () => {
      const res = await fetch(`${baseUrl}/auth`, {
        headers: { "x-staff-id": testHeadAdminId },
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.isHeadAdmin).toBe(true);
      expect(data.isAdminKey).toBe(false);
    });

    it("returns isHeadAdmin: false for regular user without error", async () => {
      const res = await fetch(`${baseUrl}/auth`, {
        headers: { "x-staff-id": "111111111111111111" },
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.isHeadAdmin).toBe(false);
      expect(data.isAdminKey).toBe(false);
    });
  });

  describe("GET /api/settings", () => {
    it("rejects unauthorized caller without credentials", async () => {
      const res = await fetch(baseUrl);
      expect(res.status).toBe(401);
    });

    it("rejects non-head-admin staff member with 403", async () => {
      const res = await fetch(baseUrl, {
        headers: { "x-staff-id": "111111111111111111" },
      });
      expect(res.status).toBe(403);
    });

    it("returns settings when called with x-admin-key", async () => {
      const res = await fetch(baseUrl, {
        headers: { "x-admin-key": env.adminApiKey },
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.log_channel_id).toBe("800000000000000001");
      expect(data.head_admin_ids).toContain(testHeadAdminId);
      expect(data.is_head_admin).toBe(true);
    });

    it("returns settings when called with authorized head admin x-staff-id", async () => {
      const res = await fetch(baseUrl, {
        headers: { "x-staff-id": testHeadAdminId },
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.log_channel_id).toBe("800000000000000001");
      expect(data.is_head_admin).toBe(true);
    });
  });

  describe("PUT /api/settings", () => {
    it("updates settings when authenticated as Head Admin", async () => {
      const res = await fetch(baseUrl, {
        method: "PUT",
        headers: {
          "x-staff-id": testHeadAdminId,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          log_channel_id: "899999999999999999",
          head_admin_ids: [testHeadAdminId, "222333444555666777"],
        }),
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.ok).toBe(true);
      expect(data.log_channel_id).toBe("899999999999999999");
      expect(data.head_admin_ids).toContain("222333444555666777");

      // Verify persistence
      const fresh = await settingsService.getSettings();
      expect(fresh.log_channel_id).toBe("899999999999999999");
    });
  });
});
