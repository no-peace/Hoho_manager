import { env } from "../config/env.js";
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

router.post(
  "/",
  attachUser,
  sendLimiter,
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const { mode, payload: rawPayload, channelId, webhookUrl, threadId, profileId, editMessageId, ...body } = req.body;

    // STRICT SANITIZATION: Remove internal IDs and empty arrays that cause Invalid Form Body
    const message = validateMessagePayload(rawPayload);
    if (message.embeds && message.embeds.length === 0) delete message.embeds;
    if (message.components && message.components.length === 0) delete message.components;
    if (message.flags === 0 || message.flags === 32768) delete message.flags;
    
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
    if (flows.length > 0) {
      await actionRepository.registerFlows(flows);
      log.info(`Registered ${flows.length} action flow(s) for this message`);
    }

    if (mode === "webhook") {
      if (typeof webhookUrl !== "string") {
        throw ApiError.badRequest('`webhookUrl` is required when mode is "webhook"');
      }
      const sent = await discord.sendWebhook(webhookUrl, sanitizedMessage, {
        wait: true,
        threadId: typeof threadId === "string" ? threadId : null,
      });
      log.info(`Webhook send by user ${req.user?.id ?? "?"}`);
      return res.json({ ok: true, mode, message: sent });
    }

    if (typeof channelId !== "string") {
      throw ApiError.badRequest('`channelId` is required when mode is "bot"');
    }

    let sent;
    if (typeof editMessageId === "string" && editMessageId.trim() !== "") {
      const token = env.discord.botToken;
      const patchRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${editMessageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bot ${token}` },
        body: JSON.stringify(sanitizedMessage)
      });
      if (!patchRes.ok) {
        const errText = await patchRes.text();
        throw new Error(`Discord Edit Failed: ${patchRes.status} - ${errText}`);
      }
      sent = await patchRes.json();
      log.info(`Bot edited message ${editMessageId} in ${channelId} by user ${req.user?.id ?? "?"}`);
    } else {
      sent = await discord.sendChannelMessage(channelId, sanitizedMessage, {
        profileId: typeof profileId === "number" ? profileId : null,
      });
      log.info(`Bot send to ${channelId} by user ${req.user?.id ?? "?"}`);
    }

    return res.json({ ok: true, mode, message: sent });
  }),
);

// ... KEEP YOUR EXISTING GET ROUTES BELOW THIS

router.get("/channels", asyncHandler(async (_req, res) => {
  const token = env.discord.botToken;
  if (!token) return res.json([]);

  const guildReq = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bot ${token}` }
  });
  const guilds = await guildReq.json();
  if (!Array.isArray(guilds) || guilds.length === 0) return res.json([]);

  const channelReq = await fetch(`https://discord.com/api/v10/guilds/${guilds[0].id}/channels`, {
    headers: { Authorization: `Bot ${token}` }
  });
  const channels = await channelReq.json();
  if (!Array.isArray(channels)) return res.json([]);

  const textChannels = channels
    .filter((c: any) => c.type === 0 || c.type === 5)
    .map((c: any) => ({ id: c.id, name: c.name }));

  res.json(textChannels);
}));

// GET /api/send/channels/:channelId/messages - Fetches recent messages sent by the bot
router.get("/channels/:channelId/messages", asyncHandler(async (req, res) => {
  const token = env.discord.botToken;
  if (!token) return res.json([]);
  
  const channelId = req.params.channelId;

  const meReq = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bot ${token}` }
  });
  const me = (await meReq.json()) as any;

  if (!me?.id) return res.json([]);

  const msgReq = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=50`, {
    headers: { Authorization: `Bot ${token}` }
  });
  const messages = (await msgReq.json()) as any;

  if (!Array.isArray(messages)) return res.json([]);

  // NEW: Filter out slash command interactions so they don't clutter the Edit dropdown
  const botMessages = messages
    .filter((m: any) => m.author?.id === me.id && !m.interaction && !m.interaction_metadata)
    .map((m: any) => ({
      id: m.id,
      content: m.content || "Embed / Component Message",
      timestamp: m.timestamp,
      raw: m
    }));

  res.json(botMessages);
}));

// Auto-Fetch Bot Identity for the Frontend
// Auto-Fetch Bot Identity for the Frontend
router.get(
  "/identity",
  attachUser,
  requireAdminKey,
  asyncHandler(async (req, res) => {
    // TypeScript fix: explicitly pass undefined if no ID is provided
    const profileId = req.query.profileId ? Number(req.query.profileId) : undefined;
    
    // FIX 1: resolveBotToken only takes 1 argument max
    const token = await discord.resolveBotToken(profileId);
    if (!token) return res.json(null);
    
    const reqMe = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` }
    });
    
    // FIX 2: Cast the response to 'any' so TS allows reading properties like data.id
    const data = (await reqMe.json()) as any;
    if (!data || !data.id) return res.json(null);
    
    return res.json({
      name: data.username,
      avatar: data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png` : ""
    });
  })
);

export default router;