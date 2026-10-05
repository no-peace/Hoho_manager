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
  {
    id: "002_interaction_receipts",
    sql: `
      CREATE TABLE IF NOT EXISTS interaction_receipts (
        interaction_id TEXT PRIMARY KEY,
        response_json  TEXT,
        expires_at     TEXT NOT NULL,
        created_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_interaction_receipts_expires
        ON interaction_receipts(expires_at);
    `,
  },
  {
    id: "003_message_scoped_actions",
    sql: `
      ALTER TABLE action_definitions ADD COLUMN message_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_actions_message_custom
        ON action_definitions(message_id, custom_id);
    `,
  },
  {
    id: "004_staff_access",
    sql: `
      CREATE TABLE IF NOT EXISTS staff_access (
        id                     INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_user_id        TEXT    UNIQUE NOT NULL,
        discord_username       TEXT    NOT NULL DEFAULT '',
        granted_by_discord_id  TEXT    NOT NULL,
        is_active              INTEGER NOT NULL DEFAULT 1,
        expires_at             TEXT,
        cooldown_seconds       INTEGER NOT NULL DEFAULT 30,
        can_send_messages      INTEGER NOT NULL DEFAULT 1,
        can_edit_messages      INTEGER NOT NULL DEFAULT 0,
        can_delete_messages    INTEGER NOT NULL DEFAULT 0,
        can_manage_templates   INTEGER NOT NULL DEFAULT 0,
        allowed_channel_ids    TEXT    NOT NULL DEFAULT '[]',
        can_mention_everyone   INTEGER NOT NULL DEFAULT 0,
        can_mention_here       INTEGER NOT NULL DEFAULT 0,
        can_mention_roles      INTEGER NOT NULL DEFAULT 0,
        allowed_role_mention_ids TEXT  NOT NULL DEFAULT '[]',
        max_messages_per_hour  INTEGER NOT NULL DEFAULT 10,
        notes                  TEXT,
        created_at             TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at             TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS staff_cooldowns (
        discord_user_id  TEXT NOT NULL,
        action           TEXT NOT NULL,
        last_at          TEXT NOT NULL,
        count_this_hour  INTEGER NOT NULL DEFAULT 1,
        hour_bucket      TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (discord_user_id, action)
      );

      CREATE INDEX IF NOT EXISTS idx_staff_access_user   ON staff_access(discord_user_id);
      CREATE INDEX IF NOT EXISTS idx_staff_access_active ON staff_access(is_active);
      CREATE INDEX IF NOT EXISTS idx_staff_cooldowns     ON staff_cooldowns(discord_user_id);
    `,
  },
  {
    id: "005_settings",
    sql: `
      CREATE TABLE IF NOT EXISTS settings (
        guild_id        TEXT PRIMARY KEY,
        log_channel_id  TEXT,
        head_admin_ids  TEXT NOT NULL DEFAULT '[]',
        bot_profile_id  TEXT,
        extra_settings  TEXT NOT NULL DEFAULT '{}',
        created_at      INTEGER,
        updated_at      INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_settings_guild ON settings(guild_id);

      ALTER TABLE staff_access ADD COLUMN granular_cooldowns TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE staff_access ADD COLUMN granular_rate_limits TEXT NOT NULL DEFAULT '{}';
    `,
  },
  {
    id: "006_audit_and_sessions",
    sql: `
      CREATE TABLE IF NOT EXISTS audit_log_entries (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id     TEXT    NOT NULL,
        channel_id   TEXT,
        message_id   TEXT,
        webhook_id   TEXT,
        thread_id    TEXT,
        user_id      TEXT,
        user_name    TEXT,
        user_avatar  TEXT,
        type         TEXT    NOT NULL,
        reason       TEXT,
        details      TEXT,
        created_at   INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audit_log_guild ON audit_log_entries(guild_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_type ON audit_log_entries(type);
      CREATE INDEX IF NOT EXISTS idx_audit_log_channel ON audit_log_entries(channel_id);

      CREATE TABLE IF NOT EXISTS active_sessions (
        id           TEXT PRIMARY KEY,
        guild_id     TEXT NOT NULL,
        user_id      TEXT NOT NULL,
        permissions  TEXT NOT NULL DEFAULT '0',
        channel_id   TEXT,
        created_at   INTEGER NOT NULL,
        expires_at   INTEGER NOT NULL,
        is_active    INTEGER NOT NULL DEFAULT 1
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_guild ON active_sessions(guild_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON active_sessions(user_id);
    `,
  },
];

