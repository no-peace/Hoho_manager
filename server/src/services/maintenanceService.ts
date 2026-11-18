import { db } from "../config/database.js";
import { memberSearchCache } from "./discordService.js";
import { logger } from "../utils/logger.js";

const log = logger.child("maintenance");

export interface MaintenanceConfig {
  actionLogRetentionDays?: number; // default: 30
  auditLogRetentionDays?: number; // default: 90
  adhocActionRetentionDays?: number; // default: 30
  batchSize?: number; // default: 500
}

export interface MaintenanceReport {
  expiredFlowsPruned: number;
  expiredReceiptsPruned: number;
  expiredSessionsPruned: number;
  expiredTemplatesPruned?: number;
  actionLogsPruned: number;
  orphanedAdHocActionsPruned: number;
  auditLogsPruned: number;
  cacheEntriesPruned: number;
  durationMs: number;
}

export const pruneExpiredTemplates = async (batchSize = 500): Promise<number> => {
  const now = new Date().toISOString();
  let total = 0;
  while (true) {
    const { changes } = await db.run(
      `DELETE FROM templates
       WHERE id IN (
         SELECT id FROM templates
         WHERE expires_at IS NOT NULL
           AND datetime(expires_at) <= datetime(@now)
           AND id NOT IN (SELECT template_id FROM tracked_messages WHERE template_id IS NOT NULL)
           AND id NOT IN (SELECT template_id FROM custom_executors WHERE template_id IS NOT NULL)
         LIMIT @batchSize
       )`,
      { now, batchSize },
    );
    total += changes;
    if (changes < batchSize) break;
    await new Promise((resolve) => setImmediate(resolve));
  }
  return total;
};

export const pruneActionLogs = async (retentionDays = 30, batchSize = 500): Promise<number> => {
  const cutoffDate = new Date(Date.now() - retentionDays * 86_400_000);
  const cutoff = cutoffDate.toISOString().replace("T", " ").slice(0, 19);
  let total = 0;
  while (true) {
    const { changes } = await db.run(
      `DELETE FROM action_logs
       WHERE id IN (
         SELECT id FROM action_logs
         WHERE executed_at <= @cutoff
         LIMIT @batchSize
       )`,
      { cutoff, batchSize },
    );
    total += changes;
    if (changes < batchSize) break;
    await new Promise((resolve) => setImmediate(resolve));
  }
  return total;
};

export const pruneAuditLogs = async (_retentionDays = 90, _batchSize = 500): Promise<number> => {
  // audit_log_entries table dropped to conserve SQLite database storage space
  return 0;
};

export const pruneOrphanedAdHocActions = async (
  retentionDays = 30,
  batchSize = 500,
): Promise<number> => {
  const cutoffDate = new Date(Date.now() - retentionDays * 86_400_000);
  const cutoff = cutoffDate.toISOString().replace("T", " ").slice(0, 19);
  let total = 0;
  while (true) {
    const { changes } = await db.run(
      `DELETE FROM action_definitions
       WHERE id IN (
         SELECT id FROM action_definitions
         WHERE template_id IS NULL
           AND created_at <= @cutoff
         LIMIT @batchSize
       )`,
      { cutoff, batchSize },
    );
    total += changes;
    if (changes < batchSize) break;
    await new Promise((resolve) => setImmediate(resolve));
  }
  return total;
};

export const pruneExpiredFlowStates = async (batchSize = 500): Promise<number> => {
  const now = new Date().toISOString();
  let total = 0;
  while (true) {
    const { changes } = await db.run(
      `DELETE FROM flow_states
       WHERE token IN (
         SELECT token FROM flow_states
         WHERE expires_at <= @now
         LIMIT @batchSize
       )`,
      { now, batchSize },
    );
    total += changes;
    if (changes < batchSize) break;
    await new Promise((resolve) => setImmediate(resolve));
  }
  return total;
};

export const pruneExpiredSessions = async (batchSize = 500): Promise<number> => {
  const now = Date.now();
  let total = 0;
  while (true) {
    const { changes } = await db.run(
      `DELETE FROM active_sessions
       WHERE id IN (
         SELECT id FROM active_sessions
         WHERE expires_at <= @now
         LIMIT @batchSize
       )`,
      { now, batchSize },
    );
    total += changes;
    if (changes < batchSize) break;
    await new Promise((resolve) => setImmediate(resolve));
  }
  return total;
};

export const pruneExpiredReceipts = async (batchSize = 500): Promise<number> => {
  const now = new Date().toISOString();
  let total = 0;
  while (true) {
    const { changes } = await db.run(
      `DELETE FROM interaction_receipts
       WHERE interaction_id IN (
         SELECT interaction_id FROM interaction_receipts
         WHERE expires_at <= @now
         LIMIT @batchSize
       )`,
      { now, batchSize },
    );
    total += changes;
    if (changes < batchSize) break;
    await new Promise((resolve) => setImmediate(resolve));
  }
  return total;
};

export const runDatabaseMaintenance = async (
  config: MaintenanceConfig = {},
): Promise<MaintenanceReport> => {
  const start = Date.now();
  const actionLogDays = config.actionLogRetentionDays ?? 30;
  const auditLogDays = config.auditLogRetentionDays ?? 90;
  const adhocActionDays = config.adhocActionRetentionDays ?? 30;
  const batchSize = config.batchSize ?? 500;

  log.info(
    `Starting database maintenance sweep (auditLogs=${auditLogDays}d, actionLogs=${actionLogDays}d, adhocActions=${adhocActionDays}d, batchSize=${batchSize})`,
  );

  let expiredFlowsPruned = 0;
  try {
    expiredFlowsPruned = await pruneExpiredFlowStates(batchSize);
  } catch (err) {
    log.warn(`Flow pruning failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  let expiredReceiptsPruned = 0;
  try {
    expiredReceiptsPruned = await pruneExpiredReceipts(batchSize);
  } catch (err) {
    log.warn(`Receipt pruning failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  let expiredSessionsPruned = 0;
  try {
    expiredSessionsPruned = await pruneExpiredSessions(batchSize);
  } catch (err) {
    log.warn(`Session pruning failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  let expiredTemplatesPruned = 0;
  try {
    expiredTemplatesPruned = await pruneExpiredTemplates(batchSize);
  } catch (err) {
    log.warn(`Template retention pruning failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  let actionLogsPruned = 0;
  try {
    actionLogsPruned = await pruneActionLogs(actionLogDays, batchSize);
  } catch (err) {
    log.warn(`Action log pruning failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  let orphanedAdHocActionsPruned = 0;
  try {
    orphanedAdHocActionsPruned = await pruneOrphanedAdHocActions(adhocActionDays, batchSize);
  } catch (err) {
    log.warn(`Ad-hoc action pruning failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const auditLogsPruned = 0;

  const cacheEntriesPruned = memberSearchCache.pruneExpired();
  const durationMs = Date.now() - start;

  const report: MaintenanceReport = {
    expiredFlowsPruned,
    expiredReceiptsPruned,
    expiredSessionsPruned,
    expiredTemplatesPruned,
    actionLogsPruned,
    orphanedAdHocActionsPruned,
    auditLogsPruned,
    cacheEntriesPruned,
    durationMs,
  };

  log.info(
    `Maintenance sweep complete in ${durationMs}ms: pruned ` +
      `${expiredFlowsPruned} flows, ${expiredReceiptsPruned} receipts, ${expiredSessionsPruned} sessions, ` +
      `${actionLogsPruned} action logs, ${orphanedAdHocActionsPruned} ad-hoc actions, ${auditLogsPruned} audit logs, ` +
      `${cacheEntriesPruned} cache entries.`,
  );

  return report;
};
