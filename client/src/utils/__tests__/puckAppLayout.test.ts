import { afterEach, describe, expect, it } from "vitest";
import { defaultDesktopLayoutData, defaultMobileLayoutData } from "../../config/puck/defaultAppLayouts";
import {
  getAppLayoutDraftKey,
  loadAppLayoutDraft,
  parseAppLayoutFile,
  resolveAppLayoutData,
  saveAppLayoutDraft,
  validateAppLayoutDocuments,
} from "../puckAppLayout";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

describe("HoHo responsive Studio layout documents", () => {
  afterEach(() => localStorage.clear());

  it("starts with the current desktop and mobile Studio dimensions", () => {
    const layout = resolveAppLayoutData(defaultDesktopLayoutData, defaultMobileLayoutData);
    expect(layout.desktop.headerHeight).toBe(56);
    expect(layout.desktop.editorRatio).toBe(0.5);
    expect(layout.desktop.inspectorWidth).toBe(440);
    expect(layout.desktop.panelOrder).toBe("editor-first");
    expect(layout.mobile.headerHeight).toBe(56);
    expect(layout.mobile.defaultPane).toBe("editor");
    expect(layout.mobile.navHeight).toBe(60);
    expect(layout.mobile.tabOrder).toBe("editor-first");
    expect(layout.mobile.showInspector).toBe(false);
    expect(layout.mobile.inspectorHeight).toBe(300);
    expect(layout.mobile.activeTab).toBe("editor");
    expect(layout.mobile.editorTabLabel).toBe("Editor");
    expect(layout.mobile.previewTabLabel).toBe("Preview");
    expect(layout.mobile.dispatchTabLabel).toBe("Dispatch");
  });

  it("keeps desktop and mobile settings independent", () => {
    const desktop = clone(defaultDesktopLayoutData);
    const mobile = clone(defaultMobileLayoutData);
    desktop.content[1].props.editorRatio = 62;
    desktop.content[1].props.panelOrder = "preview-first";
    mobile.content[1].props.defaultPane = "preview";
    mobile.content[2].props.tabOrder = "preview-first";

    const layout = resolveAppLayoutData(desktop, mobile);
    expect(layout.desktop.editorRatio).toBeCloseTo(0.62);
    expect(layout.desktop.panelOrder).toBe("preview-first");
    expect(layout.mobile.defaultPane).toBe("preview");
    expect(layout.mobile.tabOrder).toBe("preview-first");
  });

  it("rejects out-of-range dimensions and unsafe colors before runtime resolution", () => {
    const desktop = clone(defaultDesktopLayoutData);
    desktop.content[1].props.editorRatio = 99;
    expect(() => resolveAppLayoutData(desktop, defaultMobileLayoutData)).toThrow(/editorRatio/i);

    desktop.content[1].props.editorRatio = 50;
    desktop.content[1].props.inspectorWidth = 9999;
    expect(() => validateAppLayoutDocuments({ desktop, mobile: defaultMobileLayoutData })).toThrow(/inspectorWidth/i);

    desktop.content[1].props.inspectorWidth = 440;
    desktop.content[1].props.borderColor = "url(javascript:alert(1))";
    expect(() => validateAppLayoutDocuments({ desktop, mobile: defaultMobileLayoutData })).toThrow(/HEX color/i);
  });

  it("rejects missing shell regions and duplicate component IDs", () => {
    const missing = clone(defaultDesktopLayoutData);
    missing.content.pop();
    expect(() => validateAppLayoutDocuments({ desktop: missing, mobile: defaultMobileLayoutData })).toThrow(/required application section/i);

    const duplicate = clone(defaultMobileLayoutData);
    duplicate.content[1].props.content[0].props.id = duplicate.content[0].props.id;
    expect(() => validateAppLayoutDocuments({ desktop: defaultDesktopLayoutData, mobile: duplicate })).toThrow(/unique/i);
  });

  it("rejects unknown component properties, empty IDs, invalid motion and malformed nesting", () => {
    const unknown = clone(defaultDesktopLayoutData);
    unknown.content[0].props.onClick = "alert(1)";
    expect(() => validateAppLayoutDocuments({ desktop: unknown, mobile: defaultMobileLayoutData })).toThrow(/unsupported or missing properties/i);

    const emptyId = clone(defaultDesktopLayoutData);
    emptyId.content[0].props.id = "";
    expect(() => validateAppLayoutDocuments({ desktop: emptyId, mobile: defaultMobileLayoutData })).toThrow(/IDs must be non-empty/i);

    const unsafeMotion = clone(defaultMobileLayoutData);
    unsafeMotion.content[0].props.animationDuration = "999999ms";
    expect(() => validateAppLayoutDocuments({ desktop: defaultDesktopLayoutData, mobile: unsafeMotion })).toThrow(/animationDuration/i);

    const misplacedPanel = clone(defaultDesktopLayoutData);
    misplacedPanel.content[0].props.content = [];
    expect(() => validateAppLayoutDocuments({ desktop: misplacedPanel, mobile: defaultMobileLayoutData })).toThrow(/unsupported or missing properties/i);
  });

  it("rejects oversized documents and preserves valid version-1 imports", () => {
    const oversized = clone(defaultDesktopLayoutData);
    oversized.content[0].props.background = "#" + "a".repeat(70_000);
    expect(() => validateAppLayoutDocuments({ desktop: oversized, mobile: defaultMobileLayoutData })).toThrow(/64 KiB/i);

    const imported = parseAppLayoutFile({
      format: "hoho-app-layout",
      version: 1,
      exportedAt: "2026-11-17T00:00:00.000Z",
      desktop: clone(defaultDesktopLayoutData),
      mobile: clone(defaultMobileLayoutData),
    });
    expect(imported.desktop.content[0].type).toBe("DesktopHeader");
    expect(imported.mobile.content[2].type).toBe("MobileBottomNavigation");
  });

  it("validates and resolves editable mobile navigation labels and active state", () => {
    const mobile = clone(defaultMobileLayoutData);
    mobile.content[2].props.editorLabel = "Write";
    mobile.content[2].props.previewLabel = "Inspect";
    mobile.content[2].props.dispatchLabel = "Send";
    mobile.content[2].props.activeTab = "preview";
    const layout = resolveAppLayoutData(defaultDesktopLayoutData, mobile);
    expect(layout.mobile.editorTabLabel).toBe("Write");
    expect(layout.mobile.previewTabLabel).toBe("Inspect");
    expect(layout.mobile.dispatchTabLabel).toBe("Send");
    expect(layout.mobile.activeTab).toBe("preview");
  });

  it("normalizes Puck root data when the optional props object is omitted", () => {
    const desktop = clone(defaultDesktopLayoutData);
    delete (desktop.root as any).props;
    const checked = validateAppLayoutDocuments({ desktop, mobile: defaultMobileLayoutData });
    expect(checked.desktop.root.props).toEqual({});
  });

  it("saves and restores a validated local draft under a user-specific key", () => {
    const key = getAppLayoutDraftKey("discord-user-1");
    const documents = { desktop: clone(defaultDesktopLayoutData), mobile: clone(defaultMobileLayoutData) };
    documents.desktop.content[1].props.editorRatio = 60;
    expect(saveAppLayoutDraft(key, documents)).toBe(true);
    expect(loadAppLayoutDraft(key)?.desktop.content[1].props.editorRatio).toBe(60);
    expect(loadAppLayoutDraft(getAppLayoutDraftKey("discord-user-2"))).toBeNull();
  });
});
