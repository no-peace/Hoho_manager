import { Router } from "express";
import { requireHeadAdmin } from "../middleware/auth.js";
import { customExecutorRepository } from "../repositories/customExecutorRepository.js";
import { templateRepository } from "../repositories/templateRepository.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import { validateMessagePayload } from "../utils/validation.js";

const router = Router();
const EXECUTOR_ID_REGEX = /^[a-z0-9_-]{2,64}$/;
const DISCORD_SNOWFLAKE_REGEX = /^\d{17,20}$/;

router.get(
  "/",
  asyncHandler(async (req, res, next) => {
    const wantsAll = req.query.all === "true";
    if (wantsAll) {
      return requireHeadAdmin(req, res, async (err) => {
        if (err) return next(err);
        const list = await customExecutorRepository.list(false);
        return res.json({ executors: list });
      });
    }
    const list = await customExecutorRepository.list(true);
    return res.json({ executors: list });
  }),
);

router.post(
  "/",
  requireHeadAdmin,
  asyncHandler(async (req, res) => {
    const { id, title, enabled, author_id, template_id, custom_payload } = req.body ?? {};
    if (!id || typeof id !== "string" || !EXECUTOR_ID_REGEX.test(id.trim().toLowerCase())) {
      throw ApiError.badRequest("`id` must be 2–64 lowercase letters, numbers, `_`, or `-`");
    }
    if (!title || typeof title !== "string" || !title.trim() || title.trim().length > 100) {
      throw ApiError.badRequest("`title` must be a non-empty string (max 100 chars)");
    }

    let normalizedAuthorId: string | null = null;
    if (author_id !== undefined && author_id !== null && String(author_id).trim() !== "") {
      const trimmedAuthor = String(author_id).trim();
      if (!DISCORD_SNOWFLAKE_REGEX.test(trimmedAuthor)) {
        throw ApiError.badRequest("`author_id` must be a valid Discord user ID");
      }
      normalizedAuthorId = trimmedAuthor;
    }

    let normalizedTemplateId: number | null = null;
    if (template_id !== undefined && template_id !== null && template_id !== "") {
      const parsedId = Number(template_id);
      if (!Number.isSafeInteger(parsedId) || parsedId <= 0) {
        throw ApiError.badRequest("`template_id` must be a positive integer");
      }
      const tpl = await templateRepository.findById(parsedId);
      if (!tpl) {
        throw ApiError.notFound("Referenced template not found");
      }
      normalizedTemplateId = parsedId;
    }

    let serializedPayload: string | null = null;
    if (custom_payload !== undefined && custom_payload !== null && custom_payload !== "") {
      let parsedPayload: unknown = custom_payload;
      if (typeof custom_payload === "string") {
        try {
          parsedPayload = JSON.parse(custom_payload);
        } catch {
          throw ApiError.badRequest("`custom_payload` must be valid JSON");
        }
      }
      const validated = validateMessagePayload(parsedPayload) as Record<string, unknown>;
      delete validated.username;
      delete validated.avatar_url;
      serializedPayload = JSON.stringify(validated);
    }

    const saved = await customExecutorRepository.upsert({
      id: id.trim().toLowerCase(),
      title: title.trim(),
      enabled: enabled !== false,
      author_id: normalizedAuthorId,
      template_id: normalizedTemplateId,
      custom_payload: serializedPayload,
    });

    res.json({ ok: true, executor: saved });
  }),
);

router.delete(
  "/:id",
  requireHeadAdmin,
  asyncHandler(async (req, res) => {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id || typeof id !== "string") throw ApiError.badRequest("`id` is required");
    await customExecutorRepository.delete(id.trim().toLowerCase());
    res.json({ ok: true });
  }),
);

export default router;
