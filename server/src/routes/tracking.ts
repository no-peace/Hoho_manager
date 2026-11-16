import { Router } from "express";
import { attachUser, requireAdminKey } from "../middleware/auth.js";
import { requireStaffPermission } from "../middleware/staffPermissions.js";
import { trackedMessageRepository } from "../repositories/trackedMessageRepository.js";
import { templateRepository } from "../repositories/templateRepository.js";
import { syncTrackedMessages, trackMessage } from "../services/messageTrackerService.js";
import * as discord from "../services/discordService.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { parseAllowedIds } from "../utils/requestParsing.js";

const router = Router();

const assertStaffGuildAllowed = async (
  req: Express.Request,
  channelId: string,
): Promise<void> => {
  const staffCtx = req.staffContext;

  if (!staffCtx || staffCtx.isAdmin) return;

  if (!staffCtx.record) {
    throw ApiError.forbidden("An active staff record is required");
  }

  const allowedGuilds = parseAllowedIds(
    staffCtx.record.allowed_guild_ids,
  );

  if (allowedGuilds.includes("*")) return;

  const guildId = await discord.getChannelGuildId(channelId);

  if (!guildId || !allowedGuilds.includes(guildId)) {
    throw ApiError.forbidden(
      `You are not allowed to access guild ${guildId ?? "unknown"}`,
    );
  }
};

/**
 * List only tracking records the caller is authorized to see.
 * The admin key can see all records; staff are filtered by both allowlists.
 */
router.get(
  "/messages",
  attachUser,
  requireStaffPermission("edit"),
  asyncHandler(async (req, res) => {
    const list = await trackedMessageRepository.listAll();
    const staffCtx = req.staffContext;

    if (!staffCtx || staffCtx.isAdmin || !staffCtx.record) {
      return res.json({
        count: list.length,
        messages: list.map((m) => ({
          id: m.id,
          channelId: m.channel_id,
          messageId: m.message_id,
          templateId: m.template_id,
          exploitName: m.exploit_name,
          authorUserId: m.author_user_id,
          name: m.name ?? null,
          rawPayload: m.raw_payload ?? null,
          expiresAt: m.expires_at ?? null,
          createdAt: m.created_at,
          updatedAt: m.updated_at,
          lastCheckedAt: m.last_checked_at,
        })),
      });
    }

    const allowedChannels = parseAllowedIds(
      staffCtx.record.allowed_channel_ids,
    );
    const allowedGuilds = parseAllowedIds(
      staffCtx.record.allowed_guild_ids,
    );

    const guildCache = new Map<string, string | null>();
    const visible = [];

    for (const message of list) {
      if (
        !allowedChannels.includes("*") &&
        !allowedChannels.includes(message.channel_id)
      ) {
        continue;
      }

      if (!allowedGuilds.includes("*")) {
        if (!guildCache.has(message.channel_id)) {
          try {
            guildCache.set(
              message.channel_id,
              await discord.getChannelGuildId(message.channel_id),
            );
          } catch {
            // A failed lookup must not reveal the record.
            guildCache.set(message.channel_id, null);
          }
        }

        const guildId = guildCache.get(message.channel_id);
        if (!guildId || !allowedGuilds.includes(guildId)) {
          continue;
        }
      }

      visible.push(message);
    }

    return res.json({
      count: visible.length,
      messages: visible.map((m) => ({
        id: m.id,
        channelId: m.channel_id,
        messageId: m.message_id,
        templateId: m.template_id,
        exploitName: m.exploit_name,
        authorUserId: m.author_user_id,
        name: m.name ?? null,
        rawPayload: m.raw_payload ?? null,
        expiresAt: m.expires_at ?? null,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
        lastCheckedAt: m.last_checked_at,
      })),
    });
  }),
);

/**
 * Global synchronization is a bot maintenance operation, not a user action.
 * The bot's API client already sends x-admin-key.
 */
router.post(
  "/sync",
  requireAdminKey,
  asyncHandler(async (_req, res) => {
    const syncResult = await syncTrackedMessages();
    return res.json({ ok: true, result: syncResult });
  }),
);

/**
 * Track a message only when:
 * - the caller has edit permission;
 * - the channel and guild are allowed;
 * - the message exists and was authored by the configured server bot;
 * - the caller can access the referenced template, if one is supplied.
 */
router.post(
  "/track",
  attachUser,
  requireStaffPermission("edit"),
  asyncHandler(async (req, res) => {
    const {
      channelId,
      messageId,
      templateId: rawTemplateId,
      exploitName,
      authorUserId,
      rawPayload,
    } = req.body ?? {};

    if (
      typeof channelId !== "string" ||
      !channelId.trim() ||
      typeof messageId !== "string" ||
      !messageId.trim()
    ) {
      throw ApiError.badRequest("`channelId` and `messageId` are required");
    }

    await assertStaffGuildAllowed(req, channelId);

    let templateId: number | null = null;
    if (rawTemplateId !== undefined && rawTemplateId !== null) {
      const parsed = Number(rawTemplateId);
      if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw ApiError.badRequest("`templateId` must be a positive integer");
      }
      templateId = parsed;
    }

    if (
      exploitName !== undefined &&
      exploitName !== null &&
      (typeof exploitName !== "string" || exploitName.length > 100)
    ) {
      throw ApiError.badRequest("`exploitName` must be a string of at most 100 characters");
    }

    if (
      authorUserId !== undefined &&
      authorUserId !== null &&
      (typeof authorUserId !== "string" || !/^\d{17,20}$/.test(authorUserId))
    ) {
      throw ApiError.badRequest("`authorUserId` must be a valid Discord user ID");
    }

    if (
      rawPayload !== undefined &&
      (rawPayload === null ||
        typeof rawPayload !== "object" ||
        Array.isArray(rawPayload))
    ) {
      throw ApiError.badRequest("`rawPayload` must be a JSON object");
    }

    if (!templateId && !exploitName && !rawPayload) {
      throw ApiError.badRequest(
        "Provide a template, exploit name, or raw payload to track",
      );
    }

    if (templateId !== null) {
      const template = await templateRepository.findById(templateId);
      if (!template) {
        throw ApiError.notFound("Template not found");
      }

      const isAdmin = Boolean(req.staffContext?.isAdmin);
      const isOwner = template.user_id === req.user?.id;
      if (!isAdmin && !isOwner && !template.is_public) {
        throw ApiError.forbidden("You cannot track a private template owned by another user");
      }
    }

    const token = await discord.resolveBotToken(null);
    const bot = await discord.getBotIdentity(token);
    if (!bot?.id) {
      throw new ApiError(503, "Configured server bot identity is unavailable");
    }

    const existingMessage = await discord.getChannelMessage(
      channelId,
      messageId,
      null,
    );

    if (!existingMessage) {
      throw ApiError.notFound("Message not found");
    }

    if (existingMessage.author?.id !== bot.id) {
      throw ApiError.forbidden(
        "Only messages authored by the configured server bot can be tracked",
      );
    }

    const tracked = await trackMessage({
      channelId,
      messageId,
      templateId,
      exploitName: typeof exploitName === "string" ? exploitName : null,
      authorUserId: typeof authorUserId === "string" ? authorUserId : null,
      rawPayload: rawPayload ?? null,
    });

    if (!tracked) {
      throw new ApiError(500, "Failed to save tracking record");
    }

    return res.json({ ok: true, tracked });
  }),
);

/**
 * Update tracking metadata while preserving channel and guild access checks.
 */
router.patch(
  "/messages/:id",
  attachUser,
  requireStaffPermission("edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw ApiError.badRequest("`id` must be a positive integer");
    const target = (await trackedMessageRepository.listAll()).find((m) => m.id === id);
    if (!target) throw ApiError.notFound("Tracked message record not found");
    const staffCtx = req.staffContext;
    if (staffCtx && !staffCtx.isAdmin && staffCtx.record) {
      const allowedChannels = parseAllowedIds(staffCtx.record.allowed_channel_ids);
      if (!allowedChannels.includes("*") && !allowedChannels.includes(target.channel_id)) {
        throw ApiError.forbidden(`You are not allowed to access channel ${target.channel_id}`);
      }
      await assertStaffGuildAllowed(req, target.channel_id);
    }
    const body = req.body ?? {};
    if (body.track === false) {
      await trackedMessageRepository.deleteById(id);
      return res.json({ ok: true, tracked: false });
    }
    const updates: { name?: string | null; expires_at?: string | null } = {};
    if (body.name !== undefined) {
      if (body.name !== null && (typeof body.name !== "string" || body.name.length > 100)) {
        throw ApiError.badRequest("`name` must be a string of at most 100 characters or null");
      }
      updates.name = body.name;
    }
    if (body.expiresAt !== undefined) {
      if (body.expiresAt !== null && typeof body.expiresAt !== "string") {
        throw ApiError.badRequest("`expiresAt` must be an ISO date string or null");
      }
      if (typeof body.expiresAt === "string" && (!Number.isFinite(Date.parse(body.expiresAt)) || Date.parse(body.expiresAt) <= Date.now())) {
        throw ApiError.badRequest("`expiresAt` must be a valid future date");
      }
      updates.expires_at = body.expiresAt;
    }
    await trackedMessageRepository.updateConfig(id, updates);
    const updated = (await trackedMessageRepository.listAll()).find((m) => m.id === id);
    return res.json({ ok: true, tracked: true, message: updated });
  }),
);

/**
 * Stop tracking a message if the caller has edit or delete permission
 * and is allowed in the message's channel and guild.
 */
router.delete(
  "/messages/:id",
  attachUser,
  requireStaffPermission("edit"),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw ApiError.badRequest("`id` must be a positive integer");
    }

    const list = await trackedMessageRepository.listAll();
    const target = list.find((m) => m.id === id);
    if (!target) {
      throw ApiError.notFound("Tracked message record not found");
    }

    const staffCtx = req.staffContext;
    if (staffCtx && !staffCtx.isAdmin && staffCtx.record) {
      const allowedChannels = parseAllowedIds(staffCtx.record.allowed_channel_ids);
      if (!allowedChannels.includes("*") && !allowedChannels.includes(target.channel_id)) {
        throw ApiError.forbidden(`You are not allowed to access channel ${target.channel_id}`);
      }
      await assertStaffGuildAllowed(req, target.channel_id);
    }

    await trackedMessageRepository.deleteById(id);
    return res.json({ ok: true, deletedId: id });
  }),
);

export default router;