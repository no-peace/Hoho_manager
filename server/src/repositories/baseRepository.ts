import { db, type DatabaseClient } from "../config/database.js";

/**
 * Shared plumbing for repositories.
 *
 * Subclasses get the query surface (`this.db`) plus the two helpers every
 * repository needs: turning JSON columns into objects on read, and building a
 * partial `UPDATE` from a whitelist of fields.
 *
 * Parameter style is named (`@name`). Migrating to Postgres means changing
 * `config/database.ts` and the placeholder translation in one place.
 */
export abstract class BaseRepository {
  protected readonly db: DatabaseClient;

  constructor(database: DatabaseClient = db) {
    this.db = database;
  }
}

/**
 * Parse the given JSON columns on a row.
 *
 * The column genuinely changes type (`string` -> `object`), so this is the one
 * place where a cast is unavoidable — callers pass the domain type they expect.
 */
export const parseJson = <T>(row: T | undefined, columns: readonly string[]): T | undefined => {
  if (!row) return undefined;

  const result = { ...(row as Record<string, unknown>) };
  for (const column of columns) {
    const value = result[column];
    if (typeof value === "string") {
      try {
        result[column] = JSON.parse(value) as unknown;
      } catch {
        result[column] = null;
      }
    }
  }
  return result as T;
};

/** Map a list of rows through {@link parseJson}. */
export const parseJsonList = <T>(rows: T[], columns: readonly string[]): T[] =>
  rows.map((row) => parseJson(row, columns) as T);

/**
 * Build `SET a = @a, b = @b` for the keys present in `data`, restricted to
 * `allowed`. Prevents mass-assignment from request bodies.
 */
export const buildUpdate = (
  data: Record<string, unknown>,
  allowed: readonly string[],
): string | null => {
  const keys = allowed.filter((key) => data[key] !== undefined);
  if (keys.length === 0) return null;
  return keys.map((key) => `${key} = @${key}`).join(", ");
};
