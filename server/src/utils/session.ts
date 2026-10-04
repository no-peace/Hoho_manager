import crypto from "node:crypto";
import type { Request } from "express";
import { env } from "../config/env.js";

export interface SessionUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  role: string;
}

const getSecret = (): string => env.sessionSecret || env.adminApiKey || "default-session-secret";

export const createSessionToken = (user: SessionUser): string => {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      ...user,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
      iat: Math.floor(Date.now() / 1000),
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

    return {
      id: String(data.id),
      username: String(data.username),
      global_name: data.global_name ?? null,
      avatar: data.avatar ?? null,
      role: data.role ?? "editor",
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
