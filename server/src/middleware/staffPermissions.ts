/**
 * Staff Permission Middleware
 *
 * Checks the x-staff-id header. If present and the caller is not the admin,
 * validates against the staff_access table:
 *   - is_active + not expired
 *   - action-specific flag
 *   - channel allowlist
 *   - cooldown
 *   - hourly rate limit
 *
 * Admin key callers bypass all checks (owner).
 */

import crypto from "node:crypto";
import type { Request, RequestHandler } from "express";
import { env } from "../config/env.js";
import { staffRepository } from "../repositories/staffRepository.js";
import { settingsService } from "../services/settingsService.js";
import { auditLog } from "../services/auditLog.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const log = logger.child("staffPermissions");

/** Map action strings to StaffRecord boolean columns */
type StaffAction = "send" | "edit" | "delete" | "templates";

const ACTION_COLUMN: Record<StaffAction, keyof import('../repositories/staffRepository.js').StaffRecord> = {
  send:      "can_send_messages",
  edit:      "can_edit_messages",
  delete:    "can_delete_messages",
  templates: "can_manage_templates",
};

/** Constant-time compare for admin key */
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

/**
 * Returns a middleware that:
 *  1. Lets admins (x-admin-key) through with no restrictions.
 *  2. For `x-staff-id` callers: checks the full permission matrix.
 *  3. Blocks everyone else.
 */
export const requireStaffPermission = (action: StaffAction): RequestHandler =>
  asyncHandler(async (req, _res, next) => {
    const requestId = crypto.randomUUID().slice(0, 8);
    const ip = req.ip ?? req.socket.remoteAddress ?? "?";
    const staffId = req.get("x-staff-id");

    // --- Admin & Head Admin fast-path ---
    if (isAdmin(req)) {
      req.staffContext = { isAdmin: true, staffId: null };
      return next();
    }

    if (staffId && /^\d{17,20}$/.test(staffId) && await settingsService.isHeadAdmin(staffId)) {
      req.staffContext = { isAdmin: true, staffId };
      return next();
    }

    // --- Must have x-staff-id ---
    if (!staffId || !/^\d{17,20}$/.test(staffId)) {
      auditLog({
        event: "STAFF_ACCESS_DENIED",
        reason: "Missing or invalid x-staff-id header",
        ip,
        requestId,
      });
      return next(ApiError.unauthorized("x-staff-id header required for staff access"));
    }

    // --- Fetch record ---
    const record = await staffRepository.findByDiscordId(staffId);
    if (!record) {
      auditLog({
        event: "STAFF_ACCESS_DENIED",
        actorDiscordId: staffId,
        reason: "No staff record found",
        ip,
        requestId,
      });
      return next(ApiError.forbidden("You do not have staff access to this tool"));
    }

    // --- Active check ---
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

    // --- Expiry check ---
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

    // --- Action-specific permission ---
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

    // --- Channel allowlist check (default-deny: empty = denied) ---
    if (action === "send" || action === "edit" || action === "delete") {
      const channelId: string | undefined =
        req.body?.channelId ?? req.params?.channelId ?? req.query?.channelId as string;
      if (channelId) {
        let allowed: string[];
        try { allowed = JSON.parse(record.allowed_channel_ids); } catch { allowed = []; }
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

    // --- Cooldown & Rate Limits check (for mutations only: POST, PUT, PATCH, DELETE) ---
    if (req.method !== "GET") {
      let granularCooldowns: Record<string, number> = {};
      if (record.granular_cooldowns) {
        try { granularCooldowns = JSON.parse(record.granular_cooldowns); } catch { granularCooldowns = {}; }
      }
      const effectiveCooldown = typeof granularCooldowns[action] === "number"
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

      // --- Hourly rate limit (granular per action type falling back to max_messages_per_hour) ---
      let granularRateLimits: Record<string, number> = {};
      if (record.granular_rate_limits) {
        try { granularRateLimits = JSON.parse(record.granular_rate_limits); } catch { granularRateLimits = {}; }
      }
      const effectiveRateLimit = typeof granularRateLimits[action] === "number"
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

    // All checks passed — attach context for downstream use
    req.staffContext = { isAdmin: false, staffId, record };
    if (req.method !== "GET") {
      await staffRepository.upsertCooldown(staffId, action);
    }
    log.info(`Staff ${staffId} (${record.discord_username}) passed ${action} check`);
    return next();
  });

export const getStaffContext = (req: Request) => req.staffContext;
