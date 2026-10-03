import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useGlobalStore } from "../src/store/globalStore";
import { useMessageStore } from "../src/store/messageStore";
import { useProfileStore } from "../src/store/profileStore";
import { useSettingsStore } from "../src/store/settingsStore";
import { MessagePreview } from "../src/components/preview/MessagePreview";
import {
  newButton,
  newContainer,
  newSection,
  createComponent,
} from "../src/utils/componentsV2";
import {
  toDiscordPayload,
  validateMessage,
  stripInternal,
  isPayloadEmpty,
} from "../src/utils/discord";
import {
  ButtonStyle,
  ComponentType,
  MessageFlags,
  SNOWFLAKE_REGEX,
} from "@dmb/shared";
import { EDITOR_MODES } from "../src/utils/constants";

describe("Adversarial Stress Harness: Layout, State & Avatar Edge Cases", () => {
  let mockStorage: Record<string, string> = {};
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

    // Bridge React's useSyncExternalStore to evaluate getSnapshot (active store state)
    // rather than SSR initial state snapshot during node-rendered test harnesses.
    React.useSyncExternalStore = (_sub: any, getSnapshot: any) => getSnapshot();

    useGlobalStore.setState({
      selectedGuildId: null,
      botIdentity: null,
    });

    useMessageStore.getState().reset();
    useProfileStore.getState().reset();
    useSettingsStore.getState().updateSettings({
      theme: "dark",
      messageDisplay: "cozy",
      fontSize: 16,
    });
  });

  afterEach(() => {
    React.useSyncExternalStore = origUseSync;
  });

  /* ──────────────────────────────────────────────────────────────────────────
     1. useGlobalStore: Corrupted Storage, Missing Fields, Extreme Snowflakes
     ────────────────────────────────────────────────────────────────────────── */
  describe("1. useGlobalStore Adversarial Storage & Schema Resilience", () => {
    it("survives completely malformed JSON in localStorage without unhandled exception", () => {
      const corruptPayloads = [
        "{unclosed_json: true",
        "undefined",
        "<<<NOT_JSON>>>",
        "{ 'bad_quotes': 123 }",
        "NaN",
        "{{{{{{",
      ];

      for (const corrupt of corruptPayloads) {
        mockStorage["hoho_global_state"] = corrupt;
        mockStorage["bot_identity_cache"] = corrupt;

        // Ensure store write and read operations continue functioning normally
        expect(() => {
          useGlobalStore.getState().setSelectedGuildId("112233445566778899");
          useGlobalStore.getState().setBotIdentity({
            id: "112233445566778899",
            username: "SafeBot",
            avatar: null,
          });
        }).not.toThrow();

        expect(useGlobalStore.getState().selectedGuildId).toBe("112233445566778899");
        expect(useGlobalStore.getState().botIdentity?.username).toBe("SafeBot");
      }
    });

    it("handles non-object primitives and arrays stored in localStorage keys", () => {
      const weirdPrimitives = [
        "12345",
        '"a pure string"',
        "true",
        "false",
        "[1, 2, 3]",
        "null",
      ];

      for (const val of weirdPrimitives) {
        mockStorage["hoho_global_state"] = val;
        mockStorage["bot_identity_cache"] = val;

        expect(() => {
          useGlobalStore.getState().setSelectedGuildId("998877665544332211");
        }).not.toThrow();
      }
    });

    it("gracefully handles missing fields, legacy schema variations, and nulls", () => {
      const partialIdentities = [
        { id: "123456789012345678" } as any,
        { username: "OnlyName" } as any,
        { avatar: "https://example.com/avatar.png" } as any,
        { id: "123456789012345678", name: "LegacyNameProperty", avatar: null } as any,
        {} as any,
      ];

      for (const partial of partialIdentities) {
        expect(() => {
          useGlobalStore.getState().setBotIdentity(partial);
        }).not.toThrow();

        const stored = useGlobalStore.getState().botIdentity;
        expect(stored).toBeDefined();
      }
    });

    it("preserves extreme boundary snowflake strings (17-20 digits and beyond)", () => {
      const extremeSnowflakes = [
        "0",
        "4194304", // (1 << 22) - Discord epoch base
        "10000000000000000", // 17 digits (min length)
        "123456789012345678", // 18 digits (common)
        "1234567890123456789", // 19 digits (common modern)
        "18446744073709551615", // 20 digits (uint64 max)
        "99999999999999999999", // 20 digits max decimal
      ];

      for (const sf of extremeSnowflakes) {
        useGlobalStore.getState().setSelectedGuildId(sf);
        expect(useGlobalStore.getState().selectedGuildId).toBe(sf);

        useGlobalStore.getState().setBotIdentity({
          id: sf,
          username: `Bot-${sf}`,
          avatar: null,
        });
        expect(useGlobalStore.getState().botIdentity?.id).toBe(sf);
      }
    });

    it("handles storage write failures (e.g. QuotaExceededError or security block)", () => {
      // Simulate throwing localStorage
      globalThis.localStorage.setItem = () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      };

      expect(() => {
        useGlobalStore.getState().setSelectedGuildId("123456789012345678");
        useGlobalStore.getState().setBotIdentity({
          id: "123456789012345678",
          username: "ResilientBot",
          avatar: null,
        });
      }).not.toThrow();

      expect(useGlobalStore.getState().selectedGuildId).toBe("123456789012345678");
      expect(useGlobalStore.getState().botIdentity?.username).toBe("ResilientBot");
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     2. Discord CDN Snowflake Formula: Mathematical Invariants & Boundaries
     ────────────────────────────────────────────────────────────────────────── */
  describe("2. Discord CDN Snowflake Formula: (BigInt(id) >> 22n) % 6n Invariants", () => {
    const calculateAvatarIndex = (id: string | bigint): number => {
      const snowflake = typeof id === "bigint" ? id : BigInt(id);
      return Number((snowflake >> 22n) % 6n);
    };

    it("verifies mathematical invariant: index is ALWAYS strictly in [0, 5] for valid positive snowflakes", () => {
      // Test across 1,000 algorithmic snowflakes generated at different epochs
      const discordEpoch = 1420070400000n; // 2015-01-01T00:00:00Z
      const indicesSeen = new Set<number>();

      for (let i = 0; i < 1000; i++) {
        // Construct realistic Discord snowflake with incrementing milliseconds
        const fakeTimestamp = discordEpoch + BigInt(i);
        const snowflake = ((fakeTimestamp - discordEpoch) << 22n) | BigInt(i % 1024);
        const index = calculateAvatarIndex(snowflake);

        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThanOrEqual(5);
        expect(Number.isInteger(index)).toBe(true);
        indicesSeen.add(index);
      }

      // Ensure full coverage of all 6 avatar buckets: 0, 1, 2, 3, 4, 5
      expect(indicesSeen.size).toBe(6);
    });

    it("verifies bit-boundary shifts and power-of-two boundaries", () => {
      const boundaryCases: Array<{ name: string; snowflake: bigint }> = [
        { name: "zero", snowflake: 0n },
        { name: "one", snowflake: 1n },
        { name: "max bit before shift (2^22 - 1)", snowflake: (1n << 22n) - 1n },
        { name: "exact shift threshold (2^22)", snowflake: 1n << 22n },
        { name: "exact shift threshold + 1", snowflake: (1n << 22n) + 1n },
        { name: "exact multiple 6 * 2^22", snowflake: 6n * (1n << 22n) },
        { name: "uint64 max (2^64 - 1)", snowflake: (1n << 64n) - 1n },
      ];

      for (const { snowflake } of boundaryCases) {
        const index = calculateAvatarIndex(snowflake);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThanOrEqual(5);
      }

      // Check exact expected values on known bit boundaries
      expect(calculateAvatarIndex(0n)).toBe(0);
      expect(calculateAvatarIndex((1n << 22n) - 1n)).toBe(0); // shifted right 22 bits = 0
      expect(calculateAvatarIndex(1n << 22n)).toBe(1); // 1 % 6 = 1
      expect(calculateAvatarIndex(6n * (1n << 22n))).toBe(0); // 6 % 6 = 0
    });

    it("evaluates edge behaviors with negative and malformed snowflake inputs", () => {
      // In JS BigInt: (-10000000000n >> 22n) % 6n produces negative modulo!
      const negativeBigInt = -10000000000n;
      const rawJsModulo = (negativeBigInt >> 22n) % 6n;
      expect(rawJsModulo).toBeLessThan(0n); // Demonstrates why input must be positive snowflake

      // Non-numeric strings throw SyntaxError in BigInt()
      expect(() => BigInt("not-a-number")).toThrow(SyntaxError);
      expect(() => BigInt("123abc456")).toThrow(SyntaxError);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     3. Mode Switching & Store Document Retention
     ────────────────────────────────────────────────────────────────────────── */
  describe("3. Mode Switching & Store State Retention (Classic <-> V2)", () => {
    it("maintains content, embeds, and component trees across rapid bidirectional mode switching", () => {
      const store = useMessageStore.getState();

      const initialEmbed = {
        _id: "emb_persist_1",
        title: "Persistent Title",
        description: "Persistent Description",
        fields: [{ _id: "f_1", name: "Key", value: "Value", inline: true }],
      };

      const initialButton = {
        ...newButton(ButtonStyle.Primary),
        _id: "btn_persist_1",
        label: "Click Me",
        custom_id: "btn_click",
      };

      const initialRow = {
        _id: "row_persist_1",
        type: ComponentType.ActionRow,
        components: [initialButton],
      };

      useMessageStore.setState({
        data: {
          content: "Keep this content unchanged",
          embeds: [initialEmbed as any],
          components: [initialRow as any],
          username: "TestBot",
          avatar_url: "https://example.com/avatar.png",
          thread_name: "test-thread",
        },
      });

      // Switch mode 20 times alternately
      for (let i = 0; i < 20; i++) {
        const nextMode = i % 2 === 0 ? EDITOR_MODES.V2 : EDITOR_MODES.CLASSIC;
        store.setMode(nextMode);

        const currentData = useMessageStore.getState().data;
        expect(currentData.content).toBe("Keep this content unchanged");
        expect(currentData.embeds).toHaveLength(1);
        expect(currentData.embeds[0].title).toBe("Persistent Title");
        expect(currentData.components).toHaveLength(1);
        expect(currentData.components[0].components?.[0].label).toBe("Click Me");
        expect(currentData.username).toBe("TestBot");
        expect(currentData.thread_name).toBe("test-thread");
      }
    });

    it("allows editing embeds and components across mode switches without data wiping", () => {
      const store = useMessageStore.getState();

      // Start in classic mode and add embed
      store.setMode(EDITOR_MODES.CLASSIC);
      store.addEmbed();
      const embedId = useMessageStore.getState().data.embeds[0]._id as string;
      store.updateEmbed(embedId, { title: "Classic Mode Embed" });

      // Switch to V2 mode and add component
      store.setMode(EDITOR_MODES.V2);
      store.addComponent(ComponentType.ActionRow);
      const rowId = useMessageStore.getState().data.components[0]._id as string;
      store.addActionRowChild(rowId, ComponentType.Button);

      // Switch back to Classic mode
      store.setMode(EDITOR_MODES.CLASSIC);
      expect(useMessageStore.getState().data.embeds).toHaveLength(1);
      expect(useMessageStore.getState().data.embeds[0].title).toBe("Classic Mode Embed");
      expect(useMessageStore.getState().data.components).toHaveLength(1);

      // Verify payload in Classic mode contains both embeds and components
      const classicPayload = store.getPayload();
      expect(classicPayload.embeds).toHaveLength(1);
      expect(classicPayload.components).toHaveLength(1);
      expect(classicPayload.flags).toBeUndefined();

      // Verify payload in V2 mode adds MessageFlags.IsComponentsV2 and carries components
      store.setMode(EDITOR_MODES.V2);
      const v2Payload = store.getPayload();
      expect(v2Payload.flags).toBe(MessageFlags.IsComponentsV2);
      expect(v2Payload.components).toHaveLength(1);
      // Embeds are retained in message document even if stripped from V2 wire payload
      expect(useMessageStore.getState().data.embeds).toHaveLength(1);
    });

    it("resets selection safely on mode change without dangling selection", () => {
      const store = useMessageStore.getState();
      store.addEmbed();
      const embedId = useMessageStore.getState().data.embeds[0]._id as string;
      store.select({ kind: "embed", id: embedId });
      expect(useMessageStore.getState().selection).toEqual({ kind: "embed", id: embedId });

      // Mode change clears selection
      store.setMode(EDITOR_MODES.V2);
      expect(useMessageStore.getState().selection).toBeNull();
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     4. Dynamic Bot Avatar Live Preview Resolution
     ────────────────────────────────────────────────────────────────────────── */
  describe("4. Dynamic Bot Avatar Live Preview Resolution", () => {
    it("renders custom bot avatar when provided in botIdentity", () => {
      useGlobalStore.getState().setBotIdentity({
        id: "123456789012345678",
        username: "HohoCustom",
        avatar: "https://cdn.discordapp.com/avatars/123/custom.png",
      });

      useMessageStore.setState({
        data: {
          content: "Hello world",
          embeds: [],
          components: [],
          username: "",
          avatar_url: "",
          thread_name: "",
        },
      });

      const html = renderToStaticMarkup(createElement(MessagePreview));
      expect(html).toContain("https://cdn.discordapp.com/avatars/123/custom.png");
      expect(html).toContain("HohoCustom");
    });

    it("falls back to Discord CDN snowflake avatar when bot avatar is null", () => {
      const id = "911111111111111111";
      const expectedIndex = (BigInt(id) >> 22n) % 6n;
      const expectedCdnUrl = `https://cdn.discordapp.com/embed/avatars/${expectedIndex}.png`;

      useGlobalStore.getState().setBotIdentity({
        id,
        username: "SnowflakeBot",
        avatar: null,
      });

      useMessageStore.setState({
        data: {
          content: "Checking snowflake fallback",
          embeds: [],
          components: [],
          username: "",
          avatar_url: "",
          thread_name: "",
        },
      });

      const html = renderToStaticMarkup(createElement(MessagePreview));
      expect(html).toContain(expectedCdnUrl);
      expect(html).toContain("SnowflakeBot");
    });

    it("message data avatar_url takes priority over botIdentity avatar", () => {
      useGlobalStore.getState().setBotIdentity({
        id: "123456789012345678",
        username: "IdentityBot",
        avatar: "https://cdn.discordapp.com/avatars/bot.png",
      });

      useMessageStore.setState({
        data: {
          content: "Override test",
          embeds: [],
          components: [],
          username: "OverrideBot",
          avatar_url: "https://override.example.com/custom.png",
          thread_name: "",
        },
      });

      const html = renderToStaticMarkup(createElement(MessagePreview));
      expect(html).toContain("https://override.example.com/custom.png");
      expect(html).toContain("OverrideBot");
      expect(html).not.toContain("https://cdn.discordapp.com/avatars/bot.png");
    });

    it("renders fallback Bot icon when both botIdentity and message avatar are null/empty", () => {
      useGlobalStore.getState().setBotIdentity(null);

      useMessageStore.setState({
        data: {
          content: "Anonymous message",
          embeds: [],
          components: [],
          username: "",
          avatar_url: "",
          thread_name: "",
        },
      });

      const html = renderToStaticMarkup(createElement(MessagePreview));
      expect(html).toContain("lucide-bot");
      expect(html).toContain("Message Builder");
    });

    it("handles botIdentity with empty string id without crashing preview render", () => {
      useGlobalStore.getState().setBotIdentity({
        id: "",
        username: "EmptyIdBot",
        avatar: null,
      });

      useMessageStore.setState({
        data: {
          content: "Empty id test",
          embeds: [],
          components: [],
          username: "",
          avatar_url: "",
          thread_name: "",
        },
      });

      // botIdentity.id is empty string, which is falsy -> defaultDiscordAvatar is null
      expect(() => {
        renderToStaticMarkup(createElement(MessagePreview));
      }).not.toThrow();

      const html = renderToStaticMarkup(createElement(MessagePreview));
      expect(html).toContain("EmptyIdBot");
      expect(html).toContain("lucide-bot");
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     5. Container Layout, Drawer Toggles & Component Hierarchy
     ────────────────────────────────────────────────────────────────────────── */
  describe("5. Container Layout, Drawer Toggles & Tree Management", () => {
    it("handles deep component hierarchy with Container and Sections without recursion errors", () => {
      const store = useMessageStore.getState();

      const btn1 = { ...newButton(ButtonStyle.Primary), _id: "deep_btn_1" };
      const btn2 = { ...newButton(ButtonStyle.Secondary), _id: "deep_btn_2" };
      const row = {
        _id: "deep_row_1",
        type: ComponentType.ActionRow,
        components: [btn1, btn2],
      };
      const section = newSection([row]);
      const container = newContainer([section]);

      useMessageStore.setState({
        data: {
          content: "Nested container message",
          embeds: [],
          components: [container],
          username: "",
          avatar_url: "",
          thread_name: "",
        },
      });

      store.setMode(EDITOR_MODES.V2);
      const payload = store.getPayload();
      expect(payload.components).toBeDefined();
      expect(payload.components).toHaveLength(1);

      // Verify stripInternal cleanly removed _id at every level
      const stripped = stripInternal(container) as any;
      expect(stripped._id).toBeUndefined();
      expect(stripped.components[0]._id).toBeUndefined();
      expect(stripped.components[0].components[0]._id).toBeUndefined();
    });

    it("deleting a parent component cascades cleanup of active selection", () => {
      const store = useMessageStore.getState();
      const btn = { ...newButton(ButtonStyle.Primary), _id: "child_btn" };
      const row = {
        _id: "parent_row",
        type: ComponentType.ActionRow,
        components: [btn],
      };

      useMessageStore.setState({
        data: {
          content: "",
          embeds: [],
          components: [row],
          username: "",
          avatar_url: "",
          thread_name: "",
        },
      });

      // Select child
      store.select({ kind: "component", id: "child_btn" });
      expect(useMessageStore.getState().selection?.id).toBe("child_btn");

      // Remove parent row
      store.removeComponentById("parent_row");
      expect(useMessageStore.getState().data.components).toHaveLength(0);
      expect(useMessageStore.getState().selection).toBeNull();
    });

    it("duplicating component tree generates distinct unique IDs across all subnodes", () => {
      const store = useMessageStore.getState();
      const btn = { ...newButton(ButtonStyle.Primary), _id: "orig_btn" };
      const row = {
        _id: "orig_row",
        type: ComponentType.ActionRow,
        components: [btn],
      };

      useMessageStore.setState({
        data: {
          content: "",
          embeds: [],
          components: [row],
          username: "",
          avatar_url: "",
          thread_name: "",
        },
      });

      store.duplicateComponentById("orig_row");
      const components = useMessageStore.getState().data.components;
      expect(components).toHaveLength(2);

      const [c1, c2] = components;
      expect(c1._id).toBe("orig_row");
      expect(c2._id).not.toBe("orig_row");
      expect(c1.components?.[0]._id).toBe("orig_btn");
      expect(c2.components?.[0]._id).not.toBe("orig_btn");
      expect(c2.components?.[0]._id).toBeDefined();
    });

    it("verifies SplitPane clamp ratio mathematics under extreme boundaries", () => {
      const minRatio = 0.25;
      const maxRatio = 0.75;
      const clampRatio = (r: number) => Math.min(Math.max(r, minRatio), maxRatio);

      expect(clampRatio(-1.0)).toBe(0.25);
      expect(clampRatio(0.0)).toBe(0.25);
      expect(clampRatio(0.24)).toBe(0.25);
      expect(clampRatio(0.5)).toBe(0.5);
      expect(clampRatio(0.76)).toBe(0.75);
      expect(clampRatio(1.0)).toBe(0.75);
      expect(clampRatio(100.0)).toBe(0.75);
    });

    it("preserves high-density document (10 embeds and 25 buttons) across repeated mode switches", () => {
      const store = useMessageStore.getState();
      const embeds = Array.from({ length: 10 }, (_, i) => ({
        _id: `emb_${i}`,
        title: `Embed ${i}`,
        description: `Description ${i}`,
        fields: [{ _id: `f_${i}`, name: `Field ${i}`, value: `Val ${i}`, inline: false }],
      }));

      const components = Array.from({ length: 5 }, (_, r) => ({
        _id: `row_${r}`,
        type: ComponentType.ActionRow,
        components: Array.from({ length: 5 }, (_, b) => ({
          ...newButton(ButtonStyle.Primary),
          _id: `btn_${r}_${b}`,
          label: `Button ${r}-${b}`,
          custom_id: `btn_${r}_${b}`,
        })),
      }));

      useMessageStore.setState({
        data: {
          content: "Full capacity message",
          embeds: embeds as any,
          components: components as any,
          username: "MaxBot",
          avatar_url: "",
          thread_name: "",
        },
      });

      // Switch mode multiple times
      store.setMode(EDITOR_MODES.V2);
      expect(useMessageStore.getState().data.embeds).toHaveLength(10);
      expect(useMessageStore.getState().data.components).toHaveLength(5);
      expect(useMessageStore.getState().data.components[0].components).toHaveLength(5);

      store.setMode(EDITOR_MODES.CLASSIC);
      expect(useMessageStore.getState().data.embeds).toHaveLength(10);
      expect(useMessageStore.getState().data.components).toHaveLength(5);
      expect(useMessageStore.getState().data.components[4].components).toHaveLength(5);
    });
  });

  describe("6. Edge Vulnerability Reproduction: Malformed Snowflake Crash", () => {
    it("safely handles non-numeric botIdentity.id without throwing SyntaxError and falls back to default avatar", () => {
      useGlobalStore.getState().setBotIdentity({
        id: "invalid_non_numeric_snowflake",
        username: "CrashBot",
        avatar: null,
      });

      useMessageStore.setState({
        data: {
          content: "Triggering snowflake syntax error",
          embeds: [],
          components: [],
          username: "",
          avatar_url: "",
          thread_name: "",
        },
      });

      // MessagePreview.tsx safely guards against non-numeric botIdentity.id using regex and try/catch.
      // It does not throw SyntaxError and falls back to default avatar markup gracefully.
      expect(() => {
        const markup = renderToStaticMarkup(createElement(MessagePreview));
        expect(markup).toContain("CrashBot");
        expect(markup).not.toContain("https://cdn.discordapp.com/embed/avatars/");
      }).not.toThrow();
    });
  });
});
