import crypto from "node:crypto";
import type { Request, RequestHandler } from "express";
import type { UserRecord, UserRole } from "@dmb/shared";
import { env } from "../config/env.js";
import { userRepository } from "../repositories/userRepository.js";
import { settingsService } from "../services/settingsService.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { getSessionUserFromRequest } from "../utils/session.js";

/**
 * Access control.
 *
 * The app supports session/JWT authentication and falls back to local-admin
 * for machine callers and headless tests.
 *
 * Two independent checks are supported:
 *   1. {@link attachUser} / {@link requireRole} — role-based.
 *   2. {@link requireAdminKey} — a shared secret header, used for machine callers
 *      and as a stopgap until logins exist.
 */

/** Constant-time string comparison so we don't leak the secret via timing. */
const safeEqual = (a: unknown, b: unknown): boolean => {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/**
 * The acting user, guaranteed.
 *
 * `req.user` is optional by type because not every route attaches one. Calling
 * this in a handler that is preceded by `attachUser` narrows it once, instead of
 * sprinkling non-null assertions through the route bodies.
 *
 * @throws ApiError 401 when no user was attached.
 */
export const requireUser = (req: Request): UserRecord => {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
};

/**
 * Resolve the acting user onto `req.user`.
 *
 * Checks session cookie / bearer token first. If not found, falls back
 * to local-admin record.
 */
export const attachUser: RequestHandler = asyncHandler(async (req, _res, next) => {
  const sessionUser = getSessionUserFromRequest(req);
  if (sessionUser) {
    const dbUser = await userRepository.findByDiscordId(sessionUser.id);
    if (dbUser) {
      req.user = dbUser;
    } else {
      req.user = {
        id: 0,
        discord_id: sessionUser.id,
        username: sessionUser.username,
        avatar: sessionUser.avatar ?? null,
        role: (sessionUser.role as UserRole) || "editor",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  } else {
    req.user = await userRepository.findByDiscordId("local-admin");
  }
  next();
});

/** Gate a route behind one or more roles. Always used after {@link attachUser}. */
export const requireRole =
  (...roles: readonly UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());

    // An 'admin' implicitly satisfies every role check.
    const allowed = req.user.role === "admin" || roles.includes(req.user.role);
    if (!allowed) {
      return next(ApiError.forbidden(`Requires role: ${roles.join(" or ")}`));
    }
    return next();
  };

/** Alias for the most common case. */
export const requireAdmin: RequestHandler = requireRole("admin");

/**
 * Require the shared `x-admin-key` header. Used for privileged machine-to-machine
 * calls (e.g. sending with a bot token while no login session exists yet).
 */
export const requireAdminKey: RequestHandler = (req, _res, next) => {
  const provided = req.get("x-admin-key");
  if (!provided || !safeEqual(provided, env.adminApiKey)) {
    return next(ApiError.unauthorized("A valid x-admin-key header is required"));
  }
  return next();
};

/**
 * Require either a valid master `x-admin-key` OR an authenticated session / `x-staff-id` header
 * matching an authorized Head Admin in DB settings or env.ownerDiscordIds.
 */
export const requireHeadAdmin: RequestHandler = asyncHandler(async (req, _res, next) => {
  const adminKey = req.get("x-admin-key");
  if (adminKey && safeEqual(adminKey, env.adminApiKey)) {
    req.staffContext = { isAdmin: true, staffId: null };
    return next();
  }

  const sessionUser = getSessionUserFromRequest(req);
  if (sessionUser) {
    const isHead =
      (await settingsService.isHeadAdmin(sessionUser.id)) ||
      env.ownerDiscordIds.includes(sessionUser.id) ||
      sessionUser.role === "admin";
    if (isHead) {
      req.staffContext = { isAdmin: true, staffId: sessionUser.id };
      return next();
    }
  }

  const staffId = sessionUser ? sessionUser.id : req.get("x-staff-id");
  if (staffId && /^\d{17,20}$/.test(staffId)) {
    const isHead = await settingsService.isHeadAdmin(staffId);
    if (isHead) {
      req.staffContext = { isAdmin: true, staffId };
      return next();
    }
    return next(ApiError.forbidden("Access denied: Requires authorized Head Admin credentials"));
  }

  if (adminKey) {
    return next(ApiError.forbidden("Access denied: Invalid admin key"));
  }

  return next(ApiError.unauthorized("A valid x-admin-key or authorized x-staff-id header is required"));
});

