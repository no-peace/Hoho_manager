import { Router } from "express";
import { db } from "../config/database.js";
import { env } from "../config/env.js";
import { asyncHandler } from "../utils/errors.js";

const router = Router();

/**
 * GET /api/health
 *
 * Readiness probe. Reports which optional integrations are configured so
 * deployment mistakes ("I forgot the bot token") are visible immediately.
 */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const readiness = await db.get<{ ready: number }>("SELECT 1 AS ready").catch(() => undefined);

    const isConnected = readiness !== undefined;
    const statusCode = isConnected ? 200 : 503;

    res.status(statusCode).json({
      status: isConnected ? "ok" : "degraded",
      environment: env.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      time: new Date().toISOString(),
      database: { connected: isConnected },
      discord: {
        publicKeyConfigured: Boolean(env.discord.publicKey),
        botTokenConfigured: Boolean(env.discord.botToken),
        applicationIdConfigured: Boolean(env.discord.applicationId),
      },
    });
  }),
);

export default router;
