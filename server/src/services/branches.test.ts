import { describe, expect, it } from "vitest";
import { hasBranches, readBranch, selectBranch } from "./branches.js";

/**
 * Branch parsing and selection.
 *
 * The `then` / `else` arrays are untrusted JSON on their way in from the editor,
 * and picking the wrong branch is the difference between a button working and a
 * flow silently doing the wrong thing — so both halves are pinned here, away from
 * the database the executor otherwise needs.
 */

const step = (type: string, config: Record<string, unknown> = {}) => ({ type, config });

describe("readBranch", () => {
  it("returns an empty list for non-arrays", () => {
    expect(readBranch(undefined)).toEqual([]);
    expect(readBranch(null)).toEqual([]);
    expect(readBranch("nope")).toEqual([]);
    expect(readBranch({ type: "dud" })).toEqual([]);
  });

  it("reads type and config, defaulting the id to null", () => {
    expect(readBranch([step("add_role", { roleId: "1" })])).toEqual([
      { id: null, type: "add_role", config: { roleId: "1" } },
    ]);
  });

  it("falls back to a dud for a non-string type and to {} for a non-object config", () => {
    expect(readBranch([{ type: 42, config: "bad" }])).toEqual([
      { id: null, type: "dud", config: {} },
    ]);
  });

  it("drops malformed entries instead of throwing", () => {
    const parsed = readBranch([null, "x", 7, [], step("stop")]);
    expect(parsed).toEqual([{ id: null, type: "stop", config: {} }]);
  });

  it("preserves a nested check's own branches", () => {
    const nested = step("check", {
      function: "equals",
      conditions: [{ a: "1", b: "1" }],
      then: [step("stop", { content: "yes" })],
      else: [],
    });
    const [parsed] = readBranch([nested]);
    expect(readBranch(parsed?.config.then)).toEqual([
      { id: null, type: "stop", config: { content: "yes" } },
    ]);
  });
});

describe("hasBranches", () => {
  it("is false when neither branch has steps", () => {
    expect(hasBranches({ function: "equals" })).toBe(false);
    expect(hasBranches({ then: [], else: [] })).toBe(false);
  });

  it("is true when either branch has a step", () => {
    expect(hasBranches({ else: [step("stop")] })).toBe(true);
    expect(hasBranches({ then: [step("stop")] })).toBe(true);
  });
});

describe("selectBranch", () => {
  const config = {
    function: "equals",
    conditions: [{ a: "{{flag}}", b: "on" }],
    then: [step("stop", { content: "on" })],
    else: [step("stop", { content: "off" })],
  };

  it("takes `then` when the condition passes", () => {
    const branch = selectBranch(config, { flag: "on" });
    expect(branch).toEqual([{ id: null, type: "stop", config: { content: "on" } }]);
  });

  it("takes `else` when the condition fails", () => {
    const branch = selectBranch(config, { flag: "off" });
    expect(branch).toEqual([{ id: null, type: "stop", config: { content: "off" } }]);
  });

  it("returns empty when the chosen branch is empty, so the flow falls through", () => {
    expect(selectBranch({ function: "equals", conditions: [], then: [] }, {})).toEqual([]);
  });
});
