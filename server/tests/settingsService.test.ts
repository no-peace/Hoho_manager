import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettingsRecord } from "@dmb/shared";

vi.mock("../src/repositories/settingsRepository.js", () => ({
  settingsRepository: {
    findByGuildId: vi.fn(),
    upsert: vi.fn(),
  },
}));

import { settingsRepository } from "../src/repositories/settingsRepository.js";
import { clearSettingsCache, settingsService } from "../src/services/settingsService.js";

const makeSettings = (guildId: string): SettingsRecord => ({
  guild_id: guildId,
  log_channel_id: null,
  head_admin_ids: [],
  bot_profile_id: null,
  extra_settings: {},
  created_at: 1,
  updated_at: 1,
});

describe("settingsService cache", () => {
  beforeEach(() => {
    clearSettingsCache();
    vi.clearAllMocks();
  });

  it("reuses a cached settings record within the cache TTL", async () => {
    const record = makeSettings("guild-1");
    vi.mocked(settingsRepository.findByGuildId).mockResolvedValue(record);

    const first = await settingsService.getSettings("guild-1");
    const second = await settingsService.getSettings("guild-1");

    expect(first).toBe(record);
    expect(second).toBe(record);
    expect(settingsRepository.findByGuildId).toHaveBeenCalledTimes(1);
  });

  it("negative-caches unconfigured guilds instead of querying storage repeatedly", async () => {
    vi.mocked(settingsRepository.findByGuildId).mockResolvedValue(undefined);

    const first = await settingsService.getSettings("guild-without-settings");
    const second = await settingsService.getSettings("guild-without-settings");

    expect(first.guild_id).toBe("guild-without-settings");
    expect(second.guild_id).toBe("guild-without-settings");
    expect(settingsRepository.findByGuildId).toHaveBeenCalledTimes(1);
  });

  it("expires cached settings after the configured TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-18T00:00:00.000Z"));
    vi.mocked(settingsRepository.findByGuildId).mockResolvedValue(makeSettings("guild-ttl"));

    try {
      await settingsService.getSettings("guild-ttl");
      vi.advanceTimersByTime(30_001);
      await settingsService.getSettings("guild-ttl");

      expect(settingsRepository.findByGuildId).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the cache bounded and evicts the least recently used guild", async () => {
    vi.mocked(settingsRepository.findByGuildId).mockImplementation(async (guildId) => makeSettings(guildId));

    for (let index = 0; index < 501; index += 1) {
      await settingsService.getSettings(`guild-${index}`);
    }

    // guild-0 was the oldest entry and should have been evicted at capacity.
    await settingsService.getSettings("guild-0");

    expect(settingsRepository.findByGuildId).toHaveBeenCalledTimes(502);
  });

  it("writes updated settings through to the cache", async () => {
    const updated = makeSettings("guild-updated");
    vi.mocked(settingsRepository.upsert).mockResolvedValue(updated);
    vi.mocked(settingsRepository.findByGuildId).mockResolvedValue(undefined);

    const result = await settingsService.updateSettings("guild-updated", {
      log_channel_id: "123456789012345678",
    });
    const cached = await settingsService.getSettings("guild-updated");

    expect(result).toBe(updated);
    expect(cached).toBe(updated);
    expect(settingsRepository.findByGuildId).not.toHaveBeenCalled();
  });
});
