import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrations } from "./migrations.js";

describe("database migrations", () => {
  it("creates the interaction receipt table and expiry index", () => {
    const database = new Database(":memory:");
    try {
      for (const migration of migrations) database.exec(migration.sql);

      const columns = database.prepare("PRAGMA table_info(interaction_receipts)").all() as {
        name: string;
      }[];
      const indexes = database.prepare("PRAGMA index_list(interaction_receipts)").all() as {
        name: string;
      }[];

      expect(columns.map((column) => column.name)).toEqual([
        "interaction_id",
        "response_json",
        "expires_at",
        "created_at",
      ]);
      expect(indexes.some((index) => index.name === "idx_interaction_receipts_expires")).toBe(true);
    } finally {
      database.close();
    }
  });
});