import { Router } from "express";
import { attachUser } from "../middleware/auth.js";
import { requireStaffPermission } from "../middleware/staffPermissions.js";
import { sendLimiter } from "../middleware/rateLimit.js";
import { actionRepository } from "../repositories/actionRepository.js";
import * as discord from "../services/discordService.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { parseFlowRegistrations, validateMessagePayload } from "../utils/validation.js";

const router = Router();
const log = logger.child("send");

const parseProfileId = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "" || value === "null") return null;
  if (typeof value !== "string" && typeof value !== "number") {
    throw ApiError.badRequest("`profileId` must be a positive integer");
  }
  const profileId = Number(value);
  if (!Number.isSafeInteger(profileId) || profileId <= 0) {
    throw ApiError.badRequest("`profileId` must be a positive integer");
  }
  return profileId;
};

router.post(
  "/",
  attachUser,
  sendLimiter,
  requireStaffPermission("send"),
  asyncHandler(async (req, res) => {
    const { mode, payload: rawPayload, channelId, webhookUrl, threadId, profileId: rawProfileId, editMessageId, ...body } = req.body;
    const profileId = parseProfileId(rawProfileId);

    if (mode !== "bot" && mode !== "webhook") {
      throw ApiError.badRequest('`mode` must be "bot" or "webhook"');
    }

    // STRICT SANITIZATION: Remove internal IDs and empty arrays that cause Invalid Form Body
    const message = validateMessagePayload(rawPayload);
    if (message.embeds && message.embeds.length === 0) delete message.embeds;
    if (message.components && message.components.length === 0) delete message.components;
    if (message.flags === 0) delete message.flags;
    
    // Cleanse UI-only _id properties recursively
    const cleanseIds = (obj: any): any => {
      if (Array.isArray(obj)) return obj.map(cleanseIds);
      if (obj !== null && typeof obj === 'object') {
        const newObj: any = {};
        for (const [k, v] of Object.entries(obj)) {
          if (k !== '_id') newObj[k] = cleanseIds(v);
        }
        return newObj;
      }
      return obj;
    };
    const sanitizedMessage = cleanseIds(message);

    // For staff sends (x-staff-id present), scrub disallowed mentions and log
    const staffCtx = req.staffContext;
    let finalMessage = sanitizedMessage;
    if (staffCtx && !staffCtx.isAdmin && staffCtx.record) {
      const { scrubMentions, sanitizeAllowedMentions } = await import("../utils/mentionScrubber.js");
      const { payload: scrubbed, stripped } = scrubMentions(sanitizedMessage, staffCtx.record);
      finalMessage = sanitizeAllowedMentions(scrubbed, staffCtx.record);
      if (stripped.length > 0) {
        const { auditLog } = await import("../services/auditLog.js");
        auditLog({
          event: "MENTION_BLOCKED",
          actorDiscordId: staffCtx.staffId ?? undefined,
          channelId: typeof req.body.channelId === "string" ? req.body.channelId : undefined,
          reason: `Stripped disallowed mentions: ${stripped.join(", ")}`,
          ip: req.ip,
        });
      }
    } else {
      finalMessage = sanitizedMessage;
    }

    const rawFlows = parseFlowRegistrations(body.flows);
    let flows = rawFlows;
    if (staffCtx && !staffCtx.isAdmin && staffCtx.record) {
      const { scrubFlows } = await import("../utils/mentionScrubber.js");
      const { flows: scrubbedFlows, stripped: strippedFlows } = scrubFlows(rawFlows, staffCtx.record);
      flows = scrubbedFlows;
      if (strippedFlows.length > 0) {
        const { auditLog } = await import("../services/auditLog.js");
        auditLog({
          event: "MENTION_BLOCKED",
          actorDiscordId: staffCtx.staffId ?? undefined,
          channelId: typeof req.body.channelId === "string" ? req.body.channelId : undefined,
          reason: `Stripped disallowed mentions in flows: ${strippedFlows.join(", ")}`,
          ip: req.ip,
        });
      }
    }

    const registerMessageFlows = async (sentMessage: unknown): Promise<void> => {
      const messageId =
        sentMessage !== null && typeof sentMessage === "object"
          ? (sentMessage as Record<string, unknown>).id
          : undefined;
      if (typeof messageId !== "string") {
        if (flows.length > 0) {
          log.warn("Message was sent without an ID; its action flows could not be registered");
        }
        return;
      }
      await actionRepository.registerFlows(messageId, flows);
      if (flows.length > 0) {
        log.info(`Registered ${flows.length} action flow(s) for message ${messageId}`);
      }
    };

    if (mode === "webhook") {
      if (typeof webhookUrl !== "string") {
        throw ApiError.badRequest('`webhookUrl` is required when mode is "webhook"');
      }
      const sent = await discord.sendWebhook(webhookUrl, finalMessage, {
        wait: true,
        threadId: typeof threadId === "string" ? threadId : null,
      });
      await registerMessageFlows(sent);
      log.info(`Webhook send by user ${req.user?.id ?? "?"}`);
      return res.json({ ok: true, mode, message: sent });
    }

    if (typeof channelId !== "string") {
      throw ApiError.badRequest('`channelId` is required when mode is "bot"');
    }

    let sent;
    if (typeof editMessageId === "string" && editMessageId.trim() !== "") {
      sent = await discord.editChannelMessage(channelId, editMessageId, finalMessage, {
        profileId,
      });
      log.info(`Bot edited message ${editMessageId} in ${channelId} by user ${req.user?.id ?? "?"}`);
    } else {
      sent = await discord.sendChannelMessage(channelId, finalMessage, {
        profileId,
      });
      log.info(`Bot send to ${channelId} by user ${req.user?.id ?? "?"}`);
    }

    await registerMessageFlows(sent);

    // Audit log for staff sends
    if (staffCtx && !staffCtx.isAdmin && staffCtx.staffId) {
      const { auditLog } = await import("../services/auditLog.js");
      auditLog({
        event: (typeof editMessageId === "string" && editMessageId.trim() !== "") ? "EDIT_MESSAGE" : "SEND_MESSAGE",
        actorDiscordId: staffCtx.staffId,
        actorUsername: staffCtx.record?.discord_username,
        channelId: typeof channelId === "string" ? channelId : undefined,
        messageId: typeof editMessageId === "string" ? editMessageId : undefined,
        ip: req.ip,
      });
    }

    return res.json({ ok: true, mode, message: sent });
  }),
);

// ... KEEP YOUR EXISTING GET ROUTES BELOW THIS

router.get("/channels", attachUser, requireStaffPermission("send"), asyncHandler(async (req, res) => {
  const profileId = parseProfileId(req.query.profileId);
  const queryGuildId = typeof req.query.guildId === "string" && req.query.guildId.trim()
    ? req.query.guildId.trim()
    : undefined;

  let targetGuildId = queryGuildId;
  if (!targetGuildId) {
    const [guild] = await discord.getBotGuilds(profileId);
    targetGuildId = guild?.id;
  }
  if (!targetGuildId) return res.json([]);

  const channels = await discord.getGuildChannels(targetGuildId, profileId);
  
  let filteredChannels = channels;
  const staffCtx = req.staffContext;
  if (staffCtx && !staffCtx.isAdmin && staffCtx.record) {
    try {
      const allowed = JSON.parse(staffCtx.record.allowed_channel_ids);
      const allAllowed = allowed.includes("*");
      if (!allAllowed) {
        filteredChannels = channels.filter((c: any) => allowed.includes(c.id));
      }
    } catch {
      filteredChannels = [];
    }
  }

  res.json(
    filteredChannels
      .filter((channel: any) => channel.type === 0 || channel.type === 5)
      .map(({ id, name }: any) => ({ id, name })),
  );
}));

// GET /api/send/channels/:channelId/messages - Fetches recent messages sent by the bot
router.get("/channels/:channelId/messages", attachUser, requireStaffPermission("edit"), asyncHandler(async (req, res) => {
  const profileId = parseProfileId(req.query.profileId);
  const channelId = req.params.channelId;
  if (typeof channelId !== "string") {
    throw ApiError.badRequest("`channelId` must be a string");
  }
  const token = await discord.resolveBotToken(profileId);
  const me = await discord.getBotIdentity(token);
  if (!me?.id) return res.json([]);

  const messages = await discord.getChannelMessages(channelId, profileId);

  // NEW: Filter out slash command interactions so they don't clutter the Edit dropdown
  const botMessages = messages
    .filter((message: any) => message.author?.id === me.id && !message.interaction && !message.interaction_metadata)
    .map((message: any) => ({
      id: message.id,
      content: message.content || "Embed / Component Message",
      timestamp: message.timestamp,
      raw: message,
    }));

  res.json(botMessages);
}));

// Auto-Fetch Bot Identity for the Frontend
router.get(
  "/identity",
  attachUser,
  requireStaffPermission("send"),
  asyncHandler(async (req, res) => {
    // Safely parse the query ID, ensuring we pass exactly 1 or 0 arguments
    const profileId = parseProfileId(req.query.profileId);
    const token = await discord.resolveBotToken(profileId);
    const data = await discord.getBotIdentity(token);
    if (!data || !data.id) return res.json(null);
    
    return res.json({
      name: data.username,
      avatar: data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png` : ""
    });
  })
);

export default router;