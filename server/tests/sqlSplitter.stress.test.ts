import Database from "better-sqlite3";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Replication of the quote-aware splitSqlStatements state machine from server/src/config/database.ts:148-260
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

describe("Milestone 2 Stress Tests: Quote-Aware SQL Statement Splitter", () => {
  it("preserves semicolons inside single-quoted strings", () => {
    const sql = "INSERT INTO logs (data) VALUES ('val1;val2;val3'); SELECT 1;";
    const parts = splitSqlStatements(sql);
    expect(parts.length).toBe(2);
    expect(parts[0]).toBe("INSERT INTO logs (data) VALUES ('val1;val2;val3')");
    expect(parts[1]).toBe("SELECT 1");
  });

  it("preserves semicolons inside escaped single-quoted strings ('')", () => {
    const sql = "INSERT INTO test VALUES ('It''s a semicolon; right here;'); DELETE FROM test;";
    const parts = splitSqlStatements(sql);
    expect(parts.length).toBe(2);
    expect(parts[0]).toBe("INSERT INTO test VALUES ('It''s a semicolon; right here;')");
    expect(parts[1]).toBe("DELETE FROM test");
  });

  it("preserves semicolons inside double-quoted identifiers", () => {
    const sql = `CREATE TABLE "my;table" ("col;1" TEXT, "col;2" INTEGER); SELECT * FROM "my;table";`;
    const parts = splitSqlStatements(sql);
    expect(parts.length).toBe(2);
    expect(parts[0]).toBe(`CREATE TABLE "my;table" ("col;1" TEXT, "col;2" INTEGER)`);
    expect(parts[1]).toBe(`SELECT * FROM "my;table"`);
  });

  it("preserves semicolons inside backtick-quoted identifiers", () => {
    const sql = "SELECT `foo;bar` FROM `table;baz`; DROP TABLE `test;table`;";
    const parts = splitSqlStatements(sql);
    expect(parts.length).toBe(2);
    expect(parts[0]).toBe("SELECT `foo;bar` FROM `table;baz`");
    expect(parts[1]).toBe("DROP TABLE `test;table`");
  });

  it("ignores semicolons inside single-line comments (--)", () => {
    const sql = `
      -- comment line with ; semicolon
      SELECT 1;
      -- another comment;
      SELECT 2;
    `;
    const parts = splitSqlStatements(sql);
    expect(parts.length).toBe(2);
    expect(parts[0]).toContain("SELECT 1");
    expect(parts[1]).toContain("SELECT 2");
  });

  it("ignores semicolons inside multi-line block comments (/* ... */)", () => {
    const sql = `
      /* Block comment with ; multiple ; semicolons ; */
      INSERT INTO t VALUES (1);
      /*
        Multiline ;
        Comment ;
      */
      SELECT * FROM t;
    `;
    const parts = splitSqlStatements(sql);
    expect(parts.length).toBe(2);
    expect(parts[0]).toBe("INSERT INTO t VALUES (1)");
    expect(parts[1]).toBe("SELECT * FROM t");
  });

  it("handles empty statements, trailing semicolons, and excessive whitespace cleanly", () => {
    const sql = "   ;;; SELECT 1;;   SELECT 2;   ;;; ";
    const parts = splitSqlStatements(sql);
    expect(parts.length).toBe(2);
    expect(parts[0]).toBe("SELECT 1");
    expect(parts[1]).toBe("SELECT 2");
  });

  it("returns empty array for empty or comment-only SQL inputs", () => {
    expect(splitSqlStatements("")).toEqual([]);
    expect(splitSqlStatements("   \n\t   ")).toEqual([]);
    expect(splitSqlStatements("-- just a comment with ; semicolon")).toEqual([]);
    expect(splitSqlStatements("/* just a block ; */")).toEqual([]);
  });

  it("handles complex real-world migration script with mixed quotes and comments", () => {
    const migration = `
      -- Migration 007: complex audit log table
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL DEFAULT 'DEFAULT;ACTION',
        details TEXT NOT NULL DEFAULT '{"note": "item;1"}'
      );

      /* Seed initial system rows */
      INSERT INTO audit_logs (id, action, details)
      VALUES ('init-1', 'SETUP;RUN', '{"status": "ok;done"}');

      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
    `;

    const statements = splitSqlStatements(migration);
    expect(statements.length).toBe(3);
    expect(statements[0]).toContain("CREATE TABLE IF NOT EXISTS audit_logs");
    expect(statements[1]).toContain("'SETUP;RUN'");
    expect(statements[1]).toContain("'{\"status\": \"ok;done\"}'");
    expect(statements[2]).toContain("CREATE INDEX IF NOT EXISTS idx_audit_action");
  });
});

describe("Milestone 2 Stress Tests: Database Async Transactions (RB-17)", () => {
  let db: Database.Database;

  const createAsyncTransactionHelper = (sqlite: Database.Database) => {
    return async <T>(fn: () => Promise<T> | T): Promise<T> => {
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
    };
  };

  beforeEach(() => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE test_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  it("successfully commits async operations inside transaction", async () => {
    const transaction = createAsyncTransactionHelper(db);

    await transaction(async () => {
      db.prepare("INSERT INTO test_items (name) VALUES (?)").run("item1");
      await new Promise((resolve) => setTimeout(resolve, 10));
      db.prepare("INSERT INTO test_items (name) VALUES (?)").run("item2");
    });

    const rows = db.prepare("SELECT name FROM test_items").all() as { name: string }[];
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.name)).toEqual(["item1", "item2"]);
  });

  it("rolls back all changes when an async operation throws", async () => {
    const transaction = createAsyncTransactionHelper(db);

    await expect(
      transaction(async () => {
        db.prepare("INSERT INTO test_items (name) VALUES (?)").run("item-fail-1");
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new Error("Simulated async failure during transaction");
      }),
    ).rejects.toThrow("Simulated async failure during transaction");

    const rows = db.prepare("SELECT name FROM test_items").all();
    expect(rows.length).toBe(0);
  });

  it("supports nested transaction calls without crashing", async () => {
    const transaction = createAsyncTransactionHelper(db);

    await transaction(async () => {
      db.prepare("INSERT INTO test_items (name) VALUES (?)").run("outer");
      await transaction(async () => {
        db.prepare("INSERT INTO test_items (name) VALUES (?)").run("inner");
      });
    });

    const rows = db.prepare("SELECT name FROM test_items").all() as { name: string }[];
    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.name)).toEqual(["outer", "inner"]);
  });
});
