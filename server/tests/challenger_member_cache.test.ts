import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  BoundedTtlCache,
  searchGuildMembers,
  clearMemberSearchCache,
  getMemberSearchCacheStats,
} from "../src/services/discordService.js";

describe("PERF-05: Member Search In-Memory LRU/TTL Cache", () => {
  let cache: BoundedTtlCache<any>;

  beforeEach(() => {
    cache = new BoundedTtlCache(3, 50); // capacity 3, ttl 50ms
    clearMemberSearchCache();
  });

  it("stores and retrieves cached items", () => {
    cache.set("g1:alice", [{ id: "1", username: "alice" }]);
    expect(cache.get("g1:alice")).toEqual([{ id: "1", username: "alice" }]);
  });

  it("expires items after TTL window", async () => {
    cache.set("g1:bob", [{ id: "2", username: "bob" }]);
    expect(cache.get("g1:bob")).toBeDefined();
    await new Promise((r) => setTimeout(r, 60));
    expect(cache.get("g1:bob")).toBeUndefined();
  });

  it("evicts least recently used items when capacity is exceeded", () => {
    cache.set("k1", 1);
    cache.set("k2", 2);
    cache.set("k3", 3);
    // Access k1 so k2 becomes the oldest
    cache.get("k1");
    // Adding 4th item evicts k2
    cache.set("k4", 4);
    expect(cache.get("k2")).toBeUndefined();
    expect(cache.get("k1")).toBe(1);
    expect(cache.get("k3")).toBe(3);
    expect(cache.get("k4")).toBe(4);
  });

  it("tracks hit and miss statistics accurately", () => {
    cache.set("k1", 100);
    cache.get("k1"); // hit
    cache.get("k1"); // hit
    cache.get("missing"); // miss
    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);
    expect(stats.maxEntries).toBe(3);
  });

  it("prunes expired entries when requested", async () => {
    cache.set("item1", "a", 20); // 20ms TTL
    cache.set("item2", "b", 200); // 200ms TTL
    expect(cache.size()).toBe(2);

    await new Promise((r) => setTimeout(r, 35));
    const pruned = cache.pruneExpired();
    expect(pruned).toBe(1);
    expect(cache.size()).toBe(1);
    expect(cache.get("item2")).toBe("b");
  });

  it("coalesces in-flight duplicate requests and caches results in searchGuildMembers", async () => {
    let fetchCount = 0;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      fetchCount++;
      await new Promise((r) => setTimeout(r, 30));
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => [
          { user: { id: "123", username: "charlie", global_name: "Charlie Brown" }, nick: null, roles: [] },
        ],
      } as any;
    });

    try {
      // Dispatch 3 concurrent searches for the same guild and query
      const [res1, res2, res3] = await Promise.all([
        searchGuildMembers("guild_1", "charlie"),
        searchGuildMembers("guild_1", "charlie"),
        searchGuildMembers("guild_1", "CHARLIE"), // Case-insensitive match
      ]);

      // All 3 should receive identical results
      expect(res1).toHaveLength(1);
      expect(res2).toEqual(res1);
      expect(res3).toEqual(res1);

      // Only ONE outbound fetch call should have occurred (thundering herd coalesced)
      expect(fetchCount).toBe(1);

      // Subsequent query after settlement hits cache directly with 0 additional fetches
      const cachedRes = await searchGuildMembers("guild_1", "charlie");
      expect(cachedRes).toEqual(res1);
      expect(fetchCount).toBe(1);

      const stats = getMemberSearchCacheStats();
      expect(stats.hits).toBeGreaterThanOrEqual(1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
