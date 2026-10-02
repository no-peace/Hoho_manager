import { Router } from "express";
import { attachUser, requireAdminKey } from "../middleware/auth.js";
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
  requireAdminKey,
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

    const flows = parseFlowRegistrations(body.flows);
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
      const sent = await discord.sendWebhook(webhookUrl, sanitizedMessage, {
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
      sent = await discord.editChannelMessage(channelId, editMessageId, sanitizedMessage, {
        profileId,
      });
      log.info(`Bot edited message ${editMessageId} in ${channelId} by user ${req.user?.id ?? "?"}`);
    } else {
      sent = await discord.sendChannelMessage(channelId, sanitizedMessage, {
        profileId,
      });
      log.info(`Bot send to ${channelId} by user ${req.user?.id ?? "?"}`);
    }

    await registerMessageFlows(sent);

    return res.json({ ok: true, mode, message: sent });
  }),
);

// ... KEEP YOUR EXISTING GET ROUTES BELOW THIS

router.get("/channels", attachUser, requireAdminKey, asyncHandler(async (req, res) => {
  const profileId = parseProfileId(req.query.profileId);
  const [guild] = await discord.getBotGuilds(profileId);
  if (!guild) return res.json([]);

  const channels = await discord.getGuildChannels(guild.id, profileId);
  res.json(
    channels
      .filter((channel) => channel.type === 0 || channel.type === 5)
      .map(({ id, name }) => ({ id, name })),
  );
}));

// GET /api/send/channels/:channelId/messages - Fetches recent messages sent by the bot
router.get("/channels/:channelId/messages", attachUser, requireAdminKey, asyncHandler(async (req, res) => {
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
    .filter((message) => message.author?.id === me.id && !message.interaction && !message.interaction_metadata)
    .map((message) => ({
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
  requireAdminKey,
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