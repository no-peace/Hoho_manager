import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { env } from "./env.js";
import { migrations } from "./migrations.js";
import { logger } from "../utils/logger.js";

/** Named (`{ userId: 1 }`) or positional (`[1]`) bind parameters. */
export type QueryParams = Record<string, unknown> | readonly unknown[];

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

/** The dialect-neutral surface repositories are written against. */
export interface DatabaseClient {
  query<T>(sql: string, params?: QueryParams): Promise<T[]>;
  get<T>(sql: string, params?: QueryParams): Promise<T | undefined>;
  run(sql: string, params?: QueryParams): Promise<RunResult>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: () => Promise<T> | T): Promise<T>;
  close(): Promise<void>;
}

let instance: Database.Database | null = null;
const log = logger.child("db");

const tursoUrlRaw = (process.env.TURSO_DATABASE_URL ?? "").trim();
const tursoAuthToken = (process.env.TURSO_AUTH_TOKEN ?? "").trim();
const useTurso =
  env.nodeEnv !== "test" &&
  Boolean(tursoUrlRaw) &&
  Boolean(tursoAuthToken) &&
  /^(libsql|https?):\/\//i.test(tursoUrlRaw);

const getTursoPipelineUrl = (): string => {
  const httpsBase = tursoUrlRaw.replace(/^libsql:\/\//i, "https://").replace(/\/+$/, "");
  return `${httpsBase}/v2/pipeline`;
};

type TursoArg =
  | { type: "null" }
  | { type: "integer"; value: string }
  | { type: "float"; value: number }
  | { type: "text"; value: string };

const toTursoArg = (val: unknown): TursoArg => {
  if (val === null || val === undefined) return { type: "null" };
  if (typeof val === "boolean") return { type: "integer", value: val ? "1" : "0" };
  if (typeof val === "bigint") return { type: "integer", value: val.toString() };
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return { type: "null" };
    return Number.isInteger(val)
      ? { type: "integer", value: String(val) }
      : { type: "float", value: val };
  }
  return { type: "text", value: String(val) };
};

const buildTursoStmt = (sql: string, params?: QueryParams): Record<string, unknown> => {
  if (!params) return { sql };
  if (Array.isArray(params)) {
    return { sql, args: params.map(toTursoArg) };
  }
  const named_args = Object.entries(params as Record<string, unknown>)
    .filter(([key]) => new RegExp(`[@:$]\\b${key}\\b`).test(sql))
    .map(([key, value]) => ({
      name: key.replace(/^[@:$]/, ""),
      value: toTursoArg(value),
    }));
  return named_args.length > 0 ? { sql, named_args } : { sql };
};

interface TursoExecuteResult {
  cols: { name: string; decltype?: string | null }[];
  rows: { type: string; value?: string | number }[][];
  affected_row_count: number;
  last_insert_rowid?: string | number | null;
}

const executeTursoStatement = async (
  sql: string,
  params?: QueryParams,
): Promise<TursoExecuteResult> => {
  const res = await fetch(getTursoPipelineUrl(), {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Bearer ${tursoAuthToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        { type: "execute", stmt: buildTursoStmt(sql, params) },
        { type: "close" },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Turso HTTP ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as {
    results?: Array<{
      type: string;
      response?: { result?: TursoExecuteResult };
      error?: { message?: string };
    }>;
  };

  const first = data.results?.[0];
  if (first?.type === "error" || first?.error) {
    throw new Error(`Turso SQL Error: ${first.error?.message ?? "Unknown error"}`);
  }

  return (
    first?.response?.result ?? {
      cols: [],
      rows: [],
      affected_row_count: 0,
      last_insert_rowid: 0,
    }
  );
};

const parseTursoRows = <T>(result: TursoExecuteResult): T[] => {
  const cols = result.cols ?? [];
  return (result.rows ?? []).map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < cols.length; i++) {
      const colName = cols[i]!.name;
      const cell = row[i];
      if (!cell || cell.type === "null") {
        obj[colName] = null;
      } else if (cell.type === "integer" || cell.type === "float") {
        obj[colName] = Number(cell.value);
      } else {
        obj[colName] = cell.value !== undefined ? String(cell.value) : null;
      }
    }
    return obj as T;
  });
};

const splitSqlStatements = (sql: string): string[] => {
  const statements: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i]!;
    const next = sql[i + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        current += "\n";
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i++; // skip '/'
      }
      continue;
    }

    if (inSingleQuote) {
      current += char;
      if (char === "'") {
        if (next === "'") {
          current += next;
          i++; // skip escaped quote ''
        } else {
          inSingleQuote = false;
        }
      }
      continue;
    }

    if (inDoubleQuote) {
      current += char;
      if (char === '"') {
        if (next === '"') {
          current += next;
          i++; // skip escaped quote ""
        } else {
          inDoubleQuote = false;
        }
      }
      continue;
    }

    if (inBacktick) {
      current += char;
      if (char === "`") {
        inBacktick = false;
      }
      continue;
    }

    // Outside strings and comments: detect comment starts or quotes
    if (char === "-" && next === "-") {
      inLineComment = true;
      i++; // skip second '-'
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      i++; // skip '*'
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      current += char;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      current += char;
      continue;
    }

    if (char === "`") {
      inBacktick = true;
      current += char;
      continue;
    }

    if (char === ";") {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = "";
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing.length > 0) {
    statements.push(trailing);
  }

  return statements;
};

/** Open (or reuse) the local SQLite connection when Turso is not configured. */
const open = (): Database.Database => {
  if (instance) return instance;

  if (/^postgres/i.test(env.databaseUrl)) {
    throw new Error(
      "DATABASE_URL points at Postgres but no Postgres driver is wired up yet.",
    );
  }

  fs.mkdirSync(path.dirname(env.databaseUrl), { recursive: true });

  const connection = new Database(env.databaseUrl);
  connection.pragma("journal_mode = WAL");
  connection.pragma("foreign_keys = ON");
  connection.pragma("busy_timeout = 5000");
  connection.pragma("synchronous = NORMAL");

  instance = connection;
  log.info(`Connected to local SQLite at ${env.databaseUrl}`);
  return connection;
};

const spread = (params?: QueryParams): unknown[] =>
  params === undefined ? [] : Array.isArray(params) ? [...params] : [params];

export const db: DatabaseClient = {
  async query<T>(sql: string, params?: QueryParams): Promise<T[]> {
    if (useTurso) {
      const res = await executeTursoStatement(sql, params);
      return parseTursoRows<T>(res);
    }
    return open().prepare(sql).all(...spread(params)) as T[];
  },

  async get<T>(sql: string, params?: QueryParams): Promise<T | undefined> {
    if (useTurso) {
      const res = await executeTursoStatement(sql, params);
      return parseTursoRows<T>(res)[0];
    }
    return open().prepare(sql).get(...spread(params)) as T | undefined;
  },

  async run(sql: string, params?: QueryParams): Promise<RunResult> {
    if (useTurso) {
      const res = await executeTursoStatement(sql, params);
      return {
        changes: Number(res.affected_row_count ?? 0),
        lastInsertRowid: Number(res.last_insert_rowid ?? 0),
      };
    }
    const result = open().prepare(sql).run(...spread(params));
    return {
      changes: result.changes,
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  },

  async exec(sql: string): Promise<void> {
    if (useTurso) {
      const statements = splitSqlStatements(sql);
      for (const stmt of statements) {
        await executeTursoStatement(stmt);
      }
      return;
    }
    open().exec(sql);
  },

  async transaction<T>(fn: () => Promise<T> | T): Promise<T> {
    if (useTurso) {
      return await fn();
    }
    const sqlite = open();
    if (sqlite.inTransaction) {
      return await fn();
    }
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      const result = await fn();
      sqlite.exec("COMMIT");
      return result;
    } catch (err) {
      sqlite.exec("ROLLBACK");
      throw err;
    }
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
  if (useTurso) {
    log.info(`Connecting to Turso Cloud SQLite (${tursoUrlRaw})`);
  }

  await db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       id         TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     );`,
  );

  const rows = await db.query<MigrationRow>("SELECT id FROM schema_migrations");
  const applied = new Set(rows.map((row) => row.id));

  let appliedCount = 0;
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;

    log.info(`Applying migration ${migration.id}`);
    await db.exec(migration.sql);
    await db.run("INSERT INTO schema_migrations (id) VALUES (?)", [migration.id]);
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

  const globalSettings = await db.get<{ guild_id: string }>(
    "SELECT guild_id FROM settings WHERE guild_id = @guildId",
    { guildId: "__global__" },
  );

  if (!globalSettings) {
    const now = Date.now();
    await db.run(
      `INSERT INTO settings (guild_id, log_channel_id, head_admin_ids, bot_profile_id, extra_settings, created_at, updated_at)
       VALUES (@guildId, @logChannelId, @headAdminIds, NULL, '{}', @createdAt, @updatedAt)`,
      {
        guildId: "__global__",
        logChannelId: env.logChannelId ?? null,
        headAdminIds: JSON.stringify(env.ownerDiscordIds ?? []),
        createdAt: now,
        updatedAt: now,
      },
    );
    log.info("Seeded global settings (guild_id=__global__)");
  }

  return db;
};

/** Count helper used by the health endpoint and the migrate CLI. */
export const countUsers = async (): Promise<number> => {
  const row = await db.get<CountRow>("SELECT COUNT(*) AS count FROM users");
  return row?.count ?? 0;
};