import { ButtonStyle, ComponentType, Limits, MessageFlags } from "@dmb/shared";
import type {
  ComponentNode,
  DiscordMessagePayload,
  EmbedData,
  MessageData,
} from "@dmb/shared";
import type { EditorMode } from "./constants";

/**
 * Payload construction and validation.
 *
 * Editors keep two things the Discord API knows nothing about:
 *   - `_id` on every embed/component, so React keys survive reordering
 *   - UI-only fields (e.g. a component's action config)
 *
 * {@link toDiscordPayload} is the single boundary where those are stripped, so
 * "what the user sees" and "what Discord receives" can never drift.
 */

/* ── Colour helpers ───────────────────────────────────────────────────────── */

/** `0x5865f2` -> `#5865f2` */
export const decimalToHex = (decimal: number | null | undefined): string => {
  if (decimal === null || decimal === undefined) return "#000000";
  return `#${Number(decimal).toString(16).padStart(6, "0").slice(-6)}`;
};

/** `#5865f2` -> `5865f2` (as an integer). */
export const hexToDecimal = (hex: string): number =>
  Number.parseInt(String(hex).replace("#", ""), 16) || 0;

/** Parse user-typed hex, returning `null` when it is not a valid colour. */
export const parseHexColor = (hex: string): number | null => {
  const cleaned = String(hex).replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  return Number.parseInt(cleaned, 16);
};

/* ── Sanitising ───────────────────────────────────────────────────────────── */

/** Recursively drop editor-only keys (`_id`, and anything starting with `_`). */
export const stripInternal = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripInternal);
  if (value === null || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith("_")) continue; // `_id`, `_action`, ...
    if (nested === undefined) continue;
    output[key] = stripInternal(nested);
  }
  return output;
};

/* ── Payload building ─────────────────────────────────────────────────────── */

/**
 * Turn the editor's message document into a Discord message payload.
 *
 * @param data the store's `data` object
 */
export const toDiscordPayload = (
  data: MessageData,
  mode: EditorMode,
): DiscordMessagePayload => {
  const payload: DiscordMessagePayload = {};

  if (data.username) payload.username = data.username;
  if (data.avatar_url) payload.avatar_url = data.avatar_url;
  if (data.thread_name) payload.thread_name = data.thread_name;

  if (mode === "v2") {
    // Components V2 carries its own text; classic content/embeds are invalid
    // alongside it, so only `components` and the flag are sent.
    payload.components = stripInternal(data.components ?? []) as ComponentNode[];
    payload.flags = MessageFlags.IsComponentsV2;
  } else {
    if (data.content) payload.content = data.content;
    if (data.embeds.length > 0) {
      payload.embeds = stripInternal(data.embeds) as EmbedData[];
    }
    const classicComponents = data.components.filter(
      (component) => component.type === ComponentType.ActionRow,
    );
    if (classicComponents.length > 0) {
      payload.components = stripInternal(classicComponents) as ComponentNode[];
    }
  }

  return payload;
};

/**
 * A message must carry something. Discord rejects an entirely empty payload,
 * but an attachment-only message is completely valid.
 */
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

/** Total character usage of one embed, for the live counter in the editor. */
export const embedCharCount = (embed: EmbedData): number =>
  (embed.title?.length ?? 0) +
  (embed.description?.length ?? 0) +
  (embed.footer?.text?.length ?? 0) +
  (embed.author?.name?.length ?? 0) +
  (embed.fields ?? []).reduce(
    (sum, field) => sum + (field.name?.length ?? 0) + (field.value?.length ?? 0),
    0,
  );

/**
 * Validate the message document against Discord's documented limits.
 * Returns an array of human-readable problems; empty means valid.
 */
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
          errors.push(`${componentPath}: Action Row allows at most ${Limits.components.actionRowButtons} controls`);
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
        if (children.some((child) =>
          ![
            ComponentType.Button,
            ComponentType.StringSelect,
            ComponentType.UserSelect,
            ComponentType.RoleSelect,
            ComponentType.MentionableSelect,
            ComponentType.ChannelSelect,
          ].includes(child.type as never),
        )) {
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
      if (component.components) validateRows(component.components, `${componentPath}.components`, depth + 1);
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
