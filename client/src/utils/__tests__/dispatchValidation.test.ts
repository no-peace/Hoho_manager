import { describe, expect, it } from "vitest";
import { parseEditTargetMessageIds } from "../dispatchValidation";

describe("parseEditTargetMessageIds", () => {
  it("maps one snowflake to one selected channel", () => {
    expect(parseEditTargetMessageIds("123456789012345678", 1)).toEqual({
      valid: true,
      ids: ["123456789012345678"],
    });
  });

  it("maps comma-separated IDs in selected-channel order", () => {
    expect(parseEditTargetMessageIds("123456789012345678, 223456789012345678", 2)).toEqual({
      valid: true,
      ids: ["123456789012345678", "223456789012345678"],
    });
  });

  it("rejects a missing or mismatched number of IDs", () => {
    expect(parseEditTargetMessageIds("", 1).valid).toBe(false);
    expect(parseEditTargetMessageIds("123456789012345678", 2)).toMatchObject({
      valid: false,
      message: expect.stringContaining("exactly 2"),
    });
  });

  it("rejects non-snowflake and duplicate IDs", () => {
    expect(parseEditTargetMessageIds("not-an-id", 1).valid).toBe(false);
    expect(parseEditTargetMessageIds("123456789012345678,123456789012345678", 2)).toMatchObject({
      valid: false,
      message: expect.stringContaining("different"),
    });
  });
});
