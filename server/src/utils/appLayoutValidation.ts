import { ApiError } from "./errors.js";

export const APP_LAYOUT_SCHEMA_VERSION = 1;
export const MAX_APP_LAYOUT_PAIR_BYTES = 65_536;

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
const ACTIVE_TABS = ["editor", "preview", "dispatch"] as const;
const COMPONENT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

const motionRules: Record<string, PropertyRule> = {
  animation: { kind: "choice", values: MOTIONS },
  animationDuration: { kind: "choice", values: DURATIONS },
  animationDelay: { kind: "choice", values: DELAYS },
};

const headerRules = (height: number, padding: number, logo: number): Record<string, PropertyRule> => ({
  height: { kind: "number", min: 44, max: height },
  horizontalPadding: { kind: "number", min: 8, max: padding },
  logoSize: { kind: "number", min: 20, max: logo },
  background: { kind: "color" },
  borderColor: { kind: "color" },
  ...motionRules,
});

const panelRules: Record<string, PropertyRule> = {
  label: { kind: "label" },
  surface: { kind: "color" },
  padding: { kind: "number", min: 0, max: 32 },
  radius: { kind: "number", min: 0, max: 24 },
  ...motionRules,
};

const componentRules: Record<string, Record<string, PropertyRule>> = {
  DesktopHeader: headerRules(80, 36, 48),
  DesktopWorkspace: {
    editorRatio: { kind: "number", min: 28, max: 72 },
    inspectorWidth: { kind: "number", min: 300, max: 520 },
    workspaceGap: { kind: "number", min: 0, max: 24 },
    panelOrder: { kind: "choice", values: PANEL_ORDER },
    inspectorPosition: { kind: "choice", values: SIDES },
    borderColor: { kind: "color" },
    ...motionRules,
  },
  MobileHeader: headerRules(72, 28, 40),
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
    ...panelRules,
    showToolbar: { kind: "choice", values: VISIBILITY },
  },
  PreviewPanel: { ...panelRules },
  InspectorPanel: { ...panelRules },
};

const OPTIONAL_PROPERTIES: Record<string, Record<string, PropertyRule>> = {
  MobileBottomNavigation: {
    activeTab: { kind: "choice", values: ACTIVE_TABS },
    editorLabel: { kind: "label" },
    previewLabel: { kind: "label" },
    dispatchLabel: { kind: "label" },
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
  if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > 48 || /[\u0000-\u001f\u007f]/.test(value)) {
    fail(`${component}.${name} must contain 1–48 printable characters.`);
  }
  return value.trim();
};

const validateDocument = (value: unknown, mode: "desktop" | "mobile"): AppLayoutDocument => {
  if (!isRecord(value)) fail(`The ${mode} layout must be an object.`);
  exactKeys(value, ["root", "content"], `The ${mode} document`);
  if (!isRecord(value.root)) fail(`The ${mode} layout root is invalid.`);
  exactKeys(value.root, ["props"], `The ${mode} root`);
  const rootProps = value.root.props === undefined ? {} : value.root.props;
  if (!isRecord(rootProps) || Object.keys(rootProps).length !== 0) {
    fail(`The ${mode} layout root props must be an empty object.`);
  }
  if (!Array.isArray(value.content)) fail(`The ${mode} layout content must be an array.`);

  const topLevel = mode === "desktop"
    ? ["DesktopHeader", "DesktopWorkspace"]
    : ["MobileHeader", "MobileWorkspace", "MobileBottomNavigation"];
  if (value.content.length !== topLevel.length) fail(`The ${mode} layout must contain its required shell sections only.`);

  // IDs are unique within this responsive document, not across Desktop and Mobile.
  const ids = new Set<string>();
  const validateNode = (raw: unknown, expectedType: string): Record<string, unknown> => {
    if (!isRecord(raw)) fail(`The ${mode} layout contains an invalid component.`);
    exactKeys(raw, ["type", "props"], `The ${mode} component`);
    if (raw.type !== expectedType || !isRecord(raw.props)) fail(`The ${mode} layout contains an unexpected component type.`);
    const rules = componentRules[expectedType];
    if (!rules) fail(`Unsupported layout component: ${expectedType}.`);
    const optionalRules = OPTIONAL_PROPERTIES[expectedType] ?? {};
    const isWorkspace = expectedType === "DesktopWorkspace" || expectedType === "MobileWorkspace";
    exactKeys(
      raw.props,
      ["id", ...Object.keys(rules), ...Object.keys(optionalRules), ...(isWorkspace ? ["content"] : [])],
      expectedType,
    );

    const id = raw.props.id;
    if (typeof id !== "string" || !COMPONENT_ID.test(id)) {
      fail(`${expectedType} requires an ID matching the approved 1–64 character component ID format.`);
    }
    if (ids.has(id)) fail(`Component IDs must be unique within the ${mode} document.`);
    ids.add(id);

    const cleanProps: Record<string, unknown> = { id };
    for (const [name, rule] of Object.entries(rules)) {
      if (!Object.prototype.hasOwnProperty.call(raw.props, name)) {
        fail(`${expectedType} is missing required property: ${name}.`);
      }
      const rawValue = raw.props[name];
      if (expectedType === "EditorPanel" && name === "showToolbar" && typeof rawValue === "boolean") {
        cleanProps[name] = rawValue ? "show" : "hide";
      } else {
        cleanProps[name] = validateProperty(name, rawValue, rule, expectedType);
      }
    }

    for (const [name, rule] of Object.entries(optionalRules)) {
      if (Object.prototype.hasOwnProperty.call(raw.props, name)) {
        cleanProps[name] = validateProperty(name, raw.props[name], rule, expectedType);
      }
    }

    if (expectedType === "MobileBottomNavigation") {
      cleanProps.activeTab ??= "editor";
      cleanProps.editorLabel ??= "Editor";
      cleanProps.previewLabel ??= "Preview";
      cleanProps.dispatchLabel ??= "Dispatch";
    }

    if (isWorkspace) {
      if (!Array.isArray(raw.props.content) || raw.props.content.length !== 3) {
        fail(`${expectedType} must contain Editor, Preview and Inspector panels exactly once.`);
      }
      const panelTypes = ["EditorPanel", "PreviewPanel", "InspectorPanel"];
      const seen = new Set<string>();
      const cleanPanels = raw.props.content.map((panel) => {
        if (!isRecord(panel) || typeof panel.type !== "string" || !panelTypes.includes(panel.type) || seen.has(panel.type)) {
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
  exactKeys(value, ["schemaVersion", "desktop", "mobile", "updatedAt"], "The publish payload");
  if (value.updatedAt !== undefined && (typeof value.updatedAt !== "string" || value.updatedAt.length > 64)) {
    fail("updatedAt metadata must be a string of at most 64 characters.");
  }
  if (value.schemaVersion !== APP_LAYOUT_SCHEMA_VERSION) {
    fail(`Unsupported layout schema version. Expected ${APP_LAYOUT_SCHEMA_VERSION}.`);
  }

  let pairBytes: number;
  try {
    const pairJson = JSON.stringify({ desktop: value.desktop, mobile: value.mobile });
    if (typeof pairJson !== "string") fail("The responsive layout documents must be valid JSON values.");
    pairBytes = Buffer.byteLength(pairJson, "utf8");
  } catch {
    fail("The responsive layout documents must be valid JSON values.");
  }
  if (pairBytes! > MAX_APP_LAYOUT_PAIR_BYTES) {
    throw ApiError.payloadTooLarge("The combined Desktop and Mobile layout documents must not exceed 65,536 bytes (64 KiB).");
  }

  // Fully validate and normalize both documents before the caller can persist either one.
  const desktop = validateDocument(value.desktop, "desktop");
  const mobile = validateDocument(value.mobile, "mobile");
  return { schemaVersion: APP_LAYOUT_SCHEMA_VERSION, desktop, mobile };
};
