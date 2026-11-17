import { ApiError } from "./errors.js";

export const APP_LAYOUT_SCHEMA_VERSION = 1;
export const MAX_APP_LAYOUT_DOCUMENT_BYTES = 256 * 1024;
export const MAX_APP_LAYOUT_PAIR_BYTES = 512 * 1024;

export interface AppLayoutDocument {
  root: { props: Record<string, never> };
  content: Array<{ type: string; props: Record<string, unknown> }>;
}

export interface ValidatedAppLayoutPair {
  schemaVersion: typeof APP_LAYOUT_SCHEMA_VERSION;
  desktop: AppLayoutDocument;
  mobile: AppLayoutDocument;
}

type PropertyRule =
  | { kind: "number"; min: number; max: number }
  | { kind: "color" }
  | { kind: "choice"; values: readonly string[] }
  | { kind: "label" };

const MOTIONS = ["none", "fade", "fade-up", "slide-left", "slide-right", "zoom-in", "float", "pulse"] as const;
const DURATIONS = ["180ms", "300ms", "500ms", "700ms", "1200ms", "2000ms", "3000ms"] as const;
const DELAYS = ["0ms", "100ms", "200ms", "350ms"] as const;
const PANEL_ORDER = ["editor-first", "preview-first"] as const;
const SIDES = ["left", "right"] as const;
const PANES = ["editor", "preview"] as const;
const VISIBILITY = ["show", "hide"] as const;

const motionRules: Record<string, PropertyRule> = {
  animation: { kind: "choice", values: MOTIONS },
  animationDuration: { kind: "choice", values: DURATIONS },
  animationDelay: { kind: "choice", values: DELAYS },
};

const componentRules: Record<string, Record<string, PropertyRule>> = {
  DesktopHeader: {
    height: { kind: "number", min: 44, max: 80 },
    horizontalPadding: { kind: "number", min: 8, max: 36 },
    logoSize: { kind: "number", min: 20, max: 48 },
    background: { kind: "color" },
    borderColor: { kind: "color" },
    ...motionRules,
  },
  DesktopWorkspace: {
    editorRatio: { kind: "number", min: 28, max: 72 },
    inspectorWidth: { kind: "number", min: 300, max: 520 },
    workspaceGap: { kind: "number", min: 0, max: 24 },
    panelOrder: { kind: "choice", values: PANEL_ORDER },
    inspectorPosition: { kind: "choice", values: SIDES },
    borderColor: { kind: "color" },
    ...motionRules,
  },
  MobileHeader: {
    height: { kind: "number", min: 44, max: 72 },
    horizontalPadding: { kind: "number", min: 8, max: 28 },
    logoSize: { kind: "number", min: 20, max: 40 },
    background: { kind: "color" },
    borderColor: { kind: "color" },
    ...motionRules,
  },
  MobileWorkspace: {
    defaultPane: { kind: "choice", values: PANES },
    showInspector: { kind: "choice", values: VISIBILITY },
    inspectorHeight: { kind: "number", min: 180, max: 520 },
    workspaceGap: { kind: "number", min: 0, max: 20 },
    panelPadding: { kind: "number", min: 8, max: 28 },
    borderColor: { kind: "color" },
    ...motionRules,
  },
  MobileBottomNavigation: {
    height: { kind: "number", min: 48, max: 84 },
    horizontalPadding: { kind: "number", min: 8, max: 28 },
    background: { kind: "color" },
    accent: { kind: "color" },
    tabOrder: { kind: "choice", values: PANEL_ORDER },
    showLabels: { kind: "choice", values: VISIBILITY },
    ...motionRules,
  },
  EditorPanel: {
    label: { kind: "label" },
    surface: { kind: "color" },
    padding: { kind: "number", min: 0, max: 32 },
    radius: { kind: "number", min: 0, max: 24 },
    showToolbar: { kind: "choice", values: VISIBILITY },
    ...motionRules,
  },
  PreviewPanel: {
    label: { kind: "label" },
    surface: { kind: "color" },
    padding: { kind: "number", min: 0, max: 32 },
    radius: { kind: "number", min: 0, max: 24 },
    ...motionRules,
  },
  InspectorPanel: {
    label: { kind: "label" },
    surface: { kind: "color" },
    padding: { kind: "number", min: 0, max: 32 },
    radius: { kind: "number", min: 0, max: 24 },
    ...motionRules,
  },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const fail = (message: string): never => {
  throw ApiError.badRequest(message);
};

const exactKeys = (value: Record<string, unknown>, allowed: readonly string[], label: string): void => {
  const unexpected = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unexpected.length) fail(`${label} contains unsupported field(s): ${unexpected.join(", ")}.`);
};

const validateProperty = (name: string, value: unknown, rule: PropertyRule, component: string): unknown => {
  if (rule.kind === "number") {
    if (typeof value !== "number" || !Number.isInteger(value) || value < rule.min || value > rule.max) {
      fail(`${component}.${name} must be an integer from ${rule.min} to ${rule.max}.`);
    }
    return value;
  }
  if (rule.kind === "color") {
    if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
      fail(`${component}.${name} must be a six-digit HEX color.`);
    }
    return value.toUpperCase();
  }
  if (rule.kind === "choice") {
    if (typeof value !== "string" || !rule.values.includes(value)) {
      fail(`${component}.${name} has an unsupported value.`);
    }
    return value;
  }
  if (typeof value !== "string" || value.trim().length < 1 || value.length > 48 || /[\u0000-\u001f\u007f]/.test(value)) {
    fail(`${component}.${name} must contain 1–48 printable characters.`);
  }
  return value.trim();
};

const validateDocument = (value: unknown, mode: "desktop" | "mobile"): AppLayoutDocument => {
  if (!isRecord(value)) fail(`The ${mode} layout must be an object.`);
  exactKeys(value, ["root", "content"], `The ${mode} document`);
  if (!isRecord(value.root)) fail(`The ${mode} layout root is invalid.`);
  exactKeys(value.root, ["props"], `The ${mode} root`);
  if (!isRecord(value.root.props) || Object.keys(value.root.props).length !== 0) {
    fail(`The ${mode} layout root does not support custom properties.`);
  }
  if (!Array.isArray(value.content)) fail(`The ${mode} layout content must be an array.`);

  const topLevel = mode === "desktop"
    ? ["DesktopHeader", "DesktopWorkspace"]
    : ["MobileHeader", "MobileWorkspace", "MobileBottomNavigation"];
  if (value.content.length !== topLevel.length) fail(`The ${mode} layout must contain its required shell sections only.`);

  const ids = new Set<string>();
  const validateNode = (raw: unknown, expectedType: string): Record<string, unknown> => {
    if (!isRecord(raw)) fail(`The ${mode} layout contains an invalid component.`);
    exactKeys(raw, ["type", "props"], `The ${mode} component`);
    if (raw.type !== expectedType || !isRecord(raw.props)) fail(`The ${mode} layout contains an unexpected component type.`);
    const rules = componentRules[expectedType];
    if (!rules) fail(`Unsupported layout component: ${expectedType}.`);
    const props = raw.props;
    exactKeys(props, ["id", ...Object.keys(rules), ...(expectedType.endsWith("Workspace") ? ["content"] : [])], expectedType);
    if (typeof props.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(props.id)) {
      fail(`${expectedType} requires a valid component ID.`);
    }
    if (ids.has(props.id)) fail("Layout component IDs must be unique within each responsive document.");
    ids.add(props.id);

    const cleanProps: Record<string, unknown> = { id: props.id };
    for (const [name, property] of Object.entries(rules)) {
      if (Object.prototype.hasOwnProperty.call(props, name)) {
        cleanProps[name] = validateProperty(name, props[name], property, expectedType);
      }
    }

    if (expectedType.endsWith("Workspace")) {
      if (!Array.isArray(props.content) || props.content.length !== 3) {
        fail(`${expectedType} must contain Editor, Preview and Inspector panels exactly once.`);
      }
      const panels = ["EditorPanel", "PreviewPanel", "InspectorPanel"];
      const seen = new Set<string>();
      const cleanPanels = props.content.map((panel) => {
        if (!isRecord(panel) || typeof panel.type !== "string" || !panels.includes(panel.type) || seen.has(panel.type)) {
          fail(`${expectedType} contains an invalid or duplicate panel.`);
        }
        seen.add(panel.type);
        return validateNode(panel, panel.type);
      });
      if (seen.size !== 3) fail(`${expectedType} must contain all three workspace panels.`);
      cleanProps.content = cleanPanels;
    }
    return { type: expectedType, props: cleanProps };
  };

  const cleanContent = value.content.map((node, index) => validateNode(node, topLevel[index]!));
  return { root: { props: {} }, content: cleanContent as AppLayoutDocument["content"] };
};

export const validateAppLayoutPair = (value: unknown): ValidatedAppLayoutPair => {
  if (!isRecord(value)) fail("A responsive layout payload is required.");
  exactKeys(value, ["schemaVersion", "desktop", "mobile"], "The publish payload");
  if (value.schemaVersion !== APP_LAYOUT_SCHEMA_VERSION) {
    fail(`Unsupported layout schema version. Expected ${APP_LAYOUT_SCHEMA_VERSION}.`);
  }

  let desktopBytes: number;
  let mobileBytes: number;
  try {
    const desktopJson = JSON.stringify(value.desktop);
    const mobileJson = JSON.stringify(value.mobile);
    if (typeof desktopJson !== "string" || typeof mobileJson !== "string") {
      fail("The responsive layout documents must be valid JSON values.");
    }
    desktopBytes = Buffer.byteLength(desktopJson, "utf8");
    mobileBytes = Buffer.byteLength(mobileJson, "utf8");
  } catch {
    fail("The responsive layout documents must be valid JSON values.");
  }
  if (desktopBytes! > MAX_APP_LAYOUT_DOCUMENT_BYTES || mobileBytes! > MAX_APP_LAYOUT_DOCUMENT_BYTES) {
    throw ApiError.payloadTooLarge("Each responsive layout document must be 256 KiB or smaller.");
  }
  if (desktopBytes! + mobileBytes! > MAX_APP_LAYOUT_PAIR_BYTES) {
    throw ApiError.payloadTooLarge("The responsive layout pair must be 512 KiB or smaller.");
  }

  const desktop = validateDocument(value.desktop, "desktop");
  const mobile = validateDocument(value.mobile, "mobile");
  const ids = new Set(desktop.content.flatMap((node) => collectIds(node)));
  for (const id of mobile.content.flatMap((node) => collectIds(node))) {
    if (ids.has(id)) fail("Desktop and Mobile component IDs must be unique across the published pair.");
    ids.add(id);
  }
  return { schemaVersion: APP_LAYOUT_SCHEMA_VERSION, desktop, mobile };
};

const collectIds = (node: { type: string; props: Record<string, unknown> }): string[] => {
  const id = typeof node.props.id === "string" ? [node.props.id] : [];
  const nested = Array.isArray(node.props.content)
    ? (node.props.content as Array<{ type: string; props: Record<string, unknown> }>).flatMap(collectIds)
    : [];
  return [...id, ...nested];
};
