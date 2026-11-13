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
  | "LOGIN_SUCCESS";

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
      fields,
      footer: {
        text: `HoHo Manager Security Audit${ctx.ip ? ` • IP Hash: ${hashIp(ctx.ip)}` : ""}`,
      },
      timestamp: now,
    }],
  };
};

/**
 * Fire-and-forget: post an audit embed to the configured log channel.
 * Never stores in SQLite to conserve database storage.
 * Never throws — a logging failure must never break the request.
 */
export const auditLog = (ctx: AuditContext): void => {
  void (async () => {
    try {
      // Check if this event type is enabled for Discord channel dispatch in Head Admin Settings
      const settings = ctx.guildId ? await settingsService.getSettings(ctx.guildId) : await settingsService.getSettings("__global__");
      const loggingConfig = (settings?.extra_settings as any)?.logging_config as { enabled_channel_events?: string[] } | undefined;

      if (loggingConfig && Array.isArray(loggingConfig.enabled_channel_events)) {
        if (!loggingConfig.enabled_channel_events.includes(ctx.event)) {
          // Event disabled by Head Admin for Discord logging
          return;
        }
      }

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
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      log.warn(`Audit log delivery failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  })();
};
