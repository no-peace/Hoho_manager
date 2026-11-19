/**
 * Audit Log Service
 *
 * Posts structured Discord embeds to a configured log channel.
 * All events are fire-and-forget  a log failure never blocks a request.
 * The bot can read the channel history later for analysis.
 *
 * Events are colour-coded by severity:
 *   Green  #23A55A  successful send / grant
 *   Yellow #FAA61A  edit / cooldown hit
 *   Orange #FF6B35  delete
 *   Red    #DA373C  blocked / revoked
 *   Blurple #5865F2  admin actions
 *   Gray   #4F545C  info
 */

import crypto from "node:crypto";
import { env } from "../config/env.js";
import { settingsService } from "./settingsService.js";
import { DEFAULT_LOG_EVENTS } from "@dmb/shared";
import { logger } from "../utils/logger.js";

const log = logger.child("auditLog");

export type AuditEvent =
  | "SEND_MESSAGE"
  | "EDIT_MESSAGE"
  | "DELETE_MESSAGE"
  | "SEND_BLOCKED"
  | "MENTION_BLOCKED"
  | "ROLE_MENTION_BLOCKED"
  | "COOLDOWN_HIT"
  | "RATE_LIMIT_HIT"
  | "STAFF_GRANTED"
  | "STAFF_REVOKED"
  | "STAFF_UPDATED"
  | "STAFF_ACCESS_DENIED"
  | "CHANNEL_DENIED"
  | "PERMISSION_DENIED"
  | "PROFILE_OVERRIDE_BLOCKED"
  | "TEMPLATE_SAVED"
  | "TEMPLATE_DELETED"
  | "LOGIN_SUCCESS"
  | "LOG_TEST";

const EVENT_COLORS: Record<AuditEvent, number> = {
  SEND_MESSAGE:             0x23A55A,  // green
  EDIT_MESSAGE:             0xFAA61A,  // yellow
  DELETE_MESSAGE:           0xFF6B35,  // orange
  SEND_BLOCKED:             0xDA373C,  // red
  MENTION_BLOCKED:          0xDA373C,  // red
  ROLE_MENTION_BLOCKED:     0xDA373C,  // red
  COOLDOWN_HIT:             0xFAA61A,  // yellow
  RATE_LIMIT_HIT:           0xDA373C,  // red
  STAFF_GRANTED:            0x5865F2,  // blurple
  STAFF_REVOKED:            0xDA373C,  // red
  STAFF_UPDATED:            0x5865F2,  // blurple
  STAFF_ACCESS_DENIED:      0xDA373C,  // red
  CHANNEL_DENIED:           0xDA373C,  // red
  PERMISSION_DENIED:        0xDA373C,  // red
  PROFILE_OVERRIDE_BLOCKED: 0xDA373C,  // red
  TEMPLATE_SAVED:           0x5865F2,  // blurple
  TEMPLATE_DELETED:         0xFF6B35,  // orange
  LOGIN_SUCCESS:            0x23A55A,  // green
  LOG_TEST:                 0x5865F2,  // blurple
};

const EVENT_LABELS: Record<AuditEvent, string> = {
  SEND_MESSAGE:             "✅ Message Sent",
  EDIT_MESSAGE:             "✏️ Message Edited",
  DELETE_MESSAGE:           "🗑️ Message Deleted",
  SEND_BLOCKED:             "🚫 Send Blocked",
  MENTION_BLOCKED:          "🚫 Mention Blocked",
  ROLE_MENTION_BLOCKED:     "🚫 Role Mention Blocked",
  COOLDOWN_HIT:             "⏱️ Cooldown Active",
  RATE_LIMIT_HIT:           "🛑 Rate Limit Hit",
  STAFF_GRANTED:            "🔑 Staff Access Granted",
  STAFF_REVOKED:            "❌ Staff Access Revoked",
  STAFF_UPDATED:            "🔄 Staff Permissions Updated",
  STAFF_ACCESS_DENIED:      "🚫 Access Denied — Not Staff",
  CHANNEL_DENIED:           "🚫 Channel Not Allowed",
  PERMISSION_DENIED:        "🚫 Permission Denied",
  PROFILE_OVERRIDE_BLOCKED: "🚫 Profile Override Blocked",
  TEMPLATE_SAVED:           "💾 Template Saved",
  TEMPLATE_DELETED:         "🗑️ Template Deleted",
  LOGIN_SUCCESS:            "🔐 Operator Logged In",
  LOG_TEST:                 "🧪 Audit Log Test",
};

export interface AuditContext {
  event: AuditEvent;
  guildId?: string;
  actorDiscordId?: string;
  actorUsername?: string;
  targetDiscordId?: string;
  channelId?: string;
  channelName?: string;
  messageId?: string;
  reason?: string;
  details?: Record<string, string | number | boolean | undefined>;
  /** Raw request IP  will be hashed before storage */
  ip?: string;
  requestId?: string;
}

/** SHA-256 the IP and return the first 12 hex chars for light identification without storing PII */
const hashIp = (ip: string): string =>
  crypto.createHash("sha256").update(ip).digest("hex").slice(0, 12);

const truncate = (value: string, max = 100): string =>
  value.length > max ? `${value.slice(0, max - 1)}…` : value;

const buildEmbed = (ctx: AuditContext) => {
  const now = new Date().toISOString();
  const fields: { name: string; value: string; inline?: boolean }[] = [];

  if (ctx.actorDiscordId) {
    fields.push({
      name: "👤 Operator",
      value: ctx.actorUsername
        ? `${ctx.actorUsername} (<@${ctx.actorDiscordId}>)`
        : `<@${ctx.actorDiscordId}>`,
      inline: true,
    });
  }
  if (ctx.channelId) {
    fields.push({
      name: "📢 Channel",
      value: ctx.channelName ? `#${ctx.channelName} (<#${ctx.channelId}>)` : `<#${ctx.channelId}>`,
      inline: true,
    });
  }
  if (ctx.targetDiscordId) {
    fields.push({ name: "🎯 Target", value: `<@${ctx.targetDiscordId}>`, inline: true });
  }
  if (ctx.guildId && ctx.channelId && ctx.messageId) {
    fields.push({
      name: "🔗 Message Jump Link",
      value: `[Jump to Message](https://discord.com/channels/${ctx.guildId}/${ctx.channelId}/${ctx.messageId})`,
      inline: false,
    });
  }
  if (ctx.reason) {
    fields.push({ name: "📝 Reason", value: truncate(ctx.reason, 200), inline: false });
  }
  if (ctx.requestId) {
    fields.push({ name: "🆔 Request ID", value: ctx.requestId, inline: true });
  }
  if (ctx.details) {
    for (const [key, value] of Object.entries(ctx.details)) {
      if (value !== undefined) fields.push({ name: key, value: truncate(String(value)), inline: true });
    }
  }

  return {
    embeds: [{
      title: EVENT_LABELS[ctx.event],
      description: [
        `> **Event:** ${ctx.event}`,
        `> **Actor:** ${ctx.actorDiscordId ? `<@${ctx.actorDiscordId}>` : "System"}`,
      ].join("\n"),
      color: EVENT_COLORS[ctx.event],
      fields: fields.slice(0, 25),
      footer: {
        text: `HoHo Manager Security Audit${ctx.ip ? ` • IP Hash: ${hashIp(ctx.ip)}` : ""}`,
      },
      timestamp: now,
    }],
  };
};

export interface AuditDeliveryResult {
  ok: boolean;
  status?: number;
  skipped?: boolean;
  error?: string;
}

export interface AuditDeliveryOptions {
  channelId?: string;
  bypassEventFilter?: boolean;
}

/**
 * Deliver one audit embed. Callers that need confirmation (for example the
 * Settings test button) can await the result; normal audit events remain
 * fire-and-forget through auditLog().
 */
export const sendAuditLogToChannel = async (
  ctx: AuditContext,
  options: AuditDeliveryOptions = {},
): Promise<AuditDeliveryResult> => {
  try {
    if (!options.bypassEventFilter) {
      const guildSettings = ctx.guildId
        ? await settingsService.getSettings(ctx.guildId)
        : undefined;
      const globalSettings = await settingsService.getSettings("__global__");
      const getEnabledEvents = (settings: typeof globalSettings | undefined): string[] | undefined => {
        const config = settings?.extra_settings?.logging_config as
          | { enabled_channel_events?: unknown }
          | undefined;
        return Array.isArray(config?.enabled_channel_events)
          ? config.enabled_channel_events.filter((event): event is string => typeof event === "string")
          : undefined;
      };
      const enabledEvents =
        getEnabledEvents(guildSettings) ??
        getEnabledEvents(globalSettings) ??
        [...DEFAULT_LOG_EVENTS];

      if (!enabledEvents.includes(ctx.event)) {
        return { ok: true, skipped: true };
      }
    }

    const logChannelId =
      options.channelId?.trim() || await settingsService.getEffectiveLogChannelId(ctx.guildId);
    const botToken = env.discord.botToken;

    if (!logChannelId || !botToken) {
      const reason = !logChannelId ? "No audit log channel is configured" : "Discord bot token is unavailable";
      log.info("[AUDIT] " + ctx.event + " actor=" + (ctx.actorDiscordId ?? "?") + " reason=" + (ctx.reason ?? "-") + " (" + reason + ")");
      return { ok: false, error: reason };
    }

    const response = await fetch("https://discord.com/api/v10/channels/" + logChannelId + "/messages", {
      method: "POST",
      headers: {
        Authorization: "Bot " + botToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildEmbed(ctx)),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.text()).slice(0, 240);
      } catch {
        // Keep the HTTP status even if Discord's error body cannot be read.
      }
      const error = "Discord API rejected the audit log (" + response.status + ")" + (detail ? ": " + detail : "");
      log.warn(error);
      return { ok: false, status: response.status, error };
    }

    return { ok: true, status: response.status };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.warn("Audit log delivery failed: " + error);
    return { ok: false, error: "Audit log delivery failed. Check the server logs for details." };
  }
};

/**
 * Fire-and-forget audit logging. A logging failure must never block the
 * operation being audited.
 */
export const auditLog = (ctx: AuditContext): void => {
  void sendAuditLogToChannel(ctx);
};
