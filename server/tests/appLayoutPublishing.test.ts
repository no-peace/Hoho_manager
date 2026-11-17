import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { db, initializeDatabase } from "../src/config/database.js";
import { appLayoutRepository } from "../src/repositories/appLayoutRepository.js";
import { createSessionToken } from "../src/utils/session.js";
import { validateAppLayoutPair } from "../src/utils/appLayoutValidation.js";

const makePair = (suffix = "one") => ({
  schemaVersion: 1,
  desktop: {
    root: { props: {} },
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
    root: { props: {} },
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
    await db.run("DELETE FROM app_layout_publishers");
  });

  it("accepts the approved Desktop and Mobile component trees and normalizes HEX colors", () => {
    const checked = validateAppLayoutPair(makePair());
    expect(checked.schemaVersion).toBe(1);
    expect(checked.desktop.content[0]?.props.background).toBe("#10131A");
    expect(checked.mobile.content).toHaveLength(3);
  });

  it("rejects unsupported components, properties, motion values, IDs and schema versions", () => {
    const unknownComponent = structuredClone(makePair());
    unknownComponent.desktop.content[0]!.type = "ArbitraryHtml";
    expect(() => validateAppLayoutPair(unknownComponent)).toThrow();

    const unknownProperty = structuredClone(makePair());
    (unknownProperty.desktop.content[0]!.props as Record<string, unknown>).style = "background:url(javascript:alert(1))";
    expect(() => validateAppLayoutPair(unknownProperty)).toThrow();

    const unsafeMotion = structuredClone(makePair());
    (unsafeMotion.desktop.content[0]!.props as Record<string, unknown>).animation = "spin";
    expect(() => validateAppLayoutPair(unsafeMotion)).toThrow();

    const duplicateIds = structuredClone(makePair());
    duplicateIds.mobile.content[0]!.props.id = duplicateIds.desktop.content[0]!.props.id;
    expect(() => validateAppLayoutPair(duplicateIds)).toThrow();

    const wrongVersion = { ...makePair(), schemaVersion: 2 };
    expect(() => validateAppLayoutPair(wrongVersion)).toThrow();
  });

  it("rejects an unauthorized session and ignores client-supplied publisher identity", async () => {
    const denied = await fetch(`${baseUrl}/api/design/app-layout`, {
      method: "PUT",
      headers: sessionHeaders("222222222222222222"),
      body: JSON.stringify(makePair()),
    });
    expect(denied.status).toBe(403);

    await appLayoutRepository.grantPublisher("222222222222222222", "111111111111111111");
    const spoofed = { ...makePair(), publisherDiscordId: "333333333333333333" };
    const published = await fetch(`${baseUrl}/api/design/app-layout`, {
      method: "PUT",
      headers: sessionHeaders("222222222222222222"),
      body: JSON.stringify(spoofed),
    });
    // The validator rejects unexpected identity fields rather than trusting them.
    expect(published.status).toBe(400);
    expect(await appLayoutRepository.getPublished()).toBeUndefined();
  });

  it("publishes and reads the responsive pair with the authenticated publisher metadata", async () => {
    await appLayoutRepository.grantPublisher("222222222222222222", "111111111111111111");
    const response = await fetch(`${baseUrl}/api/design/app-layout`, {
      method: "PUT",
      headers: sessionHeaders("222222222222222222"),
      body: JSON.stringify(makePair()),
    });
    expect(response.status).toBe(200);
    const published = await response.json();
    expect(published.layout.publisher.discordId).toBe("222222222222222222");
    expect(published.layout.desktop.content[0].type).toBe("DesktopHeader");
    expect(published.layout.mobile.content[0].type).toBe("MobileHeader");
    expect(published.layout.createdAt).toBeTruthy();
    expect(published.layout.updatedAt).toBeTruthy();

    const read = await fetch(`${baseUrl}/api/design/app-layout`);
    expect(read.status).toBe(200);
    const body = await read.json();
    expect(body.layout.publisher.discordId).toBe("222222222222222222");
  });

  it("validates both documents before writing and preserves the previous published pair on failure", async () => {
    await appLayoutRepository.grantPublisher("222222222222222222", "111111111111111111");
    const first = await fetch(`${baseUrl}/api/design/app-layout`, {
      method: "PUT",
      headers: sessionHeaders("222222222222222222"),
      body: JSON.stringify(makePair("before")),
    });
    expect(first.status).toBe(200);
    const before = await appLayoutRepository.getPublished();

    const invalidPair = structuredClone(makePair("after"));
    (invalidPair.mobile.content[0]!.props as Record<string, unknown>).background = "url(javascript:alert(1))";
    const rejected = await fetch(`${baseUrl}/api/design/app-layout`, {
      method: "PUT",
      headers: sessionHeaders("222222222222222222"),
      body: JSON.stringify(invalidPair),
    });
    expect(rejected.status).toBe(400);

    const after = await appLayoutRepository.getPublished();
    expect(after?.desktop_document).toBe(before?.desktop_document);
    expect(after?.mobile_document).toBe(before?.mobile_document);
    expect(after?.published_by_discord_id).toBe("222222222222222222");
  });

  it("allows only the owner session to grant and revoke explicit publishers", async () => {
    const denied = await fetch(`${baseUrl}/api/design/app-layout/publishers`, {
      method: "POST",
      headers: sessionHeaders("222222222222222222"),
      body: JSON.stringify({ discordId: "333333333333333333" }),
    });
    expect(denied.status).toBe(403);

    const owner = await fetch(`${baseUrl}/api/design/app-layout/publishers`, {
      method: "POST",
      headers: sessionHeaders("111111111111111111", "admin"),
      body: JSON.stringify({ discordId: "333333333333333333" }),
    });
    expect(owner.status).toBe(201);
    expect(await appLayoutRepository.isPublisher("333333333333333333")).toBe(true);

    const revoke = await fetch(`${baseUrl}/api/design/app-layout/publishers/333333333333333333`, {
      method: "DELETE",
      headers: sessionHeaders("111111111111111111", "admin"),
    });
    expect(revoke.status).toBe(204);
    expect(await appLayoutRepository.isPublisher("333333333333333333")).toBe(false);
  });
});
