import crypto from "node:crypto";
import type { Request } from "express";
import { env } from "../config/env.js";
import { sessionRevocationRepository } from "../repositories/sessionRevocationRepository.js";

export interface MutualGuildInfo {
  id: string;
  name: string;
  icon: string | null;
  roles: string[];
  isOwner?: boolean;
}

export interface SessionUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  role: string;
  hasDefaultBotAccess?: boolean;
  isFirstLogin?: boolean;
  mutualGuilds?: MutualGuildInfo[];
}

/** 24-hour session lifetime  users must re-authenticate daily. */
export const SESSION_TTL_SECONDS = 24 * 60 * 60;
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

interface VerificationSecret {
  value: string;
  isLegacyAdminKey: boolean;
}

/** Persistently invalidate all existing JWT sessions for a Discord user ID. */
export const revokeUserSessions = async (discordUserId: string): Promise<void> => {
  if (!discordUserId) return;
  await sessionRevocationRepository.revokeUser(discordUserId);
};

/** Persistently invalidate all existing JWT sessions across all users. */
export const revokeAllSessions = async (): Promise<void> => {
  await sessionRevocationRepository.revokeAll();
};

const getSecret = (): string => {
  if (env.isProd && (!env.sessionSecret || env.sessionSecret === env.adminApiKey)) {
    throw new Error("CRITICAL: SESSION_SECRET must be configured independently from ADMIN_API_KEY in production");
  }
  return env.sessionSecret || "dev-only-session-secret";
};

/**
 * The admin key is accepted only for pre-migration tokens and only until the
 * configured cutoff. The cutoff must be no more than one session lifetime away.
 */
const getVerificationSecrets = (): VerificationSecret[] => {
  if (env.isProd && (!env.sessionSecret || env.sessionSecret === env.adminApiKey)) {
    throw new Error("CRITICAL: SESSION_SECRET must be configured independently from ADMIN_API_KEY in production");
  }

  const secrets: VerificationSecret[] = env.sessionSecret
    ? [{ value: env.sessionSecret, isLegacyAdminKey: false }]
    : [];

  const cutoffMs = env.sessionLegacyAdminKeyUntilMs;
  const nowMs = Date.now();
  if (
    env.sessionSecret &&
    cutoffMs !== undefined &&
    Number.isFinite(cutoffMs) &&
    cutoffMs > nowMs &&
    cutoffMs <= nowMs + SESSION_TTL_MS &&
    env.adminApiKey &&
    env.adminApiKey !== env.sessionSecret
  ) {
    secrets.push({ value: env.adminApiKey, isLegacyAdminKey: true });
  }

  if (secrets.length === 0 && env.isProd) {
    throw new Error("CRITICAL: SESSION_SECRET must be configured independently from ADMIN_API_KEY in production");
  }
  return secrets.length > 0 ? secrets : [{ value: "dev-only-session-secret", isLegacyAdminKey: false }];
};

export const createSessionToken = (user: SessionUser): string => {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      ...user,
      exp: nowSec + SESSION_TTL_SECONDS,
      iat: nowSec,
      iatMs: nowMs,
    }),
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
};

export const verifySessionToken = async (token: string): Promise<SessionUser | null> => {
  try {
    if (typeof token !== "string" || token.length > 8192) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const bufA = Buffer.from(s);
    const matchingSecret = getVerificationSecrets().find(({ value }) => {
      const expected = crypto.createHmac("sha256", value).update(`${h}.${p}`).digest("base64url");
      const bufB = Buffer.from(expected);
      return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
    });
    if (!matchingSecret) return null;

    const data: unknown = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
    const claims = data as Record<string, unknown>;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      !Number.isSafeInteger(claims.exp) ||
      !Number.isSafeInteger(claims.iat) ||
      (claims.exp as number) <= nowSeconds ||
      (claims.iat as number) > nowSeconds + 60 ||
      (claims.exp as number) <= (claims.iat as number) ||
      (claims.exp as number) - (claims.iat as number) > SESSION_TTL_SECONDS
    ) return null;
    if (matchingSecret.isLegacyAdminKey) {
      const cutoffMs = env.sessionLegacyAdminKeyUntilMs;
      const migrationStartedAtSeconds =
        cutoffMs === undefined ? Number.POSITIVE_INFINITY : Math.floor(cutoffMs / 1000) - SESSION_TTL_SECONDS;
      if ((claims.iat as number) > migrationStartedAtSeconds) return null;
    }
    if (
      typeof claims.id !== "string" || !/^\d{17,20}$/.test(claims.id) ||
      typeof claims.username !== "string" || !claims.username.trim()
    ) return null;

    const userId = claims.id;
    const tokenIssuedMs =
      typeof claims.iatMs === "number" && Number.isSafeInteger(claims.iatMs)
        ? claims.iatMs
        : (claims.iat as number) * 1000;
    if (
      tokenIssuedMs > Date.now() + 60_000 ||
      tokenIssuedMs < (claims.iat as number) * 1000 ||
      tokenIssuedMs > ((claims.iat as number) * 1000) + 999
    ) {
      return null;
    }

    const [globalRevokedAtMs, userRevokedAtMs] = await Promise.all([
      sessionRevocationRepository.getGlobalRevokedAt(),
      sessionRevocationRepository.getUserRevokedAt(userId),
    ]);
    if (
      (globalRevokedAtMs > 0 && tokenIssuedMs <= globalRevokedAtMs) ||
      (userRevokedAtMs > 0 && tokenIssuedMs <= userRevokedAtMs)
    ) {
      return null;
    }

    return {
      id: userId,
      username: claims.username,
      global_name: typeof claims.global_name === "string" ? claims.global_name : null,
      avatar: typeof claims.avatar === "string" ? claims.avatar : null,
      role: claims.role === "admin" ? "admin" : "editor",
      hasDefaultBotAccess:
        typeof claims.hasDefaultBotAccess === "boolean" ? claims.hasDefaultBotAccess : undefined,
      isFirstLogin: typeof claims.isFirstLogin === "boolean" ? claims.isFirstLogin : undefined,
      mutualGuilds: Array.isArray(claims.mutualGuilds) ? claims.mutualGuilds as MutualGuildInfo[] : undefined,
    };
  } catch {
    return null;
  }
};

export const parseCookies = (cookieHeader?: string): Record<string, string> => {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const pair of cookieHeader.split(";")) {
    const idx = pair.indexOf("=");
    if (idx < 0) continue;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
};

export const getSessionUserFromRequest = async (req: Request): Promise<SessionUser | null> => {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    if (cookies.dmb_session) {
      const user = await verifySessionToken(cookies.dmb_session);
      if (user) return user;
    }
  }

  const authHeader = req.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const user = await verifySessionToken(token);
    if (user) return user;
  }

  return null;
};
