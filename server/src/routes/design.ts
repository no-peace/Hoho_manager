import { Router } from "express";
import crypto from "node:crypto";
import { db } from "../config/database.js";
import { env } from "../config/env.js";
import { getSessionUserFromRequest } from "../utils/session.js";
import { ApiError, asyncHandler } from "../utils/errors.js";

const router = Router();

interface DesignIdentity { discordId: string; isOwner: boolean; }
interface ThemeRow {
  id: string; owner_discord_id: string; name: string; description: string | null;
  data: string; is_default: number; created_at: string; updated_at: string;
}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const resolveIdentity = async (req: Parameters<typeof getSessionUserFromRequest>[0]): Promise<DesignIdentity> => {
  const session = await getSessionUserFromRequest(req);
  if (!session) throw ApiError.notFound();
  const isOwner = env.ownerDiscordIds.includes(session.id) || (!env.isProd && session.role === "admin");
  if (isOwner) return { discordId: session.id, isOwner: true };
  const access = await db.get<{ is_active: number }>(
    "SELECT is_active FROM design_access_users WHERE discord_user_id = @discordId",
    { discordId: session.id },
  );
  if (!access || access.is_active !== 1) throw ApiError.notFound();
  return { discordId: session.id, isOwner: false };
};

const requireOwner = (identity: DesignIdentity): void => {
  if (!identity.isOwner) throw ApiError.forbidden("Only the Design Lab owner can perform this action.");
};

const parseTheme = (row: ThemeRow) => {
  let data: unknown = {};
  try { data = JSON.parse(row.data) as unknown; } catch { data = {}; }
  return {
    id: row.id, ownerDiscordId: row.owner_discord_id, name: row.name,
    description: row.description, data, isDefault: row.is_default === 1,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
};

const readThemeBody = (body: unknown) => {
  if (!isRecord(body)) throw ApiError.badRequest("A theme object is required.");
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 80) throw ApiError.badRequest("Theme name must contain 1–80 characters.");
  if (!isRecord(body.data)) throw ApiError.badRequest("Theme data must be a JSON object.");
  const serialized = JSON.stringify(body.data);
  if (Buffer.byteLength(serialized, "utf8") > 900_000) throw ApiError.badRequest("Theme data is too large. Keep a theme below 900 KB.");
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 240) : null;
  return { name, description: description || null, data: body.data };
};

router.get("/default", asyncHandler(async (_req, res) => {
  const row = await db.get<ThemeRow>("SELECT * FROM design_themes WHERE is_default = 1 LIMIT 1");
  res.json({ theme: row ? parseTheme(row) : null });
}));

router.get("/access", asyncHandler(async (req, res) => {
  const identity = await resolveIdentity(req);
  const allowedUsers = identity.isOwner
    ? await db.query<{ discord_user_id: string; created_at: string }>(
        "SELECT discord_user_id, created_at FROM design_access_users WHERE is_active = 1 ORDER BY created_at DESC",
      )
    : [];
  res.json({ allowed: true, isOwner: identity.isOwner, allowedUsers });
}));

router.get("/themes", asyncHandler(async (req, res) => {
  const identity = await resolveIdentity(req);
  const rows = await db.query<ThemeRow>(
    "SELECT * FROM design_themes WHERE owner_discord_id = @discordId OR is_default = 1 ORDER BY is_default DESC, updated_at DESC",
    { discordId: identity.discordId },
  );
  res.json({ themes: rows.map(parseTheme) });
}));

router.post("/themes", asyncHandler(async (req, res) => {
  const identity = await resolveIdentity(req);
  const body = readThemeBody(req.body);
  const id = crypto.randomUUID();
  await db.run(
    "INSERT INTO design_themes (id, owner_discord_id, name, description, data, is_default) VALUES (@id, @ownerDiscordId, @name, @description, @data, 0)",
    { id, ownerDiscordId: identity.discordId, name: body.name, description: body.description, data: JSON.stringify(body.data) },
  );
  const row = await db.get<ThemeRow>("SELECT * FROM design_themes WHERE id = @id", { id });
  res.status(201).json({ theme: row ? parseTheme(row) : null });
}));

router.put("/themes/:id", asyncHandler(async (req, res) => {
  const identity = await resolveIdentity(req);
  const body = readThemeBody(req.body);
  const result = await db.run(
    "UPDATE design_themes SET name = @name, description = @description, data = @data, updated_at = CURRENT_TIMESTAMP WHERE id = @id AND owner_discord_id = @ownerDiscordId",
    { id: req.params.id, ownerDiscordId: identity.discordId, name: body.name, description: body.description, data: JSON.stringify(body.data) },
  );
  if (result.changes === 0) throw ApiError.notFound();
  const row = await db.get<ThemeRow>("SELECT * FROM design_themes WHERE id = @id", { id: req.params.id });
  res.json({ theme: row ? parseTheme(row) : null });
}));

router.delete("/themes/:id", asyncHandler(async (req, res) => {
  const identity = await resolveIdentity(req);
  const result = await db.run(
    "DELETE FROM design_themes WHERE id = @id AND owner_discord_id = @ownerDiscordId",
    { id: req.params.id, ownerDiscordId: identity.discordId },
  );
  if (result.changes === 0) throw ApiError.notFound();
  res.status(204).end();
}));

router.post("/themes/:id/default", asyncHandler(async (req, res) => {
  const identity = await resolveIdentity(req);
  requireOwner(identity);
  const target = await db.get<ThemeRow>(
    "SELECT * FROM design_themes WHERE id = @id AND owner_discord_id = @ownerDiscordId",
    { id: req.params.id, ownerDiscordId: identity.discordId },
  );
  if (!target) throw ApiError.notFound();
  await db.transaction(async () => {
    await db.run("UPDATE design_themes SET is_default = 0 WHERE is_default = 1");
    await db.run("UPDATE design_themes SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = @id", { id: target.id });
  });
  const updated = await db.get<ThemeRow>("SELECT * FROM design_themes WHERE id = @id", { id: target.id });
  res.json({ theme: updated ? parseTheme(updated) : null });
}));

router.post("/access", asyncHandler(async (req, res) => {
  const identity = await resolveIdentity(req);
  requireOwner(identity);
  const discordId = isRecord(req.body) && typeof req.body.discordId === "string" ? req.body.discordId.trim() : "";
  if (!/^\d{17,20}$/.test(discordId)) throw ApiError.badRequest("Enter a valid 17–20 digit Discord user ID.");
  if (env.ownerDiscordIds.includes(discordId)) throw ApiError.badRequest("That Discord ID is already configured as an owner.");
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

export default router;
