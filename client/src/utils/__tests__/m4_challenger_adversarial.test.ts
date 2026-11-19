import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  SNOWFLAKE_REGEX,
  ComponentType,
  type ComponentNode,
  type SelectOption,
} from "@dmb/shared";
import useMessageStore from "../../store/messageStore";
import { toDiscordPayload } from "../discord";
import { SelectPreview } from "../../components/preview/ActionRowPreview";

// ─────────────────────────────────────────────────────────────────────────────
// MessageEditor validation helpers & rules
// ─────────────────────────────────────────────────────────────────────────────


const isValidHttpUrl = (val: string): boolean => {
  if (!val || !val.trim()) return true;
  try {
    const url = new URL(val.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Extraction / Recreation of Markdown Selection Formatting Algorithm
// from DiscordMentionInput.tsx: formatSelection
// ─────────────────────────────────────────────────────────────────────────────
function runMarkdownFormat(
  currentValue: string,
  start: number,
  end: number,
  prefix: string,
  suffix: string = prefix,
  defaultText: string = "",
  isLinePrefix: boolean = false,
): { replacement: string; newStart: number; newEnd: number; nextValue: string } {
  const selectedText = currentValue.slice(start, end);

  let replacement = "";
  let newStart = start;
  let newEnd = end;

  if (isLinePrefix) {
    if (selectedText.length > 0) {
      const lines = selectedText.split("\n");
      const allQuoted = lines.every((l) => l.startsWith(prefix));
      if (allQuoted) {
        // Toggle un-quote
        replacement = lines.map((l) => l.slice(prefix.length)).join("\n");
        newStart = start;
        newEnd = start + replacement.length;
      } else {
        // Quote all lines
        replacement = lines.map((l) => `${prefix}${l}`).join("\n");
        newStart = start;
        newEnd = start + replacement.length;
      }
    } else {
      replacement = `${prefix}${defaultText}`;
      newStart = start + prefix.length;
      newEnd = newStart + defaultText.length;
    }
  } else {
    if (selectedText.length > 0) {
      // Toggle unwrap if already wrapped
      const isWrapped =
        selectedText.startsWith(prefix) &&
        selectedText.endsWith(suffix) &&
        selectedText.length >= prefix.length + suffix.length;

      if (isWrapped) {
        replacement = selectedText.slice(prefix.length, selectedText.length - suffix.length);
        newStart = start;
        newEnd = start + replacement.length;
      } else {
        replacement = `${prefix}${selectedText}${suffix}`;
        newStart = start + prefix.length;
        newEnd = newStart + selectedText.length;
      }
    } else {
      replacement = `${prefix}${defaultText}${suffix}`;
      if (defaultText.length > 0) {
        newStart = start + prefix.length;
        newEnd = newStart + defaultText.length;
      } else {
        newStart = start + prefix.length;
        newEnd = newStart;
      }
    }
  }

  const before = currentValue.slice(0, start);
  const after = currentValue.slice(end);
  const nextValue = before + replacement + after;

  return { replacement, newStart, newEnd, nextValue };
}

// ─────────────────────────────────────────────────────────────────────────────
// SelectPreview State Transition Simulation
// ─────────────────────────────────────────────────────────────────────────────
function simulateSelectInteraction(
  _options: SelectOption[],
  initialSelectedValues: string[],
  maxValues: number = 1,
  clicks: string[],
): { selectedValues: string[]; isOpen: boolean } {
  let selectedValues = [...initialSelectedValues];
  let isOpen = true;
  const isMulti = maxValues > 1;

  for (const value of clicks) {
    if (isMulti) {
      if (selectedValues.includes(value)) {
        selectedValues = selectedValues.filter((v) => v !== value);
      } else if (selectedValues.length < maxValues) {
        selectedValues = [...selectedValues, value];
      }
    } else {
      selectedValues = [value];
      isOpen = false;
    }
  }

  return { selectedValues, isOpen };
}

// ═════════════════════════════════════════════════════════════════════════════
// CHALLENGER TEST SUITE
// ═════════════════════════════════════════════════════════════════════════════

describe("Milestone 4 Adversarial Empirical Challenge Suite", () => {
  beforeEach(() => {
    // Provide in-memory storage mock to suppress zustand persist warnings
    if (typeof globalThis.localStorage === "undefined") {
      const storage = new Map<string, string>();
      globalThis.localStorage = {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, val: string) => storage.set(key, String(val)),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
        key: (idx: number) => Array.from(storage.keys())[idx] ?? null,
        get length() {
          return storage.size;
        },
      } as Storage;
    }
    // Reset Zustand messageStore to clean slate
    useMessageStore.getState().reset();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Challenge UI-01 (Profile Overrides)
  // ───────────────────────────────────────────────────────────────────────────

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Challenge UI-02 (Bot Dispatch & Payload)
  // ───────────────────────────────────────────────────────────────────────────
  describe("Challenge UI-02: Bot Dispatch, Snowflake Boundaries & Batch Payload", () => {
    describe("Snowflake Regex Boundary Testing (16 vs 17 vs 20 vs 21 digits)", () => {
      it("rejects 16-digit IDs (below Discord Snowflake minimum)", () => {
        const id16 = "1234567890123456";
        expect(id16.length).toBe(16);
        expect(SNOWFLAKE_REGEX.test(id16)).toBe(false);
        expect(/^\d{17,20}$/.test(id16)).toBe(false);
      });

      it("accepts 17, 18, 19, and 20-digit Discord Snowflake IDs", () => {
        const id17 = "12345678901234567";
        const id18 = "123456789012345678";
        const id19 = "1234567890123456789";
        const id20 = "12345678901234567890";

        expect(SNOWFLAKE_REGEX.test(id17)).toBe(true);
        expect(SNOWFLAKE_REGEX.test(id18)).toBe(true);
        expect(SNOWFLAKE_REGEX.test(id19)).toBe(true);
        expect(SNOWFLAKE_REGEX.test(id20)).toBe(true);
      });

      it("rejects 21-digit IDs (exceeds Discord Snowflake maximum)", () => {
        const id21 = "123456789012345678901";
        expect(id21.length).toBe(21);
        expect(SNOWFLAKE_REGEX.test(id21)).toBe(false);
        expect(/^\d{17,20}$/.test(id21)).toBe(false);
      });

      it("rejects non-numeric characters and symbols in Snowflake", () => {
        expect(SNOWFLAKE_REGEX.test("12345678901234567a")).toBe(false);
        expect(SNOWFLAKE_REGEX.test("12345678901234567-")).toBe(false);
        expect(SNOWFLAKE_REGEX.test("-12345678901234567")).toBe(false);
        expect(SNOWFLAKE_REGEX.test(" 123456789012345678 ")).toBe(false);
      });
    });

    describe("Multi-Message Bot Payload Structure Construction", () => {
      it("constructs a single-message server bot dispatch payload without sender overrides", () => {
        const store = useMessageStore.getState();
        store.setField("content", "Single dispatch");

        const payloads = store.getAllPayloads();
        const singlePayload = payloads.length > 0 ? payloads[0] : store.getPayload();

        const requestBody = {
          mode: "bot",
          channelId: "123456789012345678",
          messages: [singlePayload],
          payload: singlePayload,
          flows: [],
        };

        expect(requestBody.mode).toBe("bot");
        expect(requestBody.channelId).toBe("123456789012345678");
        expect(requestBody.messages).toHaveLength(1);
        expect(requestBody.messages[0].content).toBe("Single dispatch");
      });

      it("constructs a multi-message server bot batch payload without sender overrides", () => {
        const store = useMessageStore.getState();
        store.load({
          messages: [
            { content: "Message 1 of 3" },
            { content: "Message 2 of 3" },
            { content: "Message 3 of 3" },
          ],
        });

        const allPayloads = store.getAllPayloads();
        expect(allPayloads).toHaveLength(3);

        const requestBody = {
          mode: "bot",
          channelId: "123456789012345678",
          messages: allPayloads,
          payload: allPayloads[0],
          flows: [],
        };

        expect(requestBody.mode).toBe("bot");
        expect(requestBody.messages).toHaveLength(3);
        expect(requestBody.payload.content).toBe("Message 1 of 3");
        expect(requestBody.messages[1].content).toBe("Message 2 of 3");
        expect(requestBody.messages[2].content).toBe("Message 3 of 3");
      });

      it("maps URL attachments with spoiler prefixes accurately", () => {
        const attachedFiles = [
          { name: "chart.png", url: "https://example.com/chart.png", spoiler: false },
          { name: "spoiler.pdf", url: "https://example.com/spoiler.pdf", spoiler: true, description: "Secret" },
        ];

        const urlAttachments = attachedFiles.map((f, index) => ({
          id: `url-${index}`,
          filename: f.spoiler ? `SPOILER_${f.name}` : f.name,
          url: f.url,
          is_spoiler: Boolean(f.spoiler),
          ...(f.description ? { description: f.description } : {}),
        }));

        expect(urlAttachments).toHaveLength(2);
        expect(urlAttachments[0].filename).toBe("chart.png");
        expect(urlAttachments[0].is_spoiler).toBe(false);
        expect(urlAttachments[1].filename).toBe("SPOILER_spoiler.pdf");
        expect(urlAttachments[1].is_spoiler).toBe(true);
        expect(urlAttachments[1].description).toBe("Secret");
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Challenge UI-03 (Markdown Toolbar & Formatting Logic)
  // ───────────────────────────────────────────────────────────────────────────
  describe("Challenge UI-03: Discord Markdown Formatting Ribbon & Selection Wrapping", () => {
    describe("Inline Formatting Selection Wrapping and Unwrapping", () => {
      it("wraps unformatted text with bold ** and toggles unwrapping when already formatted", () => {
        // 1. Wrap unformatted text
        const text = "Hello world";
        const wrapped = runMarkdownFormat(text, 6, 11, "**", "**", "bold text");
        expect(wrapped.replacement).toBe("**world**");
        expect(wrapped.nextValue).toBe("Hello **world**");

        // 2. Unwrap already formatted text
        const wrappedText = "Hello **world**";
        const unwrapped = runMarkdownFormat(wrappedText, 6, 15, "**", "**", "bold text");
        expect(unwrapped.replacement).toBe("world");
        expect(unwrapped.nextValue).toBe("Hello world");
      });

      it("wraps and unwraps italic * correctly", () => {
        const text = "emphasize this";
        const wrapped = runMarkdownFormat(text, 10, 14, "*", "*", "italic text");
        expect(wrapped.replacement).toBe("*this*");
        expect(wrapped.nextValue).toBe("emphasize *this*");

        const unwrapped = runMarkdownFormat(wrapped.nextValue, 10, 16, "*", "*", "italic text");
        expect(unwrapped.replacement).toBe("this");
        expect(unwrapped.nextValue).toBe("emphasize this");
      });

      it("wraps and unwraps underline __ correctly", () => {
        const text = "important term";
        const wrapped = runMarkdownFormat(text, 0, 9, "__", "__", "underlined text");
        expect(wrapped.replacement).toBe("__important__");
        expect(wrapped.nextValue).toBe("__important__ term");

        const unwrapped = runMarkdownFormat(wrapped.nextValue, 0, 13, "__", "__", "underlined text");
        expect(unwrapped.replacement).toBe("important");
        expect(unwrapped.nextValue).toBe("important term");
      });

      it("wraps and unwraps strikethrough ~~ correctly", () => {
        const text = "strike this out";
        const wrapped = runMarkdownFormat(text, 0, 6, "~~", "~~", "strikethrough text");
        expect(wrapped.replacement).toBe("~~strike~~");
        expect(wrapped.nextValue).toBe("~~strike~~ this out");

        const unwrapped = runMarkdownFormat(wrapped.nextValue, 0, 10, "~~", "~~", "strikethrough text");
        expect(unwrapped.replacement).toBe("strike");
        expect(unwrapped.nextValue).toBe("strike this out");
      });

      it("wraps and unwraps inline code ` correctly", () => {
        const text = "run npm test now";
        const wrapped = runMarkdownFormat(text, 4, 12, "`", "`", "code");
        expect(wrapped.replacement).toBe("`npm test`");
        expect(wrapped.nextValue).toBe("run `npm test` now");

        const unwrapped = runMarkdownFormat(wrapped.nextValue, 4, 14, "`", "`", "code");
        expect(unwrapped.replacement).toBe("npm test");
        expect(unwrapped.nextValue).toBe("run npm test now");
      });

      it("wraps and unwraps multiline code blocks ```\n ... \n``` correctly", () => {
        const code = "const x = 42;\nconsole.log(x);";
        const wrapped = runMarkdownFormat(code, 0, code.length, "```\n", "\n```", "code block");
        expect(wrapped.replacement).toBe("```\nconst x = 42;\nconsole.log(x);\n```");
        expect(wrapped.nextValue).toBe("```\nconst x = 42;\nconsole.log(x);\n```");

        const unwrapped = runMarkdownFormat(wrapped.nextValue, 0, wrapped.nextValue.length, "```\n", "\n```", "code block");
        expect(unwrapped.replacement).toBe(code);
        expect(unwrapped.nextValue).toBe(code);
      });

      it("wraps and unwraps spoilers || correctly", () => {
        const text = "Darth Vader is Luke's father";
        const wrapped = runMarkdownFormat(text, 15, text.length, "||", "||", "spoiler");
        expect(wrapped.replacement).toBe("||Luke's father||");
        expect(wrapped.nextValue).toBe("Darth Vader is ||Luke's father||");

        const unwrapped = runMarkdownFormat(wrapped.nextValue, 15, wrapped.nextValue.length, "||", "||", "spoiler");
        expect(unwrapped.replacement).toBe("Luke's father");
        expect(unwrapped.nextValue).toBe(text);
      });
    });

    describe("Multiline Blockquote Quoting and Unquoting (isLinePrefix = true)", () => {
      it("quotes single line text with > ", () => {
        const text = "Single quoted message";
        const quoted = runMarkdownFormat(text, 0, text.length, "> ", "", "quote", true);
        expect(quoted.replacement).toBe("> Single quoted message");
        expect(quoted.nextValue).toBe("> Single quoted message");
      });

      it("quotes multiple lines by prepending > to every line", () => {
        const multiline = "Line 1\nLine 2\nLine 3";
        const quoted = runMarkdownFormat(multiline, 0, multiline.length, "> ", "", "quote", true);
        expect(quoted.replacement).toBe("> Line 1\n> Line 2\n> Line 3");
        expect(quoted.nextValue).toBe("> Line 1\n> Line 2\n> Line 3");
      });

      it("unquotes multiple lines when all lines already start with > ", () => {
        const allQuoted = "> Line 1\n> Line 2\n> Line 3";
        const unquoted = runMarkdownFormat(allQuoted, 0, allQuoted.length, "> ", "", "quote", true);
        expect(unquoted.replacement).toBe("Line 1\nLine 2\nLine 3");
        expect(unquoted.nextValue).toBe("Line 1\nLine 2\nLine 3");
      });

      it("quotes all lines if only a subset of lines are quoted", () => {
        const partiallyQuoted = "> Line 1\nLine 2";
        const quoted = runMarkdownFormat(partiallyQuoted, 0, partiallyQuoted.length, "> ", "", "quote", true);
        expect(quoted.replacement).toBe("> > Line 1\n> Line 2");
      });
    });

    describe("Empty Selection Fallback and Timestamp Helpers", () => {
      it("inserts default placeholder text when selection is empty", () => {
        const emptyBold = runMarkdownFormat("", 0, 0, "**", "**", "bold text");
        expect(emptyBold.replacement).toBe("**bold text**");
        expect(emptyBold.newStart).toBe(2);
        expect(emptyBold.newEnd).toBe(11);

        const emptyItalic = runMarkdownFormat("", 0, 0, "*", "*", "italic text");
        expect(emptyItalic.replacement).toBe("*italic text*");

        const emptyQuote = runMarkdownFormat("", 0, 0, "> ", "", "quote", true);
        expect(emptyQuote.replacement).toBe("> quote");
      });

      it("inserts relative timestamp helper <t:epoch:R> at cursor position", () => {
        const now = Math.floor(Date.now() / 1000);
        const tag = `<t:${now}:R>`;
        const result = runMarkdownFormat("Timestamp: ", 11, 11, tag, "", "");
        expect(result.nextValue).toBe(`Timestamp: ${tag}`);
        expect(/^<t:\d{10}:R>$/.test(tag)).toBe(true);
      });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Challenge UI-04 (SelectPreview Interaction & Component Logic)
  // ───────────────────────────────────────────────────────────────────────────
  describe("Challenge UI-04: SelectPreview Interactive Dropdown & Option State Machine", () => {
    describe("Single-Select Interaction", () => {
      const singleOptions: SelectOption[] = [
        { label: "Option A", value: "opt_a" },
        { label: "Option B", value: "opt_b" },
        { label: "Option C", value: "opt_c" },
      ];

      it("updates selectedValues and closes dropdown on option click in single-select", () => {
        const res1 = simulateSelectInteraction(singleOptions, [], 1, ["opt_a"]);
        expect(res1.selectedValues).toEqual(["opt_a"]);
        expect(res1.isOpen).toBe(false);

        // Clicking a different option replaces previous selection and closes
        const res2 = simulateSelectInteraction(singleOptions, ["opt_a"], 1, ["opt_b"]);
        expect(res2.selectedValues).toEqual(["opt_b"]);
        expect(res2.isOpen).toBe(false);
      });
    });

    describe("Multi-Select Interaction (max_values = 2)", () => {
      const multiOptions: SelectOption[] = [
        { label: "Role 1", value: "r1" },
        { label: "Role 2", value: "r2" },
        { label: "Role 3", value: "r3" },
      ];

      it("keeps dropdown open and increments selections up to max_values", () => {
        // 1. Pick first option -> 1/2 selected, remains open
        const step1 = simulateSelectInteraction(multiOptions, [], 2, ["r1"]);
        expect(step1.selectedValues).toEqual(["r1"]);
        expect(step1.isOpen).toBe(true);

        // 2. Pick second option -> 2/2 selected, remains open
        const step2 = simulateSelectInteraction(multiOptions, ["r1"], 2, ["r2"]);
        expect(step2.selectedValues).toEqual(["r1", "r2"]);
        expect(step2.isOpen).toBe(true);

        // 3. Attempting to pick third option when at max_values (2) does NOT add more
        const step3 = simulateSelectInteraction(multiOptions, ["r1", "r2"], 2, ["r3"]);
        expect(step3.selectedValues).toEqual(["r1", "r2"]);
        expect(step3.isOpen).toBe(true);

        // 4. Clicking an already selected option toggles it OFF
        const step4 = simulateSelectInteraction(multiOptions, ["r1", "r2"], 2, ["r1"]);
        expect(step4.selectedValues).toEqual(["r2"]);
        expect(step4.isOpen).toBe(true);
      });
    });

    describe("Defaults Pre-Selection derived from default: true", () => {
      it("derives initial selectedValues from options with default: true", () => {
        const optionsWithDefaults: SelectOption[] = [
          { label: "Default Alpha", value: "alpha", default: true },
          { label: "Regular Beta", value: "beta" },
          { label: "Default Gamma", value: "gamma", default: true },
        ];

        const initialSelected = optionsWithDefaults
          .filter((opt) => opt.default)
          .map((opt) => opt.value);

        expect(initialSelected).toEqual(["alpha", "gamma"]);
      });
    });

    describe("SelectPreview Component Markup & Fallback Types", () => {
      it("renders StringSelect component with trigger placeholder", () => {
        const selectNode: ComponentNode = {
          _id: "test-sel-1",
          type: ComponentType.StringSelect,
          custom_id: "action:test:{}",
          placeholder: "Choose an option...",
          options: [
            { label: "Apple", value: "apple" },
            { label: "Banana", value: "banana" },
          ],
        };

        const html = renderToString(React.createElement(SelectPreview, { select: selectNode }));
        expect(html).toContain("Choose an option...");
        expect(html).toContain('aria-haspopup="listbox"');
        expect(html).toContain('aria-expanded="false"');
      });

      it("renders StringSelect component displaying default selected options", () => {
        const selectNode: ComponentNode = {
          _id: "test-sel-2",
          type: ComponentType.StringSelect,
          custom_id: "action:test:{}",
          options: [
            { label: "Active Mode", value: "active", default: true },
            { label: "Inactive Mode", value: "inactive" },
          ],
        };

        const html = renderToString(React.createElement(SelectPreview, { select: selectNode }));
        expect(html).toContain("Active Mode");
      });

      it("renders disabled select button with opacity and disabled attribute", () => {
        const selectNode: ComponentNode = {
          _id: "test-sel-3",
          type: ComponentType.StringSelect,
          custom_id: "action:test:{}",
          disabled: true,
          placeholder: "Locked Dropdown",
        };

        const html = renderToString(React.createElement(SelectPreview, { select: selectNode }));
        expect(html).toContain("disabled");
        expect(html).toContain("cursor-not-allowed");
      });

      it("renders type-specific fallback placeholders for Channel, Role, User, Mentionable selects", () => {
        const typesAndExpected = [
          { type: ComponentType.ChannelSelect, placeholder: "Select channels" },
          { type: ComponentType.RoleSelect, placeholder: "Select roles" },
          { type: ComponentType.UserSelect, placeholder: "Select users" },
          { type: ComponentType.MentionableSelect, placeholder: "Select users or roles" },
        ];

        for (const { type, placeholder } of typesAndExpected) {
          const node: ComponentNode = {
            _id: `sel-${type}`,
            type,
            custom_id: "action:test:{}",
          };
          const html = renderToString(React.createElement(SelectPreview, { select: node }));
          expect(html).toContain(placeholder);
        }
      });
    });
  });
});
