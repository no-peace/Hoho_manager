import { Router } from "express";
import { requireHeadAdmin } from "../middleware/auth.js";
import { settingsService } from "../services/settingsService.js";
import { auditLog } from "../services/auditLog.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { env } from "../config/env.js";

const router = Router();

/**
 * GET /api/settings/auth
 * Check if the caller has Head Admin access without throwing 403.
 * Used by UI to determine whether to render Settings navigation.
 */
router.get("/auth", asyncHandler(async (req, res) => {
  const adminKey = req.get("x-admin-key");
  const isAdminKey = !!adminKey && adminKey === env.adminApiKey;

  const staffId = req.get("x-staff-id");
  let isHeadAdminUser = false;
  if (staffId && /^\d{17,20}$/.test(staffId)) {
    isHeadAdminUser = await settingsService.isHeadAdmin(staffId);
  }

  const isHeadAdmin = isAdminKey || isHeadAdminUser;
  return res.json({ isHeadAdmin, isAdminKey });
}));

/**
 * GET /api/settings
 * Fetch settings for a given guild (or __global__ by default).
 * Guarded by requireHeadAdmin.
 */
router.get("/", requireHeadAdmin, asyncHandler(async (req, res) => {
  const guildId = typeof req.query.guildId === "string" && req.query.guildId.trim()
    ? req.query.guildId.trim()
    : undefined;

  const settings = await settingsService.getSettings(guildId);
  return res.json({
    guild_id: settings.guild_id,
    log_channel_id: settings.log_channel_id,
    head_admin_ids: settings.head_admin_ids,
    bot_profile_id: settings.bot_profile_id,
    extra_settings: settings.extra_settings,
    is_head_admin: true,
    created_at: settings.created_at,
    updated_at: settings.updated_at,
  });
}));

/**
 * PUT /api/settings & PATCH /api/settings
 * Update settings for a guild or globally.
 * Guarded by requireHeadAdmin.
 */
const handleUpdate = asyncHandler(async (req, res) => {
  const { guildId, log_channel_id, head_admin_ids, bot_profile_id, extra_settings } = req.body ?? {};

  const targetGuildId = typeof guildId === "string" && guildId.trim()
    ? guildId.trim()
    : typeof req.query.guildId === "string" && req.query.guildId.trim()
    ? req.query.guildId.trim()
    : "__global__";

  // Validate inputs
  if (log_channel_id !== undefined && log_channel_id !== null && typeof log_channel_id !== "string") {
    throw ApiError.badRequest("`log_channel_id` must be a string or null");
  }

  if (head_admin_ids !== undefined) {
    if (!Array.isArray(head_admin_ids)) {
      throw ApiError.badRequest("`head_admin_ids` must be an array of snowflake IDs");
    }
    for (const id of head_admin_ids) {
      if (typeof id !== "string") {
        throw ApiError.badRequest("Each head_admin_id must be a string snowflake");
      }
    }
  }

  if (bot_profile_id !== undefined && bot_profile_id !== null && typeof bot_profile_id !== "string") {
    throw ApiError.badRequest("`bot_profile_id` must be a string or null");
  }

  if (extra_settings !== undefined && (typeof extra_settings !== "object" || extra_settings === null || Array.isArray(extra_settings))) {
    throw ApiError.badRequest("`extra_settings` must be a JSON object");
  }

  const updated = await settingsService.updateSettings(targetGuildId, {
    guildId: targetGuildId,
    log_channel_id: log_channel_id ?? (log_channel_id === null ? null : undefined),
    head_admin_ids,
    bot_profile_id: bot_profile_id ?? (bot_profile_id === null ? null : undefined),
    extra_settings,
  });

  const staffCtx = req.staffContext;
  auditLog({
    event: "STAFF_UPDATED",
    guildId: targetGuildId,
    actorDiscordId: staffCtx?.staffId ?? undefined,
    reason: `Updated settings for ${targetGuildId}`,
    ip: req.ip,
  });

  return res.json({
    ok: true,
    guild_id: updated.guild_id,
    log_channel_id: updated.log_channel_id,
    head_admin_ids: updated.head_admin_ids,
    bot_profile_id: updated.bot_profile_id,
    extra_settings: updated.extra_settings,
    is_head_admin: true,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
    settings: updated,
  });
});

router.put("/", requireHeadAdmin, handleUpdate);
router.patch("/", requireHeadAdmin, handleUpdate);

export default router;
