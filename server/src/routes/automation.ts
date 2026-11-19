import { Router } from "express";
import { env } from "../config/env.js";
import { attachUser, requireUserOrAdminKey } from "../middleware/auth.js";
import { requireStaffPermission } from "../middleware/staffPermissions.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { parseAllowedIds } from "../utils/requestParsing.js";
import {
  createScheduledMessage,
  createStickyMessage,
  deleteScheduledMessage,
  getActiveStickyMessages,
  getScheduledMessage,
  listScheduledMessages,
  refreshStickyMessage,
  removeStickyMessage,
  runAutomationTick,
  updateScheduledMessage,
} from "../services/automationService.js";

const router = Router();
router.use(attachUser, requireUserOrAdminKey);

const snowflake = (value: unknown): value is string =>
  typeof value === "string" && /^\d{17,20}$/.test(value.trim());

const assertChannelAccess = (
  req: Express.Request,
  guildId: string,
  channelId: string,
): void => {
  const staff = req.staffContext;
  if (!staff || staff.isAdmin || !staff.record) return;
  const channels = parseAllowedIds(staff.record.allowed_channel_ids);
  const guilds = parseAllowedIds(staff.record.allowed_guild_ids);
  if (!channels.includes("*") && !channels.includes(channelId)) {
    throw ApiError.forbidden("You are not allowed to access this channel.");
  }
  if (!guilds.includes("*") && !guilds.includes(guildId)) {
    throw ApiError.forbidden("You are not allowed to access this server.");
  }
};

router.get("/schedules", asyncHandler(async (req, res) => {
  const guildId = typeof req.query.guildId === "string" ? req.query.guildId : "";
  if (!snowflake(guildId)) throw ApiError.badRequest("A valid guildId is required.");
  const staff = req.staffContext;
  if (staff && !staff.isAdmin && staff.record) {
    const allowedGuilds = parseAllowedIds(staff.record.allowed_guild_ids);
    if (!allowedGuilds.includes("*") && !allowedGuilds.includes(guildId)) {
      throw ApiError.forbidden("You are not allowed to access this server.");
    }
  }
  res.json(await listScheduledMessages(guildId));
}));

router.post(
  "/schedules",
  requireStaffPermission(() => "send"),
  asyncHandler(async (req, res) => {
    const { guildId, channelId, threadId, payload, runAt, timezone, recurrence, targetMessageId, templateId } = req.body ?? {};
    if (!snowflake(guildId) || !snowflake(channelId)) throw ApiError.badRequest("Valid guildId and channelId are required.");
    assertChannelAccess(req, guildId, channelId);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw ApiError.badRequest("A message payload is required.");
    if (typeof runAt !== "string" || !Number.isFinite(Date.parse(runAt)) || Date.parse(runAt) <= Date.now()) {
      throw ApiError.badRequest("runAt must be a future ISO date.");
    }
    if (threadId != null && !snowflake(threadId)) throw ApiError.badRequest("Invalid thread ID.");
    if (targetMessageId != null && !snowflake(targetMessageId)) throw ApiError.badRequest("Invalid target message ID.");
    const allowedFrequencies = ["hourly", "daily", "weekly", "custom"];
    if (recurrence && (!allowedFrequencies.includes(recurrence.frequency) || (recurrence.interval != null && (!Number.isInteger(recurrence.interval) || recurrence.interval < 1 || recurrence.interval > 365)))) {
      throw ApiError.badRequest("Invalid recurrence settings.");
    }
    const createdBy = req.user?.discord_id ?? req.staffContext?.staffId ?? "admin";
    const row = await createScheduledMessage({
      guildId,
      channelId,
      threadId: threadId ?? null,
      templateId: Number.isSafeInteger(Number(templateId)) && Number(templateId) > 0 ? Number(templateId) : null,
      targetMessageId: targetMessageId ?? null,
      payload,
      runAt: new Date(runAt).toISOString(),
      timezone: typeof timezone === "string" ? timezone.slice(0, 80) : "UTC",
      recurrence: recurrence ?? null,
      createdBy,
    });
    res.status(201).json(row);
  }),
);

router.patch("/schedules/:id", requireStaffPermission(() => "send"), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw ApiError.badRequest("Invalid schedule ID.");
  const schedule = await getScheduledMessage(id);
  if (!schedule) throw ApiError.notFound("Schedule not found.");
  assertChannelAccess(req, schedule.guild_id, schedule.channel_id);
  if (typeof req.body?.enabled !== "boolean") throw ApiError.badRequest("enabled must be a boolean.");
  await updateScheduledMessage(id, req.body.enabled);
  res.json({ success: true });
}));

router.delete("/schedules/:id", requireStaffPermission(() => "send"), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw ApiError.badRequest("Invalid schedule ID.");
  const schedule = await getScheduledMessage(id);
  if (!schedule) throw ApiError.notFound("Schedule not found.");
  assertChannelAccess(req, schedule.guild_id, schedule.channel_id);
  await deleteScheduledMessage(id);
  res.json({ success: true });
}));

router.post("/sticky", requireStaffPermission(() => "send"), asyncHandler(async (req, res) => {
  const { guildId, channelId, payload, intervalMessages } = req.body ?? {};
  if (!snowflake(guildId) || !snowflake(channelId)) throw ApiError.badRequest("Valid guildId and channelId are required.");
  assertChannelAccess(req, guildId, channelId);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw ApiError.badRequest("A sticky payload is required.");
  const interval = Number(intervalMessages ?? 10);
  if (!Number.isInteger(interval) || interval < 5 || interval > 50) throw ApiError.badRequest("Sticky interval must be between 5 and 50 messages.");
  await createStickyMessage({
    guildId,
    channelId,
    payload,
    intervalMessages: interval,
    createdBy: req.user?.discord_id ?? req.staffContext?.staffId ?? "admin",
  });
  res.status(201).json({ success: true });
}));

router.get("/sticky/active", asyncHandler(async (req, res) => {
  if (!env.adminApiKey || req.get("x-admin-key") !== env.adminApiKey) throw ApiError.forbidden("Internal bot access is required.");
  res.json(await getActiveStickyMessages());
}));

router.post("/sticky/:channelId/refresh", asyncHandler(async (req, res) => {
  if (!env.adminApiKey || req.get("x-admin-key") !== env.adminApiKey) throw ApiError.forbidden("Internal bot access is required.");
  if (!snowflake(req.params.channelId)) throw ApiError.badRequest("Invalid channel ID.");
  const messageId = await refreshStickyMessage(req.params.channelId);
  if (!messageId) throw ApiError.notFound("Sticky message not found.");
  res.json({ success: true, messageId });
}));

router.delete("/sticky/:channelId", requireStaffPermission(() => "send"), asyncHandler(async (req, res) => {
  if (!snowflake(req.params.channelId)) throw ApiError.badRequest("Invalid channel ID.");
  await removeStickyMessage(req.params.channelId);
  res.json({ success: true });
}));

router.post("/tick", asyncHandler(async (req, res) => {
  if (!env.adminApiKey || req.get("x-admin-key") !== env.adminApiKey) throw ApiError.forbidden("Internal automation access is required.");
  await runAutomationTick();
  res.json({ success: true });
}));

export default router;
