import { Router } from "express";
import { attachUser } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/auth.js";
import { customExecutorRepository } from "../repositories/customExecutorRepository.js";
import { asyncHandler, ApiError } from "../utils/errors.js";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const onlyEnabled = req.query.all !== "true";
    const list = await customExecutorRepository.list(onlyEnabled);
    res.json({ executors: list });
  }),
);

router.post(
  "/",
  attachUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id, title, enabled, author_id, template_id, custom_payload } = req.body;
    if (!id || typeof id !== "string") {
      throw ApiError.badRequest("`id` is required");
    }
    if (!title || typeof title !== "string") {
      throw ApiError.badRequest("`title` is required");
    }

    const saved = await customExecutorRepository.upsert({
      id: id.trim().toLowerCase(),
      title: title.trim(),
      enabled: enabled !== false,
      author_id: typeof author_id === "string" ? author_id.trim() : null,
      template_id: template_id ? Number(template_id) : null,
      custom_payload: custom_payload ? (typeof custom_payload === "string" ? custom_payload : JSON.stringify(custom_payload)) : null,
    });

    res.json({ ok: true, executor: saved });
  }),
);

router.delete(
  "/:id",
  attachUser,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id || typeof id !== "string") throw ApiError.badRequest("`id` is required");
    await customExecutorRepository.delete(id.trim().toLowerCase());
    res.json({ ok: true });
  }),
);

export default router;
