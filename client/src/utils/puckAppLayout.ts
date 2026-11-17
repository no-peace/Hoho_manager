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

export interface ResolvedAppLayout {
  desktop: {
    headerHeight: number; headerPadding: number; logoSize: number; headerBackground: string; headerBorder: string;
    editorRatio: number; inspectorWidth: number; workspaceGap: number; panelOrder: "editor-first" | "preview-first";
    inspectorPosition: "left" | "right"; borderColor: string;
    editorBackground: string; previewBackground: string; inspectorBackground: string;
    editorPadding: number; previewPadding: number; inspectorPadding: number;
    editorRadius: number; previewRadius: number; inspectorRadius: number;
  };
  mobile: {
    headerHeight: number; headerPadding: number; logoSize: number; headerBackground: string; headerBorder: string;
    defaultPane: "editor" | "preview"; showInspector: boolean; inspectorHeight: number; workspaceGap: number; panelPadding: number; borderColor: string;
    editorBackground: string; previewBackground: string; inspectorBackground: string; editorRadius: number; previewRadius: number; inspectorRadius: number; inspectorPadding: number;
    navHeight: number; navPadding: number; navBackground: string; navAccent: string;
    tabOrder: "editor-first" | "preview-first"; showLabels: boolean;
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
      editorRatio: boundedNumber(desktopWorkspace.editorRatio, 50, 28, 72) / 100,
      inspectorWidth: boundedNumber(desktopWorkspace.inspectorWidth, 440, 300, 520),
      workspaceGap: boundedNumber(desktopWorkspace.workspaceGap, 6, 0, 24),
      panelOrder: safeChoice(desktopWorkspace.panelOrder, ["editor-first", "preview-first"] as const, "editor-first"),
      inspectorPosition: safeChoice(desktopWorkspace.inspectorPosition, ["left", "right"] as const, "right"),
      borderColor: safeHex(desktopWorkspace.borderColor, "#272D3A"),
      editorBackground: safeHex(desktopEditor.surface, "#2B2D31"),
      previewBackground: safeHex(desktopPreview.surface, "#313338"),
      inspectorBackground: safeHex(desktopInspector.surface, "#161A23"),
      editorPadding: boundedNumber(desktopEditor.padding, 16, 0, 32),
      previewPadding: boundedNumber(desktopPreview.padding, 16, 0, 32),
      inspectorPadding: boundedNumber(desktopInspector.padding, 14, 0, 32),
      editorRadius: boundedNumber(desktopEditor.radius, 10, 0, 24),
      previewRadius: boundedNumber(desktopPreview.radius, 10, 0, 24),
      inspectorRadius: boundedNumber(desktopInspector.radius, 10, 0, 24),
    },
    mobile: {
      headerHeight: boundedNumber(mobileHeader.height, 56, 44, 72),
      headerPadding: boundedNumber(mobileHeader.horizontalPadding, 12, 8, 28),
      logoSize: boundedNumber(mobileHeader.logoSize, 28, 20, 40),
      headerBackground: safeHex(mobileHeader.background, "#10131A"),
      headerBorder: safeHex(mobileHeader.borderColor, "#272D3A"),
      defaultPane: safeChoice(mobileWorkspace.defaultPane, ["editor", "preview"] as const, "editor"),
      showInspector: mobileWorkspace.showInspector === "show",
      inspectorHeight: boundedNumber(mobileWorkspace.inspectorHeight, 300, 180, 520),
      workspaceGap: boundedNumber(mobileWorkspace.workspaceGap, 8, 0, 20),
      panelPadding: boundedNumber(mobileWorkspace.panelPadding, 12, 8, 28),
      borderColor: safeHex(mobileWorkspace.borderColor, "#272D3A"),
      editorBackground: safeHex(mobileEditor.surface, "#2B2D31"),
      previewBackground: safeHex(mobilePreview.surface, "#313338"),
      inspectorBackground: safeHex(mobileInspector.surface, "#161A23"),
      editorRadius: boundedNumber(mobileEditor.radius, 10, 0, 24),
      previewRadius: boundedNumber(mobilePreview.radius, 10, 0, 24),
      inspectorRadius: boundedNumber(mobileInspector.radius, 10, 0, 24),
      inspectorPadding: boundedNumber(mobileInspector.padding, 14, 0, 32),
      navHeight: boundedNumber(mobileNav.height, 60, 48, 84),
      navPadding: boundedNumber(mobileNav.horizontalPadding, 12, 8, 28),
      navBackground: safeHex(mobileNav.background, "#10131A"),
      navAccent: safeHex(mobileNav.accent, "#818CF8"),
      tabOrder: safeChoice(mobileNav.tabOrder, ["editor-first", "preview-first"] as const, "editor-first"),
      showLabels: mobileNav.showLabels !== "hide",
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

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const validateDocument = (value: unknown, mode: AppLayoutMode): AppLayoutDocument => {
  if (!isRecord(value) || !isRecord(value.root) || !Array.isArray(value.content)) {
    throw new Error(`The ${mode} layout is not a valid Puck document.`);
  }
  const rootProps = value.root.props === undefined ? {} : value.root.props;
  if (!isRecord(rootProps)) throw new Error(`The ${mode} layout root props are invalid.`);
  const expected = mode === "desktop"
    ? ["DesktopHeader", "DesktopWorkspace"]
    : ["MobileHeader", "MobileWorkspace", "MobileBottomNavigation"];
  if (value.content.length !== expected.length) {
    throw new Error(`The ${mode} layout is missing a required application section.`);
  }
  const ids = new Set<string>();
  const allowedTypes = new Set(mode === "desktop"
    ? ["DesktopHeader", "DesktopWorkspace", "EditorPanel", "PreviewPanel", "InspectorPanel"]
    : ["MobileHeader", "MobileWorkspace", "MobileBottomNavigation", "EditorPanel", "PreviewPanel", "InspectorPanel"]);
  const visit = (nodes: unknown[]) => {
    for (const node of nodes) {
      if (!isRecord(node) || typeof node.type !== "string" || !allowedTypes.has(node.type) || !isRecord(node.props) || typeof node.props.id !== "string") {
        throw new Error(`The ${mode} layout contains an invalid component.`);
      }
      if (ids.has(node.props.id)) throw new Error("Layout component IDs must be unique.");
      ids.add(node.props.id);
      if (node.props.content !== undefined) {
        if (!Array.isArray(node.props.content)) throw new Error("Nested panel content must be an array.");
        visit(node.props.content);
      }
    }
  };
  visit(value.content);
  for (let index = 0; index < expected.length; index += 1) {
    if (value.content[index]?.type !== expected[index]) {
      throw new Error(`The ${mode} layout sections are out of order or incomplete.`);
    }
  }
  const workspace = value.content[1];
  const expectedPanels = mode === "desktop"
    ? ["EditorPanel", "PreviewPanel", "InspectorPanel"]
    : ["EditorPanel", "PreviewPanel", "InspectorPanel"];
  const panels = workspace?.props?.content;
  if (!Array.isArray(panels) || panels.length !== expectedPanels.length ||
      expectedPanels.some((type) => panels.filter((panel: any) => panel?.type === type).length !== 1)) {
    throw new Error(`The ${mode} workspace must contain every required panel exactly once.`);
  }
  return { ...value, root: { ...value.root, props: rootProps } } as AppLayoutDocument;
};

export const validateAppLayoutDocuments = (value: unknown): AppLayoutDocuments => {
  if (!isRecord(value)) throw new Error("The selected file does not contain a HoHo application layout.");
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
  if (!isRecord(value) || value.format !== "hoho-app-layout" || value.version !== 1) {
    throw new Error("Unsupported HoHo application layout file.");
  }
  return validateAppLayoutDocuments(value);
};
