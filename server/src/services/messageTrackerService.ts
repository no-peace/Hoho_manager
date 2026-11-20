import crypto from "node:crypto";
import type { DiscordMessagePayload } from "@dmb/shared";
import { trackedMessageRepository, type TrackedMessageRecord } from "../repositories/trackedMessageRepository.js";
import { templateRepository } from "../repositories/templateRepository.js";
import { customExecutorRepository } from "../repositories/customExecutorRepository.js";
import { canUseTrackedTemplate } from "../utils/templateAccess.js";
import { isCustomExecutorEnabled } from "../utils/customExecutorAccess.js";
import { interpolateWeaoPlaceholders } from "./weaoService.js";
import { resolveAuthorPlaceholders } from "./authorService.js";
import * as discord from "./discordService.js";
import { logger } from "../utils/logger.js";

const log = logger.child("messageTracker");

export const computePayloadHash = (payload: unknown): string => {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
};

export interface TrackMessageParams {
  channelId: string;
  messageId: string;
  templateId?: number | null;
  templateAccessVerified?: boolean;
  exploitName?: string | null;
  authorUserId?: string | null;
  rawPayload?: DiscordMessagePayload | null;
  resolvedPayload?: DiscordMessagePayload | null;
  name?: string | null;
  expiresAt?: string | null;
}

export const trackMessage = async (
  params: TrackMessageParams,
): Promise<TrackedMessageRecord | null> => {
  try {
    const rawToStore = params.rawPayload ? JSON.stringify(params.rawPayload) : null;
    const hash = params.resolvedPayload
      ? computePayloadHash(params.resolvedPayload)
      : params.rawPayload ? computePayloadHash(params.rawPayload) : "pending";

    return await trackedMessageRepository.upsert({
      channel_id: params.channelId,
      message_id: params.messageId,
      template_id: params.templateId ?? null,
      template_access_verified:
        params.templateAccessVerified === undefined ? undefined : params.templateAccessVerified ? 1 : 0,
      exploit_name: params.exploitName ?? null,
      author_user_id: params.authorUserId ?? null,
      raw_payload: rawToStore,
      last_payload_hash: hash,
      name: params.name ?? null,
      expires_at: params.expiresAt ?? null,
    });
  } catch (err) {
    log.warn(`Failed to track message ${params.messageId} in ${params.channelId}:`, err);
    return null;
  }
};

export interface SyncResult {
  checked: number;
  updated: number;
  removed: number;
  errors: number;
}

const runTrackedMessageSync = async (): Promise<SyncResult> => {
  const records = await trackedMessageRepository.listAll();
  const result: SyncResult = { checked: records.length, updated: 0, removed: 0, errors: 0 };

  // A polling sweep often sees many messages backed by the same executor or
  // template. Reuse each lookup for this sweep instead of issuing N identical
  // database reads.
  const customExecutorLookups = new Map<
    string,
    ReturnType<typeof customExecutorRepository.findByTitle>
  >();
  const templateLookups = new Map<
    number,
    ReturnType<typeof templateRepository.findById>
  >();
  const channelGuildLookups = new Map<
    string,
    ReturnType<typeof discord.getChannelGuildId>
  >();

  const getChannelGuildId = (channelId: string) => {
    let lookup = channelGuildLookups.get(channelId);
    if (!lookup) {
      lookup = discord.getChannelGuildId(channelId).catch(() => null);
      channelGuildLookups.set(channelId, lookup);
    }
    return lookup;
  };

  const getCustomExecutor = (title: string) => {
    const key = title.trim().toLowerCase();
    let lookup = customExecutorLookups.get(key);
    if (!lookup) {
      lookup = customExecutorRepository.findByTitle(title);
      customExecutorLookups.set(key, lookup);
    }
    return lookup;
  };

  const getTemplate = (templateId: number) => {
    let lookup = templateLookups.get(templateId);
    if (!lookup) {
      lookup = templateRepository.findById(templateId);
      templateLookups.set(templateId, lookup);
    }
    return lookup;
  };

  for (const record of records) {
    try {
      if (record.expires_at && Number.isFinite(Date.parse(record.expires_at)) && Date.parse(record.expires_at) <= Date.now()) {
        await trackedMessageRepository.deleteById(record.id);
        result.removed++;
        continue;
      }
      let basePayload: DiscordMessagePayload | null = null;

      // 1. Resolve base payload from a verified template, enabled custom executor, or stored raw_payload
      const customExec = record.exploit_name
        ? await getCustomExecutor(record.exploit_name)
        : undefined;
      const customExecutorDisabled = Boolean(customExec) && !isCustomExecutorEnabled(customExec);

      if (record.template_id && !customExecutorDisabled) {
        const tpl = await getTemplate(record.template_id);
        if (tpl && canUseTrackedTemplate(tpl, record.template_access_verified)) {
          const rawDoc = tpl.data as any;
          basePayload =
            rawDoc?.messages?.[0]?.data?.data ??
            rawDoc?.messages?.[0]?.data ??
            rawDoc ??
            null;
        } else if (tpl) {
          log.warn(`Skipping unverified private template ${tpl.id} on legacy tracked message ${record.message_id}`);
        }
      } else if (record.template_id && customExecutorDisabled) {
        log.warn(`Skipping disabled custom executor on tracked message ${record.message_id}`);
      } else if (customExec && isCustomExecutorEnabled(customExec) && customExec.template_id) {
        const tpl = await getTemplate(customExec.template_id);
        if (tpl && canUseTrackedTemplate(tpl, record.template_access_verified)) {
          const rawDoc = tpl.data as any;
          basePayload =
            rawDoc?.messages?.[0]?.data?.data ??
            rawDoc?.messages?.[0]?.data ??
            rawDoc ??
            null;
        } else if (tpl) {
          log.warn(`Skipping unverified private custom-executor template ${tpl.id} on tracked message ${record.message_id}`);
        }
      } else if (customExec && isCustomExecutorEnabled(customExec) && customExec.custom_payload) {
        try {
          basePayload = JSON.parse(customExec.custom_payload);
        } catch {}
      }

      if (!basePayload && record.raw_payload) {
        try {
          basePayload = JSON.parse(record.raw_payload);
        } catch {}
      }

      if (!basePayload) {
        // If template was deleted and no payload, un-track to preserve minimal DB space
        await trackedMessageRepository.deleteById(record.id);
        result.removed++;
        continue;
      }

      // 2. Interpolate dynamic exploit placeholders
      let resolvedPayload = basePayload;
      if (record.exploit_name || JSON.stringify(basePayload).includes("{exploit")) {
        const interpolated = await interpolateWeaoPlaceholders(basePayload, record.exploit_name ?? undefined);
        resolvedPayload = interpolated.payload;
      }

      // 3. Resolve author details (name, avatar, profile link from Discord user ID)
      const guildId = await getChannelGuildId(record.channel_id);
      const authorRes = await resolveAuthorPlaceholders(
        resolvedPayload,
        record.author_user_id,
        null,
        guildId,
      );
      resolvedPayload = authorRes.payload;

      // 4. Check if rendered payload changed
      const currentHash = computePayloadHash(resolvedPayload);
      if (currentHash !== record.last_payload_hash) {
        log.info(
          `Updating message ${record.message_id} in channel ${record.channel_id} (hash changed ${record.last_payload_hash.slice(0, 8)} -> ${currentHash.slice(0, 8)})`,
        );

        try {
          await discord.editChannelMessage(record.channel_id, record.message_id, resolvedPayload);
          await trackedMessageRepository.updateHashAndCheck(record.id, currentHash);
          result.updated++;
        } catch (editErr: any) {
          const status = editErr?.status || editErr?.statusCode;
          const code = editErr?.code;
          // Discord 404 or 10008 (Unknown Message) or 10003 (Unknown Channel) -> message deleted
          if (status === 404 || code === 10008 || code === 10003) {
            log.info(`Message ${record.message_id} in channel ${record.channel_id} was deleted; un-tracking`);
            await trackedMessageRepository.deleteById(record.id);
            result.removed++;
          } else {
            throw editErr;
          }
        }
      } else {
        trackedMessageRepository.recordCheckInMemory(record.id);
      }
    } catch (itemErr) {
      log.warn(`Error syncing tracked message ${record.message_id}:`, itemErr);
      result.errors++;
    }
  }

  return result;
};

// setInterval does not wait for an async callback. If a sweep takes longer
// than the polling interval, share the in-flight promise rather than launching
// another full database/Discord pass over the same tracked messages.
let syncInFlight: Promise<SyncResult> | null = null;

export const syncTrackedMessages = (): Promise<SyncResult> => {
  if (syncInFlight) return syncInFlight;

  const run = runTrackedMessageSync();
  const shared = run.finally(() => {
    if (syncInFlight === shared) syncInFlight = null;
  });
  syncInFlight = shared;
  return shared;
};

let pollingTimer: NodeJS.Timeout | null = null;

export const startMessageTrackerPolling = (intervalMs = 60_000): void => {
  if (pollingTimer) return;
  pollingTimer = setInterval(() => {
    syncTrackedMessages().catch((err) => {
      log.warn("Background tracked message sync error:", err);
    });
  }, intervalMs);
  if (typeof pollingTimer.unref === "function") {
    pollingTimer.unref();
  }
  log.info(`Started background message tracker polling (interval: ${intervalMs / 1000}s)`);
};

export const waitForTrackedMessageSync = async (): Promise<void> => {
  if (syncInFlight) await syncInFlight.catch(() => undefined);
};

export const stopMessageTrackerPolling = (): void => {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
};
