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

interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const getZonedParts = (date: Date, formatter: Intl.DateTimeFormat): ZonedDateParts => {
  const parts = formatter.formatToParts(date);
  const values = new Map<string, string>(parts.map((part) => [part.type, part.value] as const));
  return {
    year: Number(values.get("year")),
    month: Number(values.get("month")),
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
    second: Number(values.get("second")),
  };
};

const zonedPartsToDate = (parts: ZonedDateParts, formatter: Intl.DateTimeFormat): Date => {
  const targetUtc = Date.UTC(
    parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second,
  );
  let guess = targetUtc;
  for (let attempt = 0; attempt < 4; attempt++) {
    const actual = getZonedParts(new Date(guess), formatter);
    const actualUtc = Date.UTC(
      actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second,
    );
    const difference = targetUtc - actualUtc;
    if (difference === 0) break;
    guess += difference;
  }
  return new Date(guess);
};

const addZonedTime = (
  parts: ZonedDateParts,
  formatter: Intl.DateTimeFormat,
  unit: "hour" | "day" | "minute",
  amount: number,
): Date => {
  const local = new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day + (unit === "day" ? amount : 0),
    parts.hour + (unit === "hour" ? amount : 0),
    parts.minute + (unit === "minute" ? amount : 0),
    parts.second,
  ));
  return zonedPartsToDate({
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    second: local.getUTCSeconds(),
  }, formatter);
};

const scheduleNextAt = (row: ScheduledMessageRow, now = Date.now()): string | null => {
  if (!row.cron_expr) return null;
  let rule: { frequency?: string; interval?: number; weekdays?: number[] } = {};
  try {
    rule = JSON.parse(row.cron_expr) as typeof rule;
  } catch {
    return null;
  }

  const frequency = rule.frequency;
  if (frequency !== "hourly" && frequency !== "daily" && frequency !== "weekly" && frequency !== "custom") {
    throw new Error(`Unsupported schedule frequency: ${String(frequency)}`);
  }
  const interval = Math.max(1, Math.min(365, Number(rule.interval) || 1));
  let timezone = row.timezone || "UTC";
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    timezone = "UTC";
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  }

  const anchorValue = row.next_run_at ?? row.run_at;
  const anchorTime = anchorValue ? Date.parse(anchorValue) : now;
  if (!Number.isFinite(anchorTime)) throw new Error(`Schedule ${row.id} has an invalid next_run_at anchor`);

  let candidate = new Date(anchorTime);
  for (let attempt = 0; attempt < 10_000 && candidate.getTime() <= now; attempt++) {
    const local = getZonedParts(candidate, formatter);
    if (frequency === "weekly") {
      const weekdays = [...new Set(
        (Array.isArray(rule.weekdays) ? rule.weekdays : [])
          .filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6),
      )].sort((a, b) => a - b);
      const selected = weekdays.length > 0 ? weekdays : [new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay()];
      const currentWeekday = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay();
      const nextWeekday = selected.find((day) => day > currentWeekday) ?? selected[0] ?? currentWeekday;
      let dayOffset = (nextWeekday - currentWeekday + 7) % 7;
      if (dayOffset === 0) dayOffset = 7;
      if (nextWeekday <= currentWeekday) dayOffset += (interval - 1) * 7;
      candidate = addZonedTime(local, formatter, "day", dayOffset);
    } else {
      candidate = addZonedTime(
        local,
        formatter,
        frequency === "hourly" ? "hour" : frequency === "daily" ? "day" : "minute",
        interval,
      );
    }
  }
  if (candidate.getTime() <= now) throw new Error(`Schedule ${row.id} exceeded recurrence advancement limit`);
  return candidate.toISOString();
};

const rebuildCaches = async (): Promise<void> => {
  const [nextScheduleAtValue, nextDeleteAtValue, sticky] = await Promise.all([
    automationRepository.getNextScheduleAt(),
    automationRepository.getNextExpiringAt(),
    automationRepository.listActiveSticky(),
  ]);
  const parsedScheduleAt = nextScheduleAtValue ? Date.parse(nextScheduleAtValue) : Number.POSITIVE_INFINITY;
  const parsedDeleteAt = nextDeleteAtValue ? Date.parse(nextDeleteAtValue) : Number.POSITIVE_INFINITY;
  hasSchedules = Number.isFinite(parsedScheduleAt);
  nextScheduleAt = hasSchedules ? parsedScheduleAt : Number.POSITIVE_INFINITY;
  hasExpiringMessages = Number.isFinite(parsedDeleteAt);
  nextDeleteAt = hasExpiringMessages ? parsedDeleteAt : Number.POSITIVE_INFINITY;
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
  const parsedDeleteAt = Date.parse(input.deleteAt);
  if (Number.isFinite(parsedDeleteAt)) {
    hasExpiringMessages = true;
    nextDeleteAt = Math.min(nextDeleteAt, parsedDeleteAt);
  }
};

export const createStickyMessage = async (input: {
  guildId: string;
  channelId: string;
  payload: Record<string, unknown>;
  intervalMessages: number;
  currentMessageId?: string | null;
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
  await automationRepository.setStickyMessageId(input.channelId, input.currentMessageId ?? null);
  const row = await automationRepository.findSticky(input.channelId);
  if (row) stickyCache.set(input.channelId, row);
};

export const removeStickyMessage = async (channelId: string): Promise<void> => {
  const sticky = stickyCache.get(channelId) ?? await automationRepository.findSticky(channelId);
  if (sticky?.current_message_id) {
    const token = await discord.resolveBotToken();
    await discord.deleteChannelMessage(channelId, sticky.current_message_id, token).catch((error) => {
      log.warn(`Could not delete removed sticky message in ${channelId}: ${String(error)}`);
    });
  }
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
    const parsedNextRunAt = Date.parse(row.next_run_at ?? row.run_at ?? input.runAt);
    if (Number.isFinite(parsedNextRunAt)) nextScheduleAt = Math.min(nextScheduleAt, parsedNextRunAt);
  }
  return row;
};

export const listScheduledMessages = async (guildId?: string): Promise<ScheduledMessageRow[]> =>
  automationRepository.listSchedules(guildId);

export const getScheduledMessage = (id: number): Promise<ScheduledMessageRow | undefined> =>
  automationRepository.findScheduleById(id);

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
        await discord.editChannelMessage(row.thread_id || row.channel_id, row.target_message_id, payload);
      } else {
        const token = await discord.resolveBotToken();
        await discord.sendChannelMessageWithToken(row.thread_id || row.channel_id, payload, token);
      }
      const next = scheduleNextAt(row, now.getTime());
      await automationRepository.updateSchedule(row.id, {
        last_run_at: now.toISOString(),
        enabled: next ? 1 : 0,
        next_run_at: next,
        retry_count: 0,
      });
    } catch (error) {
      log.error(`Scheduled message ${row.id} failed: ${String(error)}`);
      const status = error !== null && typeof error === "object" && "status" in error
        ? Number((error as { status: unknown }).status)
        : 0;
      const transient = status === 0 || status === 408 || status === 429 || status >= 500;
      const retryCount = Number.isInteger(row.retry_count) ? Number(row.retry_count) : 0;
      let retryAt: string | null = null;
      let nextRetryCount = retryCount;
      try {
        if (row.cron_expr) {
          retryAt = scheduleNextAt(row, now.getTime());
          nextRetryCount = 0;
        } else if (transient && retryCount < 5) {
          retryAt = new Date(now.getTime() + 60_000).toISOString();
          nextRetryCount = retryCount + 1;
        }
      } catch (scheduleError) {
        log.error(`Scheduled message ${row.id} has an unsupported recurrence and was disabled: ${String(scheduleError)}`);
      }
      await automationRepository.updateSchedule(row.id, {
        last_run_at: now.toISOString(),
        enabled: retryAt ? 1 : 0,
        next_run_at: retryAt,
        retry_count: nextRetryCount,
      });
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
      if (!token) throw new Error("Discord bot token is unavailable");
      await discord.deleteChannelMessage(row.channel_id, row.message_id, token);
      await automationRepository.removeExpiring(row.id);
    } catch (error) {
      const status =
        error !== null && typeof error === "object" && "status" in error
          ? Number((error as { status: unknown }).status)
          : 0;
      const details =
        error !== null && typeof error === "object" && "details" in error
          ? (error as { details: unknown }).details
          : null;
      const discordCode =
        details !== null && typeof details === "object" && "code" in details
          ? Number((details as { code: unknown }).code)
          : 0;
      const permanent = status === 403 || status === 404 || discordCode === 10008 || discordCode === 10003;
      if (permanent) {
        await automationRepository.removeExpiring(row.id);
        log.warn(`Expiring message ${row.message_id} is no longer deletable: ${String(error)}`);
      } else {
        const retryAt = new Date(now.getTime() + 60_000).toISOString();
        await automationRepository.retryExpiring(row.id, retryAt);
        log.warn(`Expiring message ${row.message_id} will retry at ${retryAt}: ${String(error)}`);
      }
    }
  }
  const nextDeleteAtValue = await automationRepository.getNextExpiringAt();
  if (nextDeleteAtValue === null) {
    hasExpiringMessages = false;
    nextDeleteAt = Number.POSITIVE_INFINITY;
    return;
  }
  const parsedNextDeleteAt = Date.parse(nextDeleteAtValue);
  hasExpiringMessages = Number.isFinite(parsedNextDeleteAt);
  nextDeleteAt = hasExpiringMessages ? parsedNextDeleteAt : Number.POSITIVE_INFINITY;
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
