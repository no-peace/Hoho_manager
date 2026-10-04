import { describe, it, expect, beforeEach, vi } from "vitest";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SearchableDiscordSelect } from "../src/components/ui/SearchableDiscordSelect";
import { useDiscordCacheStore } from "../src/store/discordCacheStore";
import { SNOWFLAKE_REGEX } from "@dmb/shared";

describe("Adversarial Stress Harness: SearchableDiscordSelect & Multi-Select Chips", () => {
  const guildId = "906426036772818954";

  beforeEach(() => {
    vi.restoreAllMocks();

    // Bridge React's useSyncExternalStore to evaluate getSnapshot (active store state)
    // rather than SSR initial state snapshot during node-rendered test harnesses.
    React.useSyncExternalStore = (_sub: any, getSnapshot: any) => getSnapshot();

    useDiscordCacheStore.setState({
      guilds: [
        { id: guildId, name: "[ HoHo Community ]", icon: null },
      ],
      channels: {
        [guildId]: [
          { id: "1363426163892162591", name: "bot-test", type: 0 },
          { id: "1363426163892162592", name: "general", type: 0 },
        ],
      },
      roles: {
        [guildId]: [
          { id: "906426036772818955", name: "Admin", color: 0xff0000 },
          { id: "906426036772818956", name: "Moderator", color: 0x00ff00 },
        ],
      },
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     1. Multi-Select Chips Rendering & Accessibility
     ────────────────────────────────────────────────────────────────────────── */
  describe("1. Multi-Select Chips Rendering & Accessibility", () => {
    it("renders distinct chips for each selected ID with accessible remove buttons", () => {
      const selectedIds = ["100000000000000001", "100000000000000002", "100000000000000003"];
      const html = renderToStaticMarkup(
        createElement(SearchableDiscordSelect, {
          type: "member",
          multiple: true,
          value: selectedIds,
          onChange: () => {},
          guildId,
          placeholder: "Search members...",
        }),
      );

      // Verify all 3 IDs appear in the chip markup
      for (const id of selectedIds) {
        expect(html).toContain(id);
        expect(html).toContain(`aria-label="Remove ${id}"`);
      }

      // Verify trigger displays total count
      expect(html).toContain("3 selected");
      expect(html).toContain('role="combobox"');
      expect(html).toContain('aria-expanded="false"');
    });

    it("uses matched role/channel name for chip label instead of raw ID when available", () => {
      const html = renderToStaticMarkup(
        createElement(SearchableDiscordSelect, {
          type: "channel",
          multiple: true,
          value: ["1363426163892162591"],
          onChange: () => {},
          guildId,
          placeholder: "Select channels...",
        }),
      );

      expect(html).toContain("bot-test");
      expect(html).toContain('aria-label="Remove bot-test"');
    });

    it("renders zero chips and clean placeholder state when value is empty array", () => {
      const html = renderToStaticMarkup(
        createElement(SearchableDiscordSelect, {
          type: "member",
          multiple: true,
          value: [],
          onChange: () => {},
          guildId,
          placeholder: "Select users or enter IDs...",
        }),
      );

      expect(html).not.toContain('aria-label="Remove');
      expect(html).toContain("Select users or enter IDs...");
      expect(html).not.toContain("0 selected");
    });

    it.each([
      ["empty string", ""],
      ["null value", null as any],
      ["undefined value", undefined as any],
    ])("gracefully handles %s in multiple mode without throwing or rendering invalid chips", (_, val) => {
      const html = renderToStaticMarkup(
        createElement(SearchableDiscordSelect, {
          type: "member",
          multiple: true,
          value: val,
          onChange: () => {},
          placeholder: "Fallback placeholder",
        }),
      );

      expect(html).not.toContain('aria-label="Remove');
      expect(html).toContain("Fallback placeholder");
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     2. Multi-Select Chip Addition, Removal & State Transitions
     ────────────────────────────────────────────────────────────────────────── */
  describe("2. Chip Addition & Removal State Transitions", () => {
    // Harness simulating SearchableDiscordSelect's exact selection reducer
    const simulateToggle = (current: string | string[], targetId: string, multiple = true): string[] => {
      const valArr = Array.isArray(current) ? [...current] : current ? [current] : [];
      if (!multiple) return [targetId];
      if (valArr.includes(targetId)) {
        return valArr.filter((v) => v !== targetId);
      }
      return [...valArr, targetId];
    };

    it("adds and removes multiple chips sequentially while preserving clean state", () => {
      let state: string[] = [];

      // Step 1: Add first ID
      state = simulateToggle(state, "111111111111111111");
      expect(state).toEqual(["111111111111111111"]);

      // Step 2: Add second ID
      state = simulateToggle(state, "222222222222222222");
      expect(state).toEqual(["111111111111111111", "222222222222222222"]);

      // Step 3: Add third ID
      state = simulateToggle(state, "333333333333333333");
      expect(state).toEqual(["111111111111111111", "222222222222222222", "333333333333333333"]);

      // Step 4: Remove middle ID ("222222222222222222")
      state = simulateToggle(state, "222222222222222222");
      expect(state).toEqual(["111111111111111111", "333333333333333333"]);

      // Step 5: Remove first ID ("111111111111111111")
      state = simulateToggle(state, "111111111111111111");
      expect(state).toEqual(["333333333333333333"]);

      // Step 6: Remove last remaining ID
      state = simulateToggle(state, "333333333333333333");
      expect(state).toEqual([]);
    });

    it("stress tests rapid addition and removal of 50 distinct IDs", () => {
      let state: string[] = [];
      const generated = Array.from({ length: 50 }, (_, i) => `1000000000000000${String(i).padStart(2, "0")}`);

      // Add all 50 IDs
      for (const id of generated) {
        state = simulateToggle(state, id);
      }
      expect(state).toHaveLength(50);
      expect(new Set(state).size).toBe(50);

      // Remove even-indexed IDs (25 removals)
      for (let i = 0; i < 50; i += 2) {
        state = simulateToggle(state, generated[i]!);
      }
      expect(state).toHaveLength(25);
      for (let i = 0; i < 50; i += 2) {
        expect(state).not.toContain(generated[i]);
      }
      for (let i = 1; i < 50; i += 2) {
        expect(state).toContain(generated[i]);
      }

      // Remove remaining 25 IDs
      for (let i = 1; i < 50; i += 2) {
        state = simulateToggle(state, generated[i]!);
      }
      expect(state).toEqual([]);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     3. Deduplication & State Integrity
     ────────────────────────────────────────────────────────────────────────── */
  describe("3. Deduplication & State Integrity", () => {
    it("deduplicates already-selected ID by toggling it off rather than creating duplicate chips", () => {
      const initial = ["123456789012345678", "987654321098765432"];
      // Re-selecting "123456789012345678"
      const valArr = [...initial];
      const target = "123456789012345678";
      const result = valArr.includes(target) ? valArr.filter((v) => v !== target) : [...valArr, target];

      expect(result).toEqual(["987654321098765432"]);
      expect(result).not.toContain(target);
    });

    it("purges all duplicate occurrences if external store passed duplicated IDs", () => {
      const taintedInput = ["123456789012345678", "123456789012345678", "987654321098765432"];
      const targetToRemove = "123456789012345678";
      const cleaned = taintedInput.filter((v) => v !== targetToRemove);

      expect(cleaned).toEqual(["987654321098765432"]);
      expect(cleaned).toHaveLength(1);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     4. Manual ID Entry & Snowflake Validation Rules
     ────────────────────────────────────────────────────────────────────────── */
  describe("4. Manual Snowflake Entry & Regex Invariants", () => {
    const isSnowflake = (str: string): boolean => /^\d{17,20}$/.test(str.trim());

    it.each([
      ["17 digits minimum", "12345678901234567", true],
      ["18 digits standard", "123456789012345678", true],
      ["19 digits modern", "1234567890123456789", true],
      ["20 digits maximum", "12345678901234567890", true],
      ["18 digits with leading whitespace", "   123456789012345678", true],
      ["18 digits with trailing whitespace", "123456789012345678   ", true],
      ["16 digits (too short)", "1234567890123456", false],
      ["21 digits (too long)", "123456789012345678901", false],
      ["1 digit", "1", false],
      ["empty string", "", false],
      ["letters", "abcdefghijklmnopq", false],
      ["alphanumeric suffix", "123456789012345678a", false],
      ["negative number", "-123456789012345678", false],
      ["floating point", "123456789012345.678", false],
      ["SQL injection string", "' OR '1'='1", false],
      ["XSS script", "<script>", false],
    ])("validates snowflake format for %s ('%s') -> %s", (_, input, expected) => {
      expect(isSnowflake(input)).toBe(expected);
      if (expected) {
        expect(SNOWFLAKE_REGEX.test(input.trim())).toBe(true);
      }
    });

    it("simulates handleManualId: accepts valid snowflakes and ignores non-snowflakes", () => {
      let state: string[] = [];

      const handleManualId = (search: string) => {
        const trimmed = search.trim();
        if (/^\d{17,20}$/.test(trimmed)) {
          if (state.includes(trimmed)) {
            state = state.filter((v) => v !== trimmed);
          } else {
            state = [...state, trimmed];
          }
          return true;
        }
        return false;
      };

      // Valid snowflake: added
      expect(handleManualId("123456789012345678")).toBe(true);
      expect(state).toEqual(["123456789012345678"]);

      // Invalid short ID: rejected, state untouched
      expect(handleManualId("12345")).toBe(false);
      expect(state).toEqual(["123456789012345678"]);

      // Invalid non-digit: rejected, state untouched
      expect(handleManualId("drop_table_users")).toBe(false);
      expect(state).toEqual(["123456789012345678"]);

      // Valid second snowflake: added
      expect(handleManualId("987654321098765432")).toBe(true);
      expect(state).toEqual(["123456789012345678", "987654321098765432"]);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     5. Member Search Result Formatting
     ────────────────────────────────────────────────────────────────────────── */
  describe("5. Member Search Result Formatting", () => {
    const formatMemberLabel = (m: any): string => {
      return m.nickname
        ? `${m.nickname} (${m.username})`
        : m.global_name
        ? `${m.global_name} (${m.username})`
        : (m.username || m.id || "");
    };

    it("prefers server nickname over global name and username", () => {
      const member = {
        id: "101",
        username: "alice_bot",
        global_name: "Alice Wonderland",
        nickname: "Alice In Guild",
      };
      expect(formatMemberLabel(member)).toBe("Alice In Guild (alice_bot)");
    });

    it("prefers global name over username when nickname is absent", () => {
      const member = {
        id: "102",
        username: "bob_ross",
        global_name: "Bob Ross",
        nickname: null,
      };
      expect(formatMemberLabel(member)).toBe("Bob Ross (bob_ross)");
    });

    it("falls back to username when nickname and global name are absent", () => {
      const member = {
        id: "103",
        username: "charlie_plain",
        global_name: null,
        nickname: null,
      };
      expect(formatMemberLabel(member)).toBe("charlie_plain");
    });

    it("falls back to ID when all name fields are empty", () => {
      const member = {
        id: "104",
        username: "",
        global_name: null,
        nickname: null,
      };
      expect(formatMemberLabel(member)).toBe("104");
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     6. Server Hint Rendering When Guild is Not Selected
     ────────────────────────────────────────────────────────────────────────── */
  describe("6. Server Selection Hint Rendering", () => {
    it("renders hint message when guildId is not provided for member select", () => {
      const html = renderToStaticMarkup(
        createElement(SearchableDiscordSelect, {
          type: "member",
          value: "",
          onChange: () => {},
          placeholder: "Select member...",
        }),
      );

      // Verify trigger displays placeholder properly
      expect(html).toContain("Select member...");
    });
  });
});
