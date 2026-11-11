import { describe, it, expect, beforeAll, vi } from "vitest";
import { db, initializeDatabase } from "../src/config/database.js";
import {
  BoundedTtlCache,
  searchGuildMembers,
  clearMemberSearchCache,
  getMemberSearchCacheStats,
} from "../src/services/discordService.js";
import {
  runDatabaseMaintenance,
  pruneActionLogs,
} from "../src/services/maintenanceService.js";

describe("Milestone 3 Challenger 2: Retention & Cache Empirical Verification", () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  // ==========================================================================
  // 1. BoundedTtlCache & Member Search Caching (PERF-05)
  // ==========================================================================
  describe("1. BoundedTtlCache & Member Search (PERF-05)", () => {
    it("probes LRU eviction when inserting >500 entries (verifies oldest entries evicted first)", () => {
      // Default capacity is 500, default TTL is 60_000ms
      const cache = new BoundedTtlCache<string>(500, 60_000);

      // Insert 600 entries: item_0 to item_599
      for (let i = 0; i < 600; i++) {
        cache.set(`key_${i}`, `val_${i}`);
      }

      // Bound check: Cache size must never exceed 500
      expect(cache.size()).toBe(500);

      // LRU check: The first 100 entries (key_0 to key_99) must be evicted
      for (let i = 0; i < 100; i++) {
        expect(cache.get(`key_${i}`)).toBeUndefined();
      }

      // The most recent 500 entries (key_100 to key_599) must all be retained
      for (let i = 100; i < 600; i++) {
        expect(cache.get(`key_${i}`)).toBe(`val_${i}`);
      }

      const stats = cache.getStats();
      expect(stats.size).toBe(500);
      expect(stats.maxEntries).toBe(500);
      expect(stats.misses).toBe(100);
      expect(stats.hits).toBe(500);
    });

    it("verifies LRU promotion preserves accessed entries from eviction", () => {
      const cache = new BoundedTtlCache<string>(500, 60_000);

      // Fill cache to capacity (500 items: key_0 to key_499)
      for (let i = 0; i < 500; i++) {
        cache.set(`k_${i}`, `v_${i}`);
      }
      expect(cache.size()).toBe(500);

      // Access key_0, key_5, key_10 -> promotes them to most recently used
      expect(cache.get("k_0")).toBe("v_0");
      expect(cache.get("k_5")).toBe("v_5");
      expect(cache.get("k_10")).toBe("v_10");

      // Insert 20 new items: k_500 to k_519 (forces 20 evictions)
      for (let i = 500; i < 520; i++) {
        cache.set(`k_${i}`, `v_${i}`);
      }
      expect(cache.size()).toBe(500);

      // k_0, k_5, k_10 MUST NOT have been evicted because they were promoted!
      expect(cache.get("k_0")).toBe("v_0");
      expect(cache.get("k_5")).toBe("v_5");
      expect(cache.get("k_10")).toBe("v_10");

      // Whereas unaccessed early keys MUST have been evicted (e.g. k_1, k_2, k_3, k_4, k_6)
      expect(cache.get("k_1")).toBeUndefined();
      expect(cache.get("k_2")).toBeUndefined();
      expect(cache.get("k_3")).toBeUndefined();
      expect(cache.get("k_4")).toBeUndefined();
      expect(cache.get("k_6")).toBeUndefined();
    });

    it("probes TTL expiration at 60 seconds (expired keys evicted on get/prune)", () => {
      vi.useFakeTimers();
      try {
        const cache = new BoundedTtlCache<string>(500, 60_000);
        cache.set("ephemeral_key", "active_payload");

        // Immediately available
        expect(cache.get("ephemeral_key")).toBe("active_payload");

        // At 59,999ms: Still valid
        vi.advanceTimersByTime(59_999);
        expect(cache.get("ephemeral_key")).toBe("active_payload");

        // At 60,001ms: Expired and lazily evicted on get()
        vi.advanceTimersByTime(2);
        expect(cache.get("ephemeral_key")).toBeUndefined();
        expect(cache.size()).toBe(0);

        // Test pruneExpired with mixed TTLs
        // 50 items with 60s TTL, 50 items with 120s TTL
        for (let i = 0; i < 50; i++) {
          cache.set(`ttl60_${i}`, `val_${i}`, 60_000);
          cache.set(`ttl120_${i}`, `val_${i}`, 120_000);
        }
        expect(cache.size()).toBe(100);

        // Advance 60,001ms
        vi.advanceTimersByTime(60_001);
        const prunedBatch1 = cache.pruneExpired();
        expect(prunedBatch1).toBe(50);
        expect(cache.size()).toBe(50);

        // Ensure remaining 50 are the 120s entries
        expect(cache.get("ttl120_0")).toBe("val_0");

        // Advance another 60,000ms (120,001ms total)
        vi.advanceTimersByTime(60_000);
        const prunedBatch2 = cache.pruneExpired();
        expect(prunedBatch2).toBe(50);
        expect(cache.size()).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it("probes in-flight promise coalescing under 50 concurrent requests for the same guild:query", async () => {
      clearMemberSearchCache();
      let outboundFetchCount = 0;
      const originalFetch = globalThis.fetch;

      let failCalls = 0;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        outboundFetchCount++;
        // Synthetic network latency of 30ms to ensure 50 concurrent calls overlap
        await new Promise((r) => setTimeout(r, 30));

        if (typeof url === "string" && url.includes("guild_fail_test")) {
          failCalls++;
          throw new Error("Discord API 500 Internal Server Error");
        }

        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => [
            {
              user: {
                id: "999888777",
                username: "coalesced_user",
                global_name: "Coalesced Hero",
              },
              nick: "Hero",
              roles: ["role_1", "role_2"],
            },
          ],
        } as any;
      });

      try {
        // Fire 50 simultaneous concurrent member searches for the exact same guild:query
        const concurrentSearches = Array.from({ length: 50 }, (_, i) =>
          searchGuildMembers("guild_stress_test", "coalesced_user"),
        );

        const results = await Promise.all(concurrentSearches);

        // All 50 promises must resolve
        expect(results).toHaveLength(50);

        // Outbound REST fetch MUST have executed exactly once
        expect(outboundFetchCount).toBe(1);

        // All 50 callers must receive identical member lists
        const firstResult = results[0];
        expect(firstResult).toHaveLength(1);
        expect(firstResult[0].username).toBe("coalesced_user");

        for (let i = 1; i < 50; i++) {
          expect(results[i]).toEqual(firstResult);
        }

        // Subsequent 51st search hits the cache immediately with 0 additional outbound fetches
        const cachedResult = await searchGuildMembers("guild_stress_test", "coalesced_user");
        expect(cachedResult).toEqual(firstResult);
        expect(outboundFetchCount).toBe(1);

        const stats = getMemberSearchCacheStats();
        expect(stats.hits).toBeGreaterThanOrEqual(1);

        // Check error resilience: 10 concurrent calls to a failing endpoint
        const fetchCountBeforeFail = outboundFetchCount;
        const failingSearches = Array.from({ length: 10 }, () =>
          searchGuildMembers("guild_fail_test", "error_user"),
        );
        const failResults = await Promise.all(failingSearches);

        expect(failResults).toHaveLength(10);
        // Clean degradation to empty array without crashing
        expect(failResults[0]).toEqual([]);
        for (let i = 1; i < 10; i++) {
          expect(failResults[i]).toEqual([]);
        }

        // All 10 shared the single coalesced attempt sequence (1 initial + 3 retries = 4 calls)
        // instead of 10 * 4 = 40 outbound calls
        expect(failCalls).toBe(4);
        expect(outboundFetchCount - fetchCountBeforeFail).toBe(4);

        // Verify inFlightMemberSearches map is cleaned up: subsequent request does not hang or reject
        const retryResult = await searchGuildMembers("guild_stress_test", "coalesced_user");
        expect(retryResult).toEqual(firstResult);
      } finally {
        globalThis.fetch = originalFetch;
        clearMemberSearchCache();
      }
    });
  });

  // ==========================================================================
  // 2. Database Retention & Pruning (PERF-04)
  // ==========================================================================
  describe("2. Database Retention & Pruning (PERF-04)", () => {
    const testTag = `m3_ch2_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    it("seeds stale logs and ad-hoc actions, executes runDatabaseMaintenance(), and verifies template protection", async () => {
      const now = Date.now();
      const stale45d = new Date(now - 45 * 86_400_000).toISOString().replace("T", " ").slice(0, 19);
      const fresh1d = new Date(now - 1 * 86_400_000).toISOString().replace("T", " ").slice(0, 19);

      const staleAuditMs = now - 100 * 86_400_000;
      const freshAuditMs = now - 1 * 86_400_000;

      // Ensure test parent user and template exist
      const userId = 77000 + Math.floor(Math.random() * 1000);
      const templateId = 77000 + Math.floor(Math.random() * 1000);
      await db.run(
        `INSERT OR IGNORE INTO users (id, discord_id, username) VALUES (?, ?, 'retention_tester')`,
        [userId, `discord_${userId}`],
      );
      await db.run(
        `INSERT OR IGNORE INTO templates (id, user_id, name, data) VALUES (?, ?, 'protected_template', '{}')`,
        [templateId, userId],
      );

      // Seed 5 stale action_logs (>30d) and 5 fresh action_logs
      const staleActionIds: string[] = [];
      const freshActionIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const staleId = `int_stale_${testTag}_${i}`;
        const freshId = `int_fresh_${testTag}_${i}`;
        staleActionIds.push(staleId);
        freshActionIds.push(freshId);

        await db.run(
          `INSERT INTO action_logs (interaction_id, user_id, status, executed_at) VALUES (?, 'user_test', 'success', ?)`,
          [staleId, stale45d],
        );
        await db.run(
          `INSERT INTO action_logs (interaction_id, user_id, status, executed_at) VALUES (?, 'user_test', 'success', ?)`,
          [freshId, fresh1d],
        );
      }

      // Note: audit_log_entries dropped in migration 008 in favor of zero-DB Discord channel logging

      // Seed 5 stale ad-hoc action_definitions (template_id IS NULL, >30d)
      // and 5 fresh ad-hoc action_definitions (template_id IS NULL, 1d)
      const staleAdhocCustomIds: string[] = [];
      const freshAdhocCustomIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const staleCustomId = `adhoc_stale_${testTag}_${i}`;
        const freshCustomId = `adhoc_fresh_${testTag}_${i}`;
        staleAdhocCustomIds.push(staleCustomId);
        freshAdhocCustomIds.push(freshCustomId);

        await db.run(
          `INSERT INTO action_definitions (template_id, message_id, custom_id, action_type, config, created_at)
           VALUES (NULL, 'msg_adhoc', ?, 'dud', '{}', ?)`,
          [staleCustomId, stale45d],
        );
        await db.run(
          `INSERT INTO action_definitions (template_id, message_id, custom_id, action_type, config, created_at)
           VALUES (NULL, 'msg_adhoc', ?, 'dud', '{}', ?)`,
          [freshCustomId, fresh1d],
        );
      }

      // CRITICAL: Seed 5 stale template action_definitions (template_id IS NOT NULL, >100d old)
      // and 5 fresh template action_definitions (template_id IS NOT NULL, 1d old)
      const staleTemplateCustomIds: string[] = [];
      const freshTemplateCustomIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const staleCustomId = `tpl_stale_${testTag}_${i}`;
        const freshCustomId = `tpl_fresh_${testTag}_${i}`;
        staleTemplateCustomIds.push(staleCustomId);
        freshTemplateCustomIds.push(freshCustomId);

        await db.run(
          `INSERT INTO action_definitions (template_id, message_id, custom_id, action_type, config, created_at)
           VALUES (?, 'msg_tpl', ?, 'dud', '{}', ?)`,
          [templateId, staleCustomId, stale45d],
        );
        await db.run(
          `INSERT INTO action_definitions (template_id, message_id, custom_id, action_type, config, created_at)
           VALUES (?, 'msg_tpl', ?, 'dud', '{}', ?)`,
          [templateId, freshCustomId, fresh1d],
        );
      }

      // Run runDatabaseMaintenance
      const report = await runDatabaseMaintenance({
        actionLogRetentionDays: 30,
        auditLogRetentionDays: 90,
        adhocActionRetentionDays: 30,
        batchSize: 10,
      });

      expect(report.actionLogsPruned).toBeGreaterThanOrEqual(5);
      expect(report.auditLogsPruned).toBe(0); // Zero-DB logging
      expect(report.orphanedAdHocActionsPruned).toBeGreaterThanOrEqual(5);

      // Verify stale action_logs deleted, fresh action_logs retained
      for (const id of staleActionIds) {
        const found = await db.get("SELECT id FROM action_logs WHERE interaction_id = ?", [id]);
        expect(found).toBeUndefined();
      }
      for (const id of freshActionIds) {
        const found = await db.get("SELECT id FROM action_logs WHERE interaction_id = ?", [id]);
        expect(found).toBeDefined();
      }

      // Verify stale ad-hoc action_definitions deleted, fresh ad-hoc action_definitions retained
      for (const cid of staleAdhocCustomIds) {
        const found = await db.get("SELECT id FROM action_definitions WHERE custom_id = ?", [cid]);
        expect(found).toBeUndefined();
      }
      for (const cid of freshAdhocCustomIds) {
        const found = await db.get("SELECT id FROM action_definitions WHERE custom_id = ?", [cid]);
        expect(found).toBeDefined();
      }

      // CRITICAL ASSERTION: Template action definitions are NEVER deleted,
      // regardless of how old their created_at timestamp is!
      for (const cid of staleTemplateCustomIds) {
        const found = await db.get(
          "SELECT id, template_id FROM action_definitions WHERE custom_id = ?",
          [cid],
        );
        expect(found).toBeDefined();
        expect((found as any).template_id).toBe(templateId);
      }
      for (const cid of freshTemplateCustomIds) {
        const found = await db.get(
          "SELECT id, template_id FROM action_definitions WHERE custom_id = ?",
          [cid],
        );
        expect(found).toBeDefined();
        expect((found as any).template_id).toBe(templateId);
      }
    });

    it("verifies chunked deletion executes across multiple batches without throwing SQLITE_BUSY or locking errors under concurrent operations", async () => {
      const now = Date.now();
      const staleTimestamp = new Date(now - 50 * 86_400_000)
        .toISOString()
        .replace("T", " ")
        .slice(0, 19);

      const chunkTag = `chunk_${Date.now()}`;
      const totalRecords = 1200;
      const batchSize = 250; // Will require ceil(1200 / 250) = 5 batch loops

      // Bulk insert 1200 records in transactions
      await db.transaction(async () => {
        for (let i = 0; i < totalRecords; i++) {
          await db.run(
            `INSERT INTO action_logs (interaction_id, user_id, status, executed_at)
             VALUES (?, 'user_bulk', 'success', ?)`,
            [`int_${chunkTag}_${i}`, staleTimestamp],
          );
        }
      });

      // Verify all 1200 inserted
      const countBefore = await db.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM action_logs WHERE interaction_id LIKE ?`,
        [`int_${chunkTag}_%`],
      );
      expect(countBefore?.count).toBe(totalRecords);

      // Execute chunked pruning while running concurrent read and write operations
      let concurrentOpsCompleted = 0;
      let errorEncountered: Error | null = null;

      const backgroundWorker = (async () => {
        while (concurrentOpsCompleted < 20) {
          try {
            await db.query(`SELECT COUNT(*) as c FROM action_logs WHERE interaction_id LIKE ?`, [
              `int_${chunkTag}_%`,
            ]);
            await db.get(`SELECT id FROM users LIMIT 1`);
            concurrentOpsCompleted++;
            await new Promise((r) => setImmediate(r));
          } catch (e) {
            errorEncountered = e as Error;
            break;
          }
        }
      })();

      const prunedTotal = await pruneActionLogs(30, batchSize);
      await backgroundWorker;

      // No SQLite busy or lock error should have occurred
      expect(errorEncountered).toBeNull();
      expect(prunedTotal).toBeGreaterThanOrEqual(totalRecords);
      expect(concurrentOpsCompleted).toBeGreaterThan(0);

      // Verify all target records have been deleted
      const countAfter = await db.get<{ count: number }>(
        `SELECT COUNT(*) as count FROM action_logs WHERE interaction_id LIKE ?`,
        [`int_${chunkTag}_%`],
      );
      expect(countAfter?.count).toBe(0);
    });
  });

  // ==========================================================================
  // 3. Database Performance Indexes (PERF-06)
  // ==========================================================================
  describe("3. Database Performance Indexes (PERF-06)", () => {
    it("runs EXPLAIN QUERY PLAN on target queries and asserts indexed SEARCH with no full table SCAN", async () => {
      // 1. Target Query: action_definitions WHERE message_id = ?
      const planActionDefs = await db.query<{ detail: string }>(
        "EXPLAIN QUERY PLAN SELECT * FROM action_definitions WHERE message_id = ?",
        ["msg_123456789"],
      );
      expect(planActionDefs.length).toBeGreaterThan(0);
      const actionDefsDetail = planActionDefs.map((p) => p.detail).join(" | ");

      // Must be an indexed SEARCH, not a table SCAN
      expect(
        actionDefsDetail.includes("USING INDEX idx_action_defs_message_id") ||
          actionDefsDetail.includes("USING INDEX idx_actions_message_custom"),
      ).toBe(true);
      expect(actionDefsDetail.includes("SCAN action_definitions")).toBe(false);
      expect(actionDefsDetail.includes("SEARCH action_definitions")).toBe(true);

      // 2. Target Query: flow_states WHERE token = ? AND expires_at > ?
      const planFlowStates = await db.query<{ detail: string }>(
        "EXPLAIN QUERY PLAN SELECT * FROM flow_states WHERE token = ? AND expires_at > ?",
        ["token_xyz", new Date().toISOString()],
      );
      expect(planFlowStates.length).toBeGreaterThan(0);
      const flowStatesDetail = planFlowStates.map((p) => p.detail).join(" | ");

      // Must use index or primary key search, eliminating full table scan
      expect(
        flowStatesDetail.includes("idx_flow_states_token_expires") ||
          flowStatesDetail.includes("sqlite_autoindex_flow_states") ||
          flowStatesDetail.includes("USING PRIMARY KEY"),
      ).toBe(true);
      expect(flowStatesDetail.includes("SCAN flow_states")).toBe(false);
      expect(flowStatesDetail.includes("SEARCH flow_states")).toBe(true);

      // 3. Target Query: staff_cooldowns WHERE discord_user_id = ? AND action = ?
      const planStaffCooldowns = await db.query<{ detail: string }>(
        "EXPLAIN QUERY PLAN SELECT * FROM staff_cooldowns WHERE discord_user_id = ? AND action = ?",
        ["99887766", "send_message"],
      );
      expect(planStaffCooldowns.length).toBeGreaterThan(0);
      const staffCooldownDetail = planStaffCooldowns.map((p) => p.detail).join(" | ");

      // Must use composite primary key or index search
      expect(
        staffCooldownDetail.includes("idx_staff_cooldowns_lookup") ||
          staffCooldownDetail.includes("sqlite_autoindex_staff_cooldowns") ||
          staffCooldownDetail.includes("USING PRIMARY KEY"),
      ).toBe(true);
      expect(staffCooldownDetail.includes("SCAN staff_cooldowns")).toBe(false);
      expect(staffCooldownDetail.includes("SEARCH staff_cooldowns")).toBe(true);
    });

    it("verifies ad-hoc action definition cleanup query uses composite index (template_id, created_at)", async () => {
      const planAdHocCleanup = await db.query<{ detail: string }>(
        "EXPLAIN QUERY PLAN SELECT id FROM action_definitions WHERE template_id IS NULL AND created_at <= ?",
        ["2026-11-10 00:00:00"],
      );
      expect(planAdHocCleanup.length).toBeGreaterThan(0);
      const planDetail = planAdHocCleanup.map((p) => p.detail).join(" | ");

      expect(planDetail.includes("idx_action_defs_adhoc_created")).toBe(true);
      expect(planDetail.includes("SCAN action_definitions")).toBe(false);
      expect(planDetail.includes("SEARCH action_definitions")).toBe(true);
    });

    it("verifies flow states expiration sweep query uses index idx_flow_states_expires", async () => {
      const planFlowSweep = await db.query<{ detail: string }>(
        "EXPLAIN QUERY PLAN SELECT token FROM flow_states WHERE expires_at <= ?",
        [new Date().toISOString()],
      );
      expect(planFlowSweep.length).toBeGreaterThan(0);
      const planDetail = planFlowSweep.map((p) => p.detail).join(" | ");

      expect(planDetail.includes("USING INDEX idx_flow_states_expires")).toBe(true);
      expect(planDetail.includes("SCAN flow_states")).toBe(false);
      expect(planDetail.includes("SEARCH flow_states")).toBe(true);
    });
  });
});
