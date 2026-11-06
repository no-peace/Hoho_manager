// server/src/routes/weao.ts
import { Router } from "express";
import { ComponentType, ButtonStyle } from "@dmb/shared";
import type { DiscordMessagePayload } from "@dmb/shared";
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
        title: `${exploit.updateStatus ? "🟢" : "🔴"} ${exploit.title} — Live Executor Status`,
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

    const filtered = q
      ? exploits.filter((e) => e.title.toLowerCase().includes(q))
      : exploits;

    const results = filtered.map((e) => {
      const matchedTemplate = templates.find(
        (t: TemplateSummary) =>
          t.name.toLowerCase() === e.title.toLowerCase() ||
          t.name.toLowerCase().includes(e.title.toLowerCase()),
      );
      return {
        ...e,
        hasBackupTemplate: Boolean(matchedTemplate),
        backupTemplateId: matchedTemplate?.id ?? null,
        backupTemplateName: matchedTemplate?.name ?? null,
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

    const exploit = await findExploitByName(exploitQuery);
    if (!exploit) {
      throw ApiError.notFound(`No exploit matching "${exploitQuery}" found on WEAO`);
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

      const storedActions = await actionRepository.listByTemplate(matchedSummary.id);

      return res.json({
        source: "backup_template",
        templateId: matchedSummary.id,
        templateName: matchedSummary.name,
        exploit,
        payload: interpolated,
        actionsCount: storedActions.length,
      });
    }

    const fallbackPayload = await buildAdaptiveExploitPayload(exploit);
    return res.json({
      source: "adaptive_default",
      templateId: null,
      templateName: null,
      exploit,
      payload: fallbackPayload,
      actionsCount: 0,
    });
  }),
);

export default router;