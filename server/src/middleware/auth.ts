import crypto from "node:crypto";
import type { Request, RequestHandler } from "express";
import type { UserRecord, UserRole } from "@dmb/shared";
import { env } from "../config/env.js";
import { userRepository } from "../repositories/userRepository.js";
import { settingsService } from "../services/settingsService.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { getSessionUserFromRequest } from "../utils/session.js";

/** Constant-time string comparison so we don't leak the secret via timing. */
const safeEqual = (a: unknown, b: unknown): boolean => {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

export const requireUser = (req: Request): UserRecord => {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
};

/** Reject anonymous requests before routes buffer or process expensive request bodies. */
export const requireUserOrAdminKey: RequestHandler = (req, _res, next) => {
  const adminKey = req.get("x-admin-key");
  if (req.user || (adminKey && safeEqual(adminKey, env.adminApiKey))) return next();
  return next(ApiError.unauthorized());
};

/**
 * Resolve the acting user onto `req.user`.
 *
 * In production, never falls back to `local-admin` unless a valid `x-admin-key` header is supplied.
 */
export const attachUser: RequestHandler = asyncHandler(async (req, _res, next) => {
  const sessionUser = await getSessionUserFromRequest(req);
  if (sessionUser) {
    let dbUser = await userRepository.findByDiscordId(sessionUser.id);
    if (!dbUser) {
      dbUser = await userRepository.upsert({
        discordId: sessionUser.id,
        username: sessionUser.global_name || sessionUser.username,
        avatar: sessionUser.avatar ?? null,
        role: (sessionUser.role as UserRole) || "editor",
      });
    }
    if (dbUser) {
      req.user = dbUser;
    }
    return next();
  }

  const adminKey = req.get("x-admin-key");
  const hasValidAdminKey = Boolean(adminKey && safeEqual(adminKey, env.adminApiKey));

  if (!env.isProd || hasValidAdminKey) {
    req.user = await userRepository.findByDiscordId("local-admin");
  }
  next();
});

/** Gate a route behind one or more roles. Always used after {@link attachUser}. */
export const requireRole =
  (...roles: readonly UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());

    const allowed = req.user.role === "admin" || roles.includes(req.user.role);
    if (!allowed) {
      return next(ApiError.forbidden(`Requires role: ${roles.join(" or ")}`));
    }
    return next();
  };

export const requireAdmin: RequestHandler = requireRole("admin");

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

  const sessionUser = await getSessionUserFromRequest(req);
  if (sessionUser) {
    const isHead =
      (await settingsService.isHeadAdmin(sessionUser.id)) ||
      env.ownerDiscordIds.includes(sessionUser.id) ||
      (!env.isProd && sessionUser.role === "admin");
    if (isHead) {
      req.staffContext = { isAdmin: true, staffId: sessionUser.id };
      return next();
    }
    return next(ApiError.forbidden("Access denied: Requires authorized Head Admin credentials"));
  }

  if (!env.isProd) {
    const staffId = req.get("x-staff-id");
    if (staffId && /^\d{17,20}$/.test(staffId)) {
      const isHead = await settingsService.isHeadAdmin(staffId);
      if (isHead) {
        req.staffContext = { isAdmin: true, staffId };
        return next();
      }
      return next(ApiError.forbidden("Access denied: Requires authorized Head Admin credentials"));
    }
  }

  if (adminKey) {
    return next(ApiError.forbidden("Access denied: Invalid admin key"));
  }

  return next(ApiError.unauthorized("A valid x-admin-key or authorized Head Admin session is required"));
});