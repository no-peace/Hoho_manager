import crypto from "node:crypto";
import type { Request, RequestHandler } from "express";
import { env } from "../config/env.js";
import { staffRepository } from "../repositories/staffRepository.js";
import { settingsService } from "../services/settingsService.js";
import { auditLog } from "../services/auditLog.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { getSessionUserFromRequest } from "../utils/session.js";

const log = logger.child("staffPermissions");

type StaffAction = "send" | "edit" | "delete" | "templates";

const ACTION_COLUMN: Record<StaffAction, keyof import("../repositories/staffRepository.js").StaffRecord> = {
  send: "can_send_messages",
  edit: "can_edit_messages",
  delete: "can_delete_messages",
  templates: "can_manage_templates",
};

const safeEqual = (a: unknown, b: unknown): boolean => {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

const isAdmin = (req: Request): boolean => {
  const provided = req.get("x-admin-key");
  return !!provided && safeEqual(provided, env.adminApiKey);
};

export const requireStaffPermission = (action: StaffAction): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    const requestId = crypto.randomUUID().slice(0, 8);
    const ip = req.ip ?? req.socket.remoteAddress ?? "?";

    const sessionUser = getSessionUserFromRequest(req);
    const headerStaffId = req.get("x-staff-id");

    // 1. Anti-spoofing: if session is present and client sent mismatched x-staff-id, reject immediately
    if (sessionUser && headerStaffId && headerStaffId !== sessionUser.id) {
      auditLog({
        event: "STAFF_ACCESS_DENIED",
        actorDiscordId: sessionUser.id,
        reason: `Spoofing attempt: claimed ${headerStaffId} but authenticated as ${sessionUser.id}`,
        ip,
        requestId,
      });
      return next(ApiError.forbidden("Provided x-staff-id does not match authenticated user session"));
    }

    // 2. Machine-to-machine Admin Key fast-path
    if (isAdmin(req)) {
      req.staffContext = { isAdmin: true, staffId: null };
      return next();
    }

    // 3. In production, never trust a raw x-staff-id header without a verified OAuth session
    if (env.isProd && !sessionUser) {
      return next(ApiError.unauthorized("Please log in with Discord (24h session required)"));
    }

    const staffId = sessionUser ? sessionUser.id : headerStaffId;

    // 4. Head Admin / Instance Owner fast-path (always checked live against DB/env in production)
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

    if (!env.isProd && staffId && /^\d{17,20}$/.test(staffId) && (await settingsService.isHeadAdmin(staffId))) {
      req.staffContext = { isAdmin: true, staffId };
      return next();
    }

    // 5. Standard Staff Access table check for the Server Default Bot (NEVER fail open!)
    if (!staffId || !/^\d{17,20}$/.test(staffId)) {
      auditLog({
        event: "STAFF_ACCESS_DENIED",
        reason: "Missing or invalid x-staff-id header",
        ip,
        requestId,
      });
      return next(ApiError.unauthorized("x-staff-id header or OAuth login required for staff access"));
    }

    // In production, non-admin staff MUST also share at least 1 mutual server with the default bot
    if (env.isProd && sessionUser && Array.isArray(sessionUser.mutualGuilds) && sessionUser.mutualGuilds.length === 0) {
      auditLog({
        event: "STAFF_ACCESS_DENIED",
        actorDiscordId: staffId,
        reason: "No mutual server with default bot",
        ip,
        requestId,
      });
      return next(
        ApiError.forbidden(
          "You do not share a common server with the configured bot. Ask a Head Admin to review your access.",
        ),
      );
    }

    // CRITICAL: Always require a live, active row in staff_access. Never trust sessionUser.hasDefaultBotAccess!
    const record = await staffRepository.findByDiscordId(staffId);
    if (!record) {
      auditLog({
        event: "STAFF_ACCESS_DENIED",
        actorDiscordId: staffId,
        reason: "No staff record found (revoked or never granted)",
        ip,
        requestId,
      });
      return next(
        ApiError.forbidden(
          "You do not have staff access to the configured bot. Ask a Head Admin to grant staff access.",
        ),
      );
    }

    if (!record.is_active) {
      auditLog({
        event: "STAFF_ACCESS_DENIED",
        actorDiscordId: staffId,
        actorUsername: record.discord_username,
        reason: "Staff access is disabled",
        ip,
        requestId,
      });
      return next(ApiError.forbidden("Your staff access has been disabled"));
    }

    if (record.expires_at) {
      const expiry = new Date(record.expires_at);
      if (isNaN(expiry.getTime()) || expiry < new Date()) {
        auditLog({
          event: "STAFF_ACCESS_DENIED",
          actorDiscordId: staffId,
          actorUsername: record.discord_username,
          reason: `Access expired at ${record.expires_at}`,
          ip,
          requestId,
        });
        return next(ApiError.forbidden("Your staff access has expired"));
      }
    }

    const col = ACTION_COLUMN[action];
    if (!record[col]) {
      auditLog({
        event: "PERMISSION_DENIED",
        actorDiscordId: staffId,
        actorUsername: record.discord_username,
        reason: `Missing permission: ${action}`,
        ip,
        requestId,
      });
      return next(ApiError.forbidden(`You do not have permission to perform: ${action}`));
    }

    if (action === "send" || action === "edit" || action === "delete") {
      const channelId: string | undefined =
        req.body?.channelId ?? req.params?.channelId ?? (req.query?.channelId as string);
      if (channelId) {
        let allowed: string[];
        try {
          allowed = JSON.parse(record.allowed_channel_ids);
        } catch {
          allowed = [];
        }
        const allAllowed = allowed.includes("*");
        if (!allAllowed && (allowed.length === 0 || !allowed.includes(channelId))) {
          auditLog({
            event: "CHANNEL_DENIED",
            actorDiscordId: staffId,
            actorUsername: record.discord_username,
            channelId,
            reason: `Channel ${channelId} not in staff allowlist`,
            ip,
            requestId,
          });
          return next(ApiError.forbidden(`You are not allowed to send to channel ${channelId}`));
        }
      }
    }

    if (req.method !== "GET") {
      let granularCooldowns: Record<string, number> = {};
      if (record.granular_cooldowns) {
        try {
          granularCooldowns = JSON.parse(record.granular_cooldowns);
        } catch {
          granularCooldowns = {};
        }
      }
      const effectiveCooldown =
        typeof granularCooldowns[action] === "number"
          ? granularCooldowns[action]
          : record.cooldown_seconds;

      if (effectiveCooldown > 0) {
        const cooldown = await staffRepository.getCooldown(staffId, action);
        if (cooldown) {
          const elapsed = (Date.now() - new Date(cooldown.last_at).getTime()) / 1000;
          if (elapsed < effectiveCooldown) {
            const remaining = Math.ceil(effectiveCooldown - elapsed);
            auditLog({
              event: "COOLDOWN_HIT",
              actorDiscordId: staffId,
              actorUsername: record.discord_username,
              reason: `Cooldown: ${remaining}s remaining`,
              ip,
              requestId,
            });
            return next(ApiError.tooManyRequests(`Cooldown active. Wait ${remaining}s before performing: ${action}`));
          }
        }
      }

      let granularRateLimits: Record<string, number> = {};
      if (record.granular_rate_limits) {
        try {
          granularRateLimits = JSON.parse(record.granular_rate_limits);
        } catch {
          granularRateLimits = {};
        }
      }
      const effectiveRateLimit =
        typeof granularRateLimits[action] === "number"
          ? granularRateLimits[action]
          : record.max_messages_per_hour;

      const hourlyCount = await staffRepository.getHourlyCount(staffId, action);
      if (hourlyCount >= effectiveRateLimit) {
        auditLog({
          event: "RATE_LIMIT_HIT",
          actorDiscordId: staffId,
          actorUsername: record.discord_username,
          reason: `Hourly limit of ${effectiveRateLimit} reached (${action})`,
          ip,
          requestId,
        });
        return next(ApiError.tooManyRequests(`Hourly limit of ${effectiveRateLimit} ${action} actions reached`));
      }
    }

    req.staffContext = { isAdmin: false, staffId, record };
    log.info(`Staff ${staffId} (${record.discord_username}) passed ${action} check`);
    return next();
  });

export const getStaffContext = (req: Request) => req.staffContext;