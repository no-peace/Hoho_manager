/**
 * Ordered, idempotent migrations.
 *
 * Each entry runs exactly once and is recorded in `schema_migrations`, so adding
 * a migration means appending an object here  never editing an applied one.
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
  {
    id: "007_performance_indexes",
    sql: `
      -- PERF-06: Database Index Optimization

      -- 1. Accelerates ad-hoc action definition lookups and single-column deletions
      CREATE INDEX IF NOT EXISTS idx_action_defs_message_id
        ON action_definitions(message_id);

      -- 2. Accelerates ad-hoc action definition TTL cleanup sweep
      CREATE INDEX IF NOT EXISTS idx_action_defs_adhoc_created
        ON action_definitions(template_id, created_at);

      -- 3. Accelerates flow expiration pruning and token-based state retrieval
      CREATE INDEX IF NOT EXISTS idx_flow_states_expires
        ON flow_states(expires_at);

      CREATE INDEX IF NOT EXISTS idx_flow_states_token_expires
        ON flow_states(token, expires_at);

      -- 4. Accelerates staff cooldown lookups (discord_user_id, action)
      CREATE INDEX IF NOT EXISTS idx_staff_cooldowns_lookup
        ON staff_cooldowns(discord_user_id, action);

      -- 5. Accelerates audit log entries TTL pruning and range scans (created_at INTEGER)
      CREATE INDEX IF NOT EXISTS idx_audit_log_created
        ON audit_log_entries(created_at);

      -- 6. Accelerates audit log queries filtering by user_id
      CREATE INDEX IF NOT EXISTS idx_audit_log_user
        ON audit_log_entries(user_id);

      -- 7. Accelerates action logs TTL pruning and ordered pagination (executed_at TEXT)
      CREATE INDEX IF NOT EXISTS idx_action_logs_executed_at
        ON action_logs(executed_at);

      -- 8. Foreign key index for bot profiles by owner user_id
      CREATE INDEX IF NOT EXISTS idx_bot_profiles_user
        ON bot_profiles(user_id);

      -- 9. Accelerates active sessions expiration cleanup
      CREATE INDEX IF NOT EXISTS idx_sessions_expires
        ON active_sessions(expires_at);
    `,
  },
  {
    id: "008_staff_and_logging_enhancements",
    sql: `
      -- 1. Drop audit_log_entries table to conserve SQLite database storage (logs stream directly to Discord log channel)
      DROP TABLE IF EXISTS audit_log_entries;

      -- 2. Add avatar and global name to staff_access
      ALTER TABLE staff_access ADD COLUMN discord_avatar TEXT;
      ALTER TABLE staff_access ADD COLUMN discord_global_name TEXT;

      -- 3. Add expanded permission controls to staff_access
      ALTER TABLE staff_access ADD COLUMN can_use_webhooks INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE staff_access ADD COLUMN can_override_profile INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE staff_access ADD COLUMN can_attach_files INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE staff_access ADD COLUMN can_use_components_v2 INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE staff_access ADD COLUMN can_use_weao_exploits INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE staff_access ADD COLUMN allowed_guild_ids TEXT NOT NULL DEFAULT '["*"]';
    `,
  },
  {
    id: "009_tracked_messages_and_custom_executors",
    sql: `
      -- 1. Space-optimized tracked messages for auto-updating dynamic placeholders
      CREATE TABLE IF NOT EXISTS tracked_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
        exploit_name TEXT,
        author_user_id TEXT,
        raw_payload TEXT,
        last_payload_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_checked_at INTEGER NOT NULL,
        UNIQUE(channel_id, message_id)
      );

      CREATE INDEX IF NOT EXISTS idx_tracked_messages_chan_msg
        ON tracked_messages(channel_id, message_id);
      CREATE INDEX IF NOT EXISTS idx_tracked_messages_exploit
        ON tracked_messages(exploit_name);
      CREATE INDEX IF NOT EXISTS idx_tracked_messages_author
        ON tracked_messages(author_user_id);

      -- 2. Custom executor configurations allowing user to define/customize executors in /exploit
      CREATE TABLE IF NOT EXISTS custom_executors (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        author_id TEXT,
        template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
        custom_payload TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_custom_executors_enabled
        ON custom_executors(enabled);
    `,
  },
  {
    id: "010_template_retention",
    sql: `
      ALTER TABLE templates ADD COLUMN expires_at TEXT;
      CREATE INDEX IF NOT EXISTS idx_templates_expires_at
        ON templates(expires_at);
    `,
  },
  {
    id: "011_unified_tracking_and_drop_legacy_profiles",
    sql: `
      ALTER TABLE templates ADD COLUMN is_tracked INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE tracked_messages ADD COLUMN name TEXT;
      ALTER TABLE tracked_messages ADD COLUMN expires_at TEXT;
      CREATE INDEX IF NOT EXISTS idx_tracked_messages_expires_at
        ON tracked_messages(expires_at);
      DROP INDEX IF EXISTS idx_webhooks_user;
      DROP INDEX IF EXISTS idx_bot_profiles_user;
      DROP TABLE IF EXISTS webhook_profiles;
      DROP TABLE IF EXISTS bot_profiles;
    `,
  },
  {
    id: "012_auth_session_revocations",
    sql: `
      -- Persistent revocation floors for signed-in web sessions.
      -- The '*' row is reserved for global emergency revocation.
      CREATE TABLE IF NOT EXISTS auth_session_revocations (
        user_id       TEXT PRIMARY KEY,
        revoked_at_ms INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_auth_session_revocations_timestamp
        ON auth_session_revocations(revoked_at_ms);
    `,
  },
  {
    id: "018_tracked_template_access_verification",
    sql: `
      -- Existing tracked records are unverified. Public templates remain usable,
      -- but private templates require a successful access check at track time.
      ALTER TABLE tracked_messages
        ADD COLUMN template_access_verified INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    id: "019_remove_design_customization",
    sql: `
      DROP TABLE IF EXISTS published_app_layouts;
      DROP TABLE IF EXISTS app_layout_publishers;
      DROP TABLE IF EXISTS server_theme_settings;
      DROP TABLE IF EXISTS design_themes;
      DROP TABLE IF EXISTS design_access_users;
    `,
  },
  {
    id: "020_automation_features",
    sql: `
      CREATE TABLE IF NOT EXISTS scheduled_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        thread_id TEXT,
        template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
        target_message_id TEXT,
        payload_json TEXT NOT NULL,
        cron_expr TEXT,
        run_at TEXT,
        timezone TEXT NOT NULL DEFAULT 'UTC',
        enabled INTEGER NOT NULL DEFAULT 1,
        last_run_at TEXT,
        next_run_at TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_scheduled_messages_due
        ON scheduled_messages(enabled, next_run_at);

      CREATE TABLE IF NOT EXISTS expiring_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        delete_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(channel_id, message_id)
      );
      CREATE INDEX IF NOT EXISTS idx_expiring_messages_due
        ON expiring_messages(delete_at);

      CREATE TABLE IF NOT EXISTS sticky_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL UNIQUE,
        current_message_id TEXT,
        payload_json TEXT NOT NULL,
        interval_messages INTEGER NOT NULL DEFAULT 10,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_sticky_messages_active
        ON sticky_messages(enabled, channel_id);
    `,
  },
  {
    id: "021_staff_automation_permission",
    sql: `
      ALTER TABLE staff_access
        ADD COLUMN can_manage_automation INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    id: "022_guild_scoped_action_definitions",
    sql: `
      ALTER TABLE action_definitions ADD COLUMN guild_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_action_defs_guild_custom
        ON action_definitions(guild_id, custom_id);
    `,
  },
  {
    id: "023_scheduled_message_retry_count",
    sql: `
      ALTER TABLE scheduled_messages
        ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
    `,
  },
];
