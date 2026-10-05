import { ButtonStyle, ComponentType, Limits } from "@dmb/shared";
import type {
  ComponentNode,
  ComponentTypeValue,
  GalleryItem,
  SelectOption,
} from "@dmb/shared";
import { DEFAULT_EMBED_COLOR, uid } from "./constants";

/**
 * Components V2 model.
 *
 * Every component carries an `_id` so the editor can key React lists and target
 * updates by identity instead of array position — reordering then costs nothing
 * and never desynchronises the preview. `stripInternal()` removes these before
 * the payload is sent.
 *
 * Factories return objects shaped exactly like Discord's API types, so the live
 * preview and the final payload render from the same data.
 *
 * Note: these use extensionless imports rather than `.js`, because the client is
 * bundled by Vite (`moduleResolution: bundler`). The server uses `.js` because it
 * is compiled to native ESM.
 */

/* ── Factories ────────────────────────────────────────────────────────────── */

export const newTextDisplay = (content = ""): ComponentNode => ({
  _id: uid(),
  type: ComponentType.TextDisplay,
  content,
});

export const newSeparator = ({
  divider = true,
  spacing = 1,
}: { divider?: boolean; spacing?: number } = {}): ComponentNode => ({
  _id: uid(),
  type: ComponentType.Separator,
  divider,
  spacing,
});

export const newContainer = (children: ComponentNode[] = []): ComponentNode => ({
  _id: uid(),
  type: ComponentType.Container,
  accent_color: DEFAULT_EMBED_COLOR,
  components: children,
});

export const newThumbnail = (url = ""): ComponentNode => ({
  _id: uid(),
  type: ComponentType.Thumbnail,
  media: { url },
});

export const newSection = (children: ComponentNode[] = []): ComponentNode => ({
  _id: uid(),
  type: ComponentType.Section,
  components: children.length > 0 ? children : [newTextDisplay("Section text")],
  accessory: newThumbnail(),
});

export const newGalleryItem = (url = ""): GalleryItem => ({ _id: uid(), media: { url } });

export const newMediaGallery = (items: GalleryItem[] = []): ComponentNode => ({
  _id: uid(),
  type: ComponentType.MediaGallery,
  items,
});

export const newFile = (url = ""): ComponentNode => ({
  _id: uid(),
  type: ComponentType.File,
  file: { url },
});

export const newButton = (style: number = ButtonStyle.Primary): ComponentNode => ({
  _id: uid(),
  type: ComponentType.Button,
  style,
  label: style === ButtonStyle.Link ? "Link" : "Button",
  ...(style === ButtonStyle.Link
    ? { url: "https://discord.com" }
    : style === ButtonStyle.Premium
      ? { sku_id: "" }
      : { custom_id: "action:dud" }),
});

export const buttonStylePatch = (component: ComponentNode, style: number): Partial<ComponentNode> => {
  const actionId = component._action_custom_id ?? component.custom_id;
  if (style === ButtonStyle.Link) {
    return {
      style,
      url: component.url || "https://discord.com",
      custom_id: undefined,
      _action_custom_id: actionId,
      sku_id: undefined,
    };
  }
  if (style === ButtonStyle.Premium) {
    return {
      style,
      sku_id: component.sku_id ?? "",
      custom_id: undefined,
      _action_custom_id: actionId,
      url: undefined,
    };
  }
  return {
    style,
    custom_id: actionId ?? "action:dud",
    _action_custom_id: undefined,
    url: undefined,
    sku_id: undefined,
  };
};

export const newSelectOption = (index: number): SelectOption => ({
  _id: uid(),
  label: `Option ${index}`,
  value: `option_${index}`,
});

export const newStringSelect = (): ComponentNode => ({
  _id: uid(),
  type: ComponentType.StringSelect,
  custom_id: "action:dud",
  placeholder: "Select an option",
  options: [newSelectOption(1)],
});

export const newUserSelect = (): ComponentNode => ({
  _id: uid(),
  type: ComponentType.UserSelect,
  custom_id: "action:dud",
  placeholder: "Select a user",
  min_values: 1,
  max_values: 1,
});

export const newRoleSelect = (): ComponentNode => ({
  _id: uid(),
  type: ComponentType.RoleSelect,
  custom_id: "action:dud",
  placeholder: "Select a role",
  min_values: 1,
  max_values: 1,
});

export const newMentionableSelect = (): ComponentNode => ({
  _id: uid(),
  type: ComponentType.MentionableSelect,
  custom_id: "action:dud",
  placeholder: "Select a user or role",
  min_values: 1,
  max_values: 1,
});

export const newChannelSelect = (): ComponentNode => ({
  _id: uid(),
  type: ComponentType.ChannelSelect,
  custom_id: "action:dud",
  placeholder: "Select a channel",
  min_values: 1,
  max_values: 1,
});

export const newActionRow = (children: ComponentNode[] = []): ComponentNode => ({
  _id: uid(),
  type: ComponentType.ActionRow,
  components: children,
});

/* ── Metadata driving the palette UI ──────────────────────────────────────── */

export type ComponentGroup = "Content" | "Layout" | "Interactive";

export interface ComponentDef {
  type: ComponentTypeValue;
  label: string;
  description: string;
  group: ComponentGroup;
  /** May sit directly in a message (rather than inside a container). */
  topLevel: boolean;
  create: () => ComponentNode;
}

export const COMPONENT_DEFS: readonly ComponentDef[] = [
  {
    type: ComponentType.TextDisplay,
    label: "Text Display",
    description: "Markdown text — headings, lists, code blocks.",
    group: "Content",
    topLevel: true,
    create: () => newTextDisplay(""),
  },
  {
    type: ComponentType.Section,
    label: "Section",
    description: "Text with a thumbnail accessory.",
    group: "Content",
    topLevel: true,
    create: () => newSection(),
  },
  {
    type: ComponentType.MediaGallery,
    label: "Media Gallery",
    description: "One or more images or videos.",
    group: "Content",
    topLevel: true,
    create: () => newMediaGallery(),
  },
  {
    type: ComponentType.File,
    label: "File",
    description: "A single attachment reference.",
    group: "Content",
    topLevel: true,
    create: () => newFile(),
  },
  {
    type: ComponentType.Separator,
    label: "Separator",
    description: "Spacing or a divider line between components.",
    group: "Layout",
    topLevel: true,
    create: () => newSeparator(),
  },
  {
    type: ComponentType.Container,
    label: "Container",
    description: "A grouped card with an optional accent colour.",
    group: "Layout",
    topLevel: true,
    create: () => newContainer([newTextDisplay("Container text")]),
  },
  {
    type: ComponentType.ActionRow,
    label: "Action Row",
    description: "Holds buttons or a select menu.",
    group: "Interactive",
    topLevel: true,
    create: () => newActionRow(),
  },
  {
    type: ComponentType.Button,
    label: "Button",
    description: "An interactive or link button inside an action row.",
    group: "Interactive",
    topLevel: false,
    create: () => newButton(),
  },
  {
    type: ComponentType.StringSelect,
    label: "String Select",
    description: "A menu with options you define.",
    group: "Interactive",
    topLevel: false,
    create: () => newStringSelect(),
  },
  {
    type: ComponentType.UserSelect,
    label: "User Select",
    description: "Let a member choose users from the server.",
    group: "Interactive",
    topLevel: false,
    create: () => newUserSelect(),
  },
  {
    type: ComponentType.RoleSelect,
    label: "Role Select",
    description: "Let a member choose roles from the server.",
    group: "Interactive",
    topLevel: false,
    create: () => newRoleSelect(),
  },
  {
    type: ComponentType.MentionableSelect,
    label: "Mentionable Select",
    description: "Let a member choose users or roles.",
    group: "Interactive",
    topLevel: false,
    create: () => newMentionableSelect(),
  },
  {
    type: ComponentType.ChannelSelect,
    label: "Channel Select",
    description: "Let a member choose channels from the server.",
    group: "Interactive",
    topLevel: false,
    create: () => newChannelSelect(),
  },
];

/** Types that may be nested inside a Container. */
export const CONTAINER_CHILD_TYPES: readonly number[] = [
  ComponentType.ActionRow,
  ComponentType.TextDisplay,
  ComponentType.Section,
  ComponentType.MediaGallery,
  ComponentType.Separator,
  ComponentType.File,
];

/** Types that may be nested inside a Section. */
export const SECTION_CHILD_TYPES: readonly number[] = [ComponentType.TextDisplay];

export const ACTION_ROW_CHILD_TYPES: readonly number[] = [
  ComponentType.Button,
  ComponentType.StringSelect,
  ComponentType.UserSelect,
  ComponentType.RoleSelect,
  ComponentType.MentionableSelect,
  ComponentType.ChannelSelect,
];

const DEF_BY_TYPE = new Map<number, ComponentDef>(
  COMPONENT_DEFS.map((def) => [def.type, def]),
);

/** Instantiate a component from its palette definition. */
export const createComponent = (type: number): ComponentNode => {
  const def = DEF_BY_TYPE.get(type);
  if (!def) throw new Error(`Unknown component type: ${type}`);
  return def.create();
};

export const getComponentDef = (type: number): ComponentDef | null =>
  DEF_BY_TYPE.get(type) ?? null;

/** Short label for the layer tree / property panel header. */
export const componentLabel = (component: ComponentNode | undefined): string => {
  const def = component ? getComponentDef(component.type) : null;
  if (def) return def.label;

  const names: Record<number, string> = {
    [ComponentType.Button]: "Button",
    [ComponentType.StringSelect]: "String Select",
    [ComponentType.UserSelect]: "User Select",
    [ComponentType.RoleSelect]: "Role Select",
    [ComponentType.MentionableSelect]: "Mentionable Select",
    [ComponentType.ChannelSelect]: "Channel Select",
    [ComponentType.Thumbnail]: "Thumbnail",
  };
  return component ? (names[component.type] ?? "Component") : "Component";
};

/** Components that hold interactive controls (and therefore carry actions). */
export const isInteractiveComponent = (component: ComponentNode | undefined): boolean =>
  (component?.type === ComponentType.Button &&
    component.style !== ButtonStyle.Link &&
    component.style !== ButtonStyle.Premium) ||
  component?.type === ComponentType.StringSelect ||
  component?.type === ComponentType.UserSelect ||
  component?.type === ComponentType.RoleSelect ||
  component?.type === ComponentType.MentionableSelect ||
  component?.type === ComponentType.ChannelSelect;

/** Can `childType` be nested inside `parentType`? Used to filter the palette. */
export const canNestIn = (parentType: number, childType: number): boolean => {
  if (parentType === ComponentType.Container) return CONTAINER_CHILD_TYPES.includes(childType);
  if (parentType === ComponentType.Section) return SECTION_CHILD_TYPES.includes(childType);
  if (parentType === ComponentType.ActionRow) {
    return ACTION_ROW_CHILD_TYPES.includes(childType);
  }
  return false;
};

export const canAddToActionRow = (
  children: readonly ComponentNode[],
  childType: number,
): boolean => {
  if (!canNestIn(ComponentType.ActionRow, childType)) return false;
  if (children.length >= Limits.components.actionRowButtons) return false;
  if (childType === ComponentType.Button) {
    return children.every((child) => child.type === ComponentType.Button);
  }
  return children.length === 0;
};
