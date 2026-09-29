/**
 * Ordered, idempotent migrations.
 *
 * Each entry runs exactly once and is recorded in `schema_migrations`, so adding
 * a migration means appending an object here — never editing an applied one.
 *
 * The SQL sticks to a conservative SQLite subset (INTEGER/TEXT, explicit
 * indices, foreign keys) so it maps cleanly onto PostgreSQL later.
 * `config/database.ts` is the only place that knows the dialect.
 */

export interface Migration {
  id: string;
  sql: string;
}

export const migrations: readonly Migration[] = [
  {
    id: "001_init",
    sql: `
      -- Users. Single admin today, real accounts in Phase 4.
      CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id    TEXT    UNIQUE NOT NULL,
        username      TEXT    NOT NULL,
        avatar        TEXT,
        role          TEXT    NOT NULL DEFAULT 'admin',   -- 'admin' | 'editor' | 'viewer'
        created_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Saved webhook destinations. The URL contains a token, so it is treated
      -- as a credential and only ever returned to its owner.
      CREATE TABLE IF NOT EXISTS webhook_profiles (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        TEXT    NOT NULL,
        url         TEXT    NOT NULL,
        guild_id    TEXT,
        channel_id  TEXT,
        avatar_url  TEXT,
        is_default  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Bot credentials. The token is encrypted at rest (AES-256-GCM).
      CREATE TABLE IF NOT EXISTS bot_profiles (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name             TEXT    NOT NULL,
        token_encrypted  TEXT    NOT NULL,
        public_key       TEXT    NOT NULL,
        application_id   TEXT    NOT NULL,
        default_guild_id TEXT,
        is_active        INTEGER NOT NULL DEFAULT 1,
        created_at       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Message templates. "data" holds a full Discohook-compatible QueryData blob.
      CREATE TABLE IF NOT EXISTS templates (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name              TEXT    NOT NULL,
        description       TEXT,
        data              TEXT    NOT NULL,
        preview_image_url TEXT,
        is_public         INTEGER NOT NULL DEFAULT 0,
        created_at        TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at        TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Actions bound to a component's custom_id, scoped to a template.
      CREATE TABLE IF NOT EXISTS action_definitions (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id     INTEGER REFERENCES templates(id) ON DELETE CASCADE,
        custom_id       TEXT    NOT NULL,
        action_type     TEXT    NOT NULL,
        config          TEXT    NOT NULL DEFAULT '{}',
        execution_order INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Audit trail for every executed interaction.
      CREATE TABLE IF NOT EXISTS action_logs (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        action_definition_id INTEGER REFERENCES action_definitions(id) ON DELETE SET NULL,
        interaction_id       TEXT    NOT NULL,
        user_id              TEXT    NOT NULL,
        guild_id             TEXT,
        channel_id           TEXT,
        status               TEXT    NOT NULL,
        response             TEXT,
        executed_at          TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Multi-step flow state, keyed by interaction token until it expires.
      CREATE TABLE IF NOT EXISTS flow_states (
        token       TEXT PRIMARY KEY,
        template_id INTEGER REFERENCES templates(id) ON DELETE CASCADE,
        step        INTEGER NOT NULL DEFAULT 0,
        variables   TEXT NOT NULL DEFAULT '{}',
        expires_at  TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_templates_user    ON templates(user_id);
      CREATE INDEX IF NOT EXISTS idx_actions_template  ON action_definitions(template_id);
      CREATE INDEX IF NOT EXISTS idx_actions_custom_id ON action_definitions(custom_id);
      CREATE INDEX IF NOT EXISTS idx_logs_interaction  ON action_logs(interaction_id);
      CREATE INDEX IF NOT EXISTS idx_webhooks_user     ON webhook_profiles(user_id);
    `,
  },
];
