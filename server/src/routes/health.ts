import { Router } from "express";
import { db } from "../config/database.js";
import { env } from "../config/env.js";
import { asyncHandler } from "../utils/errors.js";

const router = Router();

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
    const users = await db
      .get<CountRow>("SELECT COUNT(*) AS count FROM users")
      .catch(() => undefined);

    res.json({
      status: "ok",
      environment: env.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      time: new Date().toISOString(),
      database: { connected: users !== undefined, users: users?.count ?? null },
      discord: {
        publicKeyConfigured: Boolean(env.discord.publicKey),
        botTokenConfigured: Boolean(env.discord.botToken),
        applicationIdConfigured: Boolean(env.discord.applicationId),
      },
    });
  }),
);

export default router;
