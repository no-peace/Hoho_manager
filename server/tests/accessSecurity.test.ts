import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { initializeDatabase, db } from "../src/config/database.js";
import { staffRepository } from "../src/repositories/staffRepository.js";
import { createSessionToken } from "../src/utils/session.js";

const ownerId = "111111111111111111";
const targetId = "222222222222222222";
const spoofedActorId = "333333333333333333";
const ownerHeaders = {
  Authorization: `Bearer ${createSessionToken({ id: ownerId, username: "trusted-owner", role: "admin" })}`,
  "Content-Type": "application/json",
};

describe("staff access endpoint security", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    await initializeDatabase();
    await new Promise<void>((resolve) => {
      server = createApp().listen(0, "127.0.0.1", () => {
        baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(async () => {
    await db.run("DELETE FROM staff_access");
    await db.run("DELETE FROM staff_cooldowns");
  });

  it("records the authenticated administrator, not a client-supplied grantor", async () => {
    const response = await fetch(`${baseUrl}/api/access`, {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        discord_user_id: targetId,
        discord_username: "Target user",
        discord_global_name: "Target",
        discord_avatar: "avatar-hash",
        granted_by_discord_id: spoofedActorId,
      }),
    });

    expect(response.status).toBe(201);
    const record = await response.json() as { granted_by_discord_id: string };
    expect(record.granted_by_discord_id).toBe(ownerId);
    expect(record.granted_by_discord_id).not.toBe(spoofedActorId);
  });

  it("reports invalid expiry values as inactive in the self-check endpoint", async () => {
    await staffRepository.create({
      discord_user_id: targetId,
      discord_username: "Target user",
      granted_by_discord_id: ownerId,
      expires_at: "not-a-date",
    });

    const response = await fetch(`${baseUrl}/api/access/${targetId}/check`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ hasAccess: false, reason: "invalid_expiry" });
  });

  it("does not turn malformed stored guild allowlists into wildcard access", async () => {
    await staffRepository.create({
      discord_user_id: targetId,
      discord_username: "Target user",
      granted_by_discord_id: ownerId,
      allowed_guild_ids: "{invalid-json",
    });

    const response = await fetch(`${baseUrl}/api/access`, { headers: ownerHeaders });
    expect(response.status).toBe(200);
    const records = await response.json() as Array<{
      discord_user_id: string;
      allowed_guild_ids: string[];
    }>;
    const target = records.find((record) => record.discord_user_id === targetId);
    expect(target?.allowed_guild_ids).toEqual([]);
    expect(target?.allowed_guild_ids).not.toContain("*");
  });

  it("rejects malformed target IDs before reading or changing staff records", async () => {
    const response = await fetch(`${baseUrl}/api/access/not-a-snowflake/check`);
    expect(response.status).toBe(400);
  });
});
