import { Router } from "express";
import { attachUser, requireAdminKey } from "../middleware/auth.js";
import { sendLimiter } from "../middleware/rateLimit.js";
import { actionRepository } from "../repositories/actionRepository.js";
import * as discord from "../services/discordService.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { parseFlowRegistrations, validateMessagePayload } from "../utils/validation.js";

const router = Router();
const log = logger.child("send");

/**
 * POST /api/send
 *
 * The secure proxy for anything that needs a bot token — the token itself never
 * leaves this process. Webhook sends are supported too, so the frontend has one
 * code path for both modes and gets server-side validation for free.
 *
 * Body:
 *   {
 *     mode: "bot" | "webhook",
 *     payload: { content?, embeds?, components?, flags? },
 *     channelId?: string,   // required for mode=bot
 *     webhookUrl?: string,  // required for mode=webhook
 *     profileId?: number,   // optional bot profile override
 *     threadId?: string     // optional webhook thread target
 *   }
 *
 * Access: requires a valid `x-admin-key` header. Phase 4 replaces this with a
 * real session check; the route contract stays the same.
 */
router.post(
  "/",
  sendLimiter,
  attachUser,
  requireAdminKey,
  asyncHandler(async (req, res) => {
    // The body is untyped input: read each field defensively rather than
    // trusting a cast.
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { mode, payload, channelId, webhookUrl, profileId, threadId } = body;

    if (mode !== "bot" && mode !== "webhook") {
      throw ApiError.badRequest('`mode` must be either "bot" or "webhook"');
    }

    const message = validateMessagePayload(payload);

    // Register the components' action flows *before* the message goes out, so a
    // click that arrives the instant Discord renders it already resolves. A
    // 100-character `custom_id` cannot carry a multi-step chain, so this store is
    // what makes ad-hoc (untemplated) flows work.
    const flows = parseFlowRegistrations(body.flows);
    if (flows.length > 0) {
      await actionRepository.registerFlows(flows);
      log.info(`Registered ${flows.length} action flow(s) for this message`);
    }

    if (mode === "webhook") {
      if (typeof webhookUrl !== "string") {
        throw ApiError.badRequest('`webhookUrl` is required when mode is "webhook"');
      }
      const sent = await discord.sendWebhook(webhookUrl, message, {
        wait: true,
        threadId: typeof threadId === "string" ? threadId : null,
      });
      log.info(`Webhook send by user ${req.user?.id ?? "?"}`);
      return res.json({ ok: true, mode, message: sent });
    }

    if (typeof channelId !== "string") {
      throw ApiError.badRequest('`channelId` is required when mode is "bot"');
    }
    const sent = await discord.sendChannelMessage(channelId, message, {
      profileId: typeof profileId === "number" ? profileId : null,
    });
    log.info(`Bot send to ${channelId} by user ${req.user?.id ?? "?"}`);
    return res.json({ ok: true, mode, message: sent });
  }),
);

export default router;
