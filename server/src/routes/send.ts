import { Router } from "express";
import { attachUser, requireUserOrAdminKey } from "../middleware/auth.js";
import { requireStaffPermission } from "../middleware/staffPermissions.js";
import { sendLimiter } from "../middleware/rateLimit.js";
import { multipartParser, type UploadedFile } from "../middleware/multipart.js";
import { actionRepository } from "../repositories/actionRepository.js";
import * as discord from "../services/discordService.js";
import { ApiError, asyncHandler } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { fetchUrlAttachments } from "../utils/urlAttachments.js";
import { parseFlowRegistrations, validateMessagePayload } from "../utils/validation.js";
import { buildTimestampVariables, interpolateObject } from "../services/variableInterpolation.js";

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

const parseAllowedIds = (value: string | null | undefined): string[] => {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
};

const assertStaffChannelAllowed = (
  staffCtx: Express.Request["staffContext"],
  channelId: string,
): void => {
  if (!staffCtx || staffCtx.isAdmin || !staffCtx.record) return;

  const allowed = parseAllowedIds(staffCtx.record.allowed_channel_ids);

  if (!allowed.includes("*") && !allowed.includes(channelId)) {
    throw ApiError.forbidden(`You are not allowed to access channel ${channelId}`);
  }
};

const assertStaffGuildAllowed = async (
  staffCtx: Express.Request["staffContext"],
  channelId: string,
): Promise<void> => {
  if (!staffCtx || staffCtx.isAdmin || !staffCtx.record) return;

  const allowedGuilds = parseAllowedIds(staffCtx.record.allowed_guild_ids);

  if (allowedGuilds.includes("*")) return;

  // Lookup errors propagate, preventing the operation from proceeding.
  const guildId = await discord.getChannelGuildId(channelId);

  if (!guildId || !allowedGuilds.includes(guildId)) {
    throw ApiError.forbidden(
      `You are not allowed to access guild ${guildId ?? "unknown"}`,
    );
  }
};

router.post(
  "/",
  // Reject anonymous/non-user traffic and apply per-user limits before buffering uploads.
  attachUser,
  requireUserOrAdminKey,
  sendLimiter,
  multipartParser,
  requireStaffPermission((req) =>
    typeof req.body?.editMessageId === "string" &&
      req.body.editMessageId.trim() !== ""
      ? "edit"
      : "send",
  ),
  asyncHandler(async (req, res) => {
    const {
      mode,
      payload: rawPayload,
      messages: rawMessages,
      channelId,
      webhookUrl,
      threadId,
      profileId: rawProfileId,
      editMessageId,
      ...body
    } = req.body;
    const normalizedThreadId = typeof threadId === "string" ? threadId.trim() : "";
    if (
      threadId !== undefined &&
      threadId !== null &&
      threadId !== "" &&
      (typeof threadId !== "string" || !/^\d{17,20}$/.test(normalizedThreadId))
    ) {
      throw ApiError.badRequest("`threadId` must be a valid Discord thread ID");
    }
    const destinationChannelId =
      normalizedThreadId || (typeof channelId === "string" ? channelId.trim() : "");
    if (mode !== "bot") {
      throw ApiError.badRequest('Only mode "bot" is supported.');
    }
    if (typeof webhookUrl === "string" && webhookUrl.trim() !== "") {
      throw ApiError.badRequest("Webhook URL message sending is disabled.");
    }
    if (
      rawProfileId !== undefined &&
      rawProfileId !== null &&
      rawProfileId !== "" &&
      rawProfileId !== "null"
    ) {
      throw ApiError.badRequest("Custom bot profiles are disabled. Use the configured server bot.");
    }
    const profileId: number | null = null;
    const staffCtx = req.staffContext;
    const dbUser = req.user as { discord_id?: string; username?: string; avatar?: string | null } | undefined;
    const requestedAuthorId =
      typeof req.body?.authorUserId === "string" && /^\d{17,20}$/.test(req.body.authorUserId)
        ? req.body.authorUserId
        : "";
    const senderDiscordId = staffCtx?.staffId ?? (staffCtx?.isAdmin ? "" : dbUser?.discord_id ?? requestedAuthorId);
    const senderName = dbUser?.username ?? staffCtx?.record?.discord_username ?? "";

    // Defense-in-depth: never allow Default Bot (profileId === null) unless caller is Admin or has a verified Staff Record
    if (mode === "bot" && profileId === null) {
      if (!staffCtx?.isAdmin && !staffCtx?.record) {
        throw ApiError.forbidden("Default bot requires an active staff record or Head Admin access");
      }
      if (destinationChannelId) {
        assertStaffChannelAllowed(staffCtx, destinationChannelId);
        await assertStaffGuildAllowed(staffCtx, destinationChannelId);
      }
    }

    const cleanseIds = (obj: any): any => {
      if (Array.isArray(obj)) return obj.map(cleanseIds);
      if (obj !== null && typeof obj === "object") {
        const newObj: any = {};
        for (const [k, v] of Object.entries(obj)) {
          if (k !== "_id" && k !== "exploit_name") newObj[k] = cleanseIds(v);
        }
        return newObj;
      }
      return obj;
    };

    const processMessage = async (raw: unknown) => {
      const exploitHint =
        raw !== null &&
          typeof raw === "object" &&
          typeof (raw as Record<string, unknown>).exploit_name === "string"
          ? ((raw as Record<string, unknown>).exploit_name as string)
          : undefined;

      const message = validateMessagePayload(raw);
      if (message.embeds && message.embeds.length === 0) delete message.embeds;
      if (message.components && message.components.length === 0) delete message.components;
      if (message.flags === 0) delete message.flags;

      const sanitizedMessage = cleanseIds(message);
      // Legacy editor fields are not Discord message-sender overrides. Keep them
      // in old backups/imports, but never forward them to Discord.
      delete sanitizedMessage.username;
      delete sanitizedMessage.avatar_url;

      let weaoInterpolated = sanitizedMessage;
      try {
        const { interpolateWeaoPlaceholders } = await import("../services/weaoService.js");
        const result = await interpolateWeaoPlaceholders(sanitizedMessage, exploitHint);
        weaoInterpolated = result.payload;
      } catch {
        // Fallback to uninterpolated message if WEAO is unreachable
      }

      const timestampVars = buildTimestampVariables();
      const unixNow = timestampVars["now.unix"];
      const targetChannelId = destinationChannelId;
      // Use the destination guild's member nickname for {user.name}.
      const hasGuildScopedUserPlaceholder =
        /\{user\.\d{17,20}\.(?:name|roles|joined(?:\.date)?)\}/i.test(
          JSON.stringify(weaoInterpolated),
        );
      const targetGuildId = targetChannelId && (senderDiscordId || hasGuildScopedUserPlaceholder)
        ? await discord.getChannelGuildId(targetChannelId).catch(() => null)
        : null;
      let senderMember: any = null;
      if (targetGuildId && senderDiscordId) {
        try {
          const botToken = await discord.resolveBotToken(profileId);
          senderMember = await discord.getGuildMember(targetGuildId, senderDiscordId, botToken);
        } catch {
          senderMember = null;
        }
      }
      const resolvedSenderName =
        senderName ||
        (typeof senderMember?.user?.username === "string" ? senderMember.user.username : "User");
      const senderGlobalName =
        typeof senderMember?.user?.global_name === "string" && senderMember.user.global_name
          ? senderMember.user.global_name
          : resolvedSenderName;
      const senderNickname =
        typeof senderMember?.nick === "string" && senderMember.nick.trim()
          ? senderMember.nick.trim()
          : resolvedSenderName;

      const sendVars: Record<string, string> = {
        ...timestampVars,
        now: `<t:${unixNow}:f>`,
        "now.t": `<t:${unixNow}:t>`,
        "now.T": `<t:${unixNow}:T>`,
        "now.d": `<t:${unixNow}:d>`,
        "now.D": `<t:${unixNow}:D>`,
        "now.f": `<t:${unixNow}:f>`,
        "now.F": `<t:${unixNow}:F>`,
        "now.R": `<t:${unixNow}:R>`,
        "now.relative": `<t:${unixNow}:R>`,
        "now.longtime": `<t:${unixNow}:T>`,
        "now.longdate": `<t:${unixNow}:D>`,
        "now.short": `<t:${unixNow}:f>`,
        "now.long": `<t:${unixNow}:F>`,
        ...(targetChannelId
          ? {
            "channel.id": targetChannelId,
            "channel.mention": `<#${targetChannelId}>`,
          }
          : {}),
        ...(senderDiscordId
          ? {
            "user.id": senderDiscordId,
            "user.mention": `<@${senderDiscordId}>`,
            "user.name": senderNickname,
            "user.tag": resolvedSenderName,
            "user.displayname": senderGlobalName,
          }
          : {}),
      };

weaoInterpolated = interpolateObject(weaoInterpolated, sendVars);

      let authorResolved = weaoInterpolated;
      try {
        const { resolveAuthorPlaceholders } = await import("../services/authorService.js");
        const aRes = await resolveAuthorPlaceholders(
          weaoInterpolated,
          null,
          profileId,
          targetGuildId,
        );
        authorResolved = aRes.payload;
      } catch (error) {
        log.warn(
          `Author profile enrichment failed; sending original interpolated payload: ${error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      if (staffCtx && !staffCtx.isAdmin && staffCtx.record) {
        // 1. Strict Role & Mention Permission Check (alert/block if unauthorized)
        const { findUnauthorizedMentions } = await import("../utils/mentionScrubber.js");
        const violations = findUnauthorizedMentions(authorResolved, staffCtx.record);
        if (violations.length > 0) {
          const mentionLabels = violations.map((v) => v.mention).join(", ");
          const { auditLog } = await import("../services/auditLog.js");
          auditLog({
            event: "ROLE_MENTION_BLOCKED",
            actorDiscordId: staffCtx.staffId ?? undefined,
            actorUsername: staffCtx.record.discord_username,
            channelId: destinationChannelId || undefined,
            reason: `Attempted unauthorized ping: ${mentionLabels}`,
            ip: req.ip,
          });
          throw ApiError.forbidden(
            `You do not have permission to ping: ${mentionLabels}. Please remove these mentions before sending.`,
          );
        }

        // 2. Components V2 permission check
        if (
          staffCtx.record.can_use_components_v2 === 0 &&
          Array.isArray(authorResolved.components) &&
          authorResolved.components.length > 0
        ) {
          throw ApiError.forbidden("Your staff account is not permitted to use Interactive Components V2.");
        }

        // 4. WEAO Exploits permission check
        if (
          staffCtx.record.can_use_weao_exploits === 0 &&
          (exploitHint || JSON.stringify(authorResolved).includes("{exploit."))
        ) {
          throw ApiError.forbidden("Your staff account is not permitted to use WEAO exploit variables.");
        }

        const { scrubMentions, sanitizeAllowedMentions } = await import(
          "../utils/mentionScrubber.js"
        );
        const { payload: scrubbed } = scrubMentions(
          authorResolved,
          staffCtx.record,
        );
        return sanitizeAllowedMentions(scrubbed, staffCtx.record);
      }
      return authorResolved;
    };

    const isMulti = Array.isArray(rawMessages) && rawMessages.length > 0;
    if (isMulti && rawMessages.length > 10) {
      throw ApiError.badRequest("Too many messages: maximum 10 allowed");
    }
    if (!isMulti && (!rawPayload || typeof rawPayload !== "object")) {
      throw ApiError.badRequest("Message payload is required");
    }
    const messagesToProcess = isMulti ? rawMessages : [rawPayload];
    const finalMessages = await Promise.all(messagesToProcess.map(processMessage));
    const firstMessage = finalMessages[0];

    const rawFlows = parseFlowRegistrations(body.flows);
    let flows = rawFlows;
    if (staffCtx && !staffCtx.isAdmin && staffCtx.record) {
      const { scrubFlows } = await import("../utils/mentionScrubber.js");
      const { flows: scrubbedFlows, stripped: strippedFlows } = scrubFlows(
        rawFlows,
        staffCtx.record,
      );
      flows = scrubbedFlows;
      if (strippedFlows.length > 0) {
        const { auditLog } = await import("../services/auditLog.js");
        auditLog({
          event: "MENTION_BLOCKED",
          actorDiscordId: staffCtx.staffId ?? undefined,
          channelId: destinationChannelId || undefined,
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

    const registerTracking = async (sent: unknown, index: number): Promise<void> => {
      const sentId = sent !== null && typeof sent === "object"
        ? (sent as Record<string, unknown>).id
        : undefined;
      if (typeof sentId !== "string") return;
      const rawInputMsg = messagesToProcess[index];
      const uninterpolatedCleanMsg = cleanseIds(rawInputMsg);
      if (uninterpolatedCleanMsg && typeof uninterpolatedCleanMsg === "object") {
        delete (uninterpolatedCleanMsg as Record<string, unknown>).username;
        delete (uninterpolatedCleanMsg as Record<string, unknown>).avatar_url;
      }
      const rawStr = JSON.stringify(uninterpolatedCleanMsg);
      const hasDynamic = /\{user\.\d{17,20}\./i.test(rawStr) ||
        rawStr.includes("{exploit.") || rawStr.includes("discord.com/users/");
      if (!(hasDynamic || req.body?.track === true || Boolean(req.body?.templateId) || Boolean(req.body?.exploitName))) return;
      try {
        const { trackMessage } = await import("../services/messageTrackerService.js");
        await trackMessage({
          channelId: destinationChannelId,
          messageId: sentId,
          templateId: req.body?.templateId ? Number(req.body.templateId) : null,
          exploitName: typeof req.body?.exploitName === "string" ? req.body.exploitName : null,
          authorUserId: senderDiscordId || null,
          rawPayload: uninterpolatedCleanMsg,
          resolvedPayload: finalMessages[index],
          name: typeof req.body?.trackName === "string" ? req.body.trackName : null,
          expiresAt: typeof req.body?.expiresAt === "string" ? req.body.expiresAt : null,
        });
      } catch (trackErr) {
        log.warn("Failed to auto-track message:", trackErr);
      }
    };
    
    const uploadedFiles: UploadedFile[] = (req as any).uploadedFiles || [];
    const urlFiles = await fetchUrlAttachments(body.attachments);
    if (uploadedFiles.length + urlFiles.length > 10) {
      throw ApiError.badRequest("Too many attachments: maximum 10 allowed per message");
    }
    const totalAttachmentBytes =
      uploadedFiles.reduce((total, file) => total + file.size, 0) +
      urlFiles.reduce((total, file) => total + file.file.size, 0);
    if (totalAttachmentBytes > 50 * 1024 * 1024) {
      throw ApiError.payloadTooLarge("Combined attachments exceed maximum allowed size of 50 MB");
    }
    const files = [...uploadedFiles, ...urlFiles];


    if (staffCtx && !staffCtx.isAdmin && staffCtx.record) {
      if (staffCtx.record.can_attach_files === 0 && files.length > 0) {
        throw ApiError.forbidden("Your staff account is not permitted to attach files.");
      }
    }

    if (!destinationChannelId) {
      throw ApiError.badRequest('A `channelId` or `threadId` is required when mode is "bot"');
    }

    const sentList = [];
    if (typeof editMessageId === "string" && editMessageId.trim() !== "") {
      if (staffCtx && !staffCtx.isAdmin && staffCtx.record && !staffCtx.record.can_edit_messages) {
        throw ApiError.forbidden("You do not have permission to perform: edit");
      }
      const sent = await discord.editChannelMessage(destinationChannelId, editMessageId, firstMessage, {
        profileId,
        files,
      });
      await registerMessageFlows(sent);
      await registerTracking(sent, 0);
      sentList.push(sent);
      log.info(
        `Bot edited message ${editMessageId} in ${destinationChannelId} by user ${req.user?.id ?? "?"}`,
      );
    } else {
      for (let i = 0; i < finalMessages.length; i++) {
        const msg = finalMessages[i];
        const sent = await discord.sendChannelMessage(destinationChannelId, msg, {
          profileId,
          files: i === 0 ? files : [],
        });
        await registerMessageFlows(sent);
        sentList.push(sent);

        await registerTracking(sent, i);
      }
      log.info(`Bot send to ${destinationChannelId} by user ${req.user?.id ?? "?"}`);
    }

    if (staffCtx && !staffCtx.isAdmin && staffCtx.staffId) {
      const { staffRepository } = await import("../repositories/staffRepository.js");
      const actionName = typeof editMessageId === "string" && editMessageId.trim() !== "" ? "edit" : "send";
      await staffRepository.upsertCooldown(staffCtx.staffId, actionName);

      const { auditLog } = await import("../services/auditLog.js");
      auditLog({
        event:
          typeof editMessageId === "string" && editMessageId.trim() !== ""
            ? "EDIT_MESSAGE"
            : "SEND_MESSAGE",
        actorDiscordId: staffCtx.staffId,
        actorUsername: staffCtx.record?.discord_username,
        channelId: destinationChannelId,
        messageId: typeof editMessageId === "string" ? editMessageId : undefined,
        ip: req.ip,
      });
    }

    return res.json({ ok: true, mode, message: sentList[0], messages: sentList });
  }),
);

router.get(
  "/channels",
  attachUser,
  requireStaffPermission("send"),
  asyncHandler(async (req, res) => {
    const profileId = parseProfileId(req.query.profileId);
    const staffCtx = req.staffContext;

    if (profileId === null && !staffCtx?.isAdmin && !staffCtx?.record) {
      throw ApiError.forbidden("Default bot requires an active staff record or Head Admin access");
    }

    const queryGuildId =
      typeof req.query.guildId === "string" && req.query.guildId.trim()
        ? req.query.guildId.trim()
        : undefined;

    const botGuilds = await discord.getBotGuilds(profileId);
    let availableGuilds = botGuilds;
    if (staffCtx && !staffCtx.isAdmin && staffCtx.record) {
      let allowedGuilds: string[] = [];
      try {
        const parsed = JSON.parse(staffCtx.record.allowed_guild_ids || "[]");
        if (Array.isArray(parsed)) allowedGuilds = parsed.map(String);
      } catch {
        // Invalid allowlist data must fail closed.
      }
      if (!allowedGuilds.includes("*")) {
        availableGuilds = botGuilds.filter((guild) => allowedGuilds.includes(guild.id));
      }
    }

    if (queryGuildId && !availableGuilds.some((guild) => guild.id === queryGuildId)) {
      throw ApiError.forbidden(`You are not allowed to access guild ${queryGuildId}`);
    }

    const targetGuildId = queryGuildId ?? availableGuilds[0]?.id;
    if (!targetGuildId) return res.json([]);

    const channels = await discord.getGuildChannels(targetGuildId, profileId);

    let filteredChannels = channels;
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
  }),
);

router.get(
  "/channels/:channelId/messages",
  attachUser,
  requireStaffPermission("edit"),
  asyncHandler(async (req, res) => {
    const profileId = parseProfileId(req.query.profileId);
    const channelId = req.params.channelId;
    if (typeof channelId !== "string") {
      throw ApiError.badRequest("`channelId` must be a string");
    }
    if (!req.staffContext?.isAdmin && req.staffContext?.record) {
      assertStaffChannelAllowed(req.staffContext, channelId);
      await assertStaffGuildAllowed(req.staffContext, channelId);
    }


    const token = await discord.resolveBotToken(profileId);
    const me = await discord.getBotIdentity(token);
    if (!me?.id) return res.json([]);

    const messages = await discord.getChannelMessages(channelId, profileId);

    const botMessages = messages
      .filter(
        (message: any) =>
          message.author?.id === me.id &&
          !message.interaction &&
          !message.interaction_metadata,
      )
      .map((message: any) => ({
        id: message.id,
        content: message.content || "Embed / Component Message",
        timestamp: message.timestamp,
        raw: message,
      }));

    res.json(botMessages);
  }),
);

router.get(
  "/channels/:channelId/messages/:messageId",
  attachUser,
  requireStaffPermission("edit"),
  asyncHandler(async (req, res) => {
    const profileId = parseProfileId(req.query.profileId);
    const channelId = req.params.channelId;
    const messageId = req.params.messageId;
    if (typeof channelId !== "string" || typeof messageId !== "string") {
      throw ApiError.badRequest("`channelId` and `messageId` must be strings");
    }
    if (!req.staffContext?.isAdmin) {
      if (!req.staffContext?.record) {
        throw ApiError.forbidden(
          "Default bot requires an active staff record or Head Admin access",
        );
      }
      assertStaffChannelAllowed(req.staffContext, channelId);
      await assertStaffGuildAllowed(req.staffContext, channelId);
    }

    let found: discord.DiscordMessageRecord | null = null;
    try {
      found = await discord.getChannelMessage(channelId, messageId, profileId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        throw ApiError.notFound("Message not found in that channel (check bot permissions)");
      }
      throw err;
    }
    if (!found) {
      throw ApiError.notFound("Message not found in that channel (check bot permissions)");
    }
    res.json({
      id: found.id,
      content: found.content || "",
      raw: found,
    });
  }),
);

router.get(
  "/identity",
  attachUser,
  requireStaffPermission("send"),
  asyncHandler(async (req, res) => {
    const profileId = parseProfileId(req.query.profileId);
    const token = await discord.resolveBotToken(profileId);
    const data = await discord.getBotIdentity(token);
    if (!data || !data.id) return res.json(null);

    return res.json({
      id: data.id,
      name: data.username,
      username: data.username,
      avatar: data.avatar
        ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
        : "",
    });
  }),
);

export default router;