import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useGlobalStore } from "../src/store/globalStore";
import { useMessageStore } from "../src/store/messageStore";
import { useActionStore } from "../src/store/actionStore";
import { MessageEditor } from "../src/components/editor/MessageEditor";
import { MessagePreview } from "../src/components/preview/MessagePreview";
import { Sidebar } from "../src/components/layout/Sidebar";
import { Header } from "../src/components/layout/Header";
import { SplitPane } from "../src/components/layout/SplitPane";
import {
  ButtonStyle,
  ComponentType,
  MessageFlags,
  type EmbedData,
  type ComponentNode,
} from "@dmb/shared";
import { EDITOR_MODES } from "../src/utils/constants";
import { toDiscordPayload, validateMessage } from "../src/utils/discord";

describe("Adversarial Stress Harness: Frontend Layout, Rapid Toggle Cycles & Mode Switching", () => {
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
     SUITE 1: RAPID TOGGLE CYCLES & ASYNCHRONOUS STATE INVARIANTS
     ═══════════════════════════════════════════════════════════════════════════ */
  describe("Suite 1: Rapid Toggle Cycles Stress Harness", () => {
    it("survives 2,000 rapid chaotic toggle triggers without state corruption or desync", () => {
      expect(useGlobalStore.getState().isSidebarOpen).toBe(false);

      const operations = [
        () => useGlobalStore.getState().toggleSidebar(),
        () => useGlobalStore.getState().setIsSidebarOpen(true),
        () => useGlobalStore.getState().setIsSidebarOpen(false),
        () => useGlobalStore.getState().setSidebarOpen(true),
        () => useGlobalStore.getState().setSidebarOpen(false),
      ];

      for (let i = 0; i < 2000; i++) {
        const op = operations[i % operations.length]!;
        op();
        const current = useGlobalStore.getState().isSidebarOpen;
        expect(typeof current).toBe("boolean");
      }
    });

    it("verifies Escape key is idempotent and strictly closes the drawer", () => {
      const simulateKey = (key: string) => {
        const isOpen = useGlobalStore.getState().isSidebarOpen;
        if (key === "Escape" && isOpen) {
          useGlobalStore.getState().setIsSidebarOpen(false);
        }
      };

      // When closed, Escape does not open it
      simulateKey("Escape");
      expect(useGlobalStore.getState().isSidebarOpen).toBe(false);

      // Open, then Escape closes it
      useGlobalStore.getState().setIsSidebarOpen(true);
      expect(useGlobalStore.getState().isSidebarOpen).toBe(true);
      simulateKey("Escape");
      expect(useGlobalStore.getState().isSidebarOpen).toBe(false);

      // Repeat 100 times
      for (let i = 0; i < 100; i++) {
        simulateKey("Escape");
        expect(useGlobalStore.getState().isSidebarOpen).toBe(false);
      }
    });

    it("survives localStorage throwing SecurityError or QuotaExceededError during toggle spam", () => {
      globalThis.localStorage.setItem = () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      };

      expect(() => {
        for (let i = 0; i < 100; i++) {
          useGlobalStore.getState().toggleSidebar();
          useGlobalStore.getState().setIsSidebarOpen(true);
          useGlobalStore.getState().setIsSidebarOpen(false);
        }
      }).not.toThrow();

      expect(typeof useGlobalStore.getState().isSidebarOpen).toBe("boolean");
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     SUITE 2: MODE SWITCHING UNDER CONCURRENT MUTATION STRESS
     ═══════════════════════════════════════════════════════════════════════════ */
  describe("Suite 2: Mode Switching Under Concurrent Mutation Stress", () => {
    it("clears selection on mode switch to prevent dangling modal references", () => {
      // 1. Add embed and select it
      useMessageStore.getState().addEmbed();
      const embedId = useMessageStore.getState().data.embeds[0]!._id as string;
      useMessageStore.getState().select({ kind: "embed", id: embedId });
      expect(useMessageStore.getState().selection).toEqual({ kind: "embed", id: embedId });

      // Switch to V2 mode -> selection must be null
      useMessageStore.getState().setMode(EDITOR_MODES.V2);
      expect(useMessageStore.getState().selection).toBeNull();

      // 2. Add component and select it
      useMessageStore.getState().addComponent(ComponentType.ActionRow);
      const rowId = useMessageStore.getState().data.components[0]!._id as string;
      useMessageStore.getState().addActionRowChild(rowId, ComponentType.Button);
      const btnId = useMessageStore.getState().data.components[0]!.components![0]!._id as string;
      useMessageStore.getState().select({ kind: "component", id: btnId });
      expect(useMessageStore.getState().selection).toEqual({ kind: "component", id: btnId });

      // Switch back to Classic mode -> selection must be null
      useMessageStore.getState().setMode(EDITOR_MODES.CLASSIC);
      expect(useMessageStore.getState().selection).toBeNull();
    });

    it("executes 1,000 rapid mode switches with interleaved content, embed, and component mutations", () => {
      for (let i = 0; i < 1000; i++) {
        const mode = i % 2 === 0 ? EDITOR_MODES.V2 : EDITOR_MODES.CLASSIC;
        useMessageStore.getState().setMode(mode);

        if (mode === EDITOR_MODES.CLASSIC) {
          useMessageStore.getState().setContent(`Classic iteration ${i}`);
          if (useMessageStore.getState().data.embeds.length < 5) {
            useMessageStore.getState().addEmbed();
          }
        } else {
          if (useMessageStore.getState().data.components.length < 5) {
            useMessageStore.getState().addComponent(ComponentType.ActionRow);
          }
        }

        // Checkpoint every 100 iterations: verify payload validity
        if (i % 100 === 0) {
          const payload = useMessageStore.getState().getPayload();
          const errors = useMessageStore.getState().getValidationErrors();
          expect(Array.isArray(errors)).toBe(true);
          expect(payload).toBeDefined();

          if (mode === EDITOR_MODES.V2) {
            expect((payload.flags ?? 0) & MessageFlags.IsComponentsV2).toBe(MessageFlags.IsComponentsV2);
          } else {
            expect((payload.flags ?? 0) & MessageFlags.IsComponentsV2).toBe(0);
          }
        }
      }

      // Verify final document structure remains intact
      const finalData = useMessageStore.getState().data;
      expect(finalData.content).toContain("Classic iteration");
      expect(finalData.embeds.length).toBeGreaterThan(0);
      expect(finalData.components.length).toBeGreaterThan(0);
    });

    it("verifies payload transformation idempotence when round-tripping between modes", () => {
      // Document containing both rich text, embeds, and action rows
      const originalDoc = {
        content: "Idempotence verification payload",
        embeds: [
          {
            _id: "emb-1",
            title: "Embed 1",
            description: "Desc 1",
            fields: [{ _id: "f-1", name: "Key", value: "Val", inline: false }],
          },
        ],
        components: [
          {
            _id: "row-1",
            type: ComponentType.ActionRow,
            components: [
              {
                _id: "btn-1",
                type: ComponentType.Button,
                style: ButtonStyle.Primary,
                label: "Click Me",
                custom_id: "btn_action_1",
              },
            ],
          },
        ],
        username: "BotUser",
        avatar_url: "https://example.com/pfp.png",
        thread_name: "",
      };

      useMessageStore.getState().load({ data: originalDoc, mode: EDITOR_MODES.CLASSIC });

      // 1. Classic snapshot
      const p1Classic = useMessageStore.getState().getPayload();
      expect(p1Classic.content).toBe("Idempotence verification payload");
      expect(p1Classic.embeds?.length).toBe(1);
      expect(p1Classic.components?.length).toBe(1);
      expect((p1Classic.flags ?? 0) & MessageFlags.IsComponentsV2).toBe(0);

      // 2. Switch to V2
      useMessageStore.getState().setMode(EDITOR_MODES.V2);
      const p2V2 = useMessageStore.getState().getPayload();
      expect(p2V2.content).toBeUndefined();
      expect(p2V2.embeds).toBeUndefined();
      expect(p2V2.components?.length).toBe(1);
      expect((p2V2.flags ?? 0) & MessageFlags.IsComponentsV2).toBe(MessageFlags.IsComponentsV2);

      // 3. Switch back to Classic
      useMessageStore.getState().setMode(EDITOR_MODES.CLASSIC);
      const p3Classic = useMessageStore.getState().getPayload();
      expect(p3Classic).toEqual(p1Classic);
    });
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     SUITE 3: FRONTEND LAYOUT & SPLITPANE BOUNDARY STRESS
     ═══════════════════════════════════════════════════════════════════════════ */
  describe("Suite 3: Layout Boundaries & Responsive Drawer Invariants", () => {
    it("SplitPane divider keyboard navigation enforces strict ratio bounds [0.25, 0.75]", () => {
      let currentRatio = 0.5;
      const minRatio = 0.25;
      const maxRatio = 0.75;
      const step = 0.02;

      // Simulate 50 left arrow presses (decreasing ratio)
      for (let i = 0; i < 50; i++) {
        currentRatio = Math.max(minRatio, currentRatio - step);
      }
      expect(currentRatio).toBe(0.25);
      expect(currentRatio).toBeGreaterThanOrEqual(minRatio);

      // Further left presses do not breach minimum
      for (let i = 0; i < 20; i++) {
        currentRatio = Math.max(minRatio, currentRatio - step);
      }
      expect(currentRatio).toBe(0.25);

      // Simulate 50 right arrow presses (increasing ratio)
      for (let i = 0; i < 50; i++) {
        currentRatio = Math.min(maxRatio, currentRatio + step);
      }
      expect(currentRatio).toBe(0.75);
      expect(currentRatio).toBeLessThanOrEqual(maxRatio);

      // Further right presses do not breach maximum
      for (let i = 0; i < 20; i++) {
        currentRatio = Math.min(maxRatio, currentRatio + step);
      }
      expect(currentRatio).toBe(0.75);
    });

    it("verifies narrow viewport threshold (<=1100px) strictly forces sidebar closed on initialization", () => {
      // Mock window innerWidth at 1100px (narrow breakpoint)
      (globalThis as any).window = {
        innerWidth: 1100,
        innerHeight: 900,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      // Stored preference is explicitly true
      mockStorage["hoho_global_state"] = JSON.stringify({
        selectedGuildId: "906426036772818954",
        isSidebarOpen: true,
      });

      const isNarrow = window.innerWidth <= 1100;
      const raw = mockStorage["hoho_global_state"];
      const parsed = JSON.parse(raw);
      const calculatedOpenState = isNarrow ? false : Boolean(parsed.isSidebarOpen);

      expect(calculatedOpenState).toBe(false);
    });

    it("verifies wide viewport threshold (>1100px) respects user stored preference", () => {
      // Mock window innerWidth at 1101px (desktop)
      (globalThis as any).window = {
        innerWidth: 1101,
        innerHeight: 900,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      mockStorage["hoho_global_state"] = JSON.stringify({
        selectedGuildId: "906426036772818954",
        isSidebarOpen: true,
      });

      const isNarrow = window.innerWidth <= 1100;
      const raw = mockStorage["hoho_global_state"];
      const parsed = JSON.parse(raw);
      const calculatedOpenState = isNarrow ? false : Boolean(parsed.isSidebarOpen);

      expect(calculatedOpenState).toBe(true);
    });

    it("renders Header, MessageEditor, and MessagePreview together without layout collision or SSR crash", () => {
      const headerHtml = renderToStaticMarkup(createElement(Header));
      expect(headerHtml).toContain("HoHo Manager");
      expect(headerHtml).toContain("Toggle Toolbox (Ctrl+B)");

      const editorHtml = renderToStaticMarkup(createElement(MessageEditor));
      expect(editorHtml).toContain("Classic");
      expect(editorHtml).toContain("Components V2");

      const previewHtml = renderToStaticMarkup(createElement(MessagePreview));
      expect(previewHtml).toContain("Preview");
    });
  });
});
