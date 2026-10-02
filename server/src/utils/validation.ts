import {
  ACTION_PREFIX,
  ACTION_SEPARATOR,
  ButtonStyle,
  ComponentType,
  Limits,
  MessageFlags,
  SNOWFLAKE_REGEX,
  WEBHOOK_URL_REGEX,
} from "@dmb/shared";
import type { DiscordMessagePayload, FlowRegistration } from "@dmb/shared";
import { ApiError } from "./errors.js";

/**
 * Validation helpers for everything the client sends us.
 *
 * Kept dependency-free on purpose: the rules are small and explicit, and this
 * avoids a schema library that would need mirroring on the frontend anyway.
 *
 * Discord's own rejections are famously unhelpful ("Invalid Form Body"), so we
 * check its documented limits here and return a message that names the field and
 * tells the user what to change.
 */

export const isSnowflake = (value: unknown): value is string =>
  typeof value === "string" && SNOWFLAKE_REGEX.test(value);

export const isHttpUrl = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

export interface ParsedWebhookUrl {
  id: string;
  token: string;
}

/** Extract `{ id, token }` from a valid Discord webhook URL, else `null`. */
export const parseWebhookUrl = (value: unknown): ParsedWebhookUrl | null => {
  const match = typeof value === "string" ? value.match(WEBHOOK_URL_REGEX) : null;
  const [, id, token] = match ?? [];
  return id && token ? { id, token } : null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | null =>
  typeof value === "string" ? value : value == null ? null : null;

/* ── Components V2 ───────────────────────────────────────────────────────── */

/** Component types that may appear at the top level of a V2 payload. */
const TOP_LEVEL_TYPES = new Set<number>([
  ComponentType.ActionRow,
  ComponentType.Section,
  ComponentType.TextDisplay,
  ComponentType.MediaGallery,
  ComponentType.File,
  ComponentType.Separator,
  ComponentType.Container,
]);

/** Component types that may hold children in `components`. */
const PARENT_TYPES = new Set<number>([
  ComponentType.ActionRow,
  ComponentType.Section,
  ComponentType.Container,
]);

/** Component types that may be a Section's `accessory`. */
const ACCESSORY_TYPES = new Set<number>([
  ComponentType.Thumbnail,
  ComponentType.Button,
]);

/** Interactive component types that must live inside an ActionRow. */
const ROW_CHILD_TYPES = new Set<number>([
  ComponentType.Button,
  ComponentType.StringSelect,
  ComponentType.UserSelect,
  ComponentType.RoleSelect,
  ComponentType.MentionableSelect,
  ComponentType.ChannelSelect,
]);

const TYPE_LABELS: Record<number, string> = {
  [ComponentType.ActionRow]: "ActionRow",
  [ComponentType.Button]: "Button",
  [ComponentType.StringSelect]: "StringSelect",
  [ComponentType.TextInput]: "TextInput",
  [ComponentType.UserSelect]: "UserSelect",
  [ComponentType.RoleSelect]: "RoleSelect",
  [ComponentType.MentionableSelect]: "MentionableSelect",
  [ComponentType.ChannelSelect]: "ChannelSelect",
  [ComponentType.Section]: "Section",
  [ComponentType.TextDisplay]: "TextDisplay",
  [ComponentType.Thumbnail]: "Thumbnail",
  [ComponentType.MediaGallery]: "MediaGallery",
  [ComponentType.File]: "File",
  [ComponentType.Separator]: "Separator",
  [ComponentType.Container]: "Container",
};

const describeType = (type: unknown): string =>
  typeof type === "number" ? (TYPE_LABELS[type] ?? `type ${type}`) : "component";

/**
 * Depth-first walk over a component tree.
 *
 * Mirrors the client's `tree.ts` traversal: only `components` arrays are
 * followed; `items`/`options`/`accessory` are leaves (the accessory is visited
 * explicitly by the Section check).
 */
const walkComponents = (
  components: unknown,
  visit: (node: Record<string, unknown>, path: string, depth: number) => boolean | void,
): void => {
  if (!Array.isArray(components)) return;

  const recurse = (list: unknown[], path: string, depth: number): boolean => {
    if (depth > 25) return false; // Hard limit on nesting depth
    for (const [index, entry] of list.entries()) {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) continue;
      const node = entry as Record<string, unknown>;
      const where = `${path}[${index}]`;
      
      const shouldContinue = visit(node, where, depth);
      if (shouldContinue === false) return false;

      if (Array.isArray(node.components)) {
        if (recurse(node.components, `${where}.components`, depth + 1) === false) {
          return false;
        }
      }
    }
    return true;
  };

  recurse(components, "components", 0);
};

/**
 * Validate a Components V2 tree against Discord's documented rules.
 *
 * This is deliberately a sanity net, not a full spec re-implementation: it
 * catches the mistakes that produce Discord's unhelpful "Invalid Form Body" —
 * nesting violations, missing labels, oversized text, bad select ranges — and
 * names the offending field so the user can fix it.
 */
export const validateComponentsV2 = (components: unknown): string[] => {
  const errors: string[] = [];
  if (!Array.isArray(components)) return errors;

  let nodeCount = 0;
  let actionRowCount = 0;
  let sawInteractive = false;

  const fail = (where: string, message: string): void => {
    errors.push(`${where}: ${message}`);
  };

  walkComponents(components, (node, where, depth) => {
    nodeCount += 1;
    if (nodeCount > Limits.components.total) {
      fail(where, `more than ${Limits.components.total} components in one message`);
      return false;
    }

    const type = node.type;
    const label = describeType(type);

    if (type === ComponentType.ActionRow) {
      actionRowCount += 1;
      if (actionRowCount > 5) {
        fail(where, "A message cannot contain more than 5 Action Rows");
      }

      const rowChildren = Array.isArray(node.components) ? node.components : [];
      if (rowChildren.length === 0) {
        fail(where, "ActionRow must contain at least one button or select menu");
      }
      if (rowChildren.length > Limits.components.actionRowButtons) {
        fail(where, `ActionRow cannot contain more than ${Limits.components.actionRowButtons} controls`);
      }

      const selectCount = rowChildren.filter(
        (child) =>
          child !== null &&
          typeof child === "object" &&
          ROW_CHILD_TYPES.has(Number((child as Record<string, unknown>).type)) &&
          Number((child as Record<string, unknown>).type) !== ComponentType.Button,
      ).length;
      if (selectCount > 0 && rowChildren.length !== 1) {
        fail(where, "A select menu must be the only control in its ActionRow");
      }
      for (const child of rowChildren) {
        if (
          child === null ||
          typeof child !== "object" ||
          !ROW_CHILD_TYPES.has(Number((child as Record<string, unknown>).type))
        ) {
          fail(where, "ActionRow children must be buttons or select menus");
          break;
        }
      }
    }

    if (depth === 0 && !TOP_LEVEL_TYPES.has(Number(type))) {
      fail(where, `${label} is not allowed at the top level`);
    }
    if (depth > 0 && !PARENT_TYPES.has(Number(type))) {
      // Only reachable when the parent was itself invalid; the parent error
      // already names the real problem, so don't double-report.
    }

    // Text bounds.
    if (type === ComponentType.TextDisplay) {
      const content = node.content;
      if (typeof content !== "string" || content.trim() === "") {
        fail(where, "TextDisplay requires non-empty `content`");
      } else if (content.length > Limits.components.textDisplay) {
        fail(where, `TextDisplay content exceeds ${Limits.components.textDisplay} characters`);
      }
    }

    // Buttons & selects.
    if (ROW_CHILD_TYPES.has(Number(type))) {
      sawInteractive = true;
      if (type === ComponentType.Button) {
        const style = Number(node.style);
        if (!Object.values(ButtonStyle).includes(style as (typeof ButtonStyle)[keyof typeof ButtonStyle])) {
          fail(where, "Button `style` must be a supported Discord button style");
        }
        const isLink = style === ButtonStyle.Link;
        const isPremium = style === ButtonStyle.Premium;
        if (isPremium) {
          if (!isSnowflake(node.sku_id)) {
            fail(where, "Premium buttons require a valid `sku_id`");
          }
          if (node.custom_id !== undefined || node.url !== undefined) {
            fail(where, "Premium buttons cannot include `custom_id` or `url`");
          }
        } else if (isLink) {
          if (!isHttpUrl(node.url)) {
            fail(where, "Link buttons require a valid `url`");
          }
          if (node.custom_id !== undefined || node.sku_id !== undefined) {
            fail(where, "Link buttons cannot include `custom_id` or `sku_id`");
          }
        } else {
          const customId = node.custom_id;
          if (typeof customId !== "string" || customId.length === 0) {
            fail(where, "Button requires a `custom_id` (or link/premium style)");
          } else if (customId.length > Limits.components.customId) {
            fail(where, `Button custom_id exceeds ${Limits.components.customId} characters`);
          }
          if (node.url !== undefined || node.sku_id !== undefined) {
            fail(where, "Action buttons cannot include `url` or `sku_id`");
          }
        }
        const labelText = typeof node.label === "string" ? node.label : "";
        if (!isPremium && labelText.length > Limits.components.label) {
          fail(where, `Button label exceeds ${Limits.components.label} characters`);
        }
      }

      const placeholder = node.placeholder;
      if (typeof placeholder === "string" && placeholder.length > Limits.components.placeholder) {
        fail(where, `placeholder exceeds ${Limits.components.placeholder} characters`);
      }

      if (type === ComponentType.StringSelect) {
        if (!Array.isArray(node.options) || node.options.length === 0) {
          fail(where, "StringSelect requires at least one option");
        } else if (node.options.length > Limits.components.options) {
          fail(where, `select exceeds ${Limits.components.options} options`);
        }
        for (const [optionIndex, option] of (Array.isArray(node.options) ? node.options : []).entries()) {
          if (option === null || typeof option !== "object") {
            fail(`${where}.options[${optionIndex}]`, "must be an object");
            continue;
          }
          const record = option as Record<string, unknown>;
          const optionLabel = typeof record.label === "string" ? record.label : "";
          if (optionLabel.length === 0 || optionLabel.length > Limits.components.selectOptionLabel) {
            fail(
              `${where}.options[${optionIndex}].label`,
              `required, 1-${Limits.components.selectOptionLabel} characters`,
            );
          }
          const value = typeof record.value === "string" ? record.value : "";
          if (value.length === 0 || value.length > Limits.components.selectOptionLabel) {
            fail(
              `${where}.options[${optionIndex}].value`,
              `required, 1-${Limits.components.selectOptionLabel} characters`,
            );
          }
          const description = record.description;
          if (
            typeof description === "string" &&
            description.length > Limits.components.selectOptionDescription
          ) {
            fail(
              `${where}.options[${optionIndex}].description`,
              `exceeds ${Limits.components.selectOptionDescription} characters`,
            );
          }
        }

        const minValues = node.min_values;
        if (minValues !== undefined && (!Number.isInteger(minValues) || Number(minValues) < 0)) {
          fail(where, "`min_values` must be a non-negative integer");
        }
        const maxValues = node.max_values;
        if (maxValues !== undefined && (!Number.isInteger(maxValues) || Number(maxValues) < 1)) {
          fail(where, "`max_values` must be a positive integer");
        }
        if (
          Number.isInteger(minValues) &&
          Number.isInteger(maxValues) &&
          Number(minValues) > Number(maxValues)
        ) {
          fail(where, "`min_values` cannot exceed `max_values`");
        }
      } else if (type !== ComponentType.Button && node.options !== undefined) {
        fail(where, "Entity select menus cannot include `options`");
      }
    }

    // Section accessory.
    if (type === ComponentType.Section) {
      const accessory = node.accessory;
      if (accessory !== null && typeof accessory === "object" && !Array.isArray(accessory)) {
        const accessoryType = (accessory as Record<string, unknown>).type;
        if (!ACCESSORY_TYPES.has(Number(accessoryType))) {
          fail(
            `${where}.accessory`,
            `${describeType(accessoryType)} cannot be a section accessory (use Thumbnail or Button)`,
          );
        }
      } else {
        fail(where, "Section requires an `accessory`");
      }
    }

    // Separator spacing.
    if (type === ComponentType.Separator) {
      const spacing = node.spacing;
      if (spacing !== undefined && spacing !== 1 && spacing !== 2) {
        fail(where, "Separator `spacing` must be 1 (small) or 2 (large)");
      }
    }
  });

  // Every interactive component must sit inside an ActionRow.
  if (sawInteractive) {
    const checkRows = (list: unknown[], parentIsRow: boolean, path: string, depth: number): void => {
      if (depth > 25) return;
      for (const [index, entry] of list.entries()) {
        if (entry === null || typeof entry !== "object") continue;
        const node = entry as Record<string, unknown>;
        const where = `${path}[${index}]`;
        if (ROW_CHILD_TYPES.has(Number(node.type)) && !parentIsRow) {
          fail(where, `${describeType(node.type)} must be inside an ActionRow`);
        }
        if (Array.isArray(node.components)) {
          checkRows(node.components, node.type === ComponentType.ActionRow, `${where}.components`, depth + 1);
        }
      }
    };
    checkRows(components, false, "components", 0);
  }

  return errors;
};

/**
 * Reject obviously-oversized payloads before they reach Discord.
 *
 * Returns nothing and throws {@link ApiError} with a 400 listing every problem
 * found, so the user can fix them all at once rather than one per attempt.
 */
export const validateMessagePayload = (payload: unknown): DiscordMessagePayload => {
  if (!isRecord(payload)) {
    throw ApiError.badRequest("`payload` must be a message object");
  }

  const errors: string[] = [];

  const content = asString(payload.content);
  if (payload.content != null && content === null) {
    errors.push("`content` must be a string");
  } else if (content !== null && content.length > Limits.content) {
    errors.push(`\`content\` exceeds ${Limits.content} characters (got ${content.length})`);
  }

  const embeds = payload.embeds;
  if (embeds != null && !Array.isArray(embeds)) {
    errors.push("`embeds` must be an array");
  } else if (Array.isArray(embeds)) {
    if (embeds.length > Limits.embed.embedsPerMessage) {
      errors.push(`A message can contain at most ${Limits.embed.embedsPerMessage} embeds`);
    } else {
      embeds.forEach((embed, index) => {
        const where = `embeds[${index}]`;
        if (!isRecord(embed)) {
          errors.push(`${where} must be an object`);
          return;
        }
        const title = asString(embed.title);
        const description = asString(embed.description);
        if (title !== null && title.length > Limits.embed.title) {
          errors.push(`${where}.title exceeds ${Limits.embed.title} characters`);
        }
        if (description !== null && description.length > Limits.embed.description) {
          errors.push(`${where}.description exceeds ${Limits.embed.description} characters`);
        }
        if (Array.isArray(embed.fields) && embed.fields.length > Limits.embed.fields) {
          errors.push(`${where}.fields exceeds ${Limits.embed.fields} entries`);
        }
      });
    }
  }

  const components = payload.components;
  const isComponentsV2 =
    typeof payload.flags === "number" && (payload.flags & MessageFlags.IsComponentsV2) !== 0;

  if (isComponentsV2) {
    if (!Array.isArray(components) || components.length === 0) {
      errors.push("Components V2 flag requires a non-empty `components` array");
    }
    if (typeof payload.content === "string" && payload.content !== "") {
      errors.push("content cannot be used together with Components V2");
    }
    if (Array.isArray(payload.embeds) && payload.embeds.length > 0) {
      errors.push("embeds cannot be used together with Components V2");
    }
  }

  if (components != null && !Array.isArray(components)) {
    errors.push("`components` must be an array");
  } else if (Array.isArray(components) && components.length > 0) {
    errors.push(...validateComponentsV2(components));
  }

  if (errors.length > 0) {
    throw ApiError.badRequest("Message payload failed validation", errors);
  }

  // Validated against the documented limits above; safe to hand on as-is.
  return payload as DiscordMessagePayload;
};

/**
 * Read the optional `flows` array from a send request.
 *
 * Malformed entries are skipped rather than rejected: a flow is a convenience
 * that upgrades a button from one step to many, and refusing to send the whole
 * message because one step was unexpected would be a worse outcome than sending
 * it with just the inline action in the `custom_id`.
 */
export const parseFlowRegistrations = (value: unknown): FlowRegistration[] => {
  if (!Array.isArray(value)) return [];

  const flows: FlowRegistration[] = [];

  for (const entry of value) {
    if (!isRecord(entry)) continue;

    const customId = entry.customId;
    if (
      typeof customId !== "string" ||
      !customId.startsWith(`${ACTION_PREFIX}${ACTION_SEPARATOR}`) ||
      customId.length > Limits.components.customId
    ) {
      continue;
    }

    if (!Array.isArray(entry.steps)) continue;

    const steps = entry.steps
      .filter(isRecord)
      .map((step) => ({
        type: (typeof step.type === "string" ? step.type : "dud") as FlowRegistration["steps"][number]["type"],
        config: isRecord(step.config) ? step.config : {},
      }));

    if (steps.length === 0) continue;
    flows.push({ customId, steps });
  }

  return flows;
};

/** Parse a positive integer id, or throw a 400. */
export const requireId = (value: unknown, label = "id"): number => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw ApiError.badRequest(`\`${label}\` must be a positive integer`);
  }
  return parsed;
};

/** Assert required string fields are present and non-empty. */
export const requireStrings = (body: unknown, fields: readonly string[]): void => {
  const record = isRecord(body) ? body : {};
  const missing = fields.filter((field) => {
    const value = record[field];
    return typeof value !== "string" || value.trim() === "";
  });

  if (missing.length > 0) {
    throw ApiError.badRequest(`Missing required field(s): ${missing.join(", ")}`);
  }
};

/** Read an optional string field from a request body. */
export const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;

/** Read an optional boolean-ish field (accepts `1`, `"true"`, `true`). */
export const optionalFlag = (value: unknown): 1 | 0 | undefined => {
  if (value === undefined || value === null) return undefined;
  if (value === true || value === 1 || value === "1" || value === "true") return 1;
  return 0;
};
