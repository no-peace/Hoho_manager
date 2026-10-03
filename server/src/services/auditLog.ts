/**
 * Audit Log Service
 *
 * Posts structured Discord embeds to a configured log channel.
 * All events are fire-and-forget — a log failure never blocks a request.
 * The bot can read the channel history later for analysis.
 *
 * Events are colour-coded by severity:
 *   Green  #23A55A — successful send / grant
 *   Yellow #FAA61A — edit / cooldown hit
 *   Orange #FF6B35 — delete
 *   Red    #DA373C — blocked / revoked
 *   Blurple #5865F2 — admin actions
 *   Gray   #4F545C — info
 */

import crypto from "node:crypto";
import { env } from "../config/env.js";
import { settingsService } from "./settingsService.js";
import { logger } from "../utils/logger.js";

const log = logger.child("auditLog");

export type AuditEvent =
  | "SEND_MESSAGE"
  | "EDIT_MESSAGE"
  | "DELETE_MESSAGE"
  | "SEND_BLOCKED"
  | "MENTION_BLOCKED"
  | "COOLDOWN_HIT"
  | "RATE_LIMIT_HIT"
  | "STAFF_GRANTED"
  | "STAFF_REVOKED"
  | "STAFF_UPDATED"
  | "STAFF_ACCESS_DENIED"
  | "CHANNEL_DENIED"
  | "PERMISSION_DENIED";

const EVENT_COLORS: Record<AuditEvent, number> = {
  SEND_MESSAGE:        0x23A55A,  // green
  EDIT_MESSAGE:        0xFAA61A,  // yellow
  DELETE_MESSAGE:      0xFF6B35,  // orange
  SEND_BLOCKED:        0xDA373C,  // red
  MENTION_BLOCKED:     0xDA373C,  // red
  COOLDOWN_HIT:        0xFAA61A,  // yellow
  RATE_LIMIT_HIT:      0xDA373C,  // red
  STAFF_GRANTED:       0x5865F2,  // blurple
  STAFF_REVOKED:       0xDA373C,  // red
  STAFF_UPDATED:       0x5865F2,  // blurple
  STAFF_ACCESS_DENIED: 0xDA373C,  // red
  CHANNEL_DENIED:      0xDA373C,  // red
  PERMISSION_DENIED:   0xDA373C,  // red
};

const EVENT_LABELS: Record<AuditEvent, string> = {
  SEND_MESSAGE:        "✅ Message Sent",
  EDIT_MESSAGE:        "✏️ Message Edited",
  DELETE_MESSAGE:      "🗑️ Message Deleted",
  SEND_BLOCKED:        "🚫 Send Blocked",
  MENTION_BLOCKED:     "🚫 Mention Stripped",
  COOLDOWN_HIT:        "⏱️ Cooldown Active",
  RATE_LIMIT_HIT:      "🛑 Rate Limit Hit",
  STAFF_GRANTED:       "🔑 Staff Access Granted",
  STAFF_REVOKED:       "❌ Staff Access Revoked",
  STAFF_UPDATED:       "🔄 Staff Permissions Updated",
  STAFF_ACCESS_DENIED: "🚫 Access Denied — Not Staff",
  CHANNEL_DENIED:      "🚫 Channel Not Allowed",
  PERMISSION_DENIED:   "🚫 Permission Denied",
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
  /** Raw request IP — will be hashed before storage */
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
      name: "👤 Actor",
      value: ctx.actorUsername
        ? `${ctx.actorUsername} (<@${ctx.actorDiscordId}>)`
        : `<@${ctx.actorDiscordId}>`,
      inline: true,
    });
  }
  if (ctx.targetDiscordId) {
    fields.push({ name: "🎯 Target", value: `<@${ctx.targetDiscordId}>`, inline: true });
  }
  if (ctx.channelId) {
    fields.push({
      name: "📢 Channel",
      value: ctx.channelName ? `#${ctx.channelName} (<#${ctx.channelId}>)` : `<#${ctx.channelId}>`,
      inline: true,
    });
  }
  if (ctx.messageId) {
    fields.push({ name: "💬 Message ID", value: ctx.messageId, inline: true });
  }
  if (ctx.reason) {
    fields.push({ name: "📝 Reason", value: truncate(ctx.reason, 200), inline: false });
  }
  if (ctx.ip) {
    fields.push({ name: "🔒 IP Hash", value: hashIp(ctx.ip), inline: true });
  }
  if (ctx.requestId) {
    fields.push({ name: "🆔 Request ID", value: ctx.requestId, inline: true });
  }

  // Append any caller-provided detail fields
  if (ctx.details) {
    for (const [key, value] of Object.entries(ctx.details)) {
      if (value !== undefined) {
        fields.push({ name: key, value: truncate(String(value)), inline: true });
      }
    }
  }

  return {
    embeds: [{
      title: EVENT_LABELS[ctx.event],
      color: EVENT_COLORS[ctx.event],
      fields,
      footer: { text: `HoHo Manager Audit Log • ${now}` },
      timestamp: now,
    }],
  };
};

/**
 * Fire-and-forget: post an audit embed to the configured log channel.
 * Never throws — a logging failure must never break the request.
 */
export const auditLog = (ctx: AuditContext): void => {
  void (async () => {
    try {
      const logChannelId = await settingsService.getEffectiveLogChannelId(ctx.guildId);
      const botToken = env.discord.botToken;

      if (!logChannelId || !botToken) {
        // Log locally when no channel is configured — still useful during dev.
        log.info(`[AUDIT] ${ctx.event} actor=${ctx.actorDiscordId ?? "?"} reason=${ctx.reason ?? "-"}`);
        return;
      }

      const body = buildEmbed(ctx);

      await fetch(`https://discord.com/api/v10/channels/${logChannelId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      log.warn(`Audit log delivery failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })();
};
