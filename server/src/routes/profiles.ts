import { Router } from "express";
import { attachUser, requireHeadAdmin, requireRole, requireUser } from "../middleware/auth.js";
import { botProfileService, webhookProfileService } from "../services/profileService.js";
import { asyncHandler } from "../utils/errors.js";
import { optionalFlag, optionalString, requireId, requireStrings } from "../utils/validation.js";

const router = Router();

router.use(attachUser, requireHeadAdmin);

const readBody = (body: unknown): Record<string, unknown> =>
  (body ?? {}) as Record<string, unknown>;

/* ── Webhook profiles ─────────────────────────────────────────────────────── */

router.get(
  "/webhooks",
  asyncHandler(async (req, res) => {
    res.json({ profiles: await webhookProfileService.list(requireUser(req).id) });
  }),
);

router.post(
  "/webhooks",
  asyncHandler(async (req, res) => {
    const body = readBody(req.body);
    requireStrings(body, ["name", "url"]);

    const profile = await webhookProfileService.create(requireUser(req).id, {
      name: String(body.name),
      url: String(body.url),
      avatarUrl: optionalString(body.avatarUrl) ?? null,
      isDefault: optionalFlag(body.isDefault) ?? 0,
    });
    res.status(201).json({ profile });
  }),
);

router.patch(
  "/webhooks/:id",
  asyncHandler(async (req, res) => {
    const body = readBody(req.body);
    const profile = await webhookProfileService.update(
      requireId(req.params.id),
      requireUser(req).id,
      {
        name: optionalString(body.name),
        url: optionalString(body.url),
        avatar_url: optionalString(body.avatarUrl),
        is_default: optionalFlag(body.isDefault),
      },
    );
    res.json({ profile });
  }),
);

router.post(
  "/webhooks/:id/default",
  asyncHandler(async (req, res) => {
    const profile = await webhookProfileService.setDefault(
      requireId(req.params.id),
      requireUser(req).id,
    );
    res.json({ profile });
  }),
);

router.delete(
  "/webhooks/:id",
  asyncHandler(async (req, res) => {
    await webhookProfileService.remove(requireId(req.params.id), requireUser(req).id);
    res.status(204).end();
  }),
);

/* ── Bot profiles (admin only — these hold credentials) ───────────────────── */

router.get(
  "/bots",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    res.json({ profiles: await botProfileService.list(requireUser(req).id) });
  }),
);

router.post(
  "/bots",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const body = readBody(req.body);
    requireStrings(body, ["name", "token", "applicationId", "publicKey"]);

    const profile = await botProfileService.create(requireUser(req).id, {
      name: String(body.name),
      token: String(body.token),
      applicationId: String(body.applicationId),
      publicKey: String(body.publicKey),
      defaultGuildId: optionalString(body.defaultGuildId) ?? null,
    });
    res.status(201).json({ profile });
  }),
);

router.patch(
  "/bots/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const body = readBody(req.body);
    const profile = await botProfileService.update(
      requireId(req.params.id),
      requireUser(req).id,
      {
        name: optionalString(body.name),
        token: optionalString(body.token),
        public_key: optionalString(body.publicKey),
        application_id: optionalString(body.applicationId),
        default_guild_id: optionalString(body.defaultGuildId),
        is_active: optionalFlag(body.isActive),
      },
    );
    res.json({ profile });
  }),
);

router.delete(
  "/bots/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await botProfileService.remove(requireId(req.params.id), requireUser(req).id);
    res.status(204).end();
  }),
);

export default router;
