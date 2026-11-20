---
name: turso-db
description: Project-specific guidance for Hoho_manager's better-sqlite3 local adapter and custom Turso Cloud HTTP v2 pipeline.
---

# Database — Hoho_manager

This replaces unrelated embedded-Turso guidance. The project does **not** use `@tursodatabase/database` or `@libsql/client`.

## Actual implementation

- `server/src/config/database.ts` exposes `DatabaseClient`: `query`, `get`, `run`, `exec`, `transaction`, and `close`.
- Local development/tests use `better-sqlite3` with WAL, foreign keys, 5-second busy timeout, and NORMAL synchronous mode.
- Production Turso Cloud uses `server/src/config/tursoPipeline.ts`, a custom fetch-based HTTP v2 pipeline client targeting `/v2/pipeline`.
- Both `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are required together. `libsql://` is normalized to HTTPS. Test mode uses local SQLite.
- Feature code must use the shared `db` interface; do not add another driver or direct Turso HTTP calls.

## Query contract

- Use positional `?` or named `@name`, `:name`, `$name` parameters. Never interpolate untrusted values into SQL.
- Keep SQL compatible with SQLite and Turso Cloud.
- Use `query<T>()` for rows, `get<T>()` for one optional row, `run()` for writes, and `exec()` for multi-statement SQL/migrations.
- Write results expose `{ changes, lastInsertRowid }`; do not assume local-driver-only fields remotely.
- `exec()` splits SQL statements before pipeline batching. Do not depend on procedural blocks or delimiter directives the splitter cannot safely parse.

## Transactions

- The HTTP client uses `AsyncLocalStorage` for transaction context and a per-transaction promise queue to serialize baton use.
- A transaction owns one pipeline stream; its baton advances after each request.
- Transactions begin with `BEGIN IMMEDIATE`, commit on success, attempt rollback on failure, and nested calls join the active context.
- Use `db.transaction()`; do not bypass it or assume separate clients share its transaction.
- Keep callbacks short. Do not hold write transactions while waiting on unrelated HTTP or Discord work.
- Preserve the original operation error if rollback also fails.

## Migrations

- Add schema changes to `server/src/config/migrations.ts`. Inspect the current registry before editing.
- Migration IDs must be stable and unique. Migrations are applied under a transaction and recorded in `schema_migrations`.
- Keep migrations safe to run on every boot. Do not manually alter production schema.
- Add indexes only when query patterns justify their write cost.

## Free-plan constraints

- Minimize row reads/writes. Avoid full-table scans, `SELECT *`, N+1 patterns, repeated polling reads, and unnecessary counts.
- Use indexed bounded queries with explicit limits.
- Batch related statements only when safe; avoid oversized pipeline requests.
- Avoid unbounded result sets and caches. Never log auth tokens, headers, or sensitive query parameters.

Before DB changes, inspect `database.ts`, `tursoPipeline.ts`, `migrations.ts`, and the calling service. Source code is authoritative; generic SDK documentation is not.
