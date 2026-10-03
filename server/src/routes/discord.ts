import crypto from "node:crypto";
import { Router } from "express";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { staffRepository } from "../repositories/staffRepository.js";
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
 * Access control for Discord entity endpoints:
 * Allows master admin key, Head Admin staff, or any active staff member.
 */
const requireStaffOrAdmin: RequestHandler = asyncHandler(async (req, _res, next) => {
  const adminKey = req.get("x-admin-key");
  if (adminKey && safeEqual(adminKey, env.adminApiKey)) {
    req.staffContext = { isAdmin: true, staffId: null };
    return next();
  }

  const staffId = req.get("x-staff-id");
  if (staffId && /^\d{17,20}$/.test(staffId)) {
    if (await settingsService.isHeadAdmin(staffId)) {
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

/**
 * GET /api/discord/guilds
 * Returns list of available guilds the bot is in.
 * Zero server-side caching.
 */
router.get("/guilds", requireStaffOrAdmin, asyncHandler(async (req, res) => {
  const profileId = parseProfileId(req.query.profileId);
  const guilds = await discord.getBotGuilds(profileId);
  return res.json({ guilds });
}));

/**
 * GET /api/discord/guilds/:guildId/channels
 * Returns channels for the specified guild.
 * If caller is a staff member (not admin), applies channel allowlist with default-deny.
 * Zero server-side caching.
 */
router.get("/guilds/:guildId/channels", requireStaffOrAdmin, asyncHandler(async (req, res) => {
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

/**
 * GET /api/discord/guilds/:guildId/roles
 * Returns roles for the specified guild.
 * Zero server-side caching.
 */
router.get("/guilds/:guildId/roles", requireStaffOrAdmin, asyncHandler(async (req, res) => {
  const { guildId } = req.params;
  if (!guildId || typeof guildId !== "string") {
    throw ApiError.badRequest("`guildId` is required");
  }

  const profileId = parseProfileId(req.query.profileId);
  const roles = await discord.getGuildRoles(guildId, profileId);
  return res.json({ roles });
}));

/**
 * GET /api/discord/guilds/:guildId/members/search?query=:q
 * Search members by username or nickname.
 * Zero server-side caching.
 */
router.get("/guilds/:guildId/members/search", requireStaffOrAdmin, asyncHandler(async (req, res) => {
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

/**
 * GET /api/discord/identity
 * Auto-fetch bot identity on client load.
 */
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

export default router;
