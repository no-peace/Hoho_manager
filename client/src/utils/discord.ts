import { ButtonStyle, ComponentType, Limits, MessageFlags } from "@dmb/shared";
import type {
  ComponentNode,
  DiscordMessagePayload,
  EmbedData,
  MessageData,
} from "@dmb/shared";
import type { EditorMode } from "./constants";

export interface DiscordMessageReference {
  message_id: string;
  channel_id?: string;
  guild_id?: string;
  fail_if_not_exists?: boolean;
}

export interface ExtendedMessageData extends MessageData {
  message_link?: string;
  link_mode?: "edit" | "reply";
  edit_channel_id?: string;
  edit_message_id?: string;
  message_reference?: DiscordMessageReference;
  exploit_name?: string;
}

export interface ParsedDiscordMessageLink {
  guildId: string;
  channelId: string;
  messageId: string;
}

/** Parse `https://discord.com/channels/{guildId}/{channelId}/{messageId}` */
export const parseDiscordMessageLink = (
  input: string,
): ParsedDiscordMessageLink | null => {
  const trimmed = (input || "").trim();
  const match = trimmed.match(
    /discord(?:app)?\.com\/channels\/(\d+|@me)\/(\d+)\/(\d+)/i,
  );
  if (!match) return null;
  return {
    guildId: match[1]!,
    channelId: match[2]!,
    messageId: match[3]!,
  };
};

/* ── Colour helpers ───────────────────────────────────────────────────────── */

export const decimalToHex = (decimal: number | null | undefined): string => {
  if (decimal === null || decimal === undefined) return "#000000";
  return `#${Number(decimal).toString(16).padStart(6, "0").slice(-6)}`;
};

export const hexToDecimal = (hex: string): number =>
  Number.parseInt(String(hex).replace("#", ""), 16) || 0;

export const parseHexColor = (hex: string): number | null => {
  const cleaned = String(hex).replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  return Number.parseInt(cleaned, 16);
};

/* ── Sanitising ───────────────────────────────────────────────────────────── */

export const stripInternal = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripInternal);
  if (value === null || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith("_")) continue;
    if (nested === undefined) continue;
    output[key] = stripInternal(nested);
  }
  return output;
};

/* ── Payload building ─────────────────────────────────────────────────────── */

export const toDiscordPayload = (
  data: MessageData,
  mode: EditorMode,
): DiscordMessagePayload => {
  const extData = data as ExtendedMessageData;
  const payload: DiscordMessagePayload & {
    message_reference?: DiscordMessageReference;
    exploit_name?: string;
  } = {};

  if (extData.thread_name) payload.thread_name = extData.thread_name;
  if (extData.exploit_name) payload.exploit_name = extData.exploit_name;

  if (mode === "v2") {
    payload.components = stripInternal(extData.components ?? []) as ComponentNode[];
    payload.flags = (extData.flags ?? 0) | MessageFlags.IsComponentsV2;
  } else {
    if (extData.content) payload.content = extData.content;
    if (extData.embeds.length > 0) {
      payload.embeds = stripInternal(extData.embeds) as EmbedData[];
    }
    const classicComponents = extData.components.filter(
      (component) => component.type === ComponentType.ActionRow,
    );
    if (classicComponents.length > 0) {
      payload.components = stripInternal(classicComponents) as ComponentNode[];
    }
    if (extData.flags) {
      payload.flags = extData.flags;
    }
  }

  if (extData.link_mode === "reply" && extData.message_reference?.message_id) {
    payload.message_reference = {
      message_id: extData.message_reference.message_id,
      ...(extData.message_reference.channel_id
        ? { channel_id: extData.message_reference.channel_id }
        : {}),
      ...(extData.message_reference.guild_id &&
      extData.message_reference.guild_id !== "@me"
        ? { guild_id: extData.message_reference.guild_id }
        : {}),
      fail_if_not_exists: false,
    };
  }

  if (extData.allowed_mentions) {
    payload.allowed_mentions = extData.allowed_mentions;
  }

  return payload;
};

export const isPayloadEmpty = (
  payload: DiscordMessagePayload,
  hasAttachments: boolean = false,
): boolean =>
  !hasAttachments &&
  !(payload.attachments && payload.attachments.length > 0) &&
  !payload.content &&
  !(payload.embeds && payload.embeds.length > 0) &&
  !(payload.components && payload.components.length > 0);

/* ── Validation ───────────────────────────────────────────────────────────── */

export const embedCharCount = (embed: EmbedData): number =>
  (embed.title?.length ?? 0) +
  (embed.description?.length ?? 0) +
  (embed.footer?.text?.length ?? 0) +
  (embed.author?.name?.length ?? 0) +
  (embed.fields ?? []).reduce(
    (sum, field) => sum + (field.name?.length ?? 0) + (field.value?.length ?? 0),
    0,
  );

export const validateMessage = (data: MessageData, mode: EditorMode): string[] => {
  const errors: string[] = [];

  if (mode === "classic" && data.content.length > Limits.content) {
    errors.push(`Message content is ${data.content.length}/${Limits.content} characters`);
  }

  if (mode === "classic") {
    if (data.embeds.length > Limits.embed.embedsPerMessage) {
      errors.push(`Discord allows at most ${Limits.embed.embedsPerMessage} embeds per message`);
    }

    let totalEmbedChars = 0;
    data.embeds.forEach((embed, index) => {
      const label = `Embed ${index + 1}`;
      const chars = embedCharCount(embed);
      totalEmbedChars += chars;

      if (chars > Limits.embed.total) {
        errors.push(`${label} has ${chars} characters (limit ${Limits.embed.total})`);
      }
      if ((embed.fields?.length ?? 0) > Limits.embed.fields) {
        errors.push(`${label} has too many fields (limit ${Limits.embed.fields})`);
      }
    });

    if (totalEmbedChars > Limits.embed.total) {
      errors.push(`Embeds total ${totalEmbedChars} characters (limit ${Limits.embed.total})`);
    }
  }

  const components =
    mode === "classic"
      ? data.components.filter((component) => component.type === ComponentType.ActionRow)
      : data.components;
  let componentCount = 0;
  let actionRowCount = 0;
  const validateRows = (components: ComponentNode[], path: string, depth: number): void => {
    if (depth > 25) {
      errors.push(`${path}: component nesting exceeds 25 levels`);
      return;
    }

    components.forEach((component, index) => {
      componentCount += 1;
      const componentPath = `${path}[${index}]`;
      if (component.type === ComponentType.ActionRow) {
        actionRowCount += 1;
        if (actionRowCount > 5) {
          errors.push(`${componentPath}: A message cannot contain more than 5 Action Rows`);
        }
        const children = component.components ?? [];
        if (children.length === 0) {
          errors.push(`${componentPath}: Action Row needs at least one button or select menu`);
        }
        if (children.length > Limits.components.actionRowButtons) {
          errors.push(
            `${componentPath}: Action Row allows at most ${Limits.components.actionRowButtons} controls`,
          );
        }
        const hasSelect = children.some((child) => child.type !== ComponentType.Button);
        if (hasSelect && children.length !== 1) {
          errors.push(`${componentPath}: A select menu must be alone in its Action Row`);
        }
        for (const child of children) {
          if (child.type === ComponentType.StringSelect && (child.options?.length ?? 0) === 0) {
            errors.push(`${componentPath}: String Select needs at least one option`);
          }
          if (
            child.type !== ComponentType.Button &&
            Number.isInteger(child.min_values) &&
            Number.isInteger(child.max_values) &&
            (child.min_values ?? 0) > (child.max_values ?? 0)
          ) {
            errors.push(`${componentPath}: Minimum selections cannot exceed maximum selections`);
          }
        }
        if (
          children.some(
            (child) =>
              ![
                ComponentType.Button,
                ComponentType.StringSelect,
                ComponentType.UserSelect,
                ComponentType.RoleSelect,
                ComponentType.MentionableSelect,
                ComponentType.ChannelSelect,
              ].includes(child.type as never),
          )
        ) {
          errors.push(`${componentPath}: Action Row children must be buttons or select menus`);
        }
      }
      if (
        component.type === ComponentType.Button &&
        !Object.values(ButtonStyle).includes(
          Number(component.style ?? ButtonStyle.Primary) as (typeof ButtonStyle)[keyof typeof ButtonStyle],
        )
      ) {
        errors.push(`${componentPath}: Button style must be a supported Discord style`);
      }
      if (component.components) {
        validateRows(component.components, `${componentPath}.components`, depth + 1);
      }
    });
  };
  validateRows(components, "components", 0);

  if (componentCount > Limits.components.total) {
    errors.push(
      `This message has ${componentCount} components (limit ${Limits.components.total})`,
    );
  }

  return errors;
};