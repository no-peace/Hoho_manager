import { Router } from "express";
import { requireHeadAdmin } from "../middleware/auth.js";
import { env } from "../config/env.js";
import { staffRepository } from "../repositories/staffRepository.js";
import { settingsService } from "../services/settingsService.js";
import { auditLog } from "../services/auditLog.js";
import { getSessionUserFromRequest, revokeUserSessions } from "../utils/session.js";
import { ApiError, asyncHandler } from "../utils/errors.js";

const router = Router();

const parseGranular = (raw?: string | null): Record<string, number> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const formatStaffRecord = (r: import("../repositories/staffRepository.js").StaffRecord) => {
  const defaultAvatarIndex = (BigInt(r.discord_user_id || "0") >> 22n) % 6n;
  return {
    ...r,
    discord_avatar: r.discord_avatar ?? null,
    discord_global_name: r.discord_global_name ?? null,
    avatarUrl: r.discord_avatar
      ? `https://cdn.discordapp.com/avatars/${r.discord_user_id}/${r.discord_avatar}.png`
      : `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`,
    allowed_channel_ids: JSON.parse(r.allowed_channel_ids || "[]"),
    allowed_role_mention_ids: JSON.parse(r.allowed_role_mention_ids || "[]"),
    allowed_guild_ids: r.allowed_guild_ids ? JSON.parse(r.allowed_guild_ids) : ["*"],
    can_use_webhooks: r.can_use_webhooks ?? 1,
    can_override_profile: r.can_override_profile ?? 1,
    can_attach_files: r.can_attach_files ?? 1,
    can_use_components_v2: r.can_use_components_v2 ?? 1,
    can_use_weao_exploits: r.can_use_weao_exploits ?? 1,
    granular_cooldowns: parseGranular(r.granular_cooldowns),
    granular_rate_limits: parseGranular(r.granular_rate_limits),
  };
};

/** GET /api/access — list all staff records */
router.get(
  "/",
  requireHeadAdmin,
  asyncHandler(async (_req, res) => {
    const records = await staffRepository.findAll();
    return res.json(records.map(formatStaffRecord));
  }),
);

/** GET /api/access/:discordUserId — get one record */
router.get(
  "/:discordUserId",
  requireHeadAdmin,
  asyncHandler(async (req, res) => {
    const r = await staffRepository.findByDiscordId(req.params.discordUserId as string);
    if (!r) throw ApiError.notFound("Staff record not found");
    return res.json(formatStaffRecord(r));
  }),
);

/** POST /api/access — grant access to a Discord user */
router.post(
  "/",
  requireHeadAdmin,
  asyncHandler(async (req, res) => {
    const {
      discord_user_id,
      discord_username,
      discord_global_name,
      discord_avatar,
      granted_by_discord_id,
      is_active,
      expires_at,
      cooldown_seconds,
      can_send_messages,
      can_edit_messages,
      can_delete_messages,
      can_manage_templates,
      allowed_channel_ids,
      can_mention_everyone,
      can_mention_here,
      can_mention_roles,
      allowed_role_mention_ids,
      max_messages_per_hour,
      can_use_webhooks,
      can_override_profile,
      can_attach_files,
      can_use_components_v2,
      can_use_weao_exploits,
      allowed_guild_ids,
      granular_cooldowns,
      granular_rate_limits,
      notes,
    } = req.body;

    if (!discord_user_id || !/^\d{17,20}$/.test(discord_user_id)) {
      throw ApiError.badRequest("discord_user_id must be a valid Discord snowflake");
    }
    const existing = await staffRepository.findByDiscordId(discord_user_id as string);
    if (existing) {
      throw ApiError.badRequest("Staff record already exists for this user. Use PATCH to update.");
    }

    let resolvedAvatar = discord_avatar ?? null;
    let resolvedGlobalName = discord_global_name ?? null;

    if (!resolvedAvatar || !resolvedGlobalName) {
      try {
        const { resolveBotToken } = await import("../services/discordService.js");
        const token = await resolveBotToken();
        const userRes = await fetch(`https://discord.com/api/v10/users/${discord_user_id}`, {
          headers: { Authorization: `Bot ${token}` },
          signal: AbortSignal.timeout(5_000),
        });
        if (userRes.ok) {
          const userData = (await userRes.json()) as any;
          if (!resolvedAvatar && userData.avatar) resolvedAvatar = userData.avatar;
          if (!resolvedGlobalName && userData.global_name) resolvedGlobalName = userData.global_name;
        }
      } catch {
        // Non-blocking avatar lookup
      }
    }

    const record = await staffRepository.create({
      discord_user_id,
      discord_username: discord_username ?? discord_user_id,
      discord_global_name: resolvedGlobalName,
      discord_avatar: resolvedAvatar,
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
      can_use_webhooks: can_use_webhooks ?? 1,
      can_override_profile: can_override_profile ?? 1,
      can_attach_files: can_attach_files ?? 1,
      can_use_components_v2: can_use_components_v2 ?? 1,
      can_use_weao_exploits: can_use_weao_exploits ?? 1,
      allowed_guild_ids: JSON.stringify(allowed_guild_ids ?? ["*"]),
      granular_cooldowns:
        typeof granular_cooldowns === "string"
          ? granular_cooldowns
          : JSON.stringify(granular_cooldowns ?? {}),
      granular_rate_limits:
        typeof granular_rate_limits === "string"
          ? granular_rate_limits
          : JSON.stringify(granular_rate_limits ?? {}),
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
        expires_at,
      },
    });

    return res.status(201).json(formatStaffRecord(record));
  }),
);

/** PATCH /api/access/:discordUserId  update permissions */
router.patch(
  "/:discordUserId",
  requireHeadAdmin,
  asyncHandler(async (req, res) => {
    const targetDiscordId = req.params.discordUserId as string;
    const existing = await staffRepository.findByDiscordId(targetDiscordId);
    if (!existing) throw ApiError.notFound("Staff record not found");

    const updateData: Record<string, unknown> = {};
    const allowed = [
      "discord_username",
      "discord_global_name",
      "discord_avatar",
      "is_active",
      "expires_at",
      "cooldown_seconds",
      "can_send_messages",
      "can_edit_messages",
      "can_delete_messages",
      "can_manage_templates",
      "can_mention_everyone",
      "can_mention_here",
      "can_mention_roles",
      "max_messages_per_hour",
      "can_use_webhooks",
      "can_override_profile",
      "can_attach_files",
      "can_use_components_v2",
      "can_use_weao_exploits",
      "notes",
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }
    if (req.body.allowed_channel_ids !== undefined) {
      updateData.allowed_channel_ids = JSON.stringify(req.body.allowed_channel_ids);
    }
    if (req.body.allowed_role_mention_ids !== undefined) {
      updateData.allowed_role_mention_ids = JSON.stringify(req.body.allowed_role_mention_ids);
    }
    if (req.body.allowed_guild_ids !== undefined) {
      updateData.allowed_guild_ids = JSON.stringify(req.body.allowed_guild_ids);
    }
    if (req.body.granular_cooldowns !== undefined) {
      updateData.granular_cooldowns =
        typeof req.body.granular_cooldowns === "string"
          ? req.body.granular_cooldowns
          : JSON.stringify(req.body.granular_cooldowns);
    }
    if (req.body.granular_rate_limits !== undefined) {
      updateData.granular_rate_limits =
        typeof req.body.granular_rate_limits === "string"
          ? req.body.granular_rate_limits
          : JSON.stringify(req.body.granular_rate_limits);
    }

    const updated = await staffRepository.update(targetDiscordId, updateData as any);

    // If staff member was deactivated, immediately kill their active OAuth session
    if (updateData.is_active === 0 || updateData.is_active === false) {
      await revokeUserSessions(targetDiscordId);
    }

    auditLog({
      event: "STAFF_UPDATED",
      targetDiscordId,
      reason: "Permissions updated by admin",
      ip: req.ip as string,
      details: Object.fromEntries(
        Object.entries(updateData).map(([k, v]) => [k, String(v)]),
      ) as Record<string, string>,
    });

    return res.json(updated ? formatStaffRecord(updated) : undefined);
  }),
);

/** DELETE /api/access/:discordUserId  revoke access and invalidate active session */
router.delete(
  "/:discordUserId",
  requireHeadAdmin,
  asyncHandler(async (req, res) => {
    const targetDiscordId = req.params.discordUserId as string;
    const existing = await staffRepository.findByDiscordId(targetDiscordId);
    if (!existing) throw ApiError.notFound("Staff record not found");

    await staffRepository.delete(targetDiscordId);
    // Immediately invalidate any existing JWT session for this revoked staff member
    await revokeUserSessions(targetDiscordId);

    auditLog({
      event: "STAFF_REVOKED",
      targetDiscordId,
      reason: "Access fully revoked by admin (session invalidated)",
      ip: req.ip as string,
      details: { username: existing.discord_username },
    });

    return res.json({ ok: true });
  }),
);

/** GET /api/access/:discordUserId/check  staff self-check endpoint */
router.get(
  "/:discordUserId/check",
  asyncHandler(async (req, res) => {
    const staffId = req.params.discordUserId as string;

    if (env.isProd) {
      const sessionUser = await getSessionUserFromRequest(req);
      const adminKey = req.get("x-admin-key");
      const isAuthorizedCaller =
        (adminKey && adminKey === env.adminApiKey) ||
        (sessionUser &&
          (sessionUser.id === staffId ||
            env.ownerDiscordIds.includes(sessionUser.id) ||
            (await settingsService.isHeadAdmin(sessionUser.id))));
      if (!isAuthorizedCaller) {
        throw ApiError.unauthorized("Authentication required to check staff access");
      }
    }

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
  }),
);

export default router;