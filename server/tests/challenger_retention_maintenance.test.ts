import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, initializeDatabase } from "../src/config/database.js";
import {
  runDatabaseMaintenance,
  pruneActionLogs,
  pruneAuditLogs,
  pruneOrphanedAdHocActions,
  pruneExpiredFlowStates,
  pruneExpiredSessions,
  pruneExpiredTemplates,
} from "../src/services/maintenanceService.js";

describe("PERF-04: Retention & Maintenance Sweeps", () => {
  const runId = Math.random().toString(36).substring(2, 8);

  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(async () => {
    // Keep db connection open
  });

  it("prunes old action logs while retaining fresh entries, and safely ignores dropped audit_log_entries", async () => {
    const oldTimestamp = new Date(Date.now() - 40 * 86_400_000)
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);
    const freshTimestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

    const oldIntId = `int_old_${runId}`;
    const freshIntId = `int_fresh_${runId}`;

    await db.run(
      `INSERT INTO action_logs (interaction_id, user_id, status, executed_at)
       VALUES (@oldIntId, 'user1', 'success', @oldTimestamp),
              (@freshIntId, 'user1', 'success', @freshTimestamp)`,
      { oldIntId, freshIntId, oldTimestamp, freshTimestamp },
    );

    const report = await runDatabaseMaintenance({
      actionLogRetentionDays: 30,
      auditLogRetentionDays: 90,
      batchSize: 10,
    });

    expect(report.actionLogsPruned).toBeGreaterThanOrEqual(1);
    expect(report.auditLogsPruned).toBe(0); // Zero-DB logging: audit logs are not stored in SQLite

    const remainingLogs = await db.query<{ interaction_id: string }>(
      `SELECT interaction_id FROM action_logs WHERE interaction_id IN (?, ?)`,
      [oldIntId, freshIntId],
    );
    expect(remainingLogs.map((r) => r.interaction_id)).toEqual([freshIntId]);
  });

  it("prunes orphaned ad-hoc actions but never prunes template-backed actions", async () => {
    const oldTimestamp = new Date(Date.now() - 40 * 86_400_000)
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);

    const userId = 88000 + Math.floor(Math.random() * 1000);
    const templateId = 88000 + Math.floor(Math.random() * 1000);
    const btnTemplate = `btn_tpl_${runId}`;
    const btnAdhoc = `btn_adhoc_${runId}`;

    // Ensure test user and template exist for foreign key constraint
    await db.run(
      `INSERT OR IGNORE INTO users (id, discord_id, username) VALUES (?, ?, 'test_user')`,
      [userId, `disc_${userId}`],
    );
    await db.run(
      `INSERT OR IGNORE INTO templates (id, user_id, name, data) VALUES (?, ?, 'test_tpl', '{}')`,
      [templateId, userId],
    );

    // Template-backed action
    await db.run(
      `INSERT INTO action_definitions (template_id, custom_id, action_type, config, created_at)
       VALUES (?, ?, 'dud', '{}', ?)`,
      [templateId, btnTemplate, oldTimestamp],
    );

    // Ad-hoc action (template_id IS NULL)
    await db.run(
      `INSERT INTO action_definitions (template_id, message_id, custom_id, action_type, config, created_at)
       VALUES (NULL, 'msg_adhoc', ?, 'dud', '{}', ?)`,
      [btnAdhoc, oldTimestamp],
    );

    await runDatabaseMaintenance({ adhocActionRetentionDays: 30, batchSize: 10 });

    const templateAction = await db.get(
      "SELECT * FROM action_definitions WHERE custom_id = ?",
      [btnTemplate],
    );
    expect(templateAction).toBeDefined();

    const adhocAction = await db.get(
      "SELECT * FROM action_definitions WHERE custom_id = ?",
      [btnAdhoc],
    );
    expect(adhocAction).toBeUndefined();
  });

  it("prunes expired flow states and active sessions correctly", async () => {
    const pastIso = new Date(Date.now() - 3600 * 1000).toISOString();
    const futureIso = new Date(Date.now() + 3600 * 1000).toISOString();

    const tokenExpired = `token_exp_${runId}`;
    const tokenActive = `token_act_${runId}`;
    const sessExpired = `sess_exp_${runId}`;
    const sessActive = `sess_act_${runId}`;

    await db.run(
      `INSERT INTO flow_states (token, step, variables, expires_at)
       VALUES (@tokenExpired, 1, '{}', @pastIso),
              (@tokenActive, 1, '{}', @futureIso)`,
      { tokenExpired, tokenActive, pastIso, futureIso },
    );

    const pastMs = Date.now() - 3600 * 1000;
    const futureMs = Date.now() + 3600 * 1000;

    await db.run(
      `INSERT INTO active_sessions (id, guild_id, user_id, permissions, created_at, expires_at)
       VALUES (?, 'g1', 'u1', '0', ?, ?),
              (?, 'g1', 'u1', '0', ?, ?)`,
      [sessExpired, pastMs, pastMs, sessActive, pastMs, futureMs],
    );

    const flowsPruned = await pruneExpiredFlowStates(10);
    const sessionsPruned = await pruneExpiredSessions(10);

    expect(flowsPruned).toBeGreaterThanOrEqual(1);
    expect(sessionsPruned).toBeGreaterThanOrEqual(1);

    const activeFlow = await db.get(
      "SELECT token FROM flow_states WHERE token = ?",
      [tokenActive],
    );
    expect(activeFlow).toBeDefined();

    const expiredFlow = await db.get(
      "SELECT token FROM flow_states WHERE token = ?",
      [tokenExpired],
    );
    expect(expiredFlow).toBeUndefined();

    const activeSession = await db.get(
      "SELECT id FROM active_sessions WHERE id = ?",
      [sessActive],
    );
    expect(activeSession).toBeDefined();

    const expiredSession = await db.get(
      "SELECT id FROM active_sessions WHERE id = ?",
      [sessExpired],
    );
    expect(expiredSession).toBeUndefined();
  });

  it("prunes expired unreferenced templates while preserving tracked/pinned templates", async () => {
    const pastIso = new Date(Date.now() - 3600 * 1000).toISOString();
    const futureIso = new Date(Date.now() + 14 * 86_400_000).toISOString();
    const userId = 89000 + Math.floor(Math.random() * 1000);

    await db.run(
      `INSERT OR IGNORE INTO users (id, discord_id, username) VALUES (?, ?, 'tpl_retention_user')`,
      [userId, `disc_ret_${userId}`],
    );

    const expUnref = await db.run(
      `INSERT INTO templates (user_id, name, data, expires_at) VALUES (?, ?, '{}', ?)`,
      [userId, `exp_unref_${runId}`, pastIso],
    );
    const expTracked = await db.run(
      `INSERT INTO templates (user_id, name, data, expires_at) VALUES (?, ?, '{}', ?)`,
      [userId, `exp_tracked_${runId}`, pastIso],
    );
    const activeFuture = await db.run(
      `INSERT INTO templates (user_id, name, data, expires_at) VALUES (?, ?, '{}', ?)`,
      [userId, `active_future_${runId}`, futureIso],
    );

    await db.run(
      `INSERT INTO tracked_messages (channel_id, message_id, template_id, last_payload_hash, created_at, updated_at, last_checked_at)
       VALUES ('chan_ret', ?, ?, 'hash1', 1, 1, 1)`,
      [`msg_ret_${runId}`, expTracked.lastInsertRowid],
    );

    const pruned = await pruneExpiredTemplates(10);
    expect(pruned).toBeGreaterThanOrEqual(1);

    const foundUnref = await db.get("SELECT id FROM templates WHERE id = ?", [
      expUnref.lastInsertRowid,
    ]);
    const foundTracked = await db.get("SELECT id FROM templates WHERE id = ?", [
      expTracked.lastInsertRowid,
    ]);
    const foundFuture = await db.get("SELECT id FROM templates WHERE id = ?", [
      activeFuture.lastInsertRowid,
    ]);

    expect(foundUnref).toBeUndefined();
    expect(foundTracked).toBeDefined();
    expect(foundFuture).toBeDefined();
  });
});

