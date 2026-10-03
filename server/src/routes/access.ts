import { Router } from "express";
import { requireHeadAdmin } from "../middleware/auth.js";
import { staffRepository } from "../repositories/staffRepository.js";
import { auditLog } from "../services/auditLog.js";
import { ApiError, asyncHandler } from "../utils/errors.js";

const router = Router();

// All management /api/access routes require Head Admin — master key or Head Admin staff

const parseGranular = (raw?: string | null): Record<string, number> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

/** GET /api/access — list all staff records */
router.get("/", requireHeadAdmin, asyncHandler(async (_req, res) => {
  const records = await staffRepository.findAll();
  return res.json(records.map(r => ({
    ...r,
    allowed_channel_ids: JSON.parse(r.allowed_channel_ids),
    allowed_role_mention_ids: JSON.parse(r.allowed_role_mention_ids),
    granular_cooldowns: parseGranular(r.granular_cooldowns),
    granular_rate_limits: parseGranular(r.granular_rate_limits),
  })));
}));

/** GET /api/access/:discordUserId — get one record */
router.get("/:discordUserId", requireHeadAdmin, asyncHandler(async (req, res) => {
  const r = await staffRepository.findByDiscordId(req.params.discordUserId as string);
  if (!r) throw ApiError.notFound("Staff record not found");
  return res.json({
    ...r,
    allowed_channel_ids: JSON.parse(r.allowed_channel_ids),
    allowed_role_mention_ids: JSON.parse(r.allowed_role_mention_ids),
    granular_cooldowns: parseGranular(r.granular_cooldowns),
    granular_rate_limits: parseGranular(r.granular_rate_limits),
  });
}));

/** POST /api/access — grant access to a Discord user */
router.post("/", requireHeadAdmin, asyncHandler(async (req, res) => {
  const {
    discord_user_id, discord_username, granted_by_discord_id,
    is_active, expires_at, cooldown_seconds,
    can_send_messages, can_edit_messages, can_delete_messages, can_manage_templates,
    allowed_channel_ids, can_mention_everyone, can_mention_here,
    can_mention_roles, allowed_role_mention_ids, max_messages_per_hour,
    granular_cooldowns, granular_rate_limits, notes,
  } = req.body;

  if (!discord_user_id || !/^\d{17,20}$/.test(discord_user_id)) {
    throw ApiError.badRequest("discord_user_id must be a valid Discord snowflake");
  }
  const existing = await staffRepository.findByDiscordId(discord_user_id as string);
  if (existing) {
    throw ApiError.badRequest("Staff record already exists for this user. Use PATCH to update.");
  }

  const record = await staffRepository.create({
    discord_user_id,
    discord_username: discord_username ?? discord_user_id,
    granted_by_discord_id: granted_by_discord_id ?? "admin",
    is_active: is_active ?? 1,
    expires_at: expires_at ?? null,
    cooldown_seconds: cooldown_seconds ?? 30,
    can_send_messages: can_send_messages ?? 1,
    can_edit_messages: can_edit_messages ?? 0,
    can_delete_messages: can_delete_messages ?? 0,
    can_manage_templates: can_manage_templates ?? 0,
    allowed_channel_ids: JSON.stringify(allowed_channel_ids ?? []),
    can_mention_everyone: can_mention_everyone ?? 0,
    can_mention_here: can_mention_here ?? 0,
    can_mention_roles: can_mention_roles ?? 0,
    allowed_role_mention_ids: JSON.stringify(allowed_role_mention_ids ?? []),
    max_messages_per_hour: max_messages_per_hour ?? 10,
    granular_cooldowns: typeof granular_cooldowns === "string" ? granular_cooldowns : JSON.stringify(granular_cooldowns ?? {}),
    granular_rate_limits: typeof granular_rate_limits === "string" ? granular_rate_limits : JSON.stringify(granular_rate_limits ?? {}),
    notes: notes ?? null,
  });

  auditLog({
    event: "STAFF_GRANTED",
    actorDiscordId: granted_by_discord_id ?? "admin",
    targetDiscordId: discord_user_id,
    reason: notes ?? "Access granted via admin panel",
    ip: req.ip as string,
    details: {
      username: discord_username,
      can_send: can_send_messages ?? 1,
      can_edit: can_edit_messages ?? 0,
      cooldown: cooldown_seconds ?? 30,
      expires_at: expires_at,
    },
  });

  return res.status(201).json({
    ...record,
    allowed_channel_ids: JSON.parse(record.allowed_channel_ids),
    allowed_role_mention_ids: JSON.parse(record.allowed_role_mention_ids),
    granular_cooldowns: parseGranular(record.granular_cooldowns),
    granular_rate_limits: parseGranular(record.granular_rate_limits),
  });
}));

/** PATCH /api/access/:discordUserId — update permissions */
router.patch("/:discordUserId", requireHeadAdmin, asyncHandler(async (req, res) => {
  const existing = await staffRepository.findByDiscordId(req.params.discordUserId as string);
  if (!existing) throw ApiError.notFound("Staff record not found");

  const updateData: Record<string, unknown> = {};
  const allowed = [
    "discord_username", "is_active", "expires_at", "cooldown_seconds",
    "can_send_messages", "can_edit_messages", "can_delete_messages", "can_manage_templates",
    "can_mention_everyone", "can_mention_here", "can_mention_roles",
    "max_messages_per_hour", "notes",
  ];
  for (const key of allowed) {
    if (req.body[key] !== undefined) updateData[key] = req.body[key];
  }
  // Serialize arrays and objects
  if (req.body.allowed_channel_ids !== undefined) {
    updateData.allowed_channel_ids = JSON.stringify(req.body.allowed_channel_ids);
  }
  if (req.body.allowed_role_mention_ids !== undefined) {
    updateData.allowed_role_mention_ids = JSON.stringify(req.body.allowed_role_mention_ids);
  }
  if (req.body.granular_cooldowns !== undefined) {
    updateData.granular_cooldowns = typeof req.body.granular_cooldowns === "string"
      ? req.body.granular_cooldowns
      : JSON.stringify(req.body.granular_cooldowns);
  }
  if (req.body.granular_rate_limits !== undefined) {
    updateData.granular_rate_limits = typeof req.body.granular_rate_limits === "string"
      ? req.body.granular_rate_limits
      : JSON.stringify(req.body.granular_rate_limits);
  }

  const updated = await staffRepository.update(req.params.discordUserId as string, updateData as any);

  auditLog({
    event: "STAFF_UPDATED",
    targetDiscordId: req.params.discordUserId as string,
    reason: `Permissions updated by admin`,
    ip: req.ip as string,
    details: Object.fromEntries(
      Object.entries(updateData).map(([k, v]) => [k, String(v)])
    ) as Record<string, string>,
  });

  return res.json(updated ? {
    ...updated,
    allowed_channel_ids: JSON.parse(updated.allowed_channel_ids),
    allowed_role_mention_ids: JSON.parse(updated.allowed_role_mention_ids),
    granular_cooldowns: parseGranular(updated.granular_cooldowns),
    granular_rate_limits: parseGranular(updated.granular_rate_limits),
  } : undefined);
}));

/** DELETE /api/access/:discordUserId — revoke access */
router.delete("/:discordUserId", requireHeadAdmin, asyncHandler(async (req, res) => {
  const existing = await staffRepository.findByDiscordId(req.params.discordUserId as string);
  if (!existing) throw ApiError.notFound("Staff record not found");

  await staffRepository.delete(req.params.discordUserId as string);

  auditLog({
    event: "STAFF_REVOKED",
    targetDiscordId: req.params.discordUserId as string,
    reason: `Access fully revoked by admin`,
    ip: req.ip as string,
    details: { username: existing.discord_username },
  });

  return res.json({ ok: true });
}));

/** GET /api/access/:discordUserId/check — staff self-check endpoint */
router.get("/:discordUserId/check", asyncHandler(async (req, res) => {
  const staffId = req.params.discordUserId as string;
  const record = await staffRepository.findByDiscordId(staffId);
  if (!record || !record.is_active) return res.json({ hasAccess: false });

  if (record.expires_at) {
    const expiry = new Date(record.expires_at);
    if (expiry < new Date()) return res.json({ hasAccess: false, reason: "expired" });
  }

  return res.json({
    hasAccess: true,
    permissions: {
      can_send_messages: record.can_send_messages === 1,
      can_edit_messages: record.can_edit_messages === 1,
      can_delete_messages: record.can_delete_messages === 1,
      can_manage_templates: record.can_manage_templates === 1,
      allowed_channel_ids: JSON.parse(record.allowed_channel_ids),
      can_mention_everyone: record.can_mention_everyone === 1,
      can_mention_here: record.can_mention_here === 1,
      can_mention_roles: record.can_mention_roles === 1,
      allowed_role_mention_ids: JSON.parse(record.allowed_role_mention_ids),
      cooldown_seconds: record.cooldown_seconds,
      max_messages_per_hour: record.max_messages_per_hour,
      granular_cooldowns: parseGranular(record.granular_cooldowns),
      granular_rate_limits: parseGranular(record.granular_rate_limits),
      expires_at: record.expires_at,
    },
  });
}));

export default router;

