import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { env } from "./env.js";
import { migrations } from "./migrations.js";
import { logger } from "../utils/logger.js";

/**
 * Database access layer.
 *
 * The rest of the app never imports `better-sqlite3` directly. Everything goes
 * through the small query surface below, and every method is **async** even
 * though SQLite is synchronous. That deliberate choice means swapping in `pg`
 * later requires rewriting this file, not every repository.
 *
 *   SQLite   ->  parameters are `?` (positional) or `@name` (named)
 *   Postgres ->  parameters are `$1, $2, ...`
 *
 * Repositories therefore use named parameters where practical.
 */

/** Named (`{ userId: 1 }`) or positional (`[1]`) bind parameters. */
export type QueryParams = Record<string, unknown> | readonly unknown[];

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

/** The dialect-neutral surface repositories are written against. */
export interface DatabaseClient {
  /** Run a statement that returns rows. */
  query<T>(sql: string, params?: QueryParams): Promise<T[]>;
  /** Run a statement expected to return at most one row. */
  get<T>(sql: string, params?: QueryParams): Promise<T | undefined>;
  /** Run a write statement. */
  run(sql: string, params?: QueryParams): Promise<RunResult>;
  /** Execute one or more statements with no parameters (DDL, pragmas). */
  exec(sql: string): Promise<void>;
  /** Wrap a synchronous callback in a transaction. */
  transaction<T>(fn: () => T): Promise<T>;
  /** Close the connection (graceful shutdown and the migrate CLI). */
  close(): Promise<void>;
}

let instance: Database.Database | null = null;

const log = logger.child("db");

/** Open (or reuse) the SQLite connection. */
const open = (): Database.Database => {
  if (instance) return instance;

  if (/^postgres/i.test(env.databaseUrl)) {
    throw new Error(
      "DATABASE_URL points at Postgres but no Postgres driver is wired up yet. " +
        "Implement a `pg` adapter in config/database.ts before switching.",
    );
  }

  fs.mkdirSync(path.dirname(env.databaseUrl), { recursive: true });

  const connection = new Database(env.databaseUrl);
  // WAL keeps reads from blocking writes; the rest are sane durability defaults.
  connection.pragma("journal_mode = WAL");
  connection.pragma("foreign_keys = ON");
  connection.pragma("busy_timeout = 5000");
  connection.pragma("synchronous = NORMAL");

  instance = connection;
  log.info(`Connected to SQLite at ${env.databaseUrl}`);
  return connection;
};

/** `better-sqlite3` takes positional args; named params arrive as one object. */
const spread = (params?: QueryParams): unknown[] =>
  params === undefined ? [] : Array.isArray(params) ? [...params] : [params];

export const db: DatabaseClient = {
  async query<T>(sql: string, params?: QueryParams): Promise<T[]> {
    return open().prepare(sql).all(...spread(params)) as T[];
  },

  async get<T>(sql: string, params?: QueryParams): Promise<T | undefined> {
    return open().prepare(sql).get(...spread(params)) as T | undefined;
  },

  async run(sql: string, params?: QueryParams): Promise<RunResult> {
    const result = open().prepare(sql).run(...spread(params));
    return {
      changes: result.changes,
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  },

  async exec(sql: string): Promise<void> {
    open().exec(sql);
  },

  async transaction<T>(fn: () => T): Promise<T> {
    // `better-sqlite3` is synchronous, so the callback must be too — keep
    // transactional work free of `await`.
    return open().transaction(fn)();
  },

  async close(): Promise<void> {
    if (!instance) return;
    instance.close();
    instance = null;
    log.info("Closed SQLite connection");
  },
};

interface MigrationRow {
  id: string;
}

/** Apply any migrations whose id is not yet recorded. Safe to run every boot. */
export const runMigrations = async (): Promise<{ applied: number }> => {
  const connection = open();

  connection.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       id         TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     );`,
  );

  const applied = new Set(
    connection
      .prepare("SELECT id FROM schema_migrations")
      .all()
      .map((row) => (row as MigrationRow).id),
  );

  let appliedCount = 0;
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;

    log.info(`Applying migration ${migration.id}`);
    connection.transaction(() => {
      connection.exec(migration.sql);
      connection.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(migration.id);
    })();
    appliedCount += 1;
  }

  return { applied: appliedCount };
};

interface CountRow {
  count: number;
}

/** Ensure the schema exists and a usable admin row is present. */
export const initializeDatabase = async (): Promise<DatabaseClient> => {
  await runMigrations();

  const admin = await db.get<{ id: number }>(
    "SELECT id FROM users WHERE discord_id = @discordId",
    { discordId: "local-admin" },
  );

  if (!admin) {
    await db.run(
      `INSERT INTO users (discord_id, username, role)
       VALUES (@discordId, @username, @role)`,
      { discordId: "local-admin", username: "Local Admin", role: "admin" },
    );
    log.info("Seeded local admin user (discord_id=local-admin)");
  }

  return db;
};

/** Count helper used by the health endpoint and the migrate CLI. */
export const countUsers = async (): Promise<number> => {
  const row = await db.get<CountRow>("SELECT COUNT(*) AS count FROM users");
  return row?.count ?? 0;
};
