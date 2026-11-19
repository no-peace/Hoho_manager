import { automationRepository, type ScheduledMessageRow, type StickyMessageRow } from "../repositories/automationRepository.js";
import * as discord from "./discordService.js";
import { logger } from "../utils/logger.js";

const log = logger.child("automation");
let initialized = false;
let tickInFlight: Promise<void> | null = null;
let hasSchedules = false;
let hasExpiringMessages = false;
let nextScheduleAt = Number.POSITIVE_INFINITY;
let nextDeleteAt = Number.POSITIVE_INFINITY;
const stickyCache = new Map<string, StickyMessageRow>();

const asPayload = (value: ScheduledMessageRow["payload_json"] | StickyMessageRow["payload_json"]): Record<string, unknown> => {
  if (typeof value === "string") {
    try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; }
  }
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
};

const scheduleNextAt = (row: ScheduledMessageRow, from = Date.now()): string | null => {
  if (!row.cron_expr) return null;
  let rule: { frequency?: string; interval?: number; weekdays?: number[] } = {};
  try { rule = JSON.parse(row.cron_expr) as typeof rule; } catch { return null; }
  const interval = Math.max(1, Number(rule.interval) || 1);
  const date = new Date(from);
  if (rule.frequency === "hourly") date.setHours(date.getHours() + interval);
  else if (rule.frequency === "daily") date.setDate(date.getDate() + interval);
  else if (rule.frequency === "weekly") {
    const weekdays = Array.isArray(rule.weekdays) && rule.weekdays.length
      ? rule.weekdays
      : [date.getDay()];
    let days = 1;
    while (days <= 7 && !weekdays.includes(new Date(from + days * 86_400_000).getDay())) days++;
    date.setTime(from + days * 86_400_000);
    date.setDate(date.getDate() + (interval - 1) * 7);
  } else {
    date.setMinutes(date.getMinutes() + interval);
  }
  return date.toISOString();
};

const rebuildCaches = async (): Promise<void> => {
  const [schedules, expiring, sticky] = await Promise.all([
    automationRepository.listSchedules(),
    automationRepository.listExpiring(),
    automationRepository.listActiveSticky(),
  ]);
  hasSchedules = schedules.some((row) => row.enabled === 1 && Boolean(row.next_run_at));
  nextScheduleAt = schedules.reduce((min, row) =>
    row.enabled === 1 && row.next_run_at ? Math.min(min, Date.parse(row.next_run_at)) : min,
    Number.POSITIVE_INFINITY,
  );
  hasExpiringMessages = expiring.length > 0;
  nextDeleteAt = expiring.reduce((min, row) => Math.min(min, Date.parse(row.delete_at)), Number.POSITIVE_INFINITY);
  stickyCache.clear();
  sticky.forEach((row) => stickyCache.set(row.channel_id, row));
  initialized = true;
};

export const initializeAutomationService = async (): Promise<void> => {
  if (initialized) return;
  await rebuildCaches();
};

export const registerExpiringMessage = async (input: {
  guildId: string;
  channelId: string;
  messageId: string;
  deleteAt: string;
  createdBy: string;
}): Promise<void> => {
  await automationRepository.addExpiring({
    guild_id: input.guildId,
    channel_id: input.channelId,
    message_id: input.messageId,
    delete_at: input.deleteAt,
    created_by: input.createdBy,
  });
  hasExpiringMessages = true;
  nextDeleteAt = Math.min(nextDeleteAt, Date.parse(input.deleteAt));
};

export const createStickyMessage = async (input: {
  guildId: string;
  channelId: string;
  payload: Record<string, unknown>;
  intervalMessages: number;
  createdBy: string;
}): Promise<void> => {
  await automationRepository.upsertSticky({
    guild_id: input.guildId,
    channel_id: input.channelId,
    payload_json: input.payload,
    interval_messages: Math.max(5, Math.min(50, input.intervalMessages)),
    enabled: 1,
    created_by: input.createdBy,
  });
  const row = await automationRepository.findSticky(input.channelId);
  if (row) stickyCache.set(input.channelId, row);
};

export const removeStickyMessage = async (channelId: string): Promise<void> => {
  await automationRepository.deleteSticky(channelId);
  stickyCache.delete(channelId);
};

export const getActiveStickyMessages = async (): Promise<Array<{
  channelId: string;
  interval: number;
  currentMessageId: string | null;
}>> => {
  await initializeAutomationService();
  return [...stickyCache.values()].map((row) => ({
    channelId: row.channel_id,
    interval: row.interval_messages,
    currentMessageId: row.current_message_id,
  }));
};

export const refreshStickyMessage = async (channelId: string): Promise<string | null> => {
  await initializeAutomationService();
  let sticky = stickyCache.get(channelId);
  if (!sticky) {
    sticky = await automationRepository.findSticky(channelId);
    if (!sticky) return null;
    stickyCache.set(channelId, sticky);
  }
  const token = await discord.resolveBotToken();
  if (sticky.current_message_id) {
    await discord.deleteChannelMessage(channelId, sticky.current_message_id, token).catch((error) => {
      log.warn(`Could not delete previous sticky in ${channelId}: ${String(error)}`);
    });
  }
  const sent = await discord.sendChannelMessageWithToken(
    channelId,
    asPayload(sticky.payload_json) as any,
    token,
  );
  const messageId = sent?.id ?? null;
  await automationRepository.setStickyMessageId(channelId, messageId);
  stickyCache.set(channelId, { ...sticky, current_message_id: messageId });
  return messageId;
};

export const createScheduledMessage = async (input: {
  guildId: string;
  channelId: string;
  threadId?: string | null;
  templateId?: number | null;
  targetMessageId?: string | null;
  payload: Record<string, unknown>;
  runAt: string;
  timezone?: string;
  recurrence?: { frequency: "hourly" | "daily" | "weekly" | "custom"; interval?: number; weekdays?: number[] } | null;
  createdBy: string;
}): Promise<ScheduledMessageRow | undefined> => {
  const cronExpr = input.recurrence ? JSON.stringify(input.recurrence) : null;
  const row = await automationRepository.createSchedule({
    guild_id: input.guildId,
    channel_id: input.channelId,
    thread_id: input.threadId ?? null,
    template_id: input.templateId ?? null,
    target_message_id: input.targetMessageId ?? null,
    payload_json: input.payload,
    cron_expr: cronExpr,
    run_at: input.runAt,
    timezone: input.timezone ?? "UTC",
    enabled: 1,
    next_run_at: input.runAt,
    created_by: input.createdBy,
  });
  if (row) {
    hasSchedules = true;
    nextScheduleAt = Math.min(nextScheduleAt, Date.parse(row.next_run_at ?? row.run_at ?? input.runAt));
  }
  return row;
};

export const listScheduledMessages = async (guildId?: string): Promise<ScheduledMessageRow[]> =>
  automationRepository.listSchedules(guildId);

export const updateScheduledMessage = async (id: number, enabled: boolean): Promise<void> => {
  await automationRepository.updateSchedule(id, { enabled: enabled ? 1 : 0 });
  await rebuildCaches();
};

export const deleteScheduledMessage = async (id: number): Promise<void> => {
  await automationRepository.deleteSchedule(id);
  await rebuildCaches();
};

const runDueSchedules = async (now: Date): Promise<void> => {
  if (!hasSchedules || now.getTime() < nextScheduleAt) return;
  const due = await automationRepository.findDueSchedules(now.toISOString());
  for (const row of due) {
    try {
      const payload = asPayload(row.payload_json) as any;
      if (row.target_message_id) {
        await discord.editChannelMessage(row.channel_id, row.target_message_id, payload);
      } else {
        const token = await discord.resolveBotToken();
        await discord.sendChannelMessageWithToken(row.thread_id || row.channel_id, payload, token);
      }
      const next = scheduleNextAt(row, now.getTime());
      await automationRepository.updateSchedule(row.id, {
        last_run_at: now.toISOString(),
        enabled: next ? 1 : 0,
        next_run_at: next,
      });
    } catch (error) {
      log.error(`Scheduled message ${row.id} failed: ${String(error)}`);
      await automationRepository.updateSchedule(row.id, { last_run_at: now.toISOString(), next_run_at: scheduleNextAt(row, now.getTime()) });
    }
  }
  await rebuildCaches();
};

const runDueExpirations = async (now: Date): Promise<void> => {
  if (!hasExpiringMessages || now.getTime() < nextDeleteAt) return;
  const due = await automationRepository.findDueExpiring(now.toISOString());
  const token = due.length ? await discord.resolveBotToken() : null;
  for (const row of due) {
    try {
      if (token) await discord.deleteChannelMessage(row.channel_id, row.message_id, token);
    } catch (error) {
      log.warn(`Expiring message ${row.message_id} could not be deleted: ${String(error)}`);
    } finally {
      await automationRepository.removeExpiring(row.id);
    }
  }
  if (due.length > 0) {
    const remaining = await automationRepository.listExpiring();
    hasExpiringMessages = remaining.length > 0;
    nextDeleteAt = remaining.reduce((min, row) => Math.min(min, Date.parse(row.delete_at)), Number.POSITIVE_INFINITY);
  } else {
    // The cache said an item was due but the row was already removed elsewhere.
    nextDeleteAt = Number.POSITIVE_INFINITY;
    hasExpiringMessages = (await automationRepository.countExpiring()) > 0;
  }
};

export const runAutomationTick = async (): Promise<void> => {
  if (tickInFlight) return tickInFlight;
  tickInFlight = (async () => {
    await initializeAutomationService();
    const now = new Date();
    await Promise.all([runDueSchedules(now), runDueExpirations(now)]);
  })().finally(() => { tickInFlight = null; });
  return tickInFlight;
};

export const getAutomationCacheState = () => ({
  initialized,
  hasSchedules,
  hasExpiringMessages,
  nextScheduleAt,
  nextDeleteAt,
  stickyCount: stickyCache.size,
});
