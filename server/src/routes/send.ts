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
  sendLimiter,
  attachUser,
  requireAdminKey,
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { mode, payload, channelId, webhookUrl, profileId, threadId, editMessageId } = body;

    if (mode !== "bot" && mode !== "webhook") {
      throw ApiError.badRequest('`mode` must be either "bot" or "webhook"');
    }

    const message = validateMessagePayload(payload);

    const flows = parseFlowRegistrations(body.flows);
    if (flows.length > 0) {
      await actionRepository.registerFlows(flows);
      log.info(`Registered ${flows.length} action flow(s) for this message`);
    }

    if (mode === "webhook") {
      if (typeof webhookUrl !== "string") {
        throw ApiError.badRequest('`webhookUrl` is required when mode is "webhook"');
      }
      const sent = await discord.sendWebhook(webhookUrl, message, {
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

    // NEW: If an editMessageId is provided, PATCH the existing message instead of POSTing a new one
    if (typeof editMessageId === "string" && editMessageId.trim() !== "") {
      const token = env.discord.botToken;
      const patchRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${editMessageId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bot ${token}`
        },
        body: JSON.stringify(message)
      });

      if (!patchRes.ok) {
        const errText = await patchRes.text();
        throw new Error(`Discord Edit Failed: ${patchRes.status} - ${errText}`);
      }
      sent = await patchRes.json();
      log.info(`Bot edited message ${editMessageId} in ${channelId} by user ${req.user?.id ?? "?"}`);
    } else {
      // Normal Send
      sent = await discord.sendChannelMessage(channelId, message, {
        profileId: typeof profileId === "number" ? profileId : null,
      });
      log.info(`Bot send to ${channelId} by user ${req.user?.id ?? "?"}`);
    }

    return res.json({ ok: true, mode, message: sent });
  }),
);

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

export default router;