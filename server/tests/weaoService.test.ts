import { describe, expect, it, vi } from "vitest";
import { formatExploitChangelogs, getExploitChangelogs, getExploitChangelogComparison, interpolateWeaoPlaceholders } from "../src/services/weaoService.js";

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

  it("formats the actual WEAO version/changelog/date response shape", () => {
    expect(formatExploitChangelogs([{
      version: "0.1.9a",
      changelog: "[+] Added support\n[+] Fixed injection",
      timestamp: 1794528000,
      date: "2026-11-13T00:00:00.000Z",
    }])).toBe("• **0.1.9a** — [+] Added support\n[+] Fixed injection — (2026-11-13T00:00:00.000Z)");
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
    ].join("\n"));
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
  it("resolves changelog variables by WEAO tracker ID", async () => {
    const fetchMock = vi.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/api/status/exploits/changelogs/123456789")) {
        return new Response(JSON.stringify({ changelogs: [{ title: "Tracked release", description: "Tracker ID lookup works" }] }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/api/status/exploits")) {
        return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("Not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const result = await interpolateWeaoPlaceholders({ content: "plural: {exploit.123456789.changelogs}\nsingular: {exploit.123456789.changelog}" } as any);
      expect((result.payload as any).content).toBe("plural: • **Tracked release** — Tracker ID lookup works\nsingular: • **Tracked release** — Tracker ID lookup works");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("compares each successful changelog fetch with the immediately previous snapshot", async () => {
    const snapshots = [
      [{ title: "Old entry" }, { title: "Retained entry" }],
      [{ title: "Retained entry" }, { title: "New entry" }],
    ];
    let requestIndex = 0;
    const fetchMock = vi.fn(async () => {
      const changelogs = snapshots[Math.min(requestIndex++, snapshots.length - 1)];
      return new Response(JSON.stringify({ changelogs }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-16T00:00:00.000Z"));
    try {
      await getExploitChangelogs("Comparison Regression");
      vi.setSystemTime(Date.now() + 16_000);
      await getExploitChangelogs("Comparison Regression");
      expect(getExploitChangelogComparison("Comparison Regression")).toEqual({
        added: [{ title: "New entry" }],
        removed: [{ title: "Old entry" }],
      });
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
