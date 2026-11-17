import { describe, expect, it } from "vitest";
import { parseAllowedIds } from "../src/utils/requestParsing.js";

describe("request parsing helpers", () => {
  it("parses allowlists and filters non-string entries", () => {
    expect(parseAllowedIds('["*", "123", 42, null]')).toEqual(["*", "123"]);
    expect(parseAllowedIds("invalid json")).toEqual([]);
    expect(parseAllowedIds(null)).toEqual([]);
  });



});
