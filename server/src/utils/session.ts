import crypto from "node:crypto";
import type { Request } from "express";
import { env } from "../config/env.js";

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

/** 24-hour session lifetime — users must re-authenticate daily. */
export const SESSION_TTL_SECONDS = 24 * 60 * 60;
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

/**
 * In-memory revocation floor per Discord user ID (and global floor).
 * Any JWT issued at or before `userRevokedAtMs.get(userId)` is rejected immediately.
 */
const userRevokedAtMs = new Map<string, number>();
let globalRevokedAtMs = 0;

/** Immediately invalidate all existing JWT sessions for a specific Discord user ID. */
export const revokeUserSessions = (discordUserId: string): void => {
  if (!discordUserId) return;
  userRevokedAtMs.set(discordUserId, Date.now());
};

/** Immediately invalidate all existing JWT sessions across all users. */
export const revokeAllSessions = (): void => {
  globalRevokedAtMs = Date.now();
};

const getSecret = (): string => env.sessionSecret || env.adminApiKey || "default-session-secret";

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

export const verifySessionToken = (token: string): SessionUser | null => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const expected = crypto.createHmac("sha256", getSecret()).update(`${h}.${p}`).digest("base64url");
    const bufA = Buffer.from(s);
    const bufB = Buffer.from(expected);
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) return null;

    const data = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    if (!data.id || !data.username) return null;

    const userId = String(data.id);
    const tokenIssuedMs =
      typeof data.iatMs === "number"
        ? data.iatMs
        : typeof data.iat === "number"
          ? data.iat * 1000
          : 0;

    if (globalRevokedAtMs > 0 && tokenIssuedMs <= globalRevokedAtMs) {
      return null;
    }
    const userRevokedMs = userRevokedAtMs.get(userId);
    if (userRevokedMs !== undefined && tokenIssuedMs <= userRevokedMs) {
      return null;
    }

    return {
      id: userId,
      username: String(data.username),
      global_name: data.global_name ?? null,
      avatar: data.avatar ?? null,
      role: data.role ?? "editor",
      hasDefaultBotAccess:
        typeof data.hasDefaultBotAccess === "boolean" ? data.hasDefaultBotAccess : undefined,
      isFirstLogin: typeof data.isFirstLogin === "boolean" ? data.isFirstLogin : undefined,
      mutualGuilds: Array.isArray(data.mutualGuilds) ? data.mutualGuilds : undefined,
    };
  } catch {
    return null;
  }
};

export const parseCookies = (cookieHeader?: string): Record<string, string> => {
  if (!cookieHeader) return {};
  const cookies: Record<string, string> = {};
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

export const getSessionUserFromRequest = (req: Request): SessionUser | null => {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    if (cookies.dmb_session) {
      const user = verifySessionToken(cookies.dmb_session);
      if (user) return user;
    }
  }

  const authHeader = req.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const user = verifySessionToken(token);
    if (user) return user;
  }

  return null;
};