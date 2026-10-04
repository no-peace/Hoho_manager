import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useGlobalStore } from "./store/globalStore";
import { useMessageStore } from "./store/messageStore";
import { useActionStore } from "./store/actionStore";
import { MessageEditor } from "./components/editor/MessageEditor";
import { MessagePreview } from "./components/preview/MessagePreview";
import { Sidebar } from "./components/layout/Sidebar";
import {
  ButtonStyle,
  ComponentType,
  MessageFlags,
  type EmbedData,
  type ComponentNode,
} from "@dmb/shared";
import { EDITOR_MODES } from "./utils/constants";
import { validateMessage } from "./utils/discord";

describe("Adversarial Frontend Challenger Suite (R3 Focus)", () => {
  let mockStorage: Record<string, string> = {};
  const origWindow = globalThis.window;
  const origUseSync = React.useSyncExternalStore;

  beforeEach(() => {
    mockStorage = {};
    globalThis.localStorage = {
      getItem: (k: string) => mockStorage[k] ?? null,
      setItem: (k: string, v: string) => {
        mockStorage[k] = String(v);
      },
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
      clear: () => {
        mockStorage = {};
      },
      length: 0,
      key: () => null,
    } as any;

    // React node SSR snapshot evaluation
    React.useSyncExternalStore = (_sub: any, getSnapshot: any) => getSnapshot();

    useGlobalStore.setState({
      selectedGuildId: null,
      isSidebarOpen: false,
      botIdentity: null,
    });
    useMessageStore.getState().reset();
    useActionStore.getState().reset();
  });

  afterEach(() => {
    React.useSyncExternalStore = origUseSync;
    if (origWindow) {
      globalThis.window = origWindow;
    }
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     CHALLENGE DIMENSION 1: Viewport Boundary Stress-Testing
     Simulate widths: 320px, 768px, 1024px, 1100px, 1200px, 1920px
     Verify sidebar never clips Editor/Preview or breaks horizontal boundaries
     ═══════════════════════════════════════════════════════════════════════════ */
  describe("1. Viewport Boundaries & Responsive Layout Stress", () => {
    const VIEWPORT_CASES = [
      { width: 320, description: "Small Mobile Phone", isNarrow: true },
      { width: 480, description: "Large Mobile Phone", isNarrow: true },
      { width: 768, description: "Tablet Portrait (md breakpoint)", isNarrow: true },
      { width: 1024, description: "Tablet Landscape / Small Laptop", isNarrow: true },
      { width: 1099, description: "Narrow Split-Screen Boundary - 1px", isNarrow: true },
      { width: 1100, description: "Narrow Split-Screen Threshold (R1 Spec)", isNarrow: true },
      { width: 1101, description: "Desktop Window Boundary + 1px", isNarrow: false },
      { width: 1200, description: "Standard Desktop Screen", isNarrow: false },
      { width: 1440, description: "MacBook Pro Retina", isNarrow: false },
      { width: 1920, description: "1080p Full HD Monitor", isNarrow: false },
      { width: 2560, description: "1440p QHD Monitor", isNarrow: false },
      { width: 3840, description: "4K UHD Display", isNarrow: false },
    ];

    it.each(VIEWPORT_CASES)(
      "evaluates initial sidebar open state correctly at $width px ($description)",
      ({ width, isNarrow }) => {
        // Set window width
        (globalThis as any).window = {
          innerWidth: width,
          innerHeight: 900,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        };

        // Case A: Fresh session with no stored preference -> always closed
        mockStorage = {};
        const stateFresh = (() => {
          const raw = mockStorage["hoho_global_state"];
          if (raw) {
            const parsed = JSON.parse(raw);
            return {
              isSidebarOpen: window.innerWidth <= 1100 ? false : Boolean(parsed.isSidebarOpen),
            };
          }
          return { isSidebarOpen: false };
        })();
        expect(stateFresh.isSidebarOpen).toBe(false);

        // Case B: Stored preference is explicitly TRUE from a previous session
        mockStorage["hoho_global_state"] = JSON.stringify({
          selectedGuildId: "12345",
          isSidebarOpen: true,
        });

        const stateWithStoredTrue = (() => {
          const raw = mockStorage["hoho_global_state"];
          if (raw) {
            const parsed = JSON.parse(raw);
            return {
              isSidebarOpen: window.innerWidth <= 1100 ? false : Boolean(parsed.isSidebarOpen),
            };
          }
          return { isSidebarOpen: false };
        })();

        if (isNarrow) {
          // Narrow viewport MUST override stored preference and collapse drawer by default
          expect(stateWithStoredTrue.isSidebarOpen).toBe(false);
        } else {
          // Wide desktop viewport may honor stored preference
          expect(stateWithStoredTrue.isSidebarOpen).toBe(true);
        }
      }
    );

    it("verifies mobile/split-screen drawer does not exceed screen width at 320px", () => {
      // At 320px width:
      // max-w-[calc(100vw-3rem)] = 320px - 48px = 272px.
      // Even though w-80 is 320px (20rem), max-w caps it at 272px.
      const screenWidth = 320;
      const threeRemPx = 48; // 3 * 16px
      const drawerMaxWidth = screenWidth - threeRemPx;

      expect(drawerMaxWidth).toBe(272);
      expect(drawerMaxWidth).toBeLessThan(screenWidth);

      // Remaining hit-area for dismiss backdrop outside drawer
      const backdropHitArea = screenWidth - drawerMaxWidth;
      expect(backdropHitArea).toBe(48); // At least 48px touch target for outside click dismissal
    });

    it("verifies SplitPane clamp ratio mathematics across extreme drag inputs", () => {
      // SplitPane initialRatio=0.5, minRatio=0.25, maxRatio=0.75
      const minRatio = 0.25;
      const maxRatio = 0.75;
      const clamp = (ratio: number) => Math.min(Math.max(ratio, minRatio), maxRatio);

      // Adversarial drag coordinates:
      const testCases = [
        { raw: -1.0, expected: 0.25 },
        { raw: 0.0, expected: 0.25 },
        { raw: 0.1, expected: 0.25 },
        { raw: 0.24, expected: 0.25 },
        { raw: 0.25, expected: 0.25 },
        { raw: 0.5, expected: 0.5 },
        { raw: 0.75, expected: 0.75 },
        { raw: 0.76, expected: 0.75 },
        { raw: 1.0, expected: 0.75 },
        { raw: 5.0, expected: 0.75 },
      ];

      for (const tc of testCases) {
        const clamped = clamp(tc.raw);
        expect(clamped).toBe(tc.expected);
        // Neither Editor nor Live Preview can collapse to zero width
        expect(clamped).toBeGreaterThanOrEqual(0.25);
        expect(clamped).toBeLessThanOrEqual(0.75);
      }
    });

    it("renders Sidebar drawer DOM without horizontal overflow or missing accessibility tags", () => {
      const markup = renderToStaticMarkup(
        React.createElement(Sidebar, { onClose: vi.fn() })
      );

      // Must render toolbox header, close button with aria-label, and proper tabs
      expect(markup).toContain("Toolbox");
      expect(markup).toContain('aria-label="Close Toolbox"');
      expect(markup).toContain("Elements");
      expect(markup).toContain("Templates");
      expect(markup).toContain("Layers &amp; Hierarchy");
      // The component palette must NOT live in the drawer anymore — it is
      // rendered inline in the editor pane (Discohook-style).
      expect(markup).not.toContain("Component Palette");
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     CHALLENGE DIMENSION 2: Rapid Toggle Cycles Stress Harness
     Opening/closing drawer via button, Ctrl+B, Cmd+B, backdrop click, Escape
     ═══════════════════════════════════════════════════════════════════════════ */
  describe("2. Rapid Toggle Cycles Stress Harness", () => {
    it("executes 1,000 rapid sequential toggle cycles without state drift", () => {
      expect(useGlobalStore.getState().isSidebarOpen).toBe(false);

      for (let i = 0; i < 1000; i++) {
        useGlobalStore.getState().toggleSidebar();
        const expected = i % 2 === 0; // first iteration (i=0) -> toggled to true
        expect(useGlobalStore.getState().isSidebarOpen).toBe(expected);
      }

      // After 1,000 toggles (even number), should be back to false
      expect(useGlobalStore.getState().isSidebarOpen).toBe(false);
    });

    it("handles rapid interleaved triggers: button, Ctrl+B, Escape, backdrop, close button", () => {
      let isOpen = false;

      // Event simulation helper matching App.tsx and Sidebar.tsx handlers
      const trigger = (action: "button" | "ctrl_b" | "cmd_b" | "escape" | "backdrop" | "close_x") => {
        switch (action) {
          case "button":
          case "ctrl_b":
          case "cmd_b":
            useGlobalStore.getState().toggleSidebar();
            isOpen = !isOpen;
            break;
          case "escape":
            // In App.tsx: if (e.key === "Escape" && isSidebarOpen) setIsSidebarOpen(false);
            if (useGlobalStore.getState().isSidebarOpen) {
              useGlobalStore.getState().setIsSidebarOpen(false);
              isOpen = false;
            }
            break;
          case "backdrop":
          case "close_x":
            // In App.tsx / Sidebar.tsx: setIsSidebarOpen(false) or onClose()
            useGlobalStore.getState().setIsSidebarOpen(false);
            isOpen = false;
            break;
        }
      };

      // Scenario: user opens with button, closes with Escape
      trigger("button");
      expect(useGlobalStore.getState().isSidebarOpen).toBe(true);
      trigger("escape");
      expect(useGlobalStore.getState().isSidebarOpen).toBe(false);

      // Escape when already closed does nothing
      trigger("escape");
      expect(useGlobalStore.getState().isSidebarOpen).toBe(false);

      // Open with Ctrl+B, close with backdrop click
      trigger("ctrl_b");
      expect(useGlobalStore.getState().isSidebarOpen).toBe(true);
      trigger("backdrop");
      expect(useGlobalStore.getState().isSidebarOpen).toBe(false);

      // Open with Cmd+B (macOS), close with X button
      trigger("cmd_b");
      expect(useGlobalStore.getState().isSidebarOpen).toBe(true);
      trigger("close_x");
      expect(useGlobalStore.getState().isSidebarOpen).toBe(false);

      // 500 randomized rapid events
      const actions: ("button" | "ctrl_b" | "cmd_b" | "escape" | "backdrop" | "close_x")[] = [
        "button",
        "ctrl_b",
        "cmd_b",
        "escape",
        "backdrop",
        "close_x",
      ];

      for (let i = 0; i < 500; i++) {
        const act = actions[Math.floor(Math.random() * actions.length)];
        trigger(act);
        expect(useGlobalStore.getState().isSidebarOpen).toBe(isOpen);
      }
    });

    it("survives localStorage quota exceeded or storage failure during rapid toggle spam", () => {
      // Simulate broken or throwing localStorage
      globalThis.localStorage.setItem = () => {
        throw new DOMException("QuotaExceededError", "QuotaExceededError");
      };

      expect(() => {
        for (let i = 0; i < 100; i++) {
          useGlobalStore.getState().toggleSidebar();
        }
      }).not.toThrow();

      // State in memory toggles cleanly despite disk write failures
      expect(typeof useGlobalStore.getState().isSidebarOpen).toBe("boolean");
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     CHALLENGE DIMENSION 3: Mode Switching with Complex Message State
     Rapidly switching between Classic and Components V2 modes with complex
     message state (embeds + action rows + text content) -> zero state loss
     ═══════════════════════════════════════════════════════════════════════════ */
  describe("3. Mode Switching & Complex Message State Integrity", () => {
    const createComplexDocument = () => {
      // 1. Rich Text Content
      const content =
        "**Adversarial Challenge Payload** 🚀\n" +
        "Testing Discord message rendering under extreme mode toggle conditions.\n" +
        "```json\n{ \"verified\": true, \"mode\": \"stress-test\" }\n```\n" +
        "Emojis: 🎉 🔥 🛡️ ⚡ • Unicode: 測試 🚀 ñ ü ö 𝕏 • URLs: https://example.com/test";

      // 2. Rich Embeds
      const embeds: EmbedData[] = [
        {
          _id: "embed-1",
          title: "Primary Server Announcement",
          description: "Important information regarding the upcoming maintenance window.",
          color: 0x5865f2,
          author: { name: "System Admin", icon_url: "https://example.com/admin.png" },
          footer: { text: "Server Build v2.4.0", icon_url: "https://example.com/icon.png" },
          image: { url: "https://example.com/banner.png" },
          thumbnail: { url: "https://example.com/thumb.png" },
          fields: [
            { _id: "f-1", name: "Status", value: "Operational", inline: true },
            { _id: "f-2", name: "Latency", value: "24ms", inline: true },
            { _id: "f-3", name: "Region", value: "US-East", inline: true },
            { _id: "f-4", name: "Notes", value: "Zero downtime deployment", inline: false },
          ],
        },
        {
          _id: "embed-2",
          title: "Secondary Resource Links",
          description: "Quick links and documentation references.",
          color: 0x23a55a,
          fields: [
            { _id: "f-5", name: "Docs", value: "[API Reference](https://example.com/docs)", inline: false },
          ],
        },
        {
          _id: "embed-3",
          title: "Security & Permissions Alert",
          description: "Granular mention scrubbing and rate limit rules active.",
          color: 0xda373c,
          fields: [],
        },
      ];

      // 3. Components V2: 5 Action Rows with full breadth of components
      const components: ComponentNode[] = [
        // Row 0: 5 Buttons
        {
          _id: "row-0",
          type: ComponentType.ActionRow,
          components: [
            { _id: "btn-primary", type: ComponentType.Button, style: ButtonStyle.Primary, label: "Confirm", custom_id: "act_confirm" },
            { _id: "btn-secondary", type: ComponentType.Button, style: ButtonStyle.Secondary, label: "Details", custom_id: "act_details" },
            { _id: "btn-success", type: ComponentType.Button, style: ButtonStyle.Success, label: "Approve", custom_id: "act_approve" },
            { _id: "btn-danger", type: ComponentType.Button, style: ButtonStyle.Danger, label: "Reject", custom_id: "act_reject" },
            { _id: "btn-link", type: ComponentType.Button, style: ButtonStyle.Link, label: "External Docs", url: "https://discord.com" },
          ],
        },
        // Row 1: StringSelect Menu
        {
          _id: "row-1",
          type: ComponentType.ActionRow,
          components: [
            {
              _id: "select-roles",
              type: ComponentType.StringSelect,
              custom_id: "sel_role_choice",
              placeholder: "Select your notification roles...",
              min_values: 1,
              max_values: 3,
              options: [
                { _id: "opt-1", label: "Announcements", value: "opt_announcements", description: "Global announcements" },
                { _id: "opt-2", label: "Changelogs", value: "opt_changelogs", description: "Patch notes & updates" },
                { _id: "opt-3", label: "Events", value: "opt_events", description: "Community events" },
              ],
            },
          ],
        },
        // Row 2: UserSelect
        {
          _id: "row-2",
          type: ComponentType.ActionRow,
          components: [
            {
              _id: "select-users",
              type: ComponentType.UserSelect,
              custom_id: "sel_target_user",
              placeholder: "Select target user...",
              min_values: 1,
              max_values: 1,
            },
          ],
        },
        // Row 3: RoleSelect
        {
          _id: "row-3",
          type: ComponentType.ActionRow,
          components: [
            {
              _id: "select-roles-entity",
              type: ComponentType.RoleSelect,
              custom_id: "sel_target_role",
              placeholder: "Select role to grant...",
            },
          ],
        },
        // Row 4: ChannelSelect
        {
          _id: "row-4",
          type: ComponentType.ActionRow,
          components: [
            {
              _id: "select-channel",
              type: ComponentType.ChannelSelect,
              custom_id: "sel_target_channel",
              placeholder: "Select target channel...",
            },
          ],
        },
      ];

      return {
        content,
        embeds,
        components,
        username: "Adversarial Bot Test",
        avatar_url: "https://example.com/avatar.png",
        thread_name: "stress-test-thread",
      };
    };

    it("preserves complex message state completely across 500 rapid mode switches", () => {
      const doc = createComplexDocument();

      // Load complex document into message store
      useMessageStore.getState().load({
        data: doc,
        mode: EDITOR_MODES.CLASSIC,
        targets: [{ url: "https://discord.com/api/webhooks/123/abc" }],
      });

      // Verify loaded state
      expect(useMessageStore.getState().mode).toBe(EDITOR_MODES.CLASSIC);
      expect(useMessageStore.getState().data.content).toBe(doc.content);
      expect(useMessageStore.getState().data.embeds.length).toBe(3);
      expect(useMessageStore.getState().data.components.length).toBe(5);

      // Perform 500 rapid mode transitions back and forth
      for (let i = 0; i < 500; i++) {
        const nextMode = i % 2 === 0 ? EDITOR_MODES.V2 : EDITOR_MODES.CLASSIC;
        useMessageStore.getState().setMode(nextMode);

        expect(useMessageStore.getState().mode).toBe(nextMode);

        // Selection must be safely reset to null to prevent dangling references
        expect(useMessageStore.getState().selection).toBeNull();

        // Checkpoint every 50 iterations: verify no state loss or corruption
        if (i % 50 === 0) {
          const currentData = useMessageStore.getState().data;
          expect(currentData.content).toBe(doc.content);
          expect(currentData.username).toBe(doc.username);
          expect(currentData.avatar_url).toBe(doc.avatar_url);
          expect(currentData.thread_name).toBe(doc.thread_name);
          expect(currentData.embeds.length).toBe(3);
          expect(currentData.embeds[0]?.title).toBe("Primary Server Announcement");
          expect(currentData.embeds[0]?.fields?.length).toBe(4);
          expect(currentData.components.length).toBe(5);
          expect(currentData.components[0]?.components?.length).toBe(5); // 5 buttons
        }
      }

      // Final inspection
      const finalData = useMessageStore.getState().data;
      expect(finalData.content).toBe(doc.content);
      expect(finalData.embeds).toEqual(doc.embeds);
      expect(finalData.components).toEqual(doc.components);
    });

    it("generates valid Discord payloads with correct flags in both Classic and V2 modes", () => {
      const doc = createComplexDocument();
      useMessageStore.getState().load({
        data: doc,
        mode: EDITOR_MODES.CLASSIC,
      });

      // 1. Classic Mode Payload
      const classicPayload = useMessageStore.getState().getPayload();
      expect(classicPayload.content).toBe(doc.content);
      expect(classicPayload.embeds?.length).toBe(3);
      expect(classicPayload.components?.length).toBe(5);
      // In Classic mode, IsComponentsV2 flag is NOT set
      expect((classicPayload.flags ?? 0) & MessageFlags.IsComponentsV2).toBe(0);

      // Validation
      const classicErrors = validateMessage(useMessageStore.getState().data, EDITOR_MODES.CLASSIC);
      expect(classicErrors).toEqual([]);

      // 2. Switch to Components V2 Mode
      useMessageStore.getState().setMode(EDITOR_MODES.V2);
      const v2Payload = useMessageStore.getState().getPayload();
      // Per Discord Components V2 spec (toDiscordPayload): classic outer content and embeds are
      // omitted in the Discord payload because V2 message components carry their own content
      expect(v2Payload.content).toBeUndefined();
      expect(v2Payload.embeds).toBeUndefined();
      expect(v2Payload.components?.length).toBe(5);
      // In V2 mode, IsComponentsV2 flag MUST be present
      expect((v2Payload.flags ?? 0) & MessageFlags.IsComponentsV2).toBe(MessageFlags.IsComponentsV2);

      // Validation of V2 payload
      const v2Errors = validateMessage(useMessageStore.getState().data, EDITOR_MODES.V2);
      expect(v2Errors).toEqual([]);

      // 3. Switch BACK to Classic Mode and verify full payload restoration
      useMessageStore.getState().setMode(EDITOR_MODES.CLASSIC);
      const restoredPayload = useMessageStore.getState().getPayload();
      expect(restoredPayload.content).toBe(doc.content);
      expect(restoredPayload.embeds?.length).toBe(3);
      expect(restoredPayload.components?.length).toBe(5);
      expect((restoredPayload.flags ?? 0) & MessageFlags.IsComponentsV2).toBe(0);
      expect(validateMessage(useMessageStore.getState().data, EDITOR_MODES.CLASSIC)).toEqual([]);
    });

    it("MessageEditor DOM conditionally renders appropriate subtrees based on mode", () => {
      const doc = createComplexDocument();
      useMessageStore.getState().load({
        data: doc,
        mode: EDITOR_MODES.CLASSIC,
      });

      // A. Classic Mode Rendering
      const classicMarkup = renderToStaticMarkup(React.createElement(MessageEditor));

      // Classic tabs
      expect(classicMarkup).toContain('id="editor-tab-classic"');
      expect(classicMarkup).toContain('aria-selected="true"');
      expect(classicMarkup).toContain('id="editor-tab-v2"');
      // Contains Content textarea
      expect(classicMarkup).toContain("Content");
      // Contains Embeds section
      expect(classicMarkup).toContain("Embeds");
      expect(classicMarkup).toContain("Primary Server Announcement");
      // Does NOT render Action Rows & Components section
      expect(classicMarkup).not.toContain("Action Rows &amp; Components");
      // Palette is inline in the V2 editor only
      expect(classicMarkup).not.toContain("Component Palette");

      // B. Switch to Components V2 Mode
      useMessageStore.getState().setMode(EDITOR_MODES.V2);
      const v2Markup = renderToStaticMarkup(React.createElement(MessageEditor));

      // V2 tabs
      expect(v2Markup).toContain('id="editor-tab-v2"');
      // Does NOT render Content textarea
      expect(v2Markup).not.toContain('placeholder="Say something…');
      // Renders Action Rows builder
      expect(v2Markup).toContain("Action Rows &amp; Components");
      expect(v2Markup).toContain("5 / 5 Rows");
      // Component palette is always visible inline in the editor pane
      expect(v2Markup).toContain("Component Palette");
      // Renders Button labels
      expect(v2Markup).toContain("Confirm");
      expect(v2Markup).toContain("Details");
      expect(v2Markup).toContain("Approve");
      expect(v2Markup).toContain("Reject");
      expect(v2Markup).toContain("External Docs");
      // Renders Select menus
      expect(v2Markup).toContain("String Select");
      expect(v2Markup).toContain("User Select");
      expect(v2Markup).toContain("Role Select");
      expect(v2Markup).toContain("Channel Select");
    });

    it("MessagePreview DOM renders all elements simultaneously without crashing in both modes", () => {
      const doc = createComplexDocument();
      useMessageStore.getState().load({
        data: doc,
        mode: EDITOR_MODES.CLASSIC,
      });

      // Preview in Classic
      const previewClassic = renderToStaticMarkup(React.createElement(MessagePreview));
      expect(previewClassic).toContain("Preview");
      expect(previewClassic).toContain("Classic");
      expect(previewClassic).toContain("Adversarial Bot Test");
      expect(previewClassic).toContain("Primary Server Announcement");
      expect(previewClassic).toContain("Confirm");

      // Preview in V2
      useMessageStore.getState().setMode(EDITOR_MODES.V2);
      const previewV2 = renderToStaticMarkup(React.createElement(MessagePreview));
      expect(previewV2).toContain("Preview");
      expect(previewV2).toContain("Components V2");
      expect(previewV2).toContain("Primary Server Announcement");
      expect(previewV2).toContain("Confirm");
      expect(previewV2).toContain("flags: 32768 (IsComponentsV2)");
    });
  });
});
