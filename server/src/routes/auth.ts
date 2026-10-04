import { Router } from "express";
import crypto from "node:crypto";
import type { UserRole } from "@dmb/shared";
import { env } from "../config/env.js";
import { userRepository } from "../repositories/userRepository.js";
import { settingsService } from "../services/settingsService.js";
import {
  type SessionUser,
  createSessionToken,
  getSessionUserFromRequest,
  parseCookies,
} from "../utils/session.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const router = Router();
const log = logger.child("auth");

// GET /api/auth/discord/login
router.get("/discord/login", (_req, res) => {
  const clientId = env.discord.clientId || env.discord.applicationId;
  if (!clientId) {
    throw ApiError.badRequest("Discord Application ID / Client ID is not configured");
  }

  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("oauth_state", state, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
    path: "/",
  });

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: env.discord.redirectUri,
    scope: "identify",
    state,
    prompt: "consent",
  });

  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

// GET /api/auth/discord/callback
router.get(
  "/discord/callback",
  asyncHandler(async (req, res) => {
    const { code, state, error, error_description } = req.query;
    const clientBase = env.clientOrigins[0] || "http://localhost:5173";

    if (error) {
      log.warn(`OAuth error from Discord: ${error} - ${error_description}`);
      return res.redirect(`${clientBase}/?error=${encodeURIComponent(String(error_description || error))}`);
    }

    if (!code || typeof code !== "string") {
      throw ApiError.badRequest("Authorization code is required");
    }

    const cookies = parseCookies(req.headers.cookie);
    if (cookies.oauth_state && state && cookies.oauth_state !== state) {
      log.warn("OAuth state parameter mismatch");
    }

    const clientId = env.discord.clientId || env.discord.applicationId || "";
    const clientSecret = env.discord.clientSecret || "";

    const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: env.discord.redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      log.error(`Discord token exchange failed: ${tokenRes.status} ${errBody}`);
      return res.redirect(`${clientBase}/?error=token_exchange_failed`);
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      log.error(`Discord user fetch failed: ${userRes.status}`);
      return res.redirect(`${clientBase}/?error=fetch_user_failed`);
    }

    const discordUser = (await userRes.json()) as {
      id: string;
      username: string;
      global_name?: string | null;
      avatar?: string | null;
    };

    const isHead = await settingsService.isHeadAdmin(discordUser.id);
    const isOwner = env.ownerDiscordIds.includes(discordUser.id);
    const role: UserRole = isHead || isOwner ? "admin" : "editor";

    const displayName = discordUser.global_name || discordUser.username;

    await userRepository.upsert({
      discordId: discordUser.id,
      username: displayName,
      avatar: discordUser.avatar ?? null,
      role,
    });

    const sessionUser: SessionUser = {
      id: discordUser.id,
      username: displayName,
      global_name: discordUser.global_name ?? null,
      avatar: discordUser.avatar ?? null,
      role,
    };

    const sessionToken = createSessionToken(sessionUser);

    res.cookie("dmb_session", sessionToken, {
      httpOnly: true,
      secure: env.isProd,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.clearCookie("oauth_state", { path: "/" });
    res.redirect(`${clientBase}/?login=success`);
  }),
);

// GET /api/auth/me
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = getSessionUserFromRequest(req);
    if (!user) {
      return res.json({ user: null });
    }

    const isHead = await settingsService.isHeadAdmin(user.id);
    const isOwner = env.ownerDiscordIds.includes(user.id);
    const isAdmin = isHead || isOwner || user.role === "admin";

    let avatarUrl: string;
    if (user.avatar) {
      const ext = user.avatar.startsWith("a_") ? "gif" : "png";
      avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}`;
    } else {
      try {
        const index = (BigInt(user.id) >> 22n) % 6n;
        avatarUrl = `https://cdn.discordapp.com/embed/avatars/${index}.png`;
      } catch {
        avatarUrl = "https://cdn.discordapp.com/embed/avatars/0.png";
      }
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        global_name: user.global_name ?? null,
        avatar: user.avatar,
        avatarUrl,
        role: user.role,
        isAdmin,
      },
    });
  }),
);

// POST /api/auth/logout
router.post("/logout", (_req, res) => {
  res.clearCookie("dmb_session", { path: "/" });
  res.json({ success: true, ok: true });
});

// POST /api/auth/dev-login (dev/test only)
router.post(
  "/dev-login",
  asyncHandler(async (req, res) => {
    if (env.isProd) {
      throw ApiError.notFound();
    }

    const { discordId, username, avatar } = req.body;
    if (!discordId || typeof discordId !== "string") {
      throw ApiError.badRequest("discordId is required");
    }

    const isHead = await settingsService.isHeadAdmin(discordId);
    const isOwner = env.ownerDiscordIds.includes(discordId);
    const role: UserRole = isHead || isOwner ? "admin" : "editor";
    const uname = username || `User_${discordId.slice(-4)}`;

    await userRepository.upsert({
      discordId,
      username: uname,
      avatar: avatar ?? null,
      role,
    });

    const sessionUser: SessionUser = {
      id: discordId,
      username: uname,
      global_name: uname,
      avatar: avatar ?? null,
      role,
    };

    const token = createSessionToken(sessionUser);
    res.cookie("dmb_session", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.json({ ok: true, user: sessionUser, token });
  }),
);

export default router;
