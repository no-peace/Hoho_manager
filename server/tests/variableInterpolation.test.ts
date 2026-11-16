import { describe, expect, it } from "vitest";
import {
  buildTimestampVariables,
  interpolateObject,
  replaceVariables,
} from "../src/services/variableInterpolation.js";

describe("variable interpolation", () => {
  it("replaces single and double brace tokens and preserves unknown tokens", () => {
    const variables = { "user name": "Peace", empty: "", "now.time": "<t:1:T>" };

    expect(replaceVariables(
      "Hello { user name } / {{user name}} / {empty} / {missing}",
      variables,
    )).toBe("Hello Peace / Peace /  / {missing}");
  });

  it("interpolates nested payloads without changing non-string values", () => {
    const payload = {
      content: "{now.time}",
      embeds: [{ description: "{{empty}}" }],
      flags: 0,
    };

    expect(interpolateObject(payload, { "now.time": "<t:1:T>", empty: "" })).toEqual({
      content: "<t:1:T>",
      embeds: [{ description: "" }],
      flags: 0,
    });
  });

  it("builds consistent Discord timestamp aliases", () => {
    const date = new Date("2026-11-16T12:34:56.000Z");
    const unix = Math.floor(date.getTime() / 1000);
    const variables = buildTimestampVariables(date);

    expect(variables["now.iso"]).toBe(date.toISOString());
    expect(variables["now.unix"]).toBe(String(unix));
    expect(variables["now.date"]).toBe(`<t:${unix}:D>`);
    expect(variables["now.time"]).toBe(`<t:${unix}:T>`);
    expect(variables["now.datetime"]).toBe(`<t:${unix}:F>`);
    expect(variables["now.relative"]).toBe(`<t:${unix}:R>`);
    expect(variables["now.short_date"]).toBe(`<t:${unix}:d>`);
    expect(variables["now.short_time"]).toBe(`<t:${unix}:t>`);
    expect(variables["now.short_datetime"]).toBe(`<t:${unix}:f>`);
    expect(variables.timestamp).toBe(`<t:${unix}:F>`);
  });
});
