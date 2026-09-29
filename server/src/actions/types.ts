import type {
  ActionConfig,
  ActionType,
  ComponentNode,
  DiscordInteraction,
  DiscordMessagePayload,
  EmbedData,
} from "@dmb/shared";
import type { Repositories } from "../repositories/index.js";
import type { DiscordMessage, GuildMember } from "../services/discordService.js";
import type { Logger } from "../utils/logger.js";

/**
 * The contracts every action handler is written against.
 *
 * Handlers receive an explicit {@link ActionContext} rather than importing
 * services themselves. That keeps the dependency direction one-way and means a
 * handler can be unit-tested by hand-rolling a context object.
 */

/** An interaction callback body. Only the first response in a chain is sent. */
export interface ActionResponse {
  type: number;
  data?: Record<string, unknown>;
}

/**
 * The slice of the Discord API that handlers may use.
 *
 * Deliberately narrow: adding a capability here is a conscious decision, and
 * `discordService` satisfies this structurally so no adapter is needed.
 */
export interface DiscordApi {
  addGuildMemberRole(
    guildId: string,
    userId: string,
    roleId: string,
    token: string,
  ): Promise<boolean>;
  removeGuildMemberRole(
    guildId: string,
    userId: string,
    roleId: string,
    token: string,
  ): Promise<boolean>;
  hasRole(
    guildId: string,
    userId: string,
    roleId: string,
    token: string,
  ): Promise<boolean>;
  sendDirectMessage(
    userId: string,
    payload: DiscordMessagePayload,
    token: string,
  ): Promise<DiscordMessage | null>;
  sendChannelMessage(
    channelId: string,
    payload: DiscordMessagePayload,
    options?: { profileId?: number | null },
  ): Promise<DiscordMessage | null>;
  sendWebhook(
    webhookUrl: string,
    payload: DiscordMessagePayload,
    options?: { wait?: boolean; threadId?: string | null },
  ): Promise<DiscordMessage | null>;
  deleteChannelMessage(
    channelId: string,
    messageId: string,
    token: string,
  ): Promise<boolean>;
  createThreadFromMessage(
    channelId: string,
    messageId: string,
    name: string,
    token: string,
  ): Promise<{ id: string } | null>;
}

export interface ActionContext {
  /** The raw interaction payload from Discord. */
  interaction: DiscordInteraction;
  /** Action-specific parameters, either inline or from `action_definitions`. */
  config: ActionConfig;
  /**
   * Mutable variable bag for multi-step flows. Handlers may write to it (see
   * `set_variable`) and later steps read from it.
   */
  variables: Record<string, unknown>;
  /** Null when no bot token is configured — handlers must cope. */
  botToken: string | null;
  discord: DiscordApi;
  /** Only the persistence a handler genuinely needs, so it stays testable. */
  repositories: Pick<Repositories, "webhookProfiles">;
  logger: Logger;
}

export interface ActionHandlerModule {
  type: ActionType;
  description: string;
  /**
   * Run the action.
   *
   * Returning a response ends the chain and sends that response. Returning
   * `undefined` means "continue to the next step".
   */
  run(context: ActionContext): Promise<ActionResponse | undefined>;
}

/** Narrow a config value to a string, or `undefined`. */
export const configString = (config: ActionConfig, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return undefined;
};

/** Narrow a config value to a number, or `undefined`. */
export const configNumber = (config: ActionConfig, key: string): number | undefined => {
  const value = config[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

/**
 * Coerce an untrusted config value into a message payload.
 *
 * Action configs arrive from JSON, so every field is `unknown` until checked.
 * The `embeds`/`components` arrays are cast rather than deep-validated: they were
 * authored by the same editor that produced the message, and Discord rejects
 * anything malformed with a specific error we surface to the user. Returns
 * `null` when there is nothing sendable.
 */
export const toMessagePayload = (value: unknown): DiscordMessagePayload | null => {
  if (value === null || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const payload: DiscordMessagePayload = {};

  if (typeof record.content === "string") payload.content = record.content;
  if (Array.isArray(record.embeds)) payload.embeds = record.embeds as EmbedData[];
  if (Array.isArray(record.components)) {
    payload.components = record.components as ComponentNode[];
  }
  if (typeof record.flags === "number") payload.flags = record.flags;

  return Object.keys(payload).length > 0 ? payload : null;
};

export type { DiscordMessage, GuildMember };
