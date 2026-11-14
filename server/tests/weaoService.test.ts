import { describe, expect, it } from "vitest";
import { formatExploitChangelogs } from "../src/services/weaoService.js";

describe("WEAO changelog formatting", () => {
  const entries = [
    { title: "Release 1", description: "Fixed injection", date: "2026-11-12" },
    { title: "Release 2", message: "Added support" },
    { title: "Release 3", content: "Improved stability" },
    "Legacy plain-text entry",
  ];

  it("formats all changelog entries without assuming one upstream item shape", () => {
    expect(formatExploitChangelogs(entries)).toBe([
      "• **Release 1** — Fixed injection — (2026-11-12)",
      "• **Release 2** — Added support",
      "• **Release 3** — Improved stability",
      "• Legacy plain-text entry",
    ].join("\n"));
  });

  it("supports zero-based start:end slicing", () => {
    expect(formatExploitChangelogs(entries, "changelogs[1:3]")).toBe([
      "• **Release 2** — Added support",
      "• **Release 3** — Improved stability",
    ].join("\n"));
  });

  it("supports negative slicing for the latest entries", () => {
    expect(formatExploitChangelogs(entries, "changelogs[-2:]")).toBe([
      "• **Release 3** — Improved stability",
      "• Legacy plain-text entry",
    ].join("\\n"));
  });

  it("supports a single zero-based entry index", () => {
    expect(formatExploitChangelogs(entries, "changelogs[2]")).toBe(
      "• **Release 3** — Improved stability",
    );
  });

  it("formats a comparison of added and removed entries", () => {
    expect(formatExploitChangelogs(entries, "changelogs.compare", {
      added: [entries[2]],
      removed: [entries[0]],
    })).toContain("**New entries**");
    expect(formatExploitChangelogs(entries, "changelogs.compare", {
      added: [entries[2]],
      removed: [entries[0]],
    })).toContain("**Removed entries**");
  });

  it("returns a stable empty state for an empty changelog", () => {
    expect(formatExploitChangelogs([], "changelogs[0:3]")).toBe(
      "No changelog entries found.",
    );
  });
});
