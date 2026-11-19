import { Router } from "express";
import { attachUser, requireAdminKey, requireUserOrAdminKey } from "../middleware/auth.js";
import { requireStaffPermission } from "../middleware/staffPermissions.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { parseAllowedIds } from "../utils/requestParsing.js";
import { getChannelGuildId } from "../services/discordService.js";
import { validateMessagePayload } from "../utils/validation.js";
import { sanitizeAllowedMentions, scrubMentions } from "../utils/mentionScrubber.js";
import { auditLog } from "../services/auditLog.js";
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

router.get("/schedules", requireStaffPermission("automation"), asyncHandler(async (req, res) => {
  const guildId = typeof req.query.guildId === "string" ? req.query.guildId : "";
  if (!snowflake(guildId)) throw ApiError.badRequest("A valid guildId is required.");
  const staff = req.staffContext;
  if (staff && !staff.isAdmin && staff.record) {
    const allowedGuilds = parseAllowedIds(staff.record.allowed_guild_ids);
    if (!allowedGuilds.includes("*") && !allowedGuilds.includes(guildId)) {
      throw ApiError.forbidden("You are not allowed to access this server.");
    }
  }
  const schedules = await listScheduledMessages(guildId);
  if (staff && !staff.isAdmin && staff.record) {
    const allowedChannels = parseAllowedIds(staff.record.allowed_channel_ids);
    return res.json(schedules.filter((schedule) =>
      allowedChannels.includes("*") || allowedChannels.includes(schedule.channel_id),
    ));
  }
  res.json(schedules);
}));

router.post(
  "/schedules",
  requireStaffPermission("automation"),
  requireStaffPermission("send"),
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
    if (!row) {
      throw new ApiError(500, "The scheduled message could not be created.");
    }
    auditLog({
      event: "AUTOMATION_CREATED",
      guildId,
      actorDiscordId: req.staffContext?.staffId ?? req.user?.discord_id,
      channelId,
      reason: "Scheduled message created",
      details: { schedule_id: row.id, recurring: Boolean(recurrence), template_id: templateId ?? "none" },
    });
    res.status(201).json(row);
  }),
);

router.patch("/schedules/:id", requireStaffPermission("automation"), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw ApiError.badRequest("Invalid schedule ID.");
  const schedule = await getScheduledMessage(id);
  if (!schedule) throw ApiError.notFound("Schedule not found.");
  assertChannelAccess(req, schedule.guild_id, schedule.channel_id);
  if (typeof req.body?.enabled !== "boolean") throw ApiError.badRequest("enabled must be a boolean.");
  await updateScheduledMessage(id, req.body.enabled);
  auditLog({
    event: "AUTOMATION_UPDATED",
    guildId: schedule.guild_id,
    actorDiscordId: req.staffContext?.staffId ?? req.user?.discord_id,
    channelId: schedule.channel_id,
    reason: req.body.enabled ? "Schedule enabled" : "Schedule paused",
    details: { schedule_id: id, enabled: req.body.enabled },
  });
  res.json({ success: true });
}));

router.delete("/schedules/:id", requireStaffPermission("automation"), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw ApiError.badRequest("Invalid schedule ID.");
  const schedule = await getScheduledMessage(id);
  if (!schedule) throw ApiError.notFound("Schedule not found.");
  assertChannelAccess(req, schedule.guild_id, schedule.channel_id);
  await deleteScheduledMessage(id);
  auditLog({
    event: "AUTOMATION_DELETED",
    guildId: schedule.guild_id,
    actorDiscordId: req.staffContext?.staffId ?? req.user?.discord_id,
    channelId: schedule.channel_id,
    reason: "Scheduled message deleted",
    details: { schedule_id: id },
  });
  res.json({ success: true });
}));

router.post("/sticky", requireStaffPermission("automation"), requireStaffPermission("send"), asyncHandler(async (req, res) => {
  const { guildId: requestedGuildId, channelId, payload: rawPayload, intervalMessages } = req.body ?? {};
  if (!snowflake(channelId)) throw ApiError.badRequest("A valid channelId is required.");
  const resolvedGuildId = await getChannelGuildId(channelId);
  if (!resolvedGuildId) throw ApiError.notFound("Channel not found or unavailable to the configured bot.");
  if (requestedGuildId !== undefined && requestedGuildId !== resolvedGuildId) throw ApiError.forbidden("The supplied guildId does not match the channel's guild.");
  assertChannelAccess(req, resolvedGuildId, channelId);
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) throw ApiError.badRequest("A sticky payload is required.");
  const validatedPayload = validateMessagePayload(rawPayload);
  const payload = validatedPayload as unknown as Record<string, unknown>;
  const hasComponents = Array.isArray(payload.components) && payload.components.length > 0;
  const hasComponentsV2Flag = typeof payload.flags === "number" && (payload.flags & (1 << 15)) !== 0;
  const staff = req.staffContext;
  if (staff && !staff.isAdmin && staff.record) {
    if (staff.record.can_use_components_v2 === 0 && (hasComponents || hasComponentsV2Flag)) throw ApiError.forbidden("Your staff account is not permitted to use Interactive Components V2.");
    const scrubbed = scrubMentions(payload, staff.record).payload;
    Object.assign(payload, sanitizeAllowedMentions(scrubbed, staff.record));
  }
  const interval = Number(intervalMessages ?? 10);
  if (!Number.isInteger(interval) || interval < 5 || interval > 50) throw ApiError.badRequest("Sticky interval must be between 5 and 50 messages.");
  await createStickyMessage({
    guildId: resolvedGuildId,
    channelId,
    payload,
    intervalMessages: interval,
    createdBy: req.user?.discord_id ?? req.staffContext?.staffId ?? "admin",
  });
  auditLog({
    event: "STICKY_CREATED",
    guildId: resolvedGuildId,
    actorDiscordId: req.staffContext?.staffId ?? req.user?.discord_id,
    channelId,
    reason: "Sticky message created",
    details: { interval_messages: interval },
  });
  res.status(201).json({ success: true });
}));

router.get("/sticky/active", requireAdminKey, asyncHandler(async (_req, res) => {
  res.json(await getActiveStickyMessages());
}));

router.post("/sticky/:channelId/refresh", requireAdminKey, asyncHandler(async (req, res) => {
  if (!snowflake(req.params.channelId)) throw ApiError.badRequest("Invalid channel ID.");
  const messageId = await refreshStickyMessage(req.params.channelId);
  if (!messageId) throw ApiError.notFound("Sticky message not found.");
  res.json({ success: true, messageId });
}));

router.delete("/sticky/:channelId", requireStaffPermission("automation"), asyncHandler(async (req, res) => {
  if (!snowflake(req.params.channelId)) throw ApiError.badRequest("Invalid channel ID.");
  const guildId = await getChannelGuildId(req.params.channelId);
  if (!guildId) throw ApiError.notFound("Channel not found or unavailable to the configured bot.");
  assertChannelAccess(req, guildId, req.params.channelId);
  await removeStickyMessage(req.params.channelId);
  auditLog({
    event: "STICKY_DELETED",
    guildId,
    actorDiscordId: req.staffContext?.staffId ?? req.user?.discord_id,
    channelId: req.params.channelId,
    reason: "Sticky message deleted",
  });
  res.json({ success: true });
}));

router.post("/tick", requireAdminKey, asyncHandler(async (_req, res) => {
  await runAutomationTick();
  res.json({ success: true });
}));

export default router;
