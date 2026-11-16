import { describe, expect, it } from "vitest";
import { buildTimestampVariables, interpolateObject, replaceVariables } from "../src/services/variableInterpolation.js";

describe("variableInterpolation", () => {
  it("replaces single and double brace tokens, including empty values", () => {
    expect(
      replaceVariables("Hello {name} {{ name }} {empty} {unknown}", {
        name: "Peace",
        empty: "",
      }),
    ).toBe("Hello Peace Peace  {unknown}");
  });

  it("supports keys with spaces and punctuation", () => {
    expect(replaceVariables("{server.name:display}", { "server.name:display": "HoHo Hub" }))
      .toBe("HoHo Hub");
  });

  it("preserves unknown tokens by default and can explicitly strip them", () => {
    expect(replaceVariables("A {missing} B", {})).toBe("A {missing} B");
    expect(replaceVariables("A {missing} B", {}, { preserveUnknown: false })).toBe("A  B");
  });

  it("interpolates nested arrays and objects without changing non-string values", () => {
    expect(interpolateObject({ content: ["{name}", "{{name}}"], flags: 0 }, { name: "Peace" }))
      .toEqual({ content: ["Peace", "Peace"], flags: 0 });
  });

  it("resolves long and short time placeholders to their distinct Discord formats", () => {
    const date = new Date("2026-11-16T12:00:00.000Z");
    const unix = Math.floor(date.getTime() / 1000);
    const variables = buildTimestampVariables(date);

    expect(replaceVariables("{now.time}|{now.short_time}", variables))
      .toBe(`<t:${unix}:T>|<t:${unix}:t>`);
  });

  it("builds the complete Discord timestamp variable set", () => {
    const date = new Date("2026-11-16T12:00:00.000Z");
    const unix = Math.floor(date.getTime() / 1000);
    expect(buildTimestampVariables(date)).toMatchObject({
      "now.iso": date.toISOString(),
      "now.unix": String(unix),
      "now.date": `<t:${unix}:D>`,
      "now.time": `<t:${unix}:T>`,
      "now.datetime": `<t:${unix}:F>`,
      "now.relative": `<t:${unix}:R>`,
      "now.short_date": `<t:${unix}:d>`,
      "now.short_time": `<t:${unix}:t>`,
      "now.short_datetime": `<t:${unix}:f>`,
      timestamp: `<t:${unix}:F>`,
    });
  });
});
