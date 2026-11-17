import { describe, expect, it } from "vitest";
import { parseAllowedIds } from "../src/utils/requestParsing.js";

describe("request parsing helpers", () => {
  it("parses allowlists and filters non-string entries", () => {
    expect(parseAllowedIds('["*", "123", 42, null]')).toEqual(["*", "123"]);
    expect(parseAllowedIds("invalid json")).toEqual([]);
    expect(parseAllowedIds(null)).toEqual([]);
  });

  it("parses positive safe profile IDs and preserves null aliases", () => {
    expect(parseProfileId(undefined)).toBeNull();
    expect(parseProfileId("null")).toBeNull();
    expect(parseProfileId("12")).toBe(12);
    expect(parseProfileId("0")).toBeNull();
    expect(parseProfileId("not-a-number")).toBeNull();
  });

});
