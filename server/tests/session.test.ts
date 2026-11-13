import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("persists user and global revocation requests", async () => {
    await revokeUserSessions("123456789012345678");
    await revokeAllSessions();

    expect(revocationMocks.revokeUser).toHaveBeenCalledWith("123456789012345678");
    expect(revocationMocks.revokeAll).toHaveBeenCalledOnce();
  });
});
