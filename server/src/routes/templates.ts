import { Router } from "express";
import type { QueryData, StoredActionDefinition } from "@dmb/shared";
import { attachUser, requireUser } from "../middleware/auth.js";
import { requireStaffPermission } from "../middleware/staffPermissions.js";
import { templateService } from "../services/templateService.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { optionalFlag, optionalString, requireId, requireStrings } from "../utils/validation.js";

const router = Router();

// Every template route acts on behalf of a user.
router.use(attachUser);

const readBody = (body: unknown): Record<string, unknown> =>
  (body ?? {}) as Record<string, unknown>;

const parseExpiresAt = (raw: unknown): string | null | undefined => {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") {
    throw ApiError.badRequest("`expiresAt` must be an ISO date string or null");
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw ApiError.badRequest("`expiresAt` must be a valid date/time");
  }
  if (parsed.getTime() <= Date.now()) {
    throw ApiError.badRequest("`expiresAt` must be in the future");
  }
  return parsed.toISOString();
};

/** GET /api/templates?q=search  list the current user's templates. */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    res.json({ templates: await templateService.list(requireUser(req).id, { q }) });
  }),
);

/** GET /api/templates/:id  full template document including its actions. */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const template = await templateService.get(
      requireId(req.params.id),
      requireUser(req).id,
    );
    res.json({ template });
  }),
);

/** POST /api/templates — create a template (optionally with its action chain). */
router.post(
  "/",
  requireStaffPermission("templates"),
  asyncHandler(async (req, res) => {
    const body = readBody(req.body);
    requireStrings(body, ["name"]);
    if (body.data === undefined) throw ApiError.badRequest("`data` is required");

    const template = await templateService.create(requireUser(req).id, {
      name: String(body.name),
      description: optionalString(body.description) ?? null,
      data: body.data as QueryData,
      actions: Array.isArray(body.actions) ? (body.actions as StoredActionDefinition[]) : [],
      isPublic: optionalFlag(body.isPublic) ?? 0,
      expiresAt: parseExpiresAt(body.expiresAt),
      isTracked: optionalFlag(body.isTracked) ?? 0,
    });
    res.status(201).json({ template });
  }),
);

/** PUT /api/templates/:id — partial update; `actions` replaces the whole chain. */
router.put(
  "/:id",
  requireStaffPermission("templates"),
  asyncHandler(async (req, res) => {
    const body = readBody(req.body);
    const template = await templateService.update(
      requireId(req.params.id),
      requireUser(req).id,
      {
        name: optionalString(body.name),
        description: optionalString(body.description) ?? null,
        data: body.data as QueryData | undefined,
        actions: Array.isArray(body.actions)
          ? (body.actions as StoredActionDefinition[])
          : undefined,
        isPublic: optionalFlag(body.isPublic),
        expiresAt: parseExpiresAt(body.expiresAt),
        isTracked: optionalFlag(body.isTracked),
      },
    );
    res.json({ template });
  }),
);

/** DELETE /api/templates/:id */
router.delete(
  "/:id",
  requireStaffPermission("templates"),
  asyncHandler(async (req, res) => {
    await templateService.remove(requireId(req.params.id), requireUser(req).id);
    res.status(204).end();
  }),
);

export default router;
