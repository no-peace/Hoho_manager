import crypto from "node:crypto";
import type { Request, RequestHandler } from "express";
import type { UserRecord, UserRole } from "@dmb/shared";
import { env } from "../config/env.js";
import { userRepository } from "../repositories/userRepository.js";
import { ApiError, asyncHandler } from "../utils/errors.js";

/**
 * Access control.
 *
 * The app is single-user/local today, but every privileged route already goes
 * through real middleware, so swapping in sessions/JWT in Phase 4 is a change to
 * this file only — not to the routes.
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
 * Phase 4 replaces the body of this function with a session/JWT lookup; the
 * routes downstream only ever read `req.user`.
 */
export const attachUser: RequestHandler = asyncHandler(async (req, _res, next) => {
  req.user = await userRepository.findByDiscordId("local-admin");
  // Must hand off explicitly: without this the router never reaches the
  // handler and the request hangs until the client times out.
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
