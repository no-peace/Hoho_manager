import { describe, expect, it } from "vitest";
import { Limits } from "./constants.js";
import { buildCustomId, describeCustomId, parseCustomId } from "./customId.js";

/**
 * The custom-id codec is the contract between the editor and the interaction
 * endpoint — if these break, every button in every message breaks with it.
 */
describe("buildCustomId", () => {
  it("builds a bare action id with no params", () => {
    expect(buildCustomId("dud")).toBe("action:dud");
  });

  it("builds an id with JSON params", () => {
    expect(buildCustomId("add_role", { roleId: "123" })).toBe(
      `action:add_role:${JSON.stringify({ roleId: "123" })}`,
    );
  });

  it("omits empty param objects", () => {
    expect(buildCustomId("delete_message", {})).toBe("action:delete_message");
  });

  it("throws when the result would exceed Discord's 100-char limit", () => {
    const long = "x".repeat(Limits.components.customId);
    expect(() => buildCustomId("send_dm", { content: long })).toThrow(/100-char|100 limit|over Discord/i);
  });

  it("accepts an id exactly at the 100-char limit", () => {
    // `action:dud:` is 11 chars; JSON.stringify({v:X}) = {"v":"X"} adds 8 chars
    // of syntax (braces, key, its quotes, colon, value quotes) around X.
    const budget = Limits.components.customId - "action:dud:".length - 8;
    const id = buildCustomId("dud", { v: "x".repeat(budget) });
    expect(id.length).toBe(Limits.components.customId);
  });
});

describe("parseCustomId", () => {
  it("round-trips what buildCustomId produced", () => {
    const id = buildCustomId("toggle_role", { roleId: "42" });
    expect(parseCustomId(id)).toEqual({ type: "toggle_role", params: { roleId: "42" } });
  });

  it("parses a bare id to empty params", () => {
    expect(parseCustomId("action:dud")).toEqual({ type: "dud", params: {} });
  });

  it("returns null for foreign ids", () => {
    expect(parseCustomId("modal:about")).toBeNull();
    expect(parseCustomId("something-else")).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(parseCustomId(undefined)).toBeNull();
    expect(parseCustomId(null)).toBeNull();
    expect(parseCustomId(123)).toBeNull();
    expect(parseCustomId({})).toBeNull();
  });

  it("returns null for malformed JSON params rather than throwing", () => {
    expect(parseCustomId("action:dud:{not json")).toBeNull();
  });

  it("treats JSON params that are not objects as empty", () => {
    // Arrays and primitives parse fine but carry no key/value params.
    expect(parseCustomId("action:dud:[1,2]")).toEqual({ type: "dud", params: {} });
    expect(parseCustomId("action:dud:null")).toEqual({ type: "dud", params: {} });
    expect(parseCustomId('action:dud:"str"')).toEqual({ type: "dud", params: {} });
    expect(parseCustomId("action:dud:123")).toEqual({ type: "dud", params: {} });
  });

  it("handles param values containing the separator", () => {
    // JSON content can contain colons; only the FIRST one after the prefix delimits the type.
    const id = buildCustomId("send_dm", { content: "a:b:c" });
    expect(parseCustomId(id)).toEqual({ type: "send_dm", params: { content: "a:b:c" } });
  });
});

describe("describeCustomId", () => {
  it("humanises the action type", () => {
    expect(describeCustomId("action:add_role:{}")).toBe("Add role");
  });

  it("reports 'No action' for foreign or malformed ids", () => {
    expect(describeCustomId("webhook-thing")).toBe("No action");
    expect(describeCustomId(undefined)).toBe("No action");
  });
});
