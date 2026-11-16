// server/src/routes/weao.ts
import { Router } from "express";
import type { ActionConfig, ActionType, DiscordMessagePayload, FlowRegistration } from "@dmb/shared";
import { db } from "../config/database.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import {
  getAllExploits,
  findExploitByName,
  interpolateWeaoPlaceholders,
  getExploitChangelogs,
  getExploitChangelogComparison,
  formatExploitChangelogs,
  getWeaoRateLimitStatus,
  type WeaoExploitRecord,
} from "../services/weaoService.js";
import {
  templateRepository,
  type TemplateSummary,
} from "../repositories/templateRepository.js";
import { actionRepository } from "../repositories/actionRepository.js";
import { customExecutorRepository } from "../repositories/customExecutorRepository.js";
import { resolveAuthorPlaceholders } from "../services/authorService.js";
import { logger } from "../utils/logger.js";
import { attachUser, requireUser } from "../middleware/auth.js";
import { requireStaffPermission } from "../middleware/staffPermissions.js";

const log = logger.child("weaoRoute");
const router = Router();

/** Only expose templates owned by the caller or explicitly marked public. */
const listVisibleTemplateSummaries = async (userId: number): Promise<TemplateSummary[]> =>
  db.query<TemplateSummary>(
    `SELECT id, user_id, name, description, preview_image_url, is_public, created_at, updated_at
       FROM templates
      WHERE is_public = 1 OR user_id = @userId
      ORDER BY updated_at DESC`,
    { userId },
  );

router.use(attachUser);


router.get(
  "/changelogs/:exploit",
  asyncHandler(async (req, res) => {
    const exploit = typeof req.params.exploit === "string" ? req.params.exploit.trim() : "";
    if (!exploit) throw ApiError.badRequest("`exploit` is required");
    const selector = typeof req.query.selector === "string" ? req.query.selector : "changelogs";
    const entries = await getExploitChangelogs(exploit);
    return res.json({ exploit, count: entries.length, entries, formatted: formatExploitChangelogs(entries, selector, getExploitChangelogComparison(exploit)) });
  }),
);

router.get(
  "/exploits",
  requireStaffPermission("weao"),
  asyncHandler(async (req, res) => {
    const userId = requireUser(req).id;
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";

    let exploits: WeaoExploitRecord[] = [];
    let templates: TemplateSummary[] = await listVisibleTemplateSummaries(userId);
    let customExecutors: any[] = [];

    try {
      customExecutors = await customExecutorRepository.list(true);
    } catch (err) {
      log.warn("Failed to list custom executors:", err);
    }

    try {
      exploits = await getAllExploits();
    } catch (err) {
      log.warn(
        `Failed to fetch exploits from WEAO: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    const visibleTemplateIds = new Set(templates.map((template) => template.id));
    customExecutors = customExecutors.filter(
      (executor) => !executor.template_id || visibleTemplateIds.has(executor.template_id),
    );

    // Convert custom executors to exploit records
    const customRecords: any[] = customExecutors
      .filter((c) => Boolean(c.template_id || c.custom_payload))
      .map((c) => ({
      _id: `custom_${c.id}`,
      title: c.title,
      version: "Custom",
      updatedDate: new Date(c.updated_at).toISOString().split("T")[0],
      updateStatus: true,
      hasBackupTemplate: true,
      backupTemplateId: c.template_id,
      backupTemplateName: c.title,
      isCustom: true,
      author_id: c.author_id,
    }));

    const allExploitsCombined = [
      ...customRecords,
      ...exploits.filter(
        (e) => !customRecords.some((c) => c.title.toLowerCase() === e.title.toLowerCase()),
      ),
    ];

    const filtered = q
      ? allExploitsCombined.filter((e) => e.title.toLowerCase().includes(q))
      : allExploitsCombined;

    const results = filtered.map((e) => {
      const matchedTemplate = templates.find(
        (t: TemplateSummary) =>
          t.name.toLowerCase() === e.title.toLowerCase() ||
          t.name.toLowerCase().includes(e.title.toLowerCase()),
      );
      return {
        ...e,
        hasBackupTemplate: Boolean(e.hasBackupTemplate || matchedTemplate),
        backupTemplateId: e.backupTemplateId ?? matchedTemplate?.id ?? null,
        backupTemplateName: e.backupTemplateName ?? matchedTemplate?.name ?? null,
      };
    });

    res.json({
      exploits: results,
      meta: getWeaoRateLimitStatus(),
    });
  }),
);

router.post(
  "/resolve-exploit",
  requireStaffPermission("weao"),
  asyncHandler(async (req, res) => {
    const userId = requireUser(req).id;
    const exploitQuery =
      typeof req.body?.exploit === "string" ? req.body.exploit.trim() : "";
    if (!exploitQuery) {
      throw ApiError.badRequest("`exploit` name is required");
    }

    // 1. Check for configured Custom Executor first
    const customExec =
      (await customExecutorRepository.findByTitle(exploitQuery)) ??
      (await customExecutorRepository.findById(exploitQuery));

    if (customExec) {
      let basePayload: DiscordMessagePayload | null = null;

      if (customExec.template_id) {
        const fullTemplate = await templateRepository.findById(customExec.template_id);
        if (
          !fullTemplate ||
          (fullTemplate.user_id !== userId && !fullTemplate.is_public)
        ) {
          throw ApiError.notFound("Configured backup template not found");
        }
        const rawDoc = fullTemplate.data as any;
        basePayload =
          rawDoc?.messages?.[0]?.data?.data ??
          rawDoc?.messages?.[0]?.data ??
          rawDoc ??
          basePayload;
      } else if (customExec.custom_payload) {
        try {
          const parsed = JSON.parse(customExec.custom_payload);
          if (parsed && typeof parsed === "object") {
            delete parsed.username;
            delete parsed.avatar_url;
            basePayload = parsed;
          }
        } catch {}
      }

      if (!basePayload) {
        throw ApiError.notFound(`No saved message template is configured for "${customExec.title}"`);
      }

      const { payload: interpolated } = await interpolateWeaoPlaceholders(
        basePayload,
        customExec.title,
      );

      const authorRes = await resolveAuthorPlaceholders(
        interpolated,
        customExec.author_id,
      );

      let flows: FlowRegistration[] = [];
      if (customExec.template_id) {
        const storedActions = await actionRepository.listByTemplate(customExec.template_id);
        const flowsMap = new Map<string, { type: ActionType; config: ActionConfig }[]>();
        for (const action of storedActions) {
          const steps = flowsMap.get(action.custom_id) ?? [];
          steps.push({
            type: action.action_type as ActionType,
            config: action.config ?? {},
          });
          flowsMap.set(action.custom_id, steps);
        }
        flows = Array.from(flowsMap.entries()).map(([customId, steps]) => ({
          customId,
          steps,
        }));
      }

      return res.json({
        source: "custom_executor",
        templateId: customExec.template_id,
        templateName: customExec.title,
        exploit: {
          title: customExec.title,
          version: "Custom",
          updateStatus: true,
          platform: "Custom",
        },
        payload: authorRes.payload,
        actionsCount: flows.length,
        flows,
      });
    }

    // 2. Check WEAO Exploit Catalog
    const exploit = await findExploitByName(exploitQuery);
    if (!exploit) {
      throw ApiError.notFound(`No exploit matching "${exploitQuery}" found`);
    }

    const allTemplates = await listVisibleTemplateSummaries(userId);
    const matchedSummary =
      allTemplates.find(
        (t: TemplateSummary) => t.name.trim().toLowerCase() === exploit.title.toLowerCase(),
      ) ??
      allTemplates.find(
        (t: TemplateSummary) =>
          t.name.toLowerCase().includes(exploit.title.toLowerCase()) ||
          exploit.title.toLowerCase().includes(t.name.trim().toLowerCase()),
      );

    if (matchedSummary) {
      const fullTemplate = await templateRepository.findById(matchedSummary.id);
      const rawDoc = fullTemplate?.data as any;
      const firstMsg =
        rawDoc?.messages?.[0]?.data?.data ??
        rawDoc?.messages?.[0]?.data ??
        rawDoc ??
        {};

      const { payload: interpolated } = await interpolateWeaoPlaceholders(
        firstMsg,
        exploit.title,
      );

      const authorRes = await resolveAuthorPlaceholders(interpolated);

      const storedActions = await actionRepository.listByTemplate(matchedSummary.id);

      const flowsMap = new Map<string, { type: ActionType; config: ActionConfig }[]>();
      for (const action of storedActions) {
        const steps = flowsMap.get(action.custom_id) ?? [];
        steps.push({
          type: action.action_type as ActionType,
          config: action.config ?? {},
        });
        flowsMap.set(action.custom_id, steps);
      }
      const flows: FlowRegistration[] = Array.from(flowsMap.entries()).map(([customId, steps]) => ({
        customId,
        steps,
      }));

      return res.json({
        source: "backup_template",
        templateId: matchedSummary.id,
        templateName: matchedSummary.name,
        exploit,
        payload: authorRes.payload,
        actionsCount: storedActions.length,
        flows,
      });
    }

    throw ApiError.notFound(`No saved message template is configured for "${exploit.title}"`);
  }),
);

export default router;