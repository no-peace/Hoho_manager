import { Router } from "express";
import type { QueryData } from "@dmb/shared";
import { attachUser, requireUser } from "../middleware/auth.js";
import { requireStaffPermission } from "../middleware/staffPermissions.js";
import { templateService } from "../services/templateService.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { containsWeaoPlaceholder, optionalFlag, optionalString, parseStoredActionDefinitions, requireId, requireStrings } from "../utils/validation.js";

const router = Router();

// Every template route acts on behalf of a user.
router.use(attachUser);

const readBody = (body: unknown): Record<string, unknown> => {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw ApiError.badRequest("Request body must be a JSON object.");
  }
  return body as Record<string, unknown>;
};

const parseDescription = (value: unknown): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw ApiError.badRequest("`description` must be a string or null.");
  }
  return value.trim() || null;
};

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
  requireStaffPermission("templates"),
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

    const actions = body.actions === undefined ? [] : parseStoredActionDefinitions(body.actions);
    if (
      req.staffContext &&
      !req.staffContext.isAdmin &&
      req.staffContext.record?.can_use_weao_exploits === 0 &&
      (containsWeaoPlaceholder(body.data) || containsWeaoPlaceholder(actions))
    ) {
      throw ApiError.forbidden("Your staff account is not permitted to use WEAO placeholders in template data or actions.");
    }
    const template = await templateService.create(requireUser(req).id, {
      name: String(body.name),
      description: parseDescription(body.description) ?? null,
      data: body.data as QueryData,
      actions,
      isPublic: optionalFlag(body.isPublic) ?? 0,
      expiresAt: parseExpiresAt(body.expiresAt),
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
    const actions = body.actions === undefined ? undefined : parseStoredActionDefinitions(body.actions);
    if (
      req.staffContext &&
      !req.staffContext.isAdmin &&
      req.staffContext.record?.can_use_weao_exploits === 0 &&
      (containsWeaoPlaceholder(body.data) || (actions !== undefined && containsWeaoPlaceholder(actions)))
    ) {
      throw ApiError.forbidden("Your staff account is not permitted to use WEAO variables in template actions.");
    }
    const template = await templateService.update(
      requireId(req.params.id),
      requireUser(req).id,
      {
        name: optionalString(body.name),
        description: parseDescription(body.description),
        data: body.data as QueryData | undefined,
        actions,
        isPublic: optionalFlag(body.isPublic),
        expiresAt: parseExpiresAt(body.expiresAt),
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
