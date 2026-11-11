import { Router } from "express";
import { attachUser } from "../middleware/auth.js";
import { trackedMessageRepository } from "../repositories/trackedMessageRepository.js";
import { syncTrackedMessages, trackMessage } from "../services/messageTrackerService.js";
import { asyncHandler, ApiError } from "../utils/errors.js";

const router = Router();

router.get(
  "/messages",
  attachUser,
  asyncHandler(async (_req, res) => {
    const list = await trackedMessageRepository.listAll();
    res.json({
      count: list.length,
      messages: list.map((m) => ({
        id: m.id,
        channelId: m.channel_id,
        messageId: m.message_id,
        templateId: m.template_id,
        exploitName: m.exploit_name,
        authorUserId: m.author_user_id,
        updatedAt: m.updated_at,
        lastCheckedAt: m.last_checked_at,
      })),
    });
  }),
);

router.post(
  "/sync",
  attachUser,
  asyncHandler(async (_req, res) => {
    const syncResult = await syncTrackedMessages();
    res.json({ ok: true, result: syncResult });
  }),
);

router.post(
  "/track",
  attachUser,
  asyncHandler(async (req, res) => {
    const { channelId, messageId, templateId, exploitName, authorUserId, rawPayload } = req.body;
    if (!channelId || !messageId) {
      throw ApiError.badRequest("`channelId` and `messageId` are required");
    }
    const tracked = await trackMessage({
      channelId,
      messageId,
      templateId,
      exploitName,
      authorUserId,
      rawPayload,
    });
    res.json({ ok: true, tracked });
  }),
);

export default router;
