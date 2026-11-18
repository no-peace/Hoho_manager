import { Router } from "express";
import { db } from "../config/database.js";
import { env } from "../config/env.js";
import { asyncHandler } from "../utils/errors.js";

const router = Router();
const HEALTH_CACHE_TTL_MS = 60_000;
let cachedHealth: { users: number; checkedAt: number } | null = null;

export const clearHealthCache = (): void => {
  cachedHealth = null;
};

interface CountRow {
  count: number;
}

/**
 * GET /api/health
 *
 * Readiness probe. Reports which optional integrations are configured so
 * deployment mistakes ("I forgot the bot token") are visible immediately.
 */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const now = Date.now();
    const canUseCache = env.isProd;
    const cached = canUseCache && cachedHealth && now - cachedHealth.checkedAt < HEALTH_CACHE_TTL_MS
      ? cachedHealth
      : null;
    const users = cached
      ? { count: cached.users }
      : await db
          .get<CountRow>("SELECT COUNT(*) AS count FROM users")
          .catch(() => undefined);

    if (!cached && canUseCache && users !== undefined) {
      cachedHealth = { users: users.count, checkedAt: now };
    }

    const isConnected = users !== undefined;
    const statusCode = isConnected ? 200 : 503;

    res.status(statusCode).json({
      status: isConnected ? "ok" : "degraded",
      environment: env.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      time: new Date().toISOString(),
      database: { connected: isConnected, users: users?.count ?? null },
      discord: {
        publicKeyConfigured: Boolean(env.discord.publicKey),
        botTokenConfigured: Boolean(env.discord.botToken),
        applicationIdConfigured: Boolean(env.discord.applicationId),
      },
    });
  }),
);

export default router;
