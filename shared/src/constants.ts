/**
 * Shared Discord constants.
 *
 * Declared with `as const` so every value keeps its literal type. That means a
 * component built with `ComponentType.Container` is typed as `17`, not `number`,
 * which lets the compiler catch a mismatched component wherever the tree is
 * walked.
 *
 * This package has no runtime dependencies and is imported by both the Vite
 * client and the Express server.
 */

/** Message flag that tells Discord to render a Components V2 payload. */
export const MessageFlags = {
  Crossposted: 1 << 0,
  IsCrosspost: 1 << 1,
  SuppressEmbeds: 1 << 2,
  SourceMessageDeleted: 1 << 3,
  Urgent: 1 << 4,
  HasThread: 1 << 5,
  Ephemeral: 1 << 6,
  Loading: 1 << 7,
  FailedToMentionSomeRolesInThread: 1 << 8,
  SuppressNotifications: 1 << 12,
  IsVoiceMessage: 1 << 13,
  HasSnapshot: 1 << 14,
  IsComponentsV2: 1 << 15,
} as const;

/** Discord component type ids (the subset this app supports). */
export const ComponentType = {
  ActionRow: 1,
  Button: 2,
  StringSelect: 3,
  TextInput: 4,
  UserSelect: 5,
  RoleSelect: 6,
  MentionableSelect: 7,
  ChannelSelect: 8,
  Section: 9,
  TextDisplay: 10,
  Thumbnail: 11,
  MediaGallery: 12,
  File: 13,
  Separator: 14,
  Container: 17,
} as const;

export type ComponentTypeValue = (typeof ComponentType)[keyof typeof ComponentType];

/** Button styles. */
export const ButtonStyle = {
  Primary: 1,
  Secondary: 2,
  Success: 3,
  Danger: 4,
  Link: 5,
  Premium: 6,
} as const;

export type ButtonStyleValue = (typeof ButtonStyle)[keyof typeof ButtonStyle];

/** Interaction types Discord sends to the endpoint. */
export const InteractionType = {
  Ping: 1,
  ApplicationCommand: 2,
  MessageComponent: 3,
  ApplicationCommandAutocomplete: 4,
  ModalSubmit: 5,
} as const;

/** Interaction callback types used when responding to Discord. */
export const InteractionResponseType = {
  Pong: 1,
  ChannelMessageWithSource: 4,
  DeferredChannelMessageWithSource: 5,
  DeferredUpdateMessage: 6,
  UpdateMessage: 7,
  ApplicationCommandAutocompleteResult: 8,
  Modal: 9,
} as const;

/** Destination kinds inside an exported `QueryData` document. */
export const TargetType = {
  Webhook: 1,
} as const;

/**
 * Discord's documented hard limits. The editor validates against these before a
 * payload ever leaves the browser, so users get a real explanation instead of an
 * opaque 400 from Discord.
 */
export const Limits = {
  content: 2000,
  embed: {
    title: 256,
    description: 4096,
    fields: 25,
    fieldName: 256,
    fieldValue: 1024,
    footerText: 2048,
    authorName: 256,
    total: 6000,
    embedsPerMessage: 10,
  },
  components: {
    total: 40,
    label: 80,
    customId: 100,
    placeholder: 150,
    options: 25,
    selectOptionLabel: 100,
    selectOptionDescription: 100,
    textDisplay: 4000,
    actionRowButtons: 5,
  },
} as const;

/**
 * Custom id wire format for the action system:
 * `action:<type>:<json-encoded-params>`, e.g. `action:add_role:{"roleId":"123"}`.
 *
 * The prefix keeps our ids from colliding with anything else the bot handles.
 */
export const ACTION_PREFIX = "action";
export const ACTION_SEPARATOR = ":";

/* ── Flow actions ─────────────────────────────────────────────────────────── */

/**
 * Fields an `adaptive` `set_variable` step can read off the interaction.
 *
 * Shared rather than declared twice so the editor's picker and the server's
 * `readAdaptive` cannot drift apart: adding a field here means adding the switch
 * arm that reads it, and a missing arm is visible in one diff.
 */
export const AdaptiveFields = [
  "user.id",
  "user.name",
  "user.tag",
  "channel.id",
  "guild.id",
  "message.id",
  "selected",
] as const;

/** Comparison functions a `check` step supports, with their editor labels. */
export const CheckFunctions = [
  { value: "equals", label: "Is equal to" },
  { value: "in", label: "Is in" },
  { value: "and", label: "All of" },
  { value: "or", label: "Any of" },
  { value: "not", label: "None of" },
] as const;

/** How a `set_variable` step decides its value, with editor labels. */
export const SetVariableModes = [
  { value: "static", label: "Static value" },
  { value: "adaptive", label: "From the interaction" },
  { value: "get", label: "Copy another variable" },
] as const;

/** Discord REST API base. */
export const DISCORD_API_BASE = "https://discord.com/api/v10";

/** Matches a Discord snowflake id. */
export const SNOWFLAKE_REGEX = /^\d{17,20}$/;

/** Matches a Discord webhook URL and captures `id` and `token`. */
export const WEBHOOK_URL_REGEX =
  /^https?:\/\/(?:\w+\.)?discord(?:app)?\.com\/api\/(?:v\d+\/)?webhooks\/(\d+)\/([\w-]+)$/;
