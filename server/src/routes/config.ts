import { Router } from "express";
import { listActionTypes } from "../actions/index.js";
import { env } from "../config/env.js";
import { asyncHandler } from "../utils/errors.js";

const router = Router();

/**
 * GET /api/config
 *
 * Public, non-sensitive runtime information. The editor uses this so the action
 * picker is driven by the server's registry rather than a duplicated list that
 * can fall out of sync.
 */
router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({
      actionTypes: listActionTypes(),
      features: {
        botSendAvailable: Boolean(env.discord.botToken),
        interactionsConfigured: Boolean(env.discord.publicKey),
      },
    });
  }),
);

export default router;
