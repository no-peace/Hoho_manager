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

describe("FlowRepository", () => {
  let memory: ReturnType<typeof createMemoryDb>;
  let repo: FlowRepository;

  beforeEach(() => {
    memory = createMemoryDb();
    repo = new FlowRepository(memory.client);
  });

  afterEach(async () => {
    await memory.client.close();
  });

  it("saves and retrieves active flow states", async () => {
    const saved = await repo.save({
      token: "interaction-token-123",
      templateId: 42,
      step: 1,
      variables: { role: "moderator", reason: "testing" },
      ttlSeconds: 60,
    });

    expect(saved).toBeDefined();
    expect(saved?.token).toBe("interaction-token-123");
    expect(saved?.variables).toEqual({ role: "moderator", reason: "testing" });

    const retrieved = await repo.get("interaction-token-123");
    expect(retrieved).toBeDefined();
    expect(retrieved?.token).toBe("interaction-token-123");
    expect(retrieved?.template_id).toBe(42);
    expect(retrieved?.step).toBe(1);
    expect(retrieved?.variables).toEqual({ role: "moderator", reason: "testing" });
  });

  it("prunes expired flows using ISO 8601 timestamps", async () => {
    // Insert an active flow (expires in 100 seconds)
    await repo.save({
      token: "active-token",
      ttlSeconds: 100,
    });

    // Insert an expired flow (expires in past)
    const pastDate = new Date(Date.now() - 50_000).toISOString();
    await memory.client.run(
      `INSERT INTO flow_states (token, step, variables, expires_at)
       VALUES ('expired-token', 0, '{}', @pastDate)`,
      { pastDate },
    );

    // Pruning should remove the expired flow
    const prunedCount = await repo.pruneExpired();
    expect(prunedCount).toBe(1);

    const active = await repo.get("active-token");
    expect(active).toBeDefined();

    const expired = await repo.get("expired-token");
    expect(expired).toBeUndefined();
  });
});
