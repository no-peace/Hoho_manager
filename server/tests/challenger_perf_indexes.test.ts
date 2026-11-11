import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, initializeDatabase } from "../src/config/database.js";

describe("PERF-06: Database Indexes Verification", () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(async () => {
    // Keep db open for other tests or gracefully close if needed
  });

  it("verifies all performance indexes exist in SQLite schema", async () => {
    const indexes = await db.query<{ name: string; tbl_name: string }>(
      "SELECT name, tbl_name FROM sqlite_master WHERE type = 'index'",
    );
    const indexNames = new Set(indexes.map((idx) => idx.name));

    expect(indexNames.has("idx_action_defs_message_id")).toBe(true);
    expect(indexNames.has("idx_action_defs_adhoc_created")).toBe(true);
    expect(indexNames.has("idx_flow_states_expires")).toBe(true);
    expect(indexNames.has("idx_flow_states_token_expires")).toBe(true);
    expect(indexNames.has("idx_staff_cooldowns_lookup")).toBe(true);
    // Note: audit_log_entries was dropped in migration 008 in favor of zero-DB Discord logging
    expect(indexNames.has("idx_action_logs_executed_at")).toBe(true);
    expect(indexNames.has("idx_bot_profiles_user")).toBe(true);
    expect(indexNames.has("idx_sessions_expires")).toBe(true);
  });

  it("verifies query plans utilize created indexes instead of full table scans", async () => {
    const planActionLogs = await db.query<{ detail: string }>(
      "EXPLAIN QUERY PLAN SELECT * FROM action_logs WHERE executed_at <= ?",
      ["2026-11-10 00:00:00"],
    );
    expect(
      planActionLogs.some(
        (row) =>
          row.detail.includes("USING INDEX idx_action_logs_executed_at") ||
          row.detail.includes("USING COVERING INDEX idx_action_logs_executed_at"),
      ),
    ).toBe(true);

    const planFlowStates = await db.query<{ detail: string }>(
      "EXPLAIN QUERY PLAN SELECT * FROM flow_states WHERE expires_at <= ?",
      [new Date().toISOString()],
    );
    expect(
      planFlowStates.some((row) => row.detail.includes("USING INDEX idx_flow_states_expires")),
    ).toBe(true);

    const planStaffCooldown = await db.query<{ detail: string }>(
      "EXPLAIN QUERY PLAN SELECT * FROM staff_cooldowns WHERE discord_user_id = ? AND action = ?",
      ["12345", "test"],
    );
    expect(
      planStaffCooldown.some(
        (row) =>
          row.detail.includes("USING INDEX") || row.detail.includes("USING PRIMARY KEY"),
      ),
    ).toBe(true);
  });
});
