import { describe, expect, it } from "vitest";
import { detectAutocompleteToken, replaceDetectedToken } from "../mentionParser";

describe("variable autocomplete token detection", () => {
  it("opens variable autocomplete immediately after typing an opening brace", () => {
    expect(detectAutocompleteToken("{", 1)).toMatchObject({
      type: "variable",
      query: "",
      start: 0,
      end: 1,
    });
  });

  it("keeps variable autocomplete active while a partial variable is typed", () => {
    expect(detectAutocompleteToken("{explo", 6)).toMatchObject({
      type: "variable",
      query: "explo",
      start: 0,
      end: 6,
    });
  });

  it("routes the completed exploit namespace to exploit-name autocomplete", () => {
    expect(detectAutocompleteToken("{exploit.", 9)).toMatchObject({
      type: "exploit_name",
      query: "",
      start: 0,
      end: 9,
    });
  });

  it("replaces only the active token and returns the new cursor position", () => {
    const text = "Hello {explo world";
    const token = detectAutocompleteToken(text, 12);

    expect(token).not.toBeNull();
    expect(replaceDetectedToken(text, token!, "{exploit.")).toEqual({
      value: "Hello {exploit. world",
      cursor: 15,
    });
  });
});
