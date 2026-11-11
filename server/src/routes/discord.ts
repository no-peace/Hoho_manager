import crypto from "node:crypto";
import { Router } from "express";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { staffRepository } from "../repositories/staffRepository.js";
import { auditLogRepository } from "../repositories/auditLogRepository.js";
import { sessionRepository } from "../repositories/sessionRepository.js";
import { getSessionUserFromRequest } from "../utils/session.js";
import { settingsService } from "../services/settingsService.js";
import * as discord from "../services/discordService.js";
import { ApiError, asyncHandler } from "../utils/errors.js";

const router = Router();

const safeEqual = (a: unknown, b: unknown): boolean => {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

const parseProfileId = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "" || value === "null") return null;
  const num = Number(value);
  if (!Number.isSafeInteger(num) || num <= 0) return null;
  return num;
};

/**
 * Access control for Discord entity endpoints. Custom bot profiles do not grant
 * access; callers must use the configured server bot and normal staff access.
*/
const requireStaffOrAdmin: RequestHandler = asyncHandler(async (req, _res, next) => {
  const adminKey = req.get("x-admin-key");
  if (adminKey && safeEqual(adminKey, env.adminApiKey)) {
    req.staffContext = { isAdmin: true, staffId: null };
    return next();
  }

  const sessionUser = getSessionUserFromRequest(req);
  const headerStaffId = req.get("x-staff-id");

  if (sessionUser && headerStaffId && headerStaffId !== sessionUser.id) {
    return next(ApiError.forbidden("Provided x-staff-id does not match the authenticated session user ID"));
  }

  if (env.isProd && !sessionUser) {
    return next(ApiError.unauthorized("Please log in with Discord (24h session required)"));
  }

  const staffId = sessionUser ? sessionUser.id : headerStaffId;

  if (sessionUser) {
    const isLiveHeadAdmin =
      env.ownerDiscordIds.includes(sessionUser.id) ||
      (await settingsService.isHeadAdmin(sessionUser.id)) ||
      (!env.isProd && sessionUser.role === "admin");
    if (isLiveHeadAdmin) {
      req.staffContext = { isAdmin: true, staffId: sessionUser.id };
      return next();
    }
  }

  if (staffId && /^\d{17,20}$/.test(staffId)) {
    if (!env.isProd && ((await settingsService.isHeadAdmin(staffId)) || env.ownerDiscordIds.includes(staffId))) {
      req.staffContext = { isAdmin: true, staffId };
      return next();
    }

    const staff = await staffRepository.findByDiscordId(staffId);
    if (staff && staff.is_active) {
      if (!staff.expires_at || new Date(staff.expires_at) >= new Date()) {
        req.staffContext = { isAdmin: false, staffId, record: staff };
        return next();
      }
    }
  }

  return next(ApiError.unauthorized("Authentication required (admin key or active staff ID)"));
});

const requireAllowedGuild: RequestHandler = (req, _res, next) => {
  const guildId = req.params.guildId;
  const staffCtx = req.staffContext;
  if (!guildId || staffCtx?.isAdmin || !staffCtx?.record) return next();

  let allowedGuilds: string[] = [];
  try {
    const parsed = JSON.parse(staffCtx.record.allowed_guild_ids || "[]");
    if (Array.isArray(parsed)) allowedGuilds = parsed.map(String);
  } catch {
    // Invalid allowlist data must fail closed.
  }

  if (allowedGuilds.includes("*") || (typeof guildId === "string" && allowedGuilds.includes(guildId))) return next();
  return next(ApiError.forbidden(`You are not allowed to access guild ${guildId}`));
};

router.get("/guilds", requireStaffOrAdmin, asyncHandler(async (req, res) => {
  const profileId = parseProfileId(req.query.profileId);
  let guilds = await discord.getBotGuilds(profileId);
  const staffCtx = req.staffContext;
  if (staffCtx && !staffCtx.isAdmin && staffCtx.record) {
    let allowedGuilds: string[] = [];
    try {
      const parsed = JSON.parse(staffCtx.record.allowed_guild_ids || "[]");
      if (Array.isArray(parsed)) allowedGuilds = parsed.map(String);
    } catch {
      // Invalid allowlist data must fail closed.
    }
    if (!allowedGuilds.includes("*")) {
      guilds = guilds.filter((g) => allowedGuilds.includes(g.id));
    }
  }
  return res.json({ guilds });
}));

router.get("/guilds/:guildId/channels", requireStaffOrAdmin, requireAllowedGuild, asyncHandler(async (req, res) => {
  const { guildId } = req.params;
  if (!guildId || typeof guildId !== "string") {
    throw ApiError.badRequest("`guildId` is required");
  }

  const profileId = parseProfileId(req.query.profileId);
  let channels = await discord.getGuildChannels(guildId, profileId);

  const staffCtx = req.staffContext;
  if (staffCtx && !staffCtx.isAdmin && staffCtx.record) {
    let allowed: string[] = [];
    try {
      allowed = JSON.parse(staffCtx.record.allowed_channel_ids);
    } catch {
      allowed = [];
    }

    const allAllowed = allowed.includes("*");
    if (!allAllowed) {
      channels = channels.filter((c) => allowed.includes(c.id));
    }
  }

  return res.json({ channels });
}));

router.get("/guilds/:guildId/roles", requireStaffOrAdmin,requireAllowedGuild, asyncHandler(async (req, res) => {
  const { guildId } = req.params;
  if (!guildId || typeof guildId !== "string") {
    throw ApiError.badRequest("`guildId` is required");
  }

  const profileId = parseProfileId(req.query.profileId);
  const roles = await discord.getGuildRoles(guildId, profileId);
  return res.json({ roles });
}));

router.get("/guilds/:guildId/members/search", requireStaffOrAdmin, requireAllowedGuild, asyncHandler(async (req, res) => {
  const { guildId } = req.params;
  if (!guildId || typeof guildId !== "string") {
    throw ApiError.badRequest("`guildId` is required");
  }

  const query = typeof req.query.query === "string"
    ? req.query.query
    : typeof req.query.q === "string"
    ? req.query.q
    : "";

  const profileId = parseProfileId(req.query.profileId);
  const members = await discord.searchGuildMembers(guildId, query, profileId);
  return res.json({ members });
}));

router.get("/guilds/:guildId/emojis", requireStaffOrAdmin, requireAllowedGuild, asyncHandler(async (req, res) => {
  const { guildId } = req.params;
  if (!guildId || typeof guildId !== "string") {
    throw ApiError.badRequest("`guildId` is required");
  }

  const profileId = parseProfileId(req.query.profileId);
  const emojis = await discord.getGuildEmojis(guildId, profileId);
  return res.json({ emojis });
}));

router.get("/identity", requireStaffOrAdmin, asyncHandler(async (req, res) => {
  const profileId = parseProfileId(req.query.profileId);
  const token = await discord.resolveBotToken(profileId);
  const data = await discord.getBotIdentity(token);
  if (!data || !data.id) return res.json(null);

  return res.json({
    id: data.id,
    username: data.username,
    avatar: data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png` : null,
  });
}));

const getAuditLogsHandler: RequestHandler = asyncHandler(async (req, res) => {
  const { guildId } = req.params;
  if (!guildId || typeof guildId !== "string") {
    throw ApiError.badRequest("`guildId` is required");
  }

  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const page = req.query.page ? Number(req.query.page) : 0;
  const action = typeof req.query.action === "string" ? req.query.action : undefined;
  const channelId = typeof req.query.channelId === "string" ? req.query.channelId : undefined;
  const webhookId = typeof req.query.webhookId === "string" ? req.query.webhookId : undefined;
  const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;

  const result = await auditLogRepository.findMany({
    guildId,
    limit,
    page,
    action,
    channelId,
    webhookId,
    userId,
  });

  return res.json({
    entries: result.entries,
    webhooks: [],
    query: result.query,
    total: result.total,
  });
});

router.get("/guilds/:guildId/audit-logs", requireStaffOrAdmin, requireAllowedGuild, getAuditLogsHandler);
router.get("/guilds/:guildId/log", requireStaffOrAdmin, requireAllowedGuild, getAuditLogsHandler);

router.post("/guilds/:guildId/audit-logs", requireStaffOrAdmin, requireAllowedGuild, asyncHandler(async (req, res) => {
  const { guildId } = req.params;
  if (!guildId || typeof guildId !== "string") {
    throw ApiError.badRequest("`guildId` is required");
  }

  const { channelId, messageId, webhookId, threadId, userId, userName, userAvatar, type, reason, details } = req.body;
  if (!type || typeof type !== "string") {
    throw ApiError.badRequest("`type` is required");
  }

  const entry = await auditLogRepository.create({
    guildId,
    channelId,
    messageId,
    webhookId,
    threadId,
    userId: userId || req.staffContext?.staffId || undefined,
    userName,
    userAvatar,
    type,
    reason,
    details,
  });

  return res.status(201).json({ ok: true, entry });
}));

router.get("/guilds/:guildId/sessions", requireStaffOrAdmin, requireAllowedGuild, asyncHandler(async (req, res) => {
  const { guildId } = req.params;
  if (!guildId || typeof guildId !== "string") {
    throw ApiError.badRequest("`guildId` is required");
  }

  const channelId = typeof req.query.channelId === "string" ? req.query.channelId : undefined;
  const cursor = req.query.cursor ? Number(req.query.cursor) : 0;
  const currentUserId = req.staffContext?.staffId || undefined;

  const result = await sessionRepository.findActive({
    guildId,
    channelId,
    cursor,
    currentUserId,
  });

  return res.json(result);
}));

router.post("/guilds/:guildId/sessions", requireStaffOrAdmin, requireAllowedGuild, asyncHandler(async (req, res) => {
  const { guildId } = req.params;
  if (!guildId || typeof guildId !== "string") {
    throw ApiError.badRequest("`guildId` is required");
  }

  const { id, userId, permissions, channelId, expiresAt } = req.body;
  const sessionUser = userId || req.staffContext?.staffId || "900000000000000001";

  const session = await sessionRepository.create({
    id,
    guildId,
    userId: sessionUser,
    permissions,
    channelId,
    expiresAt,
    callerId: req.staffContext?.staffId ?? undefined,
  });

  return res.status(201).json({ ok: true, session });
}));

router.delete("/guilds/:guildId/sessions", requireStaffOrAdmin, requireAllowedGuild, asyncHandler(async (req, res) => {
  const { guildId } = req.params;
  if (!guildId || typeof guildId !== "string") {
    throw ApiError.badRequest("`guildId` is required");
  }

  let tokenIds: string[] = [];
  if (typeof req.query.id === "string") {
    tokenIds = [req.query.id];
  } else if (Array.isArray(req.query.id)) {
    tokenIds = req.query.id.map(String);
  } else if (Array.isArray(req.body?.tokenIds)) {
    tokenIds = req.body.tokenIds.map(String);
  } else if (typeof req.body?.id === "string") {
    tokenIds = [req.body.id];
  }

  if (tokenIds.length === 0) {
    throw ApiError.badRequest("No session id(s) provided to revoke");
  }

  const revokedCount = await sessionRepository.revoke(guildId, tokenIds);
  return res.json({ ok: true, revoked: revokedCount });
}));

router.delete("/guilds/:guildId/sessions/:tokenId", requireStaffOrAdmin, requireAllowedGuild, asyncHandler(async (req, res) => {
  const { guildId, tokenId } = req.params;
  if (!guildId || typeof guildId !== "string" || !tokenId || typeof tokenId !== "string") {
    throw ApiError.badRequest("`guildId` and `tokenId` are required");
  }

  const revokedCount = await sessionRepository.revoke(guildId, [tokenId]);
  return res.json({ ok: true, revoked: revokedCount });
}));

export default router;