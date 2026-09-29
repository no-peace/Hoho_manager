import { ButtonStyle, ComponentType } from "@dmb/shared";
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
    : { custom_id: "action:dud" }),
});

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

export const newActionRow = (children: ComponentNode[] = [newButton()]): ComponentNode => ({
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
    create: () => newTextDisplay("Hello **world**"),
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
    [ComponentType.Thumbnail]: "Thumbnail",
  };
  return component ? (names[component.type] ?? "Component") : "Component";
};

/** Components that hold interactive controls (and therefore carry actions). */
export const isInteractiveComponent = (component: ComponentNode | undefined): boolean =>
  component?.type === ComponentType.Button ||
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
    return childType === ComponentType.Button || childType === ComponentType.StringSelect;
  }
  return false;
};
