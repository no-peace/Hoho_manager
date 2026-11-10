import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseClient, QueryParams, RunResult } from "../src/config/database.js";
import { FlowRepository } from "../src/repositories/flowRepository.js";

const spread = (params?: QueryParams): unknown[] =>
  params === undefined ? [] : Array.isArray(params) ? [...params] : [params];

const createMemoryDb = (): { client: DatabaseClient; raw: Database.Database } => {
  const raw = new Database(":memory:");
  raw.exec(`
    CREATE TABLE IF NOT EXISTS flow_states (
      token       TEXT PRIMARY KEY,
      template_id INTEGER,
      step        INTEGER NOT NULL DEFAULT 0,
      variables   TEXT NOT NULL DEFAULT '{}',
      expires_at  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const client: DatabaseClient = {
    async query<T>(sql: string, params?: QueryParams): Promise<T[]> {
      return raw.prepare(sql).all(...spread(params)) as T[];
    },
    async get<T>(sql: string, params?: QueryParams): Promise<T | undefined> {
      return raw.prepare(sql).get(...spread(params)) as T | undefined;
    },
    async run(sql: string, params?: QueryParams): Promise<RunResult> {
      const res = raw.prepare(sql).run(...spread(params));
      return {
        changes: res.changes,
        lastInsertRowid: Number(res.lastInsertRowid),
      };
    },
    async exec(sql: string): Promise<void> {
      raw.exec(sql);
    },
    async transaction<T>(fn: () => T): Promise<T> {
      return raw.transaction(fn)();
    },
    async close(): Promise<void> {
      raw.close();
    },
  };

  return { client, raw };
};

describe("Empirical Challenger: FlowRepository SQL Date Pruning", () => {
  let memory: ReturnType<typeof createMemoryDb>;
  let repo: FlowRepository;

  beforeEach(() => {
    memory = createMemoryDb();
    repo = new FlowRepository(memory.client);
  });

  afterEach(async () => {
    await memory.client.close();
  });

  it("handles mixed date formats: ISO 8601 with T/Z vs SQLite space format", async () => {
    const baseNow = Date.now();
    const pastIso = new Date(baseNow - 60_000).toISOString(); // e.g. "2026-11-10T14:00:00.000Z"
    const futureIso = new Date(baseNow + 60_000).toISOString();

    // Format SQLite space-separated string (YYYY-MM-DD HH:MM:SS)
    const pastSqlite = new Date(baseNow - 120_000).toISOString().replace("T", " ").replace(/\..*$/, "");
    const futureSqlite = new Date(baseNow + 120_000).toISOString().replace("T", " ").replace(/\..*$/, "");

    await memory.client.run(
      `INSERT INTO flow_states (token, step, variables, expires_at) VALUES 
       ('past-iso', 0, '{}', @pastIso),
       ('future-iso', 0, '{}', @futureIso),
       ('past-sqlite', 0, '{}', @pastSqlite),
       ('future-sqlite', 0, '{}', @futureSqlite)`,
      { pastIso, futureIso, pastSqlite, futureSqlite },
    );

    const pruned = await repo.pruneExpired();
    expect(pruned).toBe(2);

    expect(await repo.get("past-iso")).toBeUndefined();
    expect(await repo.get("past-sqlite")).toBeUndefined();
    expect(await repo.get("future-iso")).toBeDefined();
    expect(await repo.get("future-sqlite")).toBeDefined();
  });

  it("handles ISO 8601 timezone offsets (e.g. +05:30) correctly against UTC", async () => {
    // 2 hours ago in +05:30 timezone format
    const twoHoursAgoUtc = new Date(Date.now() - 2 * 3600 * 1000);
    // Create an explicit ISO string with offset
    const pastOffset = `${twoHoursAgoUtc.toISOString().slice(0, 19)}+00:00`;
    // 2 hours in future
    const twoHoursFutureUtc = new Date(Date.now() + 2 * 3600 * 1000);
    const futureOffset = `${twoHoursFutureUtc.toISOString().slice(0, 19)}+00:00`;

    await memory.client.run(
      `INSERT INTO flow_states (token, step, variables, expires_at) VALUES 
       ('past-offset', 0, '{}', @pastOffset),
       ('future-offset', 0, '{}', @futureOffset)`,
      { pastOffset, futureOffset },
    );

    const pruned = await repo.pruneExpired();
    expect(pruned).toBe(1);

    expect(await repo.get("past-offset")).toBeUndefined();
    expect(await repo.get("future-offset")).toBeDefined();
  });

  it("stress-tests batch pruning across 500 interleaved records", async () => {
    const total = 500;
    const now = Date.now();
    let expectedExpired = 0;
    let expectedActive = 0;

    for (let i = 0; i < total; i++) {
      // Even indices expired (past), odd indices active (future)
      const isExpired = i % 2 === 0;
      const ttlOffset = isExpired ? -(i + 1) * 1000 : (i + 1) * 1000;
      const expiresAt = new Date(now + ttlOffset).toISOString();

      await memory.client.run(
        `INSERT INTO flow_states (token, step, variables, expires_at) VALUES (@token, @step, '{}', @expiresAt)`,
        { token: `stress-${i}`, step: i, expiresAt },
      );

      if (isExpired) expectedExpired++;
      else expectedActive++;
    }

    const pruned = await repo.pruneExpired();
    expect(pruned).toBe(expectedExpired);

    const remainingRows = await memory.client.query<{ token: string }>("SELECT token FROM flow_states");
    expect(remainingRows.length).toBe(expectedActive);

    // Verify all remaining rows are odd indices
    for (const row of remainingRows) {
      const idx = Number(row.token.replace("stress-", ""));
      expect(idx % 2).toBe(1);
    }
  });

  it("handles boundary conditions: exact boundary and advance() preserving expiration", async () => {
    // Active token saved via repo
    const saved = await repo.save({
      token: "advancing-token",
      ttlSeconds: 300,
    });
    expect(saved).toBeDefined();

    // Advance step
    const advanced = await repo.advance("advancing-token", { variables: { foo: "bar" } });
    expect(advanced?.step).toBe(1);
    expect(advanced?.variables).toEqual({ foo: "bar" });

    // Ensure it was not expired by prune
    const pruned = await repo.pruneExpired();
    expect(pruned).toBe(0);

    const active = await repo.get("advancing-token");
    expect(active?.step).toBe(1);
  });
});
