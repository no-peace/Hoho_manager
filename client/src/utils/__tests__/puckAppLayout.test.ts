import { afterEach, describe, expect, it } from "vitest";
import { defaultDesktopLayoutData, defaultMobileLayoutData } from "../../config/puck/defaultAppLayouts";
import {
  getAppLayoutDraftKey,
  loadAppLayoutDraft,
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

  it("clamps numeric values and rejects unsafe colors at the runtime boundary", () => {
    const desktop = clone(defaultDesktopLayoutData);
    desktop.content[1].props.editorRatio = 99;
    desktop.content[1].props.inspectorWidth = 9999;
    desktop.content[1].props.borderColor = "url(javascript:alert(1))";
    const layout = resolveAppLayoutData(desktop, defaultMobileLayoutData);
    expect(layout.desktop.editorRatio).toBeCloseTo(0.72);
    expect(layout.desktop.inspectorWidth).toBe(520);
    expect(layout.desktop.borderColor).toBe("#272D3A");
  });

  it("rejects missing shell regions and duplicate component IDs", () => {
    const missing = clone(defaultDesktopLayoutData);
    missing.content.pop();
    expect(() => validateAppLayoutDocuments({ desktop: missing, mobile: defaultMobileLayoutData })).toThrow(/required application section/i);

    const duplicate = clone(defaultMobileLayoutData);
    duplicate.content[1].props.content[0].props.id = duplicate.content[0].props.id;
    expect(() => validateAppLayoutDocuments({ desktop: defaultDesktopLayoutData, mobile: duplicate })).toThrow(/unique/i);
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
