import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/config/env.js", () => ({
  env: { discord: { botToken: "test-bot-token" } },
}));

vi.mock("../src/services/settingsService.js", () => ({
  settingsService: {
    getSettings: vi.fn(),
    getEffectiveLogChannelId: vi.fn(),
  },
}));

import { settingsService } from "../src/services/settingsService.js";
import { sendAuditLogToChannel } from "../src/services/auditLog.js";

describe("Discord audit log delivery", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      guild_id: "__global__",
      log_channel_id: "123456789012345678",
      head_admin_ids: [],
      bot_profile_id: null,
      extra_settings: {},
      created_at: 0,
      updated_at: 0,
    });
    vi.mocked(settingsService.getEffectiveLogChannelId).mockResolvedValue("123456789012345678");
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("confirms Discord accepted an embed in the explicitly selected channel", async () => {
    const result = await sendAuditLogToChannel(
      { event: "LOG_TEST", reason: "Settings test" },
      { channelId: "123456789012345678", bypassEventFilter: true },
    );

    expect(result).toEqual({ ok: true, status: 200 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.com/api/v10/channels/123456789012345678/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bot test-bot-token" }),
      }),
    );
  });

  it("returns the Discord rejection status instead of silently reporting delivery", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "Missing Permissions",
    });

    const result = await sendAuditLogToChannel(
      { event: "LOG_TEST" },
      { channelId: "123456789012345678", bypassEventFilter: true },
    );

    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toContain("Missing Permissions");
  });

  it("does not send events disabled in the saved logging configuration", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValue({
      guild_id: "__global__",
      log_channel_id: "123456789012345678",
      head_admin_ids: [],
      bot_profile_id: null,
      extra_settings: { logging_config: { enabled_channel_events: [] } },
      created_at: 0,
      updated_at: 0,
    });

    const result = await sendAuditLogToChannel({ event: "SEND_MESSAGE" });

    expect(result).toEqual({ ok: true, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
