import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import createApp from "../app.js";
import { db } from "../config/database.js";
import { createSessionToken } from "../utils/session.js";

describe("OAuth2 & Session Auth Routes (/api/auth)", () => {
  const app = createApp();
  let server: ReturnType<typeof app.listen>;
  let baseUrl: string;

  beforeAll(async () => {
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("Test server has no TCP address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  beforeEach(async () => {
    await db.run("DELETE FROM users WHERE discord_id LIKE 'test-%' OR discord_id LIKE '999%'");
    await db.run("DELETE FROM staff_access WHERE discord_user_id LIKE 'test-%' OR discord_user_id LIKE '999%'");
  });

  describe("GET /api/auth/discord/login", () => {
    it("redirects to Discord authorization URL and sets state cookie", async () => {
      const res = await fetch(`${baseUrl}/api/auth/discord/login`, {
        redirect: "manual",
      });

      expect(res.status).toBe(302);
      const location = res.headers.get("location") || "";
      expect(location).toContain("https://discord.com/oauth2/authorize");
      expect(location).toContain("response_type=code");
      expect(location).toContain("scope=identify");

      const cookie = res.headers.get("set-cookie") || "";
      expect(cookie).toContain("oauth_state=");
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns user: null when unauthenticated", async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data).toEqual({ user: null });
    });

    it("returns user profile when authenticated via session cookie", async () => {
      const sessionUser = {
        id: "999000000000000001",
        username: "TestDiscordUser",
        global_name: "Test Global",
        avatar: "avatarhash123",
        role: "editor",
      };
      const token = createSessionToken(sessionUser);

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          Cookie: `dmb_session=${token}`,
        },
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.user).toBeDefined();
      expect(data.user.id).toBe("999000000000000001");
      expect(data.user.username).toBe("TestDiscordUser");
      expect(data.user.avatarUrl).toContain("avatarhash123");
      expect(data.user.isAdmin).toBe(false);
    });

    it("identifies Head Admin in isAdmin boolean", async () => {
      const sessionUser = {
        id: "999000000000000002",
        username: "AdminUser",
        avatar: null,
        role: "admin",
      };
      const token = createSessionToken(sessionUser);

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          Cookie: `dmb_session=${token}`,
        },
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.user.isAdmin).toBe(true);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("clears dmb_session cookie", async () => {
      const res = await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);

      const cookie = res.headers.get("set-cookie") || "";
      expect(cookie).toContain("dmb_session=;");
    });
  });

  describe("POST /api/auth/dev-login", () => {
    it("issues a signed session cookie and returns user profile", async () => {
      const res = await fetch(`${baseUrl}/api/auth/dev-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discordId: "999000000000000003",
          username: "DevTester",
        }),
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.ok).toBe(true);
      expect(data.user.id).toBe("999000000000000003");
      expect(data.token).toBeDefined();

      const cookie = res.headers.get("set-cookie") || "";
      expect(cookie).toContain("dmb_session=");
    });
  });

  describe("Anti-spoofing in Staff Permissions", () => {
    it("rejects request with 403 when session user does not match provided x-staff-id", async () => {
      const token = createSessionToken({
        id: "999000000000000004",
        username: "LegitUser",
        role: "editor",
      });

      // User 999000000000000004 attempts to spoof 999000000000000005
      const res = await fetch(`${baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `dmb_session=${token}`,
          "x-staff-id": "999000000000000005",
        },
        body: JSON.stringify({
          mode: "bot",
          channelId: "123456789012345678",
          payload: { content: "Spoof test" },
        }),
      });

      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toContain("Provided x-staff-id does not match authenticated user session");
    });
  });

  describe("Multipart File Upload on /api/send", () => {
    it("accepts multipart/form-data with payload_json and file attachment", async () => {
      const formData = new FormData();
      formData.append(
        "payload_json",
        JSON.stringify({
          mode: "bot",
          channelId: "123456789012345678",
          payload: { content: "Multipart message with file" },
        }),
      );
      const blob = new Blob(["fake file data"], { type: "text/plain" });
      formData.append("files[0]", blob, "test_doc.txt");

      // Send as admin with x-admin-key to verify multipart parsing and handler reachability
      const res = await fetch(`${baseUrl}/api/send`, {
        method: "POST",
        headers: {
          "x-admin-key": "dev-admin-key",
        },
        body: formData,
      });

      // Status may fail upstream on Discord API call since mock channel is fake, but body was parsed
      // and NOT rejected by 400 Bad Request or multipart parser error
      expect(res.status).not.toBe(400);
    });
  });
});
