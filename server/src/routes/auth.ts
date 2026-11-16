import { Router } from "express";
import crypto from "node:crypto";
import type { UserRole } from "@dmb/shared";
import { env } from "../config/env.js";
import { userRepository } from "../repositories/userRepository.js";
import { staffRepository } from "../repositories/staffRepository.js";
import { settingsService } from "../services/settingsService.js";
import * as discord from "../services/discordService.js";
import {
  type MutualGuildInfo,
  type SessionUser,
  SESSION_TTL_MS,
  createSessionToken,
  getSessionUserFromRequest,
  parseCookies,
  revokeUserSessions,
} from "../utils/session.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const router = Router();
const log = logger.child("auth");

interface DiscordUserGuild {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  permissions?: string;
}

// GET /api/auth/discord/login
router.get("/discord/login", (_req, res) => {
  const clientId = env.discord.clientId || env.discord.applicationId;
  if (!clientId || !env.discord.clientSecret) {
    log.error("Discord OAuth is not configured: DISCORD_CLIENT_ID (or DISCORD_APPLICATION_ID) and DISCORD_CLIENT_SECRET are required");
    return res.redirect(`${env.clientOrigins[0] || "http://localhost:5173"}/?error=oauth_not_configured`);
  }

  let redirectUrl: URL;
  try {
    redirectUrl = new URL(env.discord.redirectUri);
  } catch {
    log.error("Discord OAuth redirect URI is invalid");
    return res.redirect(`${env.clientOrigins[0] || "http://localhost:5173"}/?error=oauth_redirect_misconfigured`);
  }
  if (env.isProd && redirectUrl.protocol !== "https:") {
    log.error("Discord OAuth redirect URI must use HTTPS in production");
    return res.redirect(`${env.clientOrigins[0] || "http://localhost:5173"}/?error=oauth_redirect_misconfigured`);
  }

  const state = crypto.randomBytes(16).toString("hex");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  const oauthCookieOptions = {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax" as const,
    maxAge: 10 * 60 * 1000,
    path: "/",
  };
  res.cookie("oauth_state", state, oauthCookieOptions);
  res.cookie("oauth_pkce_verifier", codeVerifier, oauthCookieOptions);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: env.discord.redirectUri,
    scope: "identify guilds",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "consent",
  });

  res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
});

// GET /api/auth/discord/callback
router.get(
  "/discord/callback",
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query;
    const clientBase = env.clientOrigins[0] || "http://localhost:5173";

    const cookies = parseCookies(req.headers.cookie);
    const cookieState = cookies.oauth_state;
    const codeVerifier = cookies.oauth_pkce_verifier;
    const stateMatches =
      typeof state === "string" &&
      typeof cookieState === "string" &&
      Buffer.byteLength(state) === Buffer.byteLength(cookieState) &&
      crypto.timingSafeEqual(Buffer.from(state), Buffer.from(cookieState));
    const verifierIsValid =
      typeof codeVerifier === "string" && /^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier);
    res.clearCookie("oauth_state", { path: "/" });
    res.clearCookie("oauth_pkce_verifier", { path: "/" });
    if (!stateMatches || !verifierIsValid) {
      log.warn("OAuth state or PKCE verifier was missing or invalid");
      return res.redirect(`${clientBase}/?error=invalid_oauth_state`);
    }

    if (error) {
      log.warn("OAuth authorization was not completed by Discord");
      return res.redirect(`${clientBase}/?error=oauth_denied`);
    }

    if (!code || typeof code !== "string") {
      throw ApiError.badRequest("Authorization code is required");
    }

    const clientId = env.discord.clientId || env.discord.applicationId || "";
    const clientSecret = env.discord.clientSecret || "";
    if (!clientId || !clientSecret) {
      log.error("Discord OAuth callback reached without a configured client ID and client secret");
      return res.redirect(`${clientBase}/?error=oauth_not_configured`);
    }

    let tokenRes: Response;
    try {
      tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: env.discord.redirectUri,
          code_verifier: codeVerifier,
        }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      log.error(`Discord token exchange timed out or failed: ${err}`);
      return res.redirect(`${clientBase}/?error=token_exchange_timeout`);
    }

    if (!tokenRes.ok) {
      const errorBody = await tokenRes.text();
      let discordError = "unknown_error";
      let discordDescription = "";
      try {
        const parsed = JSON.parse(errorBody) as { error?: unknown; error_description?: unknown };
        if (typeof parsed.error === "string") discordError = parsed.error;
        if (typeof parsed.error_description === "string") discordDescription = parsed.error_description;
      } catch {
        // Do not log arbitrary non-JSON response bodies.
      }
      log.error(`Discord token exchange failed: HTTP ${tokenRes.status}; error=${discordError}; description=${discordDescription || "not provided"}`);
      const publicCode = tokenRes.status === 400 || tokenRes.status === 401
        ? "oauth_credentials_rejected"
        : "token_exchange_failed";
      return res.redirect(`${clientBase}/?error=${publicCode}`);
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      log.error("Discord token exchange returned success without an access_token");
      return res.redirect(`${clientBase}/?error=token_exchange_invalid_response`);
    }

    // 1. Fetch authenticated user's Discord identity
    let userRes: Response;
    try {
      userRes = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      log.error(`Discord user profile fetch timed out or failed: ${err}`);
      return res.redirect(`${clientBase}/?error=fetch_user_timeout`);
    }

    if (!userRes.ok) {
      const errorBody = await userRes.text();
      log.error(`Discord user profile fetch failed: HTTP ${userRes.status}; response=${errorBody.slice(0, 300)}`);
      return res.redirect(`${clientBase}/?error=fetch_user_failed`);
    }

    const discordUser = (await userRes.json()) as {
      id: string;
      username: string;
      global_name?: string | null;
      avatar?: string | null;
    };

    if (!discordUser.id || !discordUser.username) {
      log.error("Discord user profile response was missing required identity fields");
      return res.redirect(`${clientBase}/?error=fetch_user_failed`);
    }
    
    // 2. Fetch user's guilds via OAuth token & cross-check with the Default Bot's guilds + roles
    let userGuilds: DiscordUserGuild[] = [];
    try {
      const guildsRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (guildsRes.ok) {
        const parsed = await guildsRes.json();
        if (Array.isArray(parsed)) userGuilds = parsed as DiscordUserGuild[];
        else log.warn("Discord OAuth guild endpoint returned a non-array response");
      } else {
        const errorBody = await guildsRes.text();
        log.warn(`Could not fetch user OAuth guilds: HTTP ${guildsRes.status}; response=${errorBody.slice(0, 300)}`);
      }
    } catch (err) {
      log.warn(`Could not fetch user OAuth guilds: ${err}`);
    }

    let botGuilds: discord.DiscordGuildSummary[] = [];
    if (env.discord.botToken) {
      try {
        botGuilds = await discord.getBotGuilds(null);
      } catch (err) {
        log.warn(`Could not fetch default bot guilds during login: ${err}`);
      }
    }

    const botGuildIds = new Set(botGuilds.map((g) => g.id));
    const commonRaw = userGuilds.filter((ug) => botGuildIds.has(ug.id));

    const mutualGuilds: MutualGuildInfo[] = [];

    for (const ug of commonRaw.slice(0, 10)) {
      let memberRoles: string[] = [];
      if (env.discord.botToken) {
        try {
          const member = await discord.getGuildMember(ug.id, discordUser.id, env.discord.botToken);
          if (Array.isArray(member?.roles)) {
            memberRoles = member.roles;
          }
        } catch {
          // User member lookup failed in guild
        }
      }

      mutualGuilds.push({
        id: ug.id,
        name: ug.name,
        icon: ug.icon ?? null,
        roles: memberRoles,
        isOwner: Boolean(ug.owner),
      });
    }

    // 3. Check Head Admin, Owner, and explicit Staff Access records ONLY (never auto-elevate from guild permissions)
    const existingDbUser = await userRepository.findByDiscordId(discordUser.id);
    const isFirstLogin = !existingDbUser;

    const isHead = await settingsService.isHeadAdmin(discordUser.id);
    const isOwner = env.ownerDiscordIds.includes(discordUser.id);

    const staffRecord = await staffRepository.findByDiscordId(discordUser.id);
    const hasActiveStaffRecord = Boolean(
      staffRecord &&
        staffRecord.is_active &&
        (!staffRecord.expires_at || new Date(staffRecord.expires_at) >= new Date()),
    );

    const hasDefaultBotAccess =
      isOwner ||
      isHead ||
      (mutualGuilds.length > 0 && hasActiveStaffRecord);

    const role: UserRole = isHead || isOwner ? "admin" : "editor";
    await userRepository.upsert({
      discordId: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar ?? null,
      role,
    });

    const sessionUser: SessionUser = {
      id: discordUser.id,
      username: discordUser.username,
      global_name: discordUser.global_name ?? null,
      avatar: discordUser.avatar ?? null,
      role,
      hasDefaultBotAccess,
      isFirstLogin,
      mutualGuilds,
    };

    const sessionToken = createSessionToken(sessionUser);

    res.cookie("dmb_session", sessionToken, {
      httpOnly: true,
      secure: env.isProd,
      sameSite: "lax",
      maxAge: SESSION_TTL_MS,
      path: "/",
    });

    res.clearCookie("oauth_state", { path: "/" });
    const needsSetup = isFirstLogin || !hasDefaultBotAccess;
    res.redirect(`${clientBase}/?login=success${needsSetup ? "&setup=1" : ""}`);
  }),
);

// GET /api/auth/me
router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = await getSessionUserFromRequest(req);
    if (!user) {
      return res.json({ user: null });
    }

    const isHead = await settingsService.isHeadAdmin(user.id);
    const isOwner = env.ownerDiscordIds.includes(user.id);
    const isAdmin = isHead || isOwner || (!env.isProd && user.role === "admin");

    const staffRecord = await staffRepository.findByDiscordId(user.id);
    const hasActiveStaffRecord = Boolean(
      staffRecord &&
        staffRecord.is_active &&
        (!staffRecord.expires_at || new Date(staffRecord.expires_at) >= new Date()),
    );

    let allowedRoleMentionIds: string[] = [];
    if (staffRecord?.allowed_role_mention_ids) {
      try {
        const parsed = JSON.parse(staffRecord.allowed_role_mention_ids);
        if (Array.isArray(parsed)) allowedRoleMentionIds = parsed.map(String);
      } catch {
        allowedRoleMentionIds = [];
      }
    }

    const mutualGuilds = user.mutualGuilds ?? [];
    // Always compute live from DB  never trust stale user.hasDefaultBotAccess from the JWT
    const hasDefaultBotAccess =
      isAdmin || (hasActiveStaffRecord && (mutualGuilds.length > 0 || !env.isProd));

    let customBotCount = 0;
    let customWebhookCount = 0;

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
        role: isAdmin ? "admin" : "editor",
        isAdmin,
        hasDefaultBotAccess,
        isFirstLogin: Boolean(user.isFirstLogin),
        mutualGuilds,
        customBotCount,
        customWebhookCount,
        needsBotConfig: !hasDefaultBotAccess,
        staffPermissions:
          hasActiveStaffRecord && staffRecord
            ? {
                can_mention_everyone: staffRecord.can_mention_everyone === 1,
                can_mention_here: staffRecord.can_mention_here === 1,
                can_mention_roles: staffRecord.can_mention_roles === 1,
                allowed_role_mention_ids: allowedRoleMentionIds,
                can_attach_files: staffRecord.can_attach_files !== 0,
                can_use_components_v2: staffRecord.can_use_components_v2 !== 0,
                can_use_weao_exploits: staffRecord.can_use_weao_exploits !== 0,
                allowed_guild_ids: staffRecord.allowed_guild_ids
                  ? JSON.parse(staffRecord.allowed_guild_ids)
                  : ["*"],
              }
            : null,
      },
    });
  }),
);

// POST /api/auth/logout
router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const user = await getSessionUserFromRequest(req);
    if (user) {
      await revokeUserSessions(user.id);
    }
    res.clearCookie("dmb_session", { path: "/" });
    res.json({ success: true, ok: true });
  }),
);

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
      maxAge: SESSION_TTL_MS,
      path: "/",
    });

    res.json({ ok: true, user: sessionUser, token });
  }),
);

export default router;