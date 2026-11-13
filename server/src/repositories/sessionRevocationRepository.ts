import { db } from "../config/database.js";

/**
 * Persistent JWT revocation floors.
 *
 * A user revocation invalidates every JWT issued at or before the stored
 * timestamp. The global row uses user_id="*" for emergency global revocation.
 * Keeping this in the shared database makes revocation consistent across
 * server processes and restarts.
 */
export const sessionRevocationRepository = {
  async getUserRevokedAt(userId: string): Promise<number> {
    const row = await db.get<{ revoked_at_ms: number }>(
      "SELECT revoked_at_ms FROM auth_session_revocations WHERE user_id = ?",
      [userId],
    );
    return row?.revoked_at_ms ?? 0;
  },

  async getGlobalRevokedAt(): Promise<number> {
    const row = await db.get<{ revoked_at_ms: number }>(
      "SELECT revoked_at_ms FROM auth_session_revocations WHERE user_id = '*'",
    );
    return row?.revoked_at_ms ?? 0;
  },

  async revokeUser(userId: string, revokedAtMs = Date.now()): Promise<void> {
    if (!userId) return;
    await db.run(
      `INSERT INTO auth_session_revocations (user_id, revoked_at_ms)
       VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         revoked_at_ms = MAX(auth_session_revocations.revoked_at_ms, excluded.revoked_at_ms)`,
      [userId, revokedAtMs],
    );
  },

  async revokeAll(revokedAtMs = Date.now()): Promise<void> {
    await this.revokeUser("*", revokedAtMs);
  },
};
