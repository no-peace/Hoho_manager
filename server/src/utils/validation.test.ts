import { describe, expect, it } from "vitest";
import { ButtonStyle, ComponentType, MessageFlags } from "@dmb/shared";
import { ApiError } from "./errors.js";
import { validateComponentsV2, validateMessagePayload } from "./validation.js";

/**
 * Validation is the last line of defence before Discord, and Discord's own
 * errors ("Invalid Form Body") are famously unhelpful — these tests pin the
 * behaviour of naming the offending field.
 */

const textDisplay = (content: string) => ({ type: ComponentType.TextDisplay, content });

const rowWithButton = (customId = "action:dud") => ({
  type: ComponentType.ActionRow,
  components: [{ type: ComponentType.Button, style: ButtonStyle.Primary, label: "Click", custom_id: customId }],
});

/**
 * The API's error *message* is a summary ("Message payload failed validation");
 * the per-field explanations live in `error.details`. Assert against those.
 */
const payloadErrorDetails = (payload: unknown): string[] => {
  try {
    validateMessagePayload(payload);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return (error as ApiError).details as string[];
  }
  throw new Error("expected validateMessagePayload to throw");
};

const expectDetail = (payload: unknown, pattern: RegExp): void => {
  expect(payloadErrorDetails(payload).some((detail) => pattern.test(detail))).toBe(true);
};

describe("validateMessagePayload — classic fields", () => {
  it("accepts a plain content message", () => {
    expect(() => validateMessagePayload({ content: "hello" })).not.toThrow();
  });

  it("rejects a non-object payload", () => {
    expect(() => validateMessagePayload("hello")).toThrow(ApiError);
    expect(() => validateMessagePayload(null)).toThrow(ApiError);
    expect(() => validateMessagePayload([1, 2])).toThrow(ApiError);
  });

  it("rejects oversized content", () => {
    expectDetail({ content: "x".repeat(2001) }, /exceeds 2000/);
  });

  it("rejects too many embeds and oversized embed fields", () => {
    expectDetail({ embeds: Array.from({ length: 11 }, () => ({})) }, /at most 10 embeds/);
    expectDetail({ embeds: [{ title: "x".repeat(257) }] }, /title exceeds/);
    expectDetail({ embeds: [{ description: "x".repeat(4097) }] }, /description exceeds/);
  });

  it("rejects a non-array components field", () => {
    expectDetail({ components: "nope" }, /`components` must be an array/);
  });
});

describe("validateMessagePayload — Components V2 exclusivity", () => {
  it("accepts a V2 payload with the flag and no classic fields", () => {
    expect(() =>
      validateMessagePayload({
        flags: MessageFlags.IsComponentsV2,
        components: [textDisplay("v2 content")],
      }),
    ).not.toThrow();
  });

  it("rejects content alongside Components V2", () => {
    expectDetail(
      {
        flags: MessageFlags.IsComponentsV2,
        content: "classic",
        components: [textDisplay("v2")],
      },
      /content cannot be used together with Components V2/,
    );
  });

  it("rejects embeds alongside Components V2", () => {
    expectDetail(
      {
        flags: MessageFlags.IsComponentsV2,
        embeds: [{ title: "x" }],
        components: [textDisplay("v2")],
      },
      /embeds cannot be used together with Components V2/,
    );
  });
});

describe("validateComponentsV2 — structure", () => {
  it("accepts a valid container tree", () => {
    const tree = [
      {
        type: ComponentType.Container,
        components: [
          textDisplay("text"),
          rowWithButton(),
          { type: ComponentType.Separator, spacing: 1 },
        ],
      },
    ];
    expect(validateComponentsV2(tree)).toEqual([]);
  });

  it("rejects a Button at the top level", () => {
    const errors = validateComponentsV2([
      { type: ComponentType.Button, style: ButtonStyle.Primary, label: "x", custom_id: "a" },
    ]);
    expect(errors.some((e) => e.includes("not allowed at the top level"))).toBe(true);
  });

  it("rejects a non-integer component type", () => {
    const errors = validateComponentsV2([{ type: 999 }]);
    expect(errors.some((e) => e.includes("not allowed at the top level"))).toBe(true);
  });

  it("rejects more than 40 components", () => {
    const tree = Array.from({ length: 41 }, () => textDisplay("x"));
    const errors = validateComponentsV2(tree);
    expect(errors.some((e) => e.includes("more than 40 components"))).toBe(true);
  });

  it("rejects a Section accessory that is not a Thumbnail or Button", () => {
    const errors = validateComponentsV2([
      {
        type: ComponentType.Section,
        components: [textDisplay("text")],
        accessory: { type: ComponentType.Separator },
      },
    ]);
    expect(errors.some((e) => e.includes("accessory"))).toBe(true);
  });

  it("rejects a Section without an accessory", () => {
    const errors = validateComponentsV2([
      { type: ComponentType.Section, components: [textDisplay("text")] },
    ]);
    expect(errors.some((e) => e.includes("requires an `accessory`"))).toBe(true);
  });

  it("rejects a Separator with bad spacing", () => {
    const errors = validateComponentsV2([{ type: ComponentType.Separator, spacing: 5 }]);
    expect(errors.some((e) => e.includes("spacing"))).toBe(true);
  });
});

describe("validateComponentsV2 — interactive components", () => {
  it("rejects a button missing a custom_id", () => {
    const errors = validateComponentsV2([
      {
        type: ComponentType.ActionRow,
        components: [{ type: ComponentType.Button, style: ButtonStyle.Primary, label: "x" }],
      },
    ]);
    expect(errors.some((e) => e.includes("custom_id"))).toBe(true);
  });

  it("rejects an oversized custom_id", () => {
    const errors = validateComponentsV2([rowWithButton("x".repeat(101))]);
    expect(errors.some((e) => e.includes("custom_id exceeds 100"))).toBe(true);
  });

  it("accepts a link button with a url and no custom_id", () => {
    const errors = validateComponentsV2([
      {
        type: ComponentType.ActionRow,
        components: [
          { type: ComponentType.Button, style: ButtonStyle.Link, label: "Docs", url: "https://example.com" },
        ],
      },
    ]);
    expect(errors).toEqual([]);
  });

  it("rejects a link button without a valid url", () => {
    const errors = validateComponentsV2([
      {
        type: ComponentType.ActionRow,
        components: [{ type: ComponentType.Button, style: ButtonStyle.Link, label: "Docs" }],
      },
    ]);
    expect(errors.some((e) => e.includes("Link buttons require"))).toBe(true);
  });

  it("rejects an oversized label", () => {
    const errors = validateComponentsV2([
      {
        type: ComponentType.ActionRow,
        components: [
          { type: ComponentType.Button, style: ButtonStyle.Primary, label: "x".repeat(81), custom_id: "a" },
        ],
      },
    ]);
    expect(errors.some((e) => e.includes("label exceeds 80"))).toBe(true);
  });

  it("rejects a button directly at the top level of a row-less tree", () => {
    // Buttons must be inside an ActionRow, even inside a Container.
    const errors = validateComponentsV2([
      {
        type: ComponentType.Container,
        components: [{ type: ComponentType.Button, style: ButtonStyle.Primary, label: "x", custom_id: "a" }],
      },
    ]);
    expect(errors.some((e) => e.includes("must be inside an ActionRow"))).toBe(true);
  });

  it("rejects a select with more than 25 options", () => {
    const options = Array.from({ length: 26 }, (_, i) => ({ label: `o${i}`, value: `v${i}` }));
    const errors = validateComponentsV2([
      {
        type: ComponentType.ActionRow,
        components: [{ type: ComponentType.StringSelect, custom_id: "a", options }],
      },
    ]);
    expect(errors.some((e) => e.includes("25 options"))).toBe(true);
  });

  it("rejects select options with missing or oversized labels", () => {
    const errors = validateComponentsV2([
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.StringSelect,
            custom_id: "a",
            options: [{ label: "", value: "v" }, { label: "ok", value: "x".repeat(101) }],
          },
        ],
      },
    ]);
    expect(errors.some((e) => e.includes("options[0].label"))).toBe(true);
    expect(errors.some((e) => e.includes("options[1].value"))).toBe(true);
  });

  it("rejects a bad placeholder", () => {
    const errors = validateComponentsV2([
      {
        type: ComponentType.ActionRow,
        components: [
          { type: ComponentType.StringSelect, custom_id: "a", options: [], placeholder: "x".repeat(151) },
        ],
      },
    ]);
    expect(errors.some((e) => e.includes("placeholder exceeds 150"))).toBe(true);
  });

  it("rejects a TextDisplay with empty or oversized content", () => {
    expect(validateComponentsV2([textDisplay("   ")]).some((e) => e.includes("non-empty"))).toBe(true);
    expect(
      validateComponentsV2([textDisplay("x".repeat(4001))]).some((e) =>
        e.includes("exceeds 4000 characters"),
      ),
    ).toBe(true);
  });
});
