import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { db, initializeDatabase } from "../src/config/database.js";
import { createSessionToken } from "../src/utils/session.js";

const ownerId = "111111111111111111";
const publisherId = "222222222222222222";
const otherUserId = "333333333333333333";
const theme = {
  background: "#0b0d12",
  panel: "#161a23",
  surface: "#1d2230",
  text: "#f1f3f9",
  muted: "#a1a8b8",
  border: "#272d3a",
  accent: "#818cf8",
  accentHover: "#6366f1",
  radius: "10px",
  fontFamily: "Inter",
};
const headers = (id: string, role = "editor") => ({
  Authorization: `Bearer ${createSessionToken({ id, username: "theme-permission-test", role })}`,
  "Content-Type": "application/json",
});

describe("delegated server-theme publishing permissions", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    await initializeDatabase();
    await new Promise<void>((resolve) => {
      server = createApp().listen(0, "127.0.0.1", () => {
        const port = (server.address() as AddressInfo).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(async () => {
    await db.run("DELETE FROM design_access_users");
    await db.run("DELETE FROM server_theme_settings");
    await db.run("DELETE FROM design_themes");
  });

  const grantDesignAccess = async (discordId = publisherId) => fetch(`${baseUrl}/api/design/access`, {
    method: "POST",
    headers: headers(ownerId, "admin"),
    body: JSON.stringify({ discordId }),
  });

  const setPublishPermission = async (discordId: string, canPublishServerTheme: boolean) =>
    fetch(`${baseUrl}/api/design/access/${discordId}`, {
      method: "PATCH",
      headers: headers(ownerId, "admin"),
      body: JSON.stringify({ canPublishServerTheme }),
    });

  const publishTheme = (discordId: string, role = "editor") => fetch(`${baseUrl}/api/design/server-theme`, {
    method: "PUT",
    headers: headers(discordId, role),
    body: JSON.stringify({ theme }),
  });

  it("adds the permission column with a deny-by-default value", async () => {
    const columns = await db.query<{ name: string; dflt_value: string | null }>(
      "PRAGMA table_info(design_access_users)",
    );
    expect(columns).toContainEqual(expect.objectContaining({
      name: "can_publish_server_theme",
      dflt_value: "0",
    }));
  });

  it("does not confuse Design Lab access with server-theme publishing permission", async () => {
    const grant = await grantDesignAccess();
    expect(grant.status).toBe(201);

    const list = await fetch(`${baseUrl}/api/design/themes`, { headers: headers(publisherId) });
    expect(list.status).toBe(200);
    expect((await list.json()).canPublishServerTheme).toBe(false);

    const denied = await publishTheme(publisherId);
    expect(denied.status).toBe(403);
    expect(await db.get("SELECT id FROM server_theme_settings WHERE id = 1")).toBeUndefined();
  });

  it("allows an explicitly granted publisher and checks the permission on each mutation", async () => {
    expect((await grantDesignAccess()).status).toBe(201);
    expect((await setPublishPermission(publisherId, true)).status).toBe(200);

    const list = await fetch(`${baseUrl}/api/design/themes`, { headers: headers(publisherId) });
    expect((await list.json()).canPublishServerTheme).toBe(true);

    const published = await publishTheme(publisherId);
    expect(published.status).toBe(200);
    expect((await db.get<{ updated_by: string }>(
      "SELECT updated_by FROM server_theme_settings WHERE id = 1",
    ))?.updated_by).toBe(publisherId);

    expect((await setPublishPermission(publisherId, false)).status).toBe(200);
    expect((await publishTheme(publisherId)).status).toBe(403);
  });

  it("revokes access immediately and does not restore publisher permission on re-grant", async () => {
    expect((await grantDesignAccess()).status).toBe(201);
    expect((await setPublishPermission(publisherId, true)).status).toBe(200);

    const revoked = await fetch(`${baseUrl}/api/design/access/${publisherId}`, {
      method: "DELETE",
      headers: headers(ownerId, "admin"),
    });
    expect(revoked.status).toBe(204);
    expect((await publishTheme(publisherId)).status).toBe(403);

    expect((await grantDesignAccess()).status).toBe(201);
    const list = await fetch(`${baseUrl}/api/design/themes`, { headers: headers(publisherId) });
    expect((await list.json()).canPublishServerTheme).toBe(false);
    expect((await publishTheme(publisherId)).status).toBe(403);
  });

  it("requires an owner to manage publisher grants and validates the permission payload", async () => {
    expect((await grantDesignAccess()).status).toBe(201);

    const unauthorized = await fetch(`${baseUrl}/api/design/access/${publisherId}`, {
      method: "PATCH",
      headers: headers(otherUserId),
      body: JSON.stringify({ canPublishServerTheme: true }),
    });
    expect(unauthorized.status).toBe(403);

    const malformed = await fetch(`${baseUrl}/api/design/access/${publisherId}`, {
      method: "PATCH",
      headers: headers(ownerId, "admin"),
      body: JSON.stringify({ canPublishServerTheme: "true" }),
    });
    expect(malformed.status).toBe(400);

    const missing = await setPublishPermission(otherUserId, true);
    expect(missing.status).toBe(404);
  });

  it("does not let delegated publishers promote another user's private theme", async () => {
    expect((await grantDesignAccess()).status).toBe(201);
    expect((await setPublishPermission(publisherId, true)).status).toBe(200);

    await db.run(
      "INSERT INTO design_themes (id, owner_discord_id, name, description, data, is_default, is_public) VALUES (@id, @owner, @name, NULL, @data, 0, 0)",
      { id: "private-theme", owner: otherUserId, name: "Private theme", data: JSON.stringify({ theme }) },
    );
    await db.run(
      "INSERT INTO design_themes (id, owner_discord_id, name, description, data, is_default, is_public) VALUES (@id, @owner, @name, NULL, @data, 0, 1)",
      { id: "public-theme", owner: otherUserId, name: "Public theme", data: JSON.stringify({ theme }) },
    );

    const privateResult = await fetch(`${baseUrl}/api/design/themes/private-theme/publish`, {
      method: "POST",
      headers: headers(publisherId),
    });
    expect(privateResult.status).toBe(404);

    const publicResult = await fetch(`${baseUrl}/api/design/themes/public-theme/publish`, {
      method: "POST",
      headers: headers(publisherId),
    });
    expect(publicResult.status).toBe(200);
  });

  it("preserves owner publishing without a delegated access row", async () => {
    const response = await publishTheme(ownerId, "admin");
    expect(response.status).toBe(200);
    expect((await db.get<{ updated_by: string }>(
      "SELECT updated_by FROM server_theme_settings WHERE id = 1",
    ))?.updated_by).toBe(ownerId);
  });
});
