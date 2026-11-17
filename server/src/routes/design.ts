import { Router } from "express";
import crypto from "node:crypto";
import { db } from "../config/database.js";
import { env } from "../config/env.js";
import { getSessionUserFromRequest } from "../utils/session.js";
import { ApiError, asyncHandler } from "../utils/errors.js";

const router = Router();
interface Identity { discordId: string; isOwner: boolean; }
interface ThemeRow {
  id: string; owner_discord_id: string; name: string; description: string | null;
  data: string; is_default: number; is_public?: number; created_at: string; updated_at: string;
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const DEFAULT_THEME = {
  background: "#0b0d12", panel: "#161a23", surface: "#1d2230", text: "#f1f3f9",
  muted: "#a1a8b8", border: "#272d3a", accent: "#818cf8", accentHover: "#6366f1",
  radius: "10px", fontFamily: "Inter",
};
const color = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
const fonts = ["Inter", "system-ui", "Roboto", "Arial"];
const radii = ["4px", "8px", "10px", "14px", "18px"];
const luminance = (hex: string): number => {
  const rgb = hex.slice(1).match(/.{2}/g)!.map((v) => parseInt(v, 16) / 255).map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
};
const contrast = (a: string, b: string): number => {
  const x = luminance(a); const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const validateTheme = (value: unknown) => {
  const input = isRecord(value) && isRecord(value.theme) ? value.theme : value;
  if (!isRecord(input)) throw ApiError.badRequest("Theme tokens must be an object.");
  const keys = Object.keys(DEFAULT_THEME);
  for (const key of keys) {
    if (!(key in input)) throw ApiError.badRequest("Theme is missing the " + key + " token.");
  }
  for (const key of ["background", "panel", "surface", "text", "muted", "border", "accent", "accentHover"]) {
    if (!color(input[key])) throw ApiError.badRequest("Invalid " + key + " color. Use a six-digit HEX color.");
  }
  if (!radii.includes(String(input.radius))) throw ApiError.badRequest("Unsupported corner radius.");
  if (!fonts.includes(String(input.fontFamily))) throw ApiError.badRequest("Unsupported font family.");
  const theme = Object.fromEntries(keys.map((key) => [key, input[key]])) as typeof DEFAULT_THEME;
  if (contrast(theme.text, theme.background) < 4.5 || contrast(theme.text, theme.panel) < 4.5 || contrast(theme.text, theme.surface) < 4.5) {
    throw ApiError.badRequest("Primary text must meet WCAG AA contrast (4.5:1) against the background, panels, and surfaces.");
  }
  if (contrast(theme.muted, theme.background) < 3 || contrast(theme.muted, theme.panel) < 3 || contrast(theme.muted, theme.surface) < 3) {
    throw ApiError.badRequest("Muted text must meet a minimum 3:1 contrast against the background and panels.");
  }
  return theme;
};
const resolveIdentity = async (req: Parameters<typeof getSessionUserFromRequest>[0]): Promise<Identity> => {
  const session = await getSessionUserFromRequest(req);
  if (!session) throw ApiError.notFound();
  return {
    discordId: session.id,
    isOwner: env.ownerDiscordIds.includes(session.id) || (!env.isProd && session.role === "admin"),
  };
};
const requireOwner = (identity: Identity) => {
  if (!identity.isOwner) throw ApiError.forbidden("Only the HoHo Manager owner can change the server theme.");
};
const parseTheme = (row: ThemeRow) => {
  let data: any = {};
  try { data = JSON.parse(row.data); } catch { data = {}; }
  const tokens = data?.theme ?? data;
  return {
    id: row.id, ownerDiscordId: row.owner_discord_id, name: row.name,
    description: row.description, theme: tokens, data, isDefault: row.is_default === 1,
    isPublic: row.is_public !== 0, createdAt: row.created_at, updatedAt: row.updated_at,
  };
};
const readThemeBody = (body: unknown) => {
  if (!isRecord(body)) throw ApiError.badRequest("A theme object is required.");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 60) throw ApiError.badRequest("Theme name must contain 1–60 characters.");
  const sourceData = isRecord(body.data) ? body.data : {};
  const theme = validateTheme(body.theme ?? sourceData.theme ?? body.data);
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 180) : null;
  return { name, description: description || null, theme, data: { ...(sourceData.puck ? { puck: sourceData.puck } : {}), theme } };
};

router.get("/default", asyncHandler(async (_req, res) => {
  const row = await db.get<{ theme_data: string; updated_at: string; updated_by: string }>(
    "SELECT theme_data, updated_at, updated_by FROM server_theme_settings WHERE id = 1",
  );
  if (row) {
    let theme = DEFAULT_THEME;
    try { theme = validateTheme(JSON.parse(row.theme_data)); } catch { /* safe built-in fallback */ }
    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    return res.json({ theme: { theme, updatedAt: row.updated_at } });
  }
  const legacy = await db.get<ThemeRow>("SELECT * FROM design_themes WHERE is_default = 1 LIMIT 1");
  if (!legacy) return res.json({ theme: { theme: DEFAULT_THEME, updatedAt: null } });
  const parsed = parseTheme(legacy);
  let legacyTheme = DEFAULT_THEME;
  try { legacyTheme = validateTheme(parsed.theme); } catch { /* reject unsafe legacy theme and use the safe default */ }
  res.json({ theme: { theme: legacyTheme, updatedAt: parsed.updatedAt } });
}));

router.get("/themes", asyncHandler(async (req, res) => {
  const identity = await resolveIdentity(req);
  const rows = identity.isOwner
    ? await db.query<ThemeRow>("SELECT * FROM design_themes ORDER BY updated_at DESC LIMIT 300")
    : await db.query<ThemeRow>(
        "SELECT * FROM design_themes WHERE is_public = 1 OR owner_discord_id = @discordId ORDER BY updated_at DESC LIMIT 200",
        { discordId: identity.discordId },
      );
  const themes = rows.flatMap((row) => {
    try {
      const parsed = parseTheme(row);
      return [{ ...parsed, theme: validateTheme(parsed.theme) }];
    } catch { return []; }
  });
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ themes, isOwner: identity.isOwner });
}));

router.post("/themes", asyncHandler(async (req, res) => {
  const identity = await resolveIdentity(req);
  const body = readThemeBody(req.body);
  const id = crypto.randomUUID();
  await db.run(
    "INSERT INTO design_themes (id, owner_discord_id, name, description, data, is_default, is_public) VALUES (@id, @owner, @name, @description, @data, 0, 1)",
    { id, owner: identity.discordId, name: body.name, description: body.description, data: JSON.stringify(body.data) },
  );
  const row = await db.get<ThemeRow>("SELECT * FROM design_themes WHERE id = @id", { id });
  res.status(201).json({ theme: row ? parseTheme(row) : null });
}));

router.put("/themes/:id", asyncHandler(async (req, res) => {
  const identity = await resolveIdentity(req);
  const body = readThemeBody(req.body);
  const result = await db.run(
    "UPDATE design_themes SET name = @name, description = @description, data = @data, updated_at = CURRENT_TIMESTAMP WHERE id = @id AND owner_discord_id = @owner",
    { id: req.params.id, owner: identity.discordId, name: body.name, description: body.description, data: JSON.stringify(body.data) },
  );
  if (!result.changes) throw ApiError.notFound();
  const row = await db.get<ThemeRow>("SELECT * FROM design_themes WHERE id = @id", { id: req.params.id });
  res.json({ theme: row ? parseTheme(row) : null });
}));

router.delete("/themes/:id", asyncHandler(async (req, res) => {
  const identity = await resolveIdentity(req);
  const result = await db.run(
    "DELETE FROM design_themes WHERE id = @id AND owner_discord_id = @owner AND is_default = 0",
    { id: req.params.id, owner: identity.discordId },
  );
  if (!result.changes) throw ApiError.notFound();
  res.status(204).end();
}));

const publishServerTheme = async (identity: Identity, theme: unknown) => {
  requireOwner(identity);
  const safeTheme = validateTheme(theme);
  await db.run(
    "INSERT INTO server_theme_settings (id, theme_data, updated_by, updated_at) VALUES (1, @data, @owner, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET theme_data = excluded.theme_data, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP",
    { data: JSON.stringify(safeTheme), owner: identity.discordId },
  );
  return safeTheme;
};

router.post("/themes/:id/default", asyncHandler(async (req, res) => {
  const identity = await resolveIdentity(req);
  requireOwner(identity);
  const row = await db.get<ThemeRow>("SELECT * FROM design_themes WHERE id = @id", { id: req.params.id });
  if (!row) throw ApiError.notFound();
  const theme = await publishServerTheme(identity, parseTheme(row).theme);
  res.json({ theme: { ...parseTheme(row), theme, isDefault: true } });
}));

router.get("/access", asyncHandler(async (req, res) => {
  const identity = await resolveIdentity(req);
  requireOwner(identity);
  const allowedUsers = await db.query<{ discord_user_id: string; created_at: string }>(
    "SELECT discord_user_id, created_at FROM design_access_users WHERE is_active = 1 ORDER BY created_at DESC",
  );
  res.json({ allowed: true, isOwner: true, allowedUsers });
}));

router.post("/access", asyncHandler(async (req, res) => {
  const identity = await resolveIdentity(req);
  requireOwner(identity);
  const discordId = isRecord(req.body) && typeof req.body.discordId === "string" ? req.body.discordId.trim() : "";
  if (!/^\d{17,20}$/.test(discordId)) throw ApiError.badRequest("Enter a valid 17–20 digit Discord user ID.");
  if (env.ownerDiscordIds.includes(discordId)) throw ApiError.badRequest("That Discord ID is already an owner.");
  await db.run(
    "INSERT INTO design_access_users (discord_user_id, granted_by_discord_id, is_active) VALUES (@discordId, @grantedBy, 1) ON CONFLICT(discord_user_id) DO UPDATE SET is_active = 1, granted_by_discord_id = @grantedBy",
    { discordId, grantedBy: identity.discordId },
  );
  res.status(201).json({ ok: true, discordId });
}));

router.delete("/access/:discordId", asyncHandler(async (req, res) => {
  const identity = await resolveIdentity(req);
  requireOwner(identity);
  const discordId = String(req.params.discordId ?? "");
  if (!/^\d{17,20}$/.test(discordId)) throw ApiError.badRequest("Invalid Discord ID.");
  await db.run("UPDATE design_access_users SET is_active = 0 WHERE discord_user_id = @discordId", { discordId });
  res.status(204).end();
}));

router.put("/server-theme", asyncHandler(async (req, res) => {
  const identity = await resolveIdentity(req);
  requireOwner(identity);
  const theme = await publishServerTheme(identity, req.body?.theme);
  res.json({ theme: { theme, updatedAt: new Date().toISOString() } });
}));

router.post("/themes/:id/publish", asyncHandler(async (req, res) => {
  const identity = await resolveIdentity(req);
  requireOwner(identity);
  const row = await db.get<ThemeRow>("SELECT * FROM design_themes WHERE id = @id", { id: req.params.id });
  if (!row) throw ApiError.notFound();
  const theme = validateTheme(parseTheme(row).theme);
  await publishServerTheme(identity, theme);
  res.json({ theme: { theme, sourceThemeId: row.id, updatedAt: new Date().toISOString() } });
}));

export default router;
