export type AppLayoutMode = "desktop" | "mobile";

export interface AppLayoutNode {
  type: string;
  props: Record<string, any>;
}

export interface AppLayoutDocument {
  root: { props: Record<string, any> };
  content: AppLayoutNode[];
}

export interface AppLayoutDocuments {
  desktop: AppLayoutDocument;
  mobile: AppLayoutDocument;
  updatedAt?: string;
}

const DRAFT_PREFIX = "hoho:app-layout-draft:v1:";

export type AppLayoutMotionPreset =
  | "none" | "fade" | "fade-up" | "slide-left" | "slide-right" | "zoom-in" | "float" | "pulse";
export type AppLayoutMotionDuration = "180ms" | "300ms" | "500ms" | "700ms" | "1200ms" | "2000ms" | "3000ms";
export type AppLayoutMotionDelay = "0ms" | "100ms" | "200ms" | "350ms";

export interface ResolvedAppLayoutMotion {
  animation: AppLayoutMotionPreset;
  duration: AppLayoutMotionDuration;
  delay: AppLayoutMotionDelay;
}

export interface ResolvedAppLayout {
  desktop: {
    headerHeight: number; headerPadding: number; logoSize: number; headerBackground: string; headerBorder: string;
    headerMotion: ResolvedAppLayoutMotion;
    editorRatio: number; inspectorWidth: number; workspaceGap: number; panelOrder: "editor-first" | "preview-first";
    inspectorPosition: "left" | "right"; borderColor: string; workspaceMotion: ResolvedAppLayoutMotion;
    editorBackground: string; previewBackground: string; inspectorBackground: string;
    editorPadding: number; previewPadding: number; inspectorPadding: number;
    editorRadius: number; previewRadius: number; inspectorRadius: number;
    editorLabel: string; previewLabel: string; inspectorLabel: string; showToolbar: boolean;
    editorMotion: ResolvedAppLayoutMotion; previewMotion: ResolvedAppLayoutMotion; inspectorMotion: ResolvedAppLayoutMotion;
  };
  mobile: {
    headerHeight: number; headerPadding: number; logoSize: number; headerBackground: string; headerBorder: string;
    headerMotion: ResolvedAppLayoutMotion;
    defaultPane: "editor" | "preview"; showInspector: boolean; inspectorHeight: number; workspaceGap: number; panelPadding: number; borderColor: string;
    workspaceMotion: ResolvedAppLayoutMotion;
    editorBackground: string; previewBackground: string; inspectorBackground: string;
    editorPadding: number; previewPadding: number; inspectorPadding: number;
    editorRadius: number; previewRadius: number; inspectorRadius: number;
    editorLabel: string; previewLabel: string; inspectorLabel: string; showToolbar: boolean;
    editorMotion: ResolvedAppLayoutMotion; previewMotion: ResolvedAppLayoutMotion; inspectorMotion: ResolvedAppLayoutMotion;
    navHeight: number; navPadding: number; navBackground: string; navAccent: string;
    tabOrder: "editor-first" | "preview-first"; showLabels: boolean;
    activeTab: "editor" | "preview" | "dispatch";
    editorTabLabel: string; previewTabLabel: string; dispatchTabLabel: string;
    navMotion: ResolvedAppLayoutMotion;
  };
}


const findNode = (nodes: AppLayoutNode[], type: string): AppLayoutNode | undefined => {
  for (const node of nodes) {
    if (node.type === type) return node;
    const nested = Array.isArray(node.props?.content) ? findNode(node.props.content, type) : undefined;
    if (nested) return nested;
  }
  return undefined;
};

const boundedNumber = (value: unknown, fallback: number, min: number, max: number): number => {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};

const safeHex = (value: unknown, fallback: string): string =>
  typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;

const safeChoice = <T extends string>(value: unknown, choices: readonly T[], fallback: T): T =>
  choices.includes(value as T) ? value as T : fallback;

const propsOf = (nodes: AppLayoutNode[], type: string): Record<string, any> =>
  findNode(nodes, type)?.props || {};

const resolveMotion = (props: Record<string, any>): ResolvedAppLayoutMotion => ({
  animation: props.animation as AppLayoutMotionPreset,
  duration: props.animationDuration as AppLayoutMotionDuration,
  delay: props.animationDelay as AppLayoutMotionDelay,
});

export const resolveAppLayoutData = (
  desktopValue: unknown,
  mobileValue: unknown,
): ResolvedAppLayout => {
  const desktop = validateDocument(desktopValue, "desktop");
  const mobile = validateDocument(mobileValue, "mobile");
  const desktopHeader = propsOf(desktop.content, "DesktopHeader");
  const desktopWorkspace = propsOf(desktop.content, "DesktopWorkspace");
  const mobileHeader = propsOf(mobile.content, "MobileHeader");
  const mobileWorkspace = propsOf(mobile.content, "MobileWorkspace");
  const mobileNav = propsOf(mobile.content, "MobileBottomNavigation");
  const desktopEditor = propsOf(desktop.content, "EditorPanel");
  const desktopPreview = propsOf(desktop.content, "PreviewPanel");
  const desktopInspector = propsOf(desktop.content, "InspectorPanel");
  const mobileEditor = propsOf(mobile.content, "EditorPanel");
  const mobilePreview = propsOf(mobile.content, "PreviewPanel");
  const mobileInspector = propsOf(mobile.content, "InspectorPanel");

  return {
    desktop: {
      headerHeight: boundedNumber(desktopHeader.height, 56, 44, 80),
      headerPadding: boundedNumber(desktopHeader.horizontalPadding, 16, 8, 36),
      logoSize: boundedNumber(desktopHeader.logoSize, 32, 20, 48),
      headerBackground: safeHex(desktopHeader.background, "#10131A"),
      headerBorder: safeHex(desktopHeader.borderColor, "#272D3A"),
      headerMotion: resolveMotion(desktopHeader),
      editorRatio: boundedNumber(desktopWorkspace.editorRatio, 50, 28, 72) / 100,
      inspectorWidth: boundedNumber(desktopWorkspace.inspectorWidth, 440, 300, 520),
      workspaceGap: boundedNumber(desktopWorkspace.workspaceGap, 6, 0, 24),
      panelOrder: safeChoice(desktopWorkspace.panelOrder, ["editor-first", "preview-first"] as const, "editor-first"),
      inspectorPosition: safeChoice(desktopWorkspace.inspectorPosition, ["left", "right"] as const, "right"),
      borderColor: safeHex(desktopWorkspace.borderColor, "#272D3A"),
      workspaceMotion: resolveMotion(desktopWorkspace),
      editorBackground: safeHex(desktopEditor.surface, "#2B2D31"),
      previewBackground: safeHex(desktopPreview.surface, "#313338"),
      inspectorBackground: safeHex(desktopInspector.surface, "#161A23"),
      editorPadding: boundedNumber(desktopEditor.padding, 16, 0, 32),
      previewPadding: boundedNumber(desktopPreview.padding, 16, 0, 32),
      inspectorPadding: boundedNumber(desktopInspector.padding, 14, 0, 32),
      editorRadius: boundedNumber(desktopEditor.radius, 10, 0, 24),
      previewRadius: boundedNumber(desktopPreview.radius, 10, 0, 24),
      inspectorRadius: boundedNumber(desktopInspector.radius, 10, 0, 24),
      editorLabel: safeLabel(desktopEditor.label, "Message Editor"),
      previewLabel: safeLabel(desktopPreview.label, "Live Preview"),
      inspectorLabel: safeLabel(desktopInspector.label, "Properties"),
      showToolbar: desktopEditor.showToolbar === "show",
      editorMotion: resolveMotion(desktopEditor),
      previewMotion: resolveMotion(desktopPreview),
      inspectorMotion: resolveMotion(desktopInspector),
    },
    mobile: {
      headerHeight: boundedNumber(mobileHeader.height, 56, 44, 72),
      headerPadding: boundedNumber(mobileHeader.horizontalPadding, 12, 8, 28),
      logoSize: boundedNumber(mobileHeader.logoSize, 28, 20, 40),
      headerBackground: safeHex(mobileHeader.background, "#10131A"),
      headerBorder: safeHex(mobileHeader.borderColor, "#272D3A"),
      headerMotion: resolveMotion(mobileHeader),
      defaultPane: safeChoice(mobileWorkspace.defaultPane, ["editor", "preview"] as const, "editor"),
      showInspector: mobileWorkspace.showInspector === "show",
      inspectorHeight: boundedNumber(mobileWorkspace.inspectorHeight, 300, 180, 520),
      workspaceGap: boundedNumber(mobileWorkspace.workspaceGap, 8, 0, 20),
      panelPadding: boundedNumber(mobileWorkspace.panelPadding, 12, 8, 28),
      borderColor: safeHex(mobileWorkspace.borderColor, "#272D3A"),
      workspaceMotion: resolveMotion(mobileWorkspace),
      editorBackground: safeHex(mobileEditor.surface, "#2B2D31"),
      previewBackground: safeHex(mobilePreview.surface, "#313338"),
      inspectorBackground: safeHex(mobileInspector.surface, "#161A23"),
      editorPadding: boundedNumber(mobileEditor.padding, 12, 0, 32),
      previewPadding: boundedNumber(mobilePreview.padding, 12, 0, 32),
      inspectorPadding: boundedNumber(mobileInspector.padding, 14, 0, 32),
      editorRadius: boundedNumber(mobileEditor.radius, 10, 0, 24),
      previewRadius: boundedNumber(mobilePreview.radius, 10, 0, 24),
      inspectorRadius: boundedNumber(mobileInspector.radius, 10, 0, 24),
      editorLabel: safeLabel(mobileEditor.label, "Message Editor"),
      previewLabel: safeLabel(mobilePreview.label, "Live Preview"),
      inspectorLabel: safeLabel(mobileInspector.label, "Properties"),
      showToolbar: mobileEditor.showToolbar === "show",
      editorMotion: resolveMotion(mobileEditor),
      previewMotion: resolveMotion(mobilePreview),
      inspectorMotion: resolveMotion(mobileInspector),
      navHeight: boundedNumber(mobileNav.height, 60, 48, 84),
      navPadding: boundedNumber(mobileNav.horizontalPadding, 12, 8, 28),
      navBackground: safeHex(mobileNav.background, "#10131A"),
      navAccent: safeHex(mobileNav.accent, "#818CF8"),
      tabOrder: safeChoice(mobileNav.tabOrder, ["editor-first", "preview-first"] as const, "editor-first"),
      showLabels: mobileNav.showLabels !== "hide",
      activeTab: safeChoice(mobileNav.activeTab, ["editor", "preview", "dispatch"] as const, "editor"),
      editorTabLabel: safeLabel(mobileNav.editorLabel, "Editor"),
      previewTabLabel: safeLabel(mobileNav.previewLabel, "Preview"),
      dispatchTabLabel: safeLabel(mobileNav.dispatchLabel, "Dispatch"),
      navMotion: resolveMotion(mobileNav),
    },
  };
};

export const getAppLayoutCssVariables = (layout: ResolvedAppLayout): Record<string, string> => ({
  "--hoho-layout-desktop-header-height": `${layout.desktop.headerHeight}px`,
  "--hoho-layout-desktop-header-padding": `${layout.desktop.headerPadding}px`,
  "--hoho-layout-desktop-logo-size": `${layout.desktop.logoSize}px`,
  "--hoho-layout-desktop-header-background": layout.desktop.headerBackground,
  "--hoho-layout-desktop-header-border": layout.desktop.headerBorder,
  "--hoho-layout-desktop-editor-ratio": String(layout.desktop.editorRatio),
  "--hoho-layout-desktop-inspector-width": `${layout.desktop.inspectorWidth}px`,
  "--hoho-layout-desktop-inspector-left": layout.desktop.inspectorPosition === "left" ? "0" : "auto",
  "--hoho-layout-desktop-inspector-right": layout.desktop.inspectorPosition === "right" ? "0" : "auto",
  "--hoho-layout-desktop-workspace-gap": `${layout.desktop.workspaceGap}px`,
  "--hoho-layout-desktop-inspector-background": layout.desktop.inspectorBackground,
  "--hoho-layout-desktop-editor-background": layout.desktop.editorBackground,
  "--hoho-layout-desktop-preview-background": layout.desktop.previewBackground,
  "--hoho-layout-desktop-border": layout.desktop.borderColor,
  "--hoho-layout-desktop-editor-padding": `${layout.desktop.editorPadding}px`,
  "--hoho-layout-desktop-preview-padding": `${layout.desktop.previewPadding}px`,
  "--hoho-layout-desktop-inspector-padding": `${layout.desktop.inspectorPadding}px`,
  "--hoho-layout-desktop-editor-radius": `${layout.desktop.editorRadius}px`,
  "--hoho-layout-desktop-preview-radius": `${layout.desktop.previewRadius}px`,
  "--hoho-layout-desktop-inspector-radius": `${layout.desktop.inspectorRadius}px`,
  "--hoho-layout-mobile-header-height": `${layout.mobile.headerHeight}px`,
  "--hoho-layout-mobile-header-padding": `${layout.mobile.headerPadding}px`,
  "--hoho-layout-mobile-logo-size": `${layout.mobile.logoSize}px`,
  "--hoho-layout-mobile-header-background": layout.mobile.headerBackground,
  "--hoho-layout-mobile-header-border": layout.mobile.headerBorder,
  "--hoho-layout-mobile-workspace-gap": `${layout.mobile.workspaceGap}px`,
  "--hoho-layout-mobile-panel-padding": `${layout.mobile.panelPadding}px`,
  "--hoho-layout-mobile-editor-background": layout.mobile.editorBackground,
  "--hoho-layout-mobile-preview-background": layout.mobile.previewBackground,
  "--hoho-layout-mobile-inspector-background": layout.mobile.inspectorBackground,
  "--hoho-layout-mobile-inspector-height": `${layout.mobile.inspectorHeight}px`,
  "--hoho-layout-mobile-inspector-padding": `${layout.mobile.inspectorPadding}px`,
  "--hoho-layout-mobile-editor-radius": `${layout.mobile.editorRadius}px`,
  "--hoho-layout-mobile-preview-radius": `${layout.mobile.previewRadius}px`,
  "--hoho-layout-mobile-inspector-radius": `${layout.mobile.inspectorRadius}px`,
  "--hoho-layout-mobile-nav-height": `${layout.mobile.navHeight}px`,
  "--hoho-layout-mobile-nav-padding": `${layout.mobile.navPadding}px`,
  "--hoho-layout-mobile-nav-background": layout.mobile.navBackground,
  "--hoho-layout-mobile-nav-accent": layout.mobile.navAccent,
  "--hoho-layout-mobile-border": layout.mobile.borderColor,
});

export const getAppLayoutDraftKey = (userId?: string | null): string =>
  DRAFT_PREFIX + (userId || "local");

const MAX_APP_LAYOUT_BYTES = 64 * 1024;
const MAX_COMPONENT_ID_LENGTH = 64;
const MAX_LABEL_LENGTH = 48;

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const hasExactKeys = (value: Record<string, any>, allowed: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));

const safeLabel = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim().length > 0 &&
    value.trim().length <= MAX_LABEL_LENGTH && !/[\u0000-\u001f\u007f]/.test(value)
    ? value.trim()
    : fallback;

const COMPONENT_PROPS: Record<string, readonly string[]> = {
  DesktopHeader: ["id", "height", "horizontalPadding", "logoSize", "background", "borderColor", "animation", "animationDuration", "animationDelay"],
  DesktopWorkspace: ["id", "editorRatio", "inspectorWidth", "workspaceGap", "panelOrder", "inspectorPosition", "borderColor", "animation", "animationDuration", "animationDelay", "content"],
  MobileHeader: ["id", "height", "horizontalPadding", "logoSize", "background", "borderColor", "animation", "animationDuration", "animationDelay"],
  MobileWorkspace: ["id", "defaultPane", "showInspector", "inspectorHeight", "workspaceGap", "panelPadding", "borderColor", "animation", "animationDuration", "animationDelay", "content"],
  MobileBottomNavigation: ["id", "height", "horizontalPadding", "background", "accent", "tabOrder", "showLabels", "activeTab", "editorLabel", "previewLabel", "dispatchLabel", "animation", "animationDuration", "animationDelay"],
  EditorPanel: ["id", "label", "surface", "padding", "radius", "showToolbar", "animation", "animationDuration", "animationDelay"],
  PreviewPanel: ["id", "label", "surface", "padding", "radius", "animation", "animationDuration", "animationDelay"],
  InspectorPanel: ["id", "label", "surface", "padding", "radius", "animation", "animationDuration", "animationDelay"],
};

const MOTION_PRESETS = ["none", "fade", "fade-up", "slide-left", "slide-right", "zoom-in", "float", "pulse"];
const MOTION_DURATIONS = ["180ms", "300ms", "500ms", "700ms", "1200ms", "2000ms", "3000ms"];
const MOTION_DELAYS = ["0ms", "100ms", "200ms", "350ms"];

const assertNumber = (props: Record<string, any>, key: string, min: number, max: number) => {
  const value = props[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new Error("Layout property " + key + " must be an integer between " + min + " and " + max + ".");
  }
};

const assertHex = (props: Record<string, any>, key: string) => {
  if (typeof props[key] !== "string" || !/^#[0-9a-fA-F]{6}$/.test(props[key])) {
    throw new Error("Layout property " + key + " must be a six-digit HEX color.");
  }
};

const assertChoice = (props: Record<string, any>, key: string, choices: readonly string[]) => {
  if (typeof props[key] !== "string" || !choices.includes(props[key])) {
    throw new Error("Layout property " + key + " has an unsupported value.");
  }
};

const assertLabel = (props: Record<string, any>, key: string) => {
  const value = props[key];
  if (typeof value !== "string" || value.trim().length === 0 ||
      value.trim().length > MAX_LABEL_LENGTH || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("Layout property " + key + " must be a non-empty label of at most " + MAX_LABEL_LENGTH + " characters.");
  }
};

const assertMotion = (props: Record<string, any>) => {
  assertChoice(props, "animation", MOTION_PRESETS);
  assertChoice(props, "animationDuration", MOTION_DURATIONS);
  assertChoice(props, "animationDelay", MOTION_DELAYS);
};

const validateComponentProps = (type: string, props: Record<string, any>) => {
  const allowed = COMPONENT_PROPS[type];
  if (!allowed || !hasExactKeys(props, allowed)) {
    throw new Error("The " + type + " component contains unsupported or missing properties.");
  }
  if (typeof props.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(props.id) ||
      props.id.length > MAX_COMPONENT_ID_LENGTH) {
    throw new Error("Layout component IDs must be non-empty, safe identifiers of at most " + MAX_COMPONENT_ID_LENGTH + " characters.");
  }

  if (type === "DesktopHeader" || type === "MobileHeader") {
    assertNumber(props, "height", 44, type === "DesktopHeader" ? 80 : 72);
    assertNumber(props, "horizontalPadding", 8, type === "DesktopHeader" ? 36 : 28);
    assertNumber(props, "logoSize", 20, type === "DesktopHeader" ? 48 : 40);
    assertHex(props, "background");
    assertHex(props, "borderColor");
    assertMotion(props);
    return;
  }

  if (type === "DesktopWorkspace") {
    assertNumber(props, "editorRatio", 28, 72);
    assertNumber(props, "inspectorWidth", 300, 520);
    assertNumber(props, "workspaceGap", 0, 24);
    assertChoice(props, "panelOrder", ["editor-first", "preview-first"]);
    assertChoice(props, "inspectorPosition", ["left", "right"]);
    assertHex(props, "borderColor");
    assertMotion(props);
    return;
  }

  if (type === "MobileWorkspace") {
    assertChoice(props, "defaultPane", ["editor", "preview"]);
    assertChoice(props, "showInspector", ["show", "hide"]);
    assertNumber(props, "inspectorHeight", 180, 520);
    assertNumber(props, "workspaceGap", 0, 20);
    assertNumber(props, "panelPadding", 8, 28);
    assertHex(props, "borderColor");
    assertMotion(props);
    return;
  }

  if (type === "MobileBottomNavigation") {
    assertNumber(props, "height", 48, 84);
    assertNumber(props, "horizontalPadding", 8, 28);
    assertHex(props, "background");
    assertHex(props, "accent");
    assertChoice(props, "tabOrder", ["editor-first", "preview-first"]);
    assertChoice(props, "showLabels", ["show", "hide"]);
    if (props.activeTab !== undefined) assertChoice(props, "activeTab", ["editor", "preview", "dispatch"]);
    if (props.editorLabel !== undefined) assertLabel(props, "editorLabel");
    if (props.previewLabel !== undefined) assertLabel(props, "previewLabel");
    if (props.dispatchLabel !== undefined) assertLabel(props, "dispatchLabel");
    assertMotion(props);
    return;
  }

  assertLabel(props, "label");
  assertHex(props, "surface");
  assertNumber(props, "padding", 0, 32);
  assertNumber(props, "radius", 0, 24);
  if (type === "EditorPanel") assertChoice(props, "showToolbar", ["show", "hide"]);
  assertMotion(props);
};

const validateDocument = (value: unknown, mode: AppLayoutMode): AppLayoutDocument => {
  if (!isRecord(value) || !hasExactKeys(value, ["root", "content"]) ||
      !isRecord(value.root) || !hasExactKeys(value.root, ["props"]) ||
      (value.root.props !== undefined && (!isRecord(value.root.props) || Object.keys(value.root.props).length !== 0)) ||
      !Array.isArray(value.content)) {
    throw new Error("The " + mode + " layout is not a valid version-1 Puck document.");
  }

  const expected = mode === "desktop"
    ? ["DesktopHeader", "DesktopWorkspace"]
    : ["MobileHeader", "MobileWorkspace", "MobileBottomNavigation"];
  if (value.content.length !== expected.length) {
    throw new Error("The " + mode + " layout must contain exactly " + expected.length + " required shell sections.");
  }

  const ids = new Set<string>();
  const allowedTypes = mode === "desktop"
    ? ["DesktopHeader", "DesktopWorkspace", "EditorPanel", "PreviewPanel", "InspectorPanel"]
    : ["MobileHeader", "MobileWorkspace", "MobileBottomNavigation", "EditorPanel", "PreviewPanel", "InspectorPanel"];

  const validateNode = (node: unknown, expectedType?: string): AppLayoutNode => {
    if (!isRecord(node) || !hasExactKeys(node, ["type", "props"]) ||
        typeof node.type !== "string" || !allowedTypes.includes(node.type) ||
        (expectedType && node.type !== expectedType) || !isRecord(node.props)) {
      throw new Error("The " + mode + " layout contains an invalid component or nesting structure.");
    }
    const normalizedProps = { ...node.props };
    // Normalize the two fields added after the original version-1 export format.
    if (node.type === "MobileBottomNavigation") {
      normalizedProps.activeTab ??= "editor";
      normalizedProps.editorLabel ??= "Editor";
      normalizedProps.previewLabel ??= "Preview";
      normalizedProps.dispatchLabel ??= "Dispatch";
    }
    // Earlier Puck defaults serialized showToolbar as a boolean.
    if (node.type === "EditorPanel" && typeof normalizedProps.showToolbar === "boolean") {
      normalizedProps.showToolbar = normalizedProps.showToolbar ? "show" : "hide";
    }
    validateComponentProps(node.type, normalizedProps);
    const id = normalizedProps.id as string;
    if (ids.has(id)) throw new Error("Layout component IDs must be unique.");
    ids.add(id);

    const isWorkspace = node.type === "DesktopWorkspace" || node.type === "MobileWorkspace";
    if (isWorkspace) {
      if (!Array.isArray(normalizedProps.content) || normalizedProps.content.length !== 3) {
        throw new Error("Each workspace must contain exactly one Editor, Preview and Inspector panel.");
      }
      const panelTypes = ["EditorPanel", "PreviewPanel", "InspectorPanel"];
      const panels = normalizedProps.content.map((child: unknown) => validateNode(child));
      if (panelTypes.some((type) => panels.filter((panel) => panel.type === type).length !== 1)) {
        throw new Error("Each workspace must contain exactly one Editor, Preview and Inspector panel.");
      }
      return { ...node, props: { ...normalizedProps, content: panels } } as AppLayoutNode;
    }
    if (Object.prototype.hasOwnProperty.call(normalizedProps, "content")) {
      throw new Error("Only workspace components may contain panel slots.");
    }
    return { ...node, props: normalizedProps } as AppLayoutNode;
  };

  const content = value.content.map((node: unknown, index: number) =>
    validateNode(node, expected[index]));
  return { root: { props: {} }, content };
};

export const validateAppLayoutDocuments = (value: unknown): AppLayoutDocuments => {
  if (!isRecord(value) || !hasExactKeys(value, ["desktop", "mobile", "updatedAt"]) ||
      !Object.prototype.hasOwnProperty.call(value, "desktop") ||
      !Object.prototype.hasOwnProperty.call(value, "mobile") ||
      (value.updatedAt !== undefined && (typeof value.updatedAt !== "string" || value.updatedAt.length > 64))) {
    throw new Error("The selected file does not contain a supported HoHo application layout.");
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new Error("The layout document must contain JSON-compatible values.");
  }
  if (typeof serialized !== "string" || new TextEncoder().encode(serialized).byteLength > MAX_APP_LAYOUT_BYTES) {
    throw new Error("The combined Desktop and Mobile layout documents exceed the 64 KiB limit.");
  }
  return {
    desktop: validateDocument(value.desktop, "desktop"),
    mobile: validateDocument(value.mobile, "mobile"),
    ...(typeof value.updatedAt === "string" ? { updatedAt: value.updatedAt } : {}),
  };
};

export const loadAppLayoutDraft = (key: string): AppLayoutDocuments | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return validateAppLayoutDocuments(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const saveAppLayoutDraft = (key: string, value: AppLayoutDocuments): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const checked = validateAppLayoutDocuments(value);
    window.localStorage.setItem(key, JSON.stringify(checked));
    return true;
  } catch {
    return false;
  }
};

export const downloadAppLayout = (value: AppLayoutDocuments, filename = "hoho-app-layout.json"): void => {
  if (typeof document === "undefined") return;
  const checked = validateAppLayoutDocuments(value);
  const payload = {
    format: "hoho-app-layout",
    version: 1,
    exportedAt: new Date().toISOString(),
    desktop: checked.desktop,
    mobile: checked.mobile,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const parseAppLayoutFile = (value: unknown): AppLayoutDocuments => {
  if (!isRecord(value) || !hasExactKeys(value, ["format", "version", "exportedAt", "desktop", "mobile"]) ||
      value.format !== "hoho-app-layout" || value.version !== 1 ||
      typeof value.exportedAt !== "string" || value.exportedAt.length > 64) {
    throw new Error("Unsupported HoHo application layout file.");
  }
  return validateAppLayoutDocuments({ desktop: value.desktop, mobile: value.mobile });
};
