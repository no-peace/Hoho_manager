import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown";

/**
 * Regression tests for the preview markdown renderer.
 *
 * The emphasis branches recurse into the inline renderer. A shared module-level
 * global regex used to leak `lastIndex` across those recursive calls, so any
 * `**bold**` in a Components V2 TextDisplay made the renderer loop forever and
 * freeze the page. These tests assert the output *and* act as a canary: if the
 * shared-regex bug returns, this file hangs instead of failing, because the loop
 * is synchronous and cannot be interrupted by a test timeout.
 */

const render = (content: string): string =>
  renderToStaticMarkup(createElement(Markdown, { content }));

describe("Markdown", () => {
  it("renders bold text without hanging", () => {
    expect(render("**bold**")).toContain("<strong");
    expect(render("**bold**")).toContain("bold");
  });

  it("renders several emphasis tokens in one line", () => {
    const html = render("**one** then *two* then ~~three~~");
    expect(html).toContain("<strong");
    expect(html).toContain("<em");
    expect(html).toContain("line-through");
  });

  it("renders nested emphasis, which is what triggered the recursion", () => {
    const html = render("**bold with `code`**");
    expect(html).toContain("<strong");
    expect(html).toContain("<code");
    expect(html).toContain("code");
  });

  it("renders bold, italic and code inside a paragraph block", () => {
    const html = render("Hello **world**");
    expect(html).toContain("Hello");
    expect(html).toContain("<strong");
  });

  it("leaves plain text and non-markdown content untouched", () => {
    expect(render("just plain text")).toContain("just plain text");
  });

  it("tolerates a custom emoji next to emphasis", () => {
    const html = render("**hi** <:party:123456789012345678>");
    expect(html).toContain("<strong");
    expect(html).toContain("<img");
  });
});
