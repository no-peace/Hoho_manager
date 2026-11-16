import { describe, expect, it } from "vitest";
import { detectAutocompleteToken } from "../mentionParser";

describe("mentionParser: detectAutocompleteToken", () => {
  it("detects chained exploit field tokens like {exploit.Delta.st", () => {
    const token = detectAutocompleteToken("Status: {exploit.Delta.st", 25);
    expect(token).toEqual({
      type: "exploit_field",
      exploitTarget: "Delta",
      query: "st",
      start: 8,
      end: 25,
    });
  });

  it("detects exploit name tokens like {exploit.Del", () => {
    const token = detectAutocompleteToken("Check {exploit.Del", 18);
    expect(token).toEqual({
      type: "exploit_name",
      query: "Del",
      start: 6,
      end: 18,
    });
  });

  it("detects dotted exploit names before a field is selected", () => {
    const text = "Use {exploit.AWP.GG";
    expect(detectAutocompleteToken(text, text.length)).toMatchObject({
      type: "exploit_name",
      query: "AWP.GG",
    });
  });

  it("detects fields after dotted exploit names", () => {
    const text = "Use {exploit.AWP.GG.su";
    expect(detectAutocompleteToken(text, text.length)).toMatchObject({
      type: "exploit_field",
      exploitTarget: "AWP.GG",
      query: "su",
    });
  });

  it("detects standard variable tokens, @mentions, #channels, and :emojis", () => {
    expect(detectAutocompleteToken("Hello {user.na", 14)?.type).toBe("variable");
    expect(detectAutocompleteToken("Ping @nexus", 11)?.type).toBe("user");
    expect(detectAutocompleteToken("See #general", 12)?.type).toBe("channel");
    expect(detectAutocompleteToken("React :fire", 11)?.type).toBe("emoji");
  });
});
