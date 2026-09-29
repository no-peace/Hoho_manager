/**
 * Domain types shared by the client and server.
 *
 * These are written by hand rather than pulled from `discord-api-types` for two
 * reasons: the app only touches a small slice of Discord's surface, and the
 * editor's shapes deliberately differ from the wire format (they carry `_id`s
 * and always-present fields). Where a type crosses the boundary that difference
 * is explicit — see {@link MessageData} (editor) vs {@link DiscordMessagePayload}
 * (wire).
 *
 * Adding `discord-api-types` later is a drop-in upgrade for the payload types if
 * you want full cov erage; the editor types would stay as they are.
 */

/* ── Editor / document model ──────────────────────────────────────────────── */

export interface EmbedField {
  /** Editor-only identity; stripped before sending. */
  _id?: string;
  name: string;
  value: string;
  inline?: boolean;
}

export interface EmbedAuthor {
  name?: string;
  url?: string;
  icon_url?: string;
}

export interface EmbedFooter {
  text?: string;
  icon_url?: string;
}

export interface EmbedMedia {
  url: string;
}

export interface EmbedData {
  _id?: string;
  title?: string;
  description?: string;
  url?: string;
  /** 24-bit integer. `null` means "no accent bar". */
  color?: number | null;
  fields?: EmbedField[];
  author?: EmbedAuthor;
  footer?: EmbedFooter;
  image?: EmbedMedia;
  thumbnail?: EmbedMedia;
  timestamp?: string | null;
}

export interface SelectOption {
  _id?: string;
  label: string;
  value: string;
  description?: string;
  default?: boolean;
}

export interface GalleryItem {
  _id?: string;
  media: EmbedMedia;
  description?: string;
  spoiler?: boolean;
}

/**
 * A node in the component tree.
 *
 * Every field after `type` is optional because a node's real shape depends on
 * its `type` (a TextDisplay has `content`, a Container has `components`). A
 * discriminated union would be more precise but would force a narrowing switch
 * at every edit — impractical for a builder that edits nodes generically. The
 * trade-off is deliberate: `type` plus optional fields, validated at the
 * payload boundary.
 */
export interface ComponentNode {
  _id?: string;
  type: number;

  /* Content */
  content?: string;
  media?: EmbedMedia;
  file?: EmbedMedia;
  items?: GalleryItem[];
  accessory?: ComponentNode;

  /* Layout */
  components?: ComponentNode[];
  accent_color?: number | null;
  divider?: boolean;
  spacing?: number;

  /* Interactive */
  style?: number;
  label?: string;
  custom_id?: string;
  url?: string;
  disabled?: boolean;
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  options?: SelectOption[];
}

/** The editor's always-populated message document. */
export interface MessageData {
  content: string;
  embeds: EmbedData[];
  components: ComponentNode[];
  username: string;
  avatar_url: string;
  thread_name: string;
}

/** A destination a document can be sent to. */
export interface TargetData {
  url: string;
}

/* ── Wire format (Discohook-compatible `QueryData`) ───────────────────────── */

export type QueryDataVersion = "d2";

/** A message payload as Discord receives it — all fields optional. */
export interface DiscordMessagePayload {
  content?: string | null;
  embeds?: EmbedData[] | null;
  components?: ComponentNode[];
  username?: string;
  avatar_url?: string;
  thread_name?: string;
  flags?: number;
  allowed_mentions?: { parse?: string[]; roles?: string[]; users?: string[] };
}

export interface QueryDataMessage {
  _id?: string;
  name?: string;
  data: DiscordMessagePayload;
}

export interface QueryDataTarget {
  type?: number;
  url: string;
}

/** Discohook's second data format — what import/export reads and writes. */
export interface QueryData {
  version?: QueryDataVersion;
  backup_id?: string;
  messages: QueryDataMessage[];
  targets?: QueryDataTarget[];
}

/* ── Action system ────────────────────────────────────────────────────────── */

/**
 * Every action the server can execute.
 * Kept as a union so a typo in a `custom_id` or a config file is a compile error.
 */
export type ActionType =
  | "dud"
  | "add_role"
  | "remove_role"
  | "toggle_role"
  | "send_ephemeral_reply"
  | "send_dm"
  | "open_modal"
  | "send_message"
  | "send_webhook_message"
  | "delete_message"
  | "create_thread"
  | "wait"
  | "set_variable"
  | "check"
  | "stop";

/**
 * How a `set_variable` step decides its value. Mirrors Discohook's
 * `FlowActionSetVariableType`.
 *
 * - `static`   — the literal string in `value`.
 * - `adaptive` — the `value` is a **field name of the previous step's result**
 *                (e.g. `channel_id` after a `send_message`).
 * - `get`      — mirrors another variable by name.
 */
export type SetVariableMode = "static" | "adaptive" | "get";

/** Comparison a `check` step can make. Mirrors Discohook's check functions. */
export type CheckFunction = "equals" | "in" | "and" | "or" | "not";

/** One comparison inside a `check` step. Values may be `{{variable}}`. */
export interface CheckCondition {
  a: unknown;
  b: unknown;
  /** `==` instead of `===` — opt-in, because the cast is lossy. */
  loose?: boolean;
}

/** Action-specific parameters. Shape depends on the action type. */
export type ActionConfig = Record<string, unknown>;

/** What the editor stores per component. */
export interface ActionDefinition {
  type: ActionType;
  config: ActionConfig;
}

/**
 * One ordered step of a component's action flow (Discohook-style).
 *
 * A component runs its steps top to bottom; execution stops at the first step
 * that produces a visible response. `_id` is editor-only and stripped before
 * anything is persisted or sent.
 *
 * A `check` step carries its own branches in `config.then` / `config.else`, each
 * of which is another `FlowStep[]`. They live in the config (as JSON) rather than
 * as sibling rows because the persistence layer is a flat ordered list — a tree
 * cannot be expressed by `execution_order` alone.
 */
export interface FlowStep {
  _id?: string;
  type: ActionType;
  config: ActionConfig;
}

/**
 * A flow registered against a `custom_id` for the lifetime of a message.
 *
 * Sent alongside an ad-hoc message so its buttons can run multi-step chains even
 * though there is no saved template to read the steps from.
 */
export interface FlowRegistration {
  customId: string;
  steps: { type: ActionType; config: ActionConfig }[];
}

/** One row of `action_definitions`, as persisted. */
export interface StoredActionDefinition {
  customId: string;
  actionType: ActionType;
  config: ActionConfig;
  executionOrder?: number;
}

/** Metadata the server exposes so the editor's picker stays in sync. */
export interface ActionHandlerMeta {
  type: ActionType;
  description: string;
}

export interface ParsedCustomId {
  type: string;
  params: ActionConfig;
}

/* ── Discord interaction payloads (subset we actually read) ───────────────── */

export interface DiscordUser {
  id: string;
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
}

export interface DiscordInteractionData {
  custom_id?: string;
  component_type?: number;
  values?: string[];
  [key: string]: unknown;
}

export interface DiscordInteraction {
  id: string;
  application_id: string;
  type: number;
  token: string;
  data?: DiscordInteractionData;
  guild_id?: string;
  channel_id?: string;
  member?: { user: DiscordUser; roles?: string[] };
  user?: DiscordUser;
  message?: { id: string };
}

/** An interaction callback body sent back to Discord. */
export interface InteractionResponse {
  type: number;
  data?: Record<string, unknown>;
}

/* ── Persistence records ──────────────────────────────────────────────────── */

export type UserRole = "admin" | "editor" | "viewer";

export interface UserRecord {
  id: number;
  discord_id: string;
  username: string;
  avatar: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface WebhookProfileRecord {
  id: number;
  user_id: number;
  name: string;
  url: string;
  guild_id: string | null;
  channel_id: string | null;
  avatar_url: string | null;
  is_default: number;
  created_at: string;
  updated_at: string;
}

export interface BotProfileRecord {
  id: number;
  user_id: number;
  name: string;
  public_key: string;
  application_id: string;
  default_guild_id: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface TemplateRecord {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  data: QueryData;
  preview_image_url: string | null;
  is_public: number;
  created_at: string;
  updated_at: string;
}

export interface ActionDefinitionRecord {
  id: number;
  template_id: number | null;
  custom_id: string;
  action_type: ActionType;
  config: ActionConfig;
  execution_order: number;
  created_at: string;
}

export interface FlowStateRecord {
  token: string;
  template_id: number | null;
  step: number;
  variables: Record<string, unknown>;
  expires_at: string;
  created_at: string;
}

/* ── Send API ─────────────────────────────────────────────────────────────── */

export type SendMode = "webhook" | "bot";

export interface SendRequestBody {
  mode: SendMode;
  payload: DiscordMessagePayload;
  channelId?: string;
  webhookUrl?: string;
  profileId?: number | null;
  threadId?: string;
  /**
   * Ordered action flows for the components in this message, keyed by
   * `custom_id`. Registering them makes ad-hoc (untemplated) multi-step buttons
   * work, because the chain is too long to fit in the 100-char `custom_id`.
   */
  flows?: FlowRegistration[];
}

export interface SendSuccessResponse {
  ok: true;
  mode: SendMode;
  message: unknown;
}
