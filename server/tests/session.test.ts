import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";

const revocationMocks = vi.hoisted(() => ({
  getUserRevokedAt: vi.fn<() => Promise<number>>(),
  getGlobalRevokedAt: vi.fn<() => Promise<number>>(),
  revokeUser: vi.fn<(userId: string) => Promise<void>>(),
  revokeAll: vi.fn<() => Promise<void>>(),
}));

vi.mock("../src/repositories/sessionRevocationRepository.js", () => ({
  sessionRevocationRepository: revocationMocks,
}));

import {
  createSessionToken,
  revokeAllSessions,
  revokeUserSessions,
  verifySessionToken,
} from "../src/utils/session.js";

describe("database-backed auth session revocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revocationMocks.getUserRevokedAt.mockResolvedValue(0);
    revocationMocks.getGlobalRevokedAt.mockResolvedValue(0);
    revocationMocks.revokeUser.mockResolvedValue();
    revocationMocks.revokeAll.mockResolvedValue();
  });

  const token = () =>
    createSessionToken({
      id: "123456789012345678",
      username: "Session Test",
      role: "editor",
    });

  it("accepts a valid session when no revocation floor exists", async () => {
    await expect(verifySessionToken(token())).resolves.toMatchObject({
      id: "123456789012345678",
      username: "Session Test",
    });
  });

  it("rejects a user's previously issued token after the database revocation floor", async () => {
    const signedToken = token();
    revocationMocks.getUserRevokedAt.mockResolvedValue(Date.now() + 1);

    await expect(verifySessionToken(signedToken)).resolves.toBeNull();
  });

  it("rejects all previously issued tokens after global revocation", async () => {
    const signedToken = token();
    revocationMocks.getGlobalRevokedAt.mockResolvedValue(Date.now() + 1);

    await expect(verifySessionToken(signedToken)).resolves.toBeNull();
  });

  const signClaims = (claims: Record<string, unknown>): string => {
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const secret = env.sessionSecret || env.adminApiKey || "dev-only-session-secret";
    const signature = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
    return `${header}.${payload}.${signature}`;
  };

  it("rejects signed session claims without a valid expiry window", async () => {
    const now = Math.floor(Date.now() / 1000);
    const base = { id: "123456789012345678", username: "Session Test", role: "editor", iat: now };

    await expect(verifySessionToken(signClaims(base))).resolves.toBeNull();
    await expect(verifySessionToken(signClaims({ ...base, exp: now - 1 }))).resolves.toBeNull();
    await expect(verifySessionToken(signClaims({ ...base, exp: now + 86_401 }))).resolves.toBeNull();
    await expect(verifySessionToken(signClaims({ ...base, id: "not-a-snowflake", exp: now + 60 }))).resolves.toBeNull();
  });

  it("persists user and global revocation requests", async () => {
    await revokeUserSessions("123456789012345678");
    await revokeAllSessions();

    expect(revocationMocks.revokeUser).toHaveBeenCalledWith("123456789012345678");
    expect(revocationMocks.revokeAll).toHaveBeenCalledOnce();
  });
});
