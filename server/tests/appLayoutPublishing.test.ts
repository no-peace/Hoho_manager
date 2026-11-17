import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { db, initializeDatabase } from "../src/config/database.js";
import { appLayoutRepository } from "../src/repositories/appLayoutRepository.js";
import { createSessionToken } from "../src/utils/session.js";
import { validateAppLayoutPair, MAX_APP_LAYOUT_PAIR_BYTES } from "../src/utils/appLayoutValidation.js";

const makePair = (suffix = "one") => ({
  schemaVersion: 1,
  desktop: {
    root: { props: {} as Record<string, never> },
    content: [
      {
        type: "DesktopHeader",
        props: {
          id: `desktop-header-${suffix}`, height: 56, horizontalPadding: 16, logoSize: 32,
          background: "#10131A", borderColor: "#272D3A", animation: "fade",
          animationDuration: "300ms", animationDelay: "0ms",
        },
      },
      {
        type: "DesktopWorkspace",
        props: {
          id: `desktop-workspace-${suffix}`, editorRatio: 50, inspectorWidth: 440,
          workspaceGap: 6, panelOrder: "editor-first", inspectorPosition: "right",
          borderColor: "#272D3A", animation: "none", animationDuration: "300ms",
          animationDelay: "0ms",
          content: [
            { type: "EditorPanel", props: { id: `desktop-editor-${suffix}`, label: "Message Editor", surface: "#2B2D31", padding: 16, radius: 10, showToolbar: "show", animation: "none", animationDuration: "300ms", animationDelay: "0ms" } },
            { type: "PreviewPanel", props: { id: `desktop-preview-${suffix}`, label: "Live Preview", surface: "#313338", padding: 16, radius: 10, animation: "none", animationDuration: "300ms", animationDelay: "0ms" } },
            { type: "InspectorPanel", props: { id: `desktop-inspector-${suffix}`, label: "Properties", surface: "#161A23", padding: 14, radius: 10, animation: "none", animationDuration: "300ms", animationDelay: "0ms" } },
          ],
        },
      },
    ],
  },
  mobile: {
    root: { props: {} as Record<string, never> },
    content: [
      {
        type: "MobileHeader",
        props: {
          id: `mobile-header-${suffix}`, height: 56, horizontalPadding: 12, logoSize: 28,
          background: "#10131A", borderColor: "#272D3A", animation: "none",
          animationDuration: "300ms", animationDelay: "0ms",
        },
      },
      {
        type: "MobileWorkspace",
        props: {
          id: `mobile-workspace-${suffix}`, defaultPane: "editor", showInspector: "hide",
          inspectorHeight: 300, workspaceGap: 8, panelPadding: 12, borderColor: "#272D3A",
          animation: "none", animationDuration: "300ms", animationDelay: "0ms",
          content: [
            { type: "EditorPanel", props: { id: `mobile-editor-${suffix}`, label: "Message Editor", surface: "#2B2D31", padding: 12, radius: 10, showToolbar: "show", animation: "none", animationDuration: "300ms", animationDelay: "0ms" } },
            { type: "PreviewPanel", props: { id: `mobile-preview-${suffix}`, label: "Live Preview", surface: "#313338", padding: 12, radius: 10, animation: "none", animationDuration: "300ms", animationDelay: "0ms" } },
            { type: "InspectorPanel", props: { id: `mobile-inspector-${suffix}`, label: "Properties", surface: "#161A23", padding: 14, radius: 10, animation: "none", animationDuration: "300ms", animationDelay: "0ms" } },
          ],
        },
      },
      {
        type: "MobileBottomNavigation",
        props: {
          id: `mobile-navigation-${suffix}`, height: 60, horizontalPadding: 12,
          background: "#10131A", accent: "#818CF8", tabOrder: "editor-first", showLabels: "show",
          activeTab: "editor", editorLabel: "Editor", previewLabel: "Preview", dispatchLabel: "Dispatch",
          animation: "none", animationDuration: "300ms", animationDelay: "0ms",
        },
      },
    ],
  },
});

const sessionHeaders = (id: string, role = "editor") => ({
  Authorization: `Bearer ${createSessionToken({ id, username: "layout-test", role })}`,
  "Content-Type": "application/json",
});

describe("responsive application layout publishing", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    await initializeDatabase();
    await new Promise<void>((resolve) => {
      server = createApp().listen(0, "127.0.0.1", () => {
        const port = (server.address() as AddressInfo).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(async () => {
    await db.run("DELETE FROM published_app_layouts WHERE id = 1");
  });

  it("accepts the approved component trees and normalizes colors", () => {
    const checked = validateAppLayoutPair(makePair());
    expect(checked.schemaVersion).toBe(1);
    expect(checked.desktop.content[0]?.props.background).toBe("#10131A");
    expect(checked.mobile.content).toHaveLength(3);
  });

  it("rejects missing required component properties", () => {
    const missing = makePair();
    delete (missing.desktop.content[0]!.props as Record<string, unknown>).height;
    expect(() => validateAppLayoutPair(missing)).toThrow("missing required property: height");
    const missingPanel = makePair();
    delete (((missingPanel.mobile.content[1]!.props as Record<string, any>).content[1].props) as Record<string, unknown>).label;
    expect(() => validateAppLayoutPair(missingPanel)).toThrow("missing required property: label");
  });

  it("normalizes omitted optional version-1 navigation fields and omitted root props", () => {
    const legacy = makePair();
    delete (legacy.desktop.root as unknown as Record<string, unknown>).props;
    delete (legacy.mobile.root as unknown as Record<string, unknown>).props;
    const nav = legacy.mobile.content[2]!.props as Record<string, unknown>;
    delete nav.activeTab;
    delete nav.editorLabel;
    delete nav.previewLabel;
    delete nav.dispatchLabel;
    const checked = validateAppLayoutPair(legacy);
    expect(checked.desktop.root.props).toEqual({});
    expect(checked.mobile.root.props).toEqual({});
    expect(checked.mobile.content[2]!.props).toMatchObject({
      activeTab: "editor", editorLabel: "Editor", previewLabel: "Preview", dispatchLabel: "Dispatch",
    });
  });

  it("normalizes legacy boolean EditorPanel.showToolbar values", () => {
    const legacy = makePair();
    (((legacy.desktop.content[1]!.props as Record<string, any>).content[0].props) as Record<string, unknown>).showToolbar = false;
    (((legacy.mobile.content[1]!.props as Record<string, any>).content[0].props) as Record<string, unknown>).showToolbar = true;
    const checked = validateAppLayoutPair(legacy);
    expect(((checked.desktop.content[1]!.props as Record<string, any>).content[0].props).showToolbar).toBe("hide");
    expect(((checked.mobile.content[1]!.props as Record<string, any>).content[0].props).showToolbar).toBe("show");
  });

  it("enforces the exact component ID format and 64-character maximum", () => {
    for (const id of ["", "_starts-with-underscore", "-starts-with-hyphen", "x".repeat(65), "has space"]) {
      const invalid = makePair();
      invalid.desktop.content[0]!.props.id = id;
      expect(() => validateAppLayoutPair(invalid)).toThrow("approved 1–64 character component ID format");
    }
    const valid = makePair();
    valid.desktop.content[0]!.props.id = `A${"x".repeat(63)}`;
    expect(() => validateAppLayoutPair(valid)).not.toThrow();
  });

  it("enforces the 65,536-byte combined Desktop and Mobile JSON boundary", () => {
    const atLimit = makePair();
    const emptyExtra = { desktop: { ...atLimit.desktop, padding: "" }, mobile: atLimit.mobile };
    const baseBytes = Buffer.byteLength(JSON.stringify(emptyExtra), "utf8");
    (atLimit.desktop as unknown as Record<string, unknown>).padding = "x".repeat(MAX_APP_LAYOUT_PAIR_BYTES - baseBytes);
    const exactBytes = Buffer.byteLength(JSON.stringify({ desktop: atLimit.desktop, mobile: atLimit.mobile }), "utf8");
    expect(exactBytes).toBe(MAX_APP_LAYOUT_PAIR_BYTES);
    expect(() => validateAppLayoutPair(atLimit)).toThrow("unsupported field");

    const overLimit = makePair();
    const overEmpty = { desktop: { ...overLimit.desktop, padding: "" }, mobile: overLimit.mobile };
    const overBase = Buffer.byteLength(JSON.stringify(overEmpty), "utf8");
    (overLimit.desktop as unknown as Record<string, unknown>).padding = "x".repeat(MAX_APP_LAYOUT_PAIR_BYTES + 1 - overBase);
    expect(() => validateAppLayoutPair(overLimit)).toThrow("65,536 bytes");
  });

  it("rejects unsupported components, properties, motion values, dimensions, colors and schema versions", () => {
    const unknownComponent = makePair();
    unknownComponent.desktop.content[0]!.type = "ArbitraryHtml";
    expect(() => validateAppLayoutPair(unknownComponent)).toThrow();

    const unknownProperty = makePair();
    (unknownProperty.desktop.content[0]!.props as Record<string, unknown>).style = "background:url(javascript:alert(1))";
    expect(() => validateAppLayoutPair(unknownProperty)).toThrow();

    const unsafeMotion = makePair();
    (unsafeMotion.desktop.content[0]!.props as Record<string, unknown>).animation = "spin";
    expect(() => validateAppLayoutPair(unsafeMotion)).toThrow();

    const invalidDimension = makePair();
    (invalidDimension.desktop.content[0]!.props as Record<string, unknown>).height = 1000;
    expect(() => validateAppLayoutPair(invalidDimension)).toThrow();

    const invalidColor = makePair();
    (invalidColor.mobile.content[2]!.props as Record<string, unknown>).accent = "red";
    expect(() => validateAppLayoutPair(invalidColor)).toThrow();

    const wrongVersion = { ...makePair(), schemaVersion: 2 };
    expect(() => validateAppLayoutPair(wrongVersion)).toThrow();
  });

  it("keeps component IDs unique per document without requiring cross-document uniqueness", () => {
    const sameAcrossDocuments = makePair();
    sameAcrossDocuments.mobile.content[0]!.props.id = sameAcrossDocuments.desktop.content[0]!.props.id;
    expect(() => validateAppLayoutPair(sameAcrossDocuments)).not.toThrow();

    const duplicateWithinDesktop = makePair();
    (((duplicateWithinDesktop.desktop.content[1]!.props as Record<string, any>).content[0].props) as Record<string, unknown>).id =
      duplicateWithinDesktop.desktop.content[0]!.props.id;
    expect(() => validateAppLayoutPair(duplicateWithinDesktop)).toThrow("unique within the desktop document");
  });

  it("denies a non-owner even when the request supplies a client-side publisher ID", async () => {
    const spoofed = { ...makePair(), publisherDiscordId: "111111111111111111" };
    const response = await fetch(`${baseUrl}/api/design/app-layout`, {
      method: "PUT",
      headers: sessionHeaders("222222222222222222"),
      body: JSON.stringify(spoofed),
    });
    expect(response.status).toBe(403);
    expect(await appLayoutRepository.getPublished()).toBeUndefined();
  });

  it("allows an authenticated development owner session to publish the complete pair", async () => {
    // This uses the existing non-production admin simulation; production owner checks use env.ownerDiscordIds only.
    const response = await fetch(`${baseUrl}/api/design/app-layout`, {
      method: "PUT",
      headers: sessionHeaders("111111111111111111", "admin"),
      body: JSON.stringify(makePair()),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.layout.publisher.discordId).toBe("111111111111111111");
    expect(body.layout.desktop.content[0].type).toBe("DesktopHeader");
    expect(body.layout.mobile.content[0].type).toBe("MobileHeader");
    expect(body.layout.createdAt).toBeTruthy();
    expect(body.layout.updatedAt).toBeTruthy();

    const read = await fetch(`${baseUrl}/api/design/app-layout`);
    expect(read.status).toBe(200);
    expect((await read.json()).layout.publisher.discordId).toBe("111111111111111111");
  });

  it("validates invalid Mobile data before writing and preserves the previously published pair", async () => {
    const first = await fetch(`${baseUrl}/api/design/app-layout`, {
      method: "PUT",
      headers: sessionHeaders("111111111111111111", "admin"),
      body: JSON.stringify(makePair("before")),
    });
    expect(first.status).toBe(200);
    const before = await appLayoutRepository.getPublished();

    const invalidPair = makePair("after");
    delete (invalidPair.mobile.content[2]!.props as Record<string, unknown>).activeTab;
    (((invalidPair.mobile.content[1]!.props as Record<string, any>).content[0].props) as Record<string, unknown>).surface = "not-a-color";
    const rejected = await fetch(`${baseUrl}/api/design/app-layout`, {
      method: "PUT",
      headers: sessionHeaders("111111111111111111", "admin"),
      body: JSON.stringify(invalidPair),
    });
    expect(rejected.status).toBe(400);

    const after = await appLayoutRepository.getPublished();
    expect(after?.desktop_document).toBe(before?.desktop_document);
    expect(after?.mobile_document).toBe(before?.mobile_document);
    expect(after?.published_by_discord_id).toBe("111111111111111111");
  });

  it("keeps the published layout read endpoint public when no layout exists", async () => {
    const response = await fetch(`${baseUrl}/api/design/app-layout`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ layout: null, fallback: true });
  });
});
