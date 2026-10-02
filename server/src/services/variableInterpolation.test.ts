import { describe, expect, it } from "vitest";
import { replaceVariables } from "./variableInterpolation.js";

describe("replaceVariables", () => {
  it("replaces single- and double-brace placeholders in strings", () => {
    expect(replaceVariables("Hi {user.name} ({{ user.id }})", {
      "user.name": "Ada",
      "user.id": "123",
    })).toBe("Hi Ada (123)");
  });

  it("recursively replaces placeholders in nested action config values", () => {
    expect(
      replaceVariables(
        { content: "Hello {user.name}", components: [{ label: "{{choice}}" }] },
        { "user.name": "Ada", choice: "Continue" },
      ),
    ).toEqual({ content: "Hello Ada", components: [{ label: "Continue" }] });
  });

  it("preserves unknown placeholders and non-string values", () => {
    expect(replaceVariables({ content: "{missing}", count: 3, empty: null }, {})).toEqual({
      content: "{missing}",
      count: 3,
      empty: null,
    });
  });
});