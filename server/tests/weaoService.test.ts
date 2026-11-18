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
      const result = await interpolateWeaoPlaceholders({ content: "{exploit.123456789.changelogs}" } as any);
      expect((result.payload as any).content).toBe("• **Tracked release** — Tracker ID lookup works");
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

  it("bounds comparison baselines when expired cache refreshes fail", async () => {
    const calls = new Map<string, number>();
    const fetchMock = vi.fn(async (input: any) => {
      const url = new URL(String(input));
      const name = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      const call = (calls.get(name) ?? 0) + 1;
      calls.set(name, call);

      const baselineIndex = /^Baseline-(\d+)$/.exec(name);
      if (baselineIndex && Number(baselineIndex[1]) < 100 && (call === 2 || call === 3)) {
        return new Response("upstream unavailable", { status: 503 });
      }

      return new Response(JSON.stringify({
        changelogs: [{ title: call > 1 ? `new ${name}` : `old ${name}` }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-16T00:00:00.000Z"));
    try {
      for (let index = 0; index < 250; index += 1) {
        await getExploitChangelogs(`Baseline-${index}`);
      }

      vi.setSystemTime(Date.now() + 16_000);
      for (let index = 0; index < 100; index += 1) {
        await getExploitChangelogs(`Baseline-${index}`);
      }

      for (let index = 0; index < 100; index += 1) {
        await getExploitChangelogs(`Fresh-${index}`);
      }

      await getExploitChangelogs("Baseline-99");
      expect(getExploitChangelogComparison("Baseline-99")).toEqual({
        added: [],
        removed: [],
      });
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

});
