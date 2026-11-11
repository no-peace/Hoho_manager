// server/src/routes/weao.ts
import { Router } from "express";
import { ComponentType, ButtonStyle } from "@dmb/shared";
import type { ActionConfig, ActionType, DiscordMessagePayload, FlowRegistration } from "@dmb/shared";
import { db } from "../config/database.js";
import { asyncHandler, ApiError } from "../utils/errors.js";
import {
  getAllExploits,
  findExploitByName,
  getExploitSuncDetails,
  interpolateWeaoPlaceholders,
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

const log = logger.child("weaoRoute");
const router = Router();

/** List all saved templates across users so `/exploit` can match any saved exploit backup. */
const listAllTemplateSummaries = async (): Promise<TemplateSummary[]> =>
  db.query<TemplateSummary>(
    `SELECT id, user_id, name, description, preview_image_url, is_public, created_at, updated_at
       FROM templates
      ORDER BY updated_at DESC`,
  );

const buildAdaptiveExploitPayload = async (
  exploit: WeaoExploitRecord,
): Promise<DiscordMessagePayload> => {
  const suncDetails = await getExploitSuncDetails(exploit);
  const passed = suncDetails?.tests?.passed?.length;
  const failed = suncDetails?.tests?.failed?.length;
  const suncDisplay =
    typeof exploit.suncPercentage === "number"
      ? `${exploit.suncPercentage}%`
      : typeof passed === "number" && typeof failed === "number" && passed + failed > 0
        ? `${Math.round((passed / (passed + failed)) * 100)}% (${passed}/${passed + failed})`
        : "N/A";

  const buttons: any[] = [];
  if (exploit.websitelink) {
    buttons.push({
      type: ComponentType.Button,
      style: ButtonStyle.Link,
      label: "Website",
      url: exploit.websitelink,
    });
  }
  if (exploit.discordlink) {
    buttons.push({
      type: ComponentType.Button,
      style: ButtonStyle.Link,
      label: "Discord",
      url: exploit.discordlink,
    });
  }
  if (exploit.purchaselink) {
    buttons.push({
      type: ComponentType.Button,
      style: ButtonStyle.Link,
      label: "Purchase",
      url: exploit.purchaselink,
    });
  }

  return {
    embeds: [
      {
        title: `${exploit.updateStatus ? "🟢" : "🔴"} ${exploit.title}  Live Executor Status`,
        color: exploit.updateStatus ? 0x23a55a : 0xda373c,
        fields: [
          {
            name: "Status",
            value: exploit.updateStatus ? "🟢 Updated" : "🔴 Outdated",
            inline: true,
          },
          {
            name: "Version",
            value: `\`${exploit.version || "Unknown"}\``,
            inline: true,
          },
          {
            name: "sUNC / UNC",
            value: `**sUNC:** ${suncDisplay} • **UNC:** ${
              typeof exploit.uncPercentage === "number" ? `${exploit.uncPercentage}%` : "N/A"
            }`,
            inline: true,
          },
          {
            name: "Platform & Cost",
            value: `${exploit.platform || "Windows"} • ${
              exploit.free ? "Free" : exploit.cost || "Paid"
            }`,
            inline: true,
          },
          {
            name: "Detection & Features",
            value: `${exploit.detected ? "⚠️ Detected" : "🛡️ Undetected"} • Decompiler: ${
              exploit.decompiler ? "✅" : "❌"
            } • Key: ${exploit.keysystem ? "🔑" : "🔓"}`,
            inline: true,
          },
          {
            name: "Last Updated",
            value: exploit.updatedDate || "Unknown",
            inline: true,
          },
        ],
        footer: {
          text: `Roblox Target: ${exploit.rbxversion || "Unknown"} • Powered by WEAO API`,
        },
      },
    ],
    ...(buttons.length > 0
      ? {
          components: [
            {
              type: ComponentType.ActionRow,
              components: buttons.slice(0, 5),
            },
          ],
        }
      : {}),
  };
};

router.get(
  "/exploits",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";

    let exploits: WeaoExploitRecord[] = [];
    let templates: TemplateSummary[] = [];
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

    try {
      templates = await listAllTemplateSummaries();
    } catch (err) {
      log.warn("Failed to list templates from summaries:", err);
    }

    // Convert custom executors to exploit records
    const customRecords: any[] = customExecutors.map((c) => ({
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
  asyncHandler(async (req, res) => {
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
      let basePayload: DiscordMessagePayload = {
        embeds: [
          {
            title: customExec.title,
            description: `# ${customExec.title}\n> Live status card for ${customExec.title}`,
            color: 0x23a55a,
          },
        ],
      };

      if (customExec.template_id) {
        const fullTemplate = await templateRepository.findById(customExec.template_id);
        const rawDoc = fullTemplate?.data as any;
        basePayload =
          rawDoc?.messages?.[0]?.data?.data ??
          rawDoc?.messages?.[0]?.data ??
          rawDoc ??
          basePayload;
      } else if (customExec.custom_payload) {
        try {
          basePayload = JSON.parse(customExec.custom_payload);
        } catch {}
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

    const allTemplates = await listAllTemplateSummaries();
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

    const fallbackPayload = await buildAdaptiveExploitPayload(exploit);
    const authorRes = await resolveAuthorPlaceholders(fallbackPayload);
    return res.json({
      source: "adaptive_default",
      templateId: null,
      templateName: null,
      exploit,
      payload: authorRes.payload,
      actionsCount: 0,
      flows: [],
    });
  }),
);

export default router;