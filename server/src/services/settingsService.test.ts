import { describe, it, expect, beforeEach } from "vitest";
import { settingsService } from "./settingsService.js";
import { settingsRepository } from "../repositories/settingsRepository.js";
import { env } from "../config/env.js";

describe("settingsService", () => {
  beforeEach(async () => {
    settingsService.clearCache();
    await settingsRepository.delete("__global__");
    await settingsRepository.delete("test-guild-123");
  });

  it("returns global defaults when no DB settings are present", async () => {
    const settings = await settingsService.getSettings();
    expect(settings.guild_id).toBe("__global__");
    expect(settings.log_channel_id).toBe(env.logChannelId ?? null);
    expect(settings.head_admin_ids).toEqual([...env.ownerDiscordIds]);
  });

  it("updates and retrieves global settings with cache invalidation", async () => {
    await settingsService.updateSettings("__global__", {
      log_channel_id: "log-channel-999",
      head_admin_ids: ["111222333444555666"],
    });

    const settings = await settingsService.getSettings();
    expect(settings.log_channel_id).toBe("log-channel-999");
    expect(settings.head_admin_ids).toEqual(["111222333444555666"]);

    // Test cached response
    const cached = await settingsService.getSettings("__global__");
    expect(cached.log_channel_id).toBe("log-channel-999");
  });

  it("resolves effective log channel hierarchy: guild -> global -> env", async () => {
    // 1. When nothing in DB, falls back to env
    const initial = await settingsService.getEffectiveLogChannelId("test-guild-123");
    expect(initial).toBe(env.logChannelId ? env.logChannelId.trim() : undefined);

    // 2. Set global settings
    await settingsService.updateSettings("__global__", {
      log_channel_id: "global-log-channel",
    });
    expect(await settingsService.getEffectiveLogChannelId("test-guild-123")).toBe("global-log-channel");

    // 3. Set guild-specific settings
    await settingsService.updateSettings("test-guild-123", {
      log_channel_id: "guild-specific-log",
    });
    expect(await settingsService.getEffectiveLogChannelId("test-guild-123")).toBe("guild-specific-log");

    // Other guilds still resolve to global
    expect(await settingsService.getEffectiveLogChannelId("other-guild")).toBe("global-log-channel");
  });

  it("verifies isHeadAdmin with env owners, global settings, and guild settings", async () => {
    // 1. Env owner ID
    if (env.ownerDiscordIds.length > 0) {
      expect(await settingsService.isHeadAdmin(env.ownerDiscordIds[0])).toBe(true);
    }

    const testAdminId = "999888777666555444";
    expect(await settingsService.isHeadAdmin(testAdminId)).toBe(false);

    // 2. Global head admin
    await settingsService.updateSettings("__global__", {
      head_admin_ids: [testAdminId],
    });
    expect(await settingsService.isHeadAdmin(testAdminId)).toBe(true);

    // 3. Guild-specific head admin
    const guildAdminId = "555444333222111000";
    expect(await settingsService.isHeadAdmin(guildAdminId, "test-guild-123")).toBe(false);

    await settingsService.updateSettings("test-guild-123", {
      head_admin_ids: [guildAdminId],
    });
    expect(await settingsService.isHeadAdmin(guildAdminId, "test-guild-123")).toBe(true);
    // Not admin globally
    expect(await settingsService.isHeadAdmin(guildAdminId, "other-guild")).toBe(false);
  });
});
