import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listSchedules: vi.fn(),
  listExpiring: vi.fn(),
  listActiveSticky: vi.fn(),
  getNextScheduleAt: vi.fn(),
  getNextExpiringAt: vi.fn(),
  findDueSchedules: vi.fn(),
  findDueExpiring: vi.fn(),
  removeExpiring: vi.fn(),
  retryExpiring: vi.fn(),
  updateSchedule: vi.fn(),
  setStickyMessageId: vi.fn(),
  findSticky: vi.fn(),
  resolveBotToken: vi.fn(),
  deleteChannelMessage: vi.fn(),
  sendChannelMessageWithToken: vi.fn(),
  editChannelMessage: vi.fn(),
}));

vi.mock("../src/repositories/automationRepository.js", () => ({
  automationRepository: {
    listSchedules: mocks.listSchedules,
    listExpiring: mocks.listExpiring,
    listActiveSticky: mocks.listActiveSticky,
    getNextScheduleAt: mocks.getNextScheduleAt,
    getNextExpiringAt: mocks.getNextExpiringAt,
    findDueSchedules: mocks.findDueSchedules,
    findDueExpiring: mocks.findDueExpiring,
    removeExpiring: mocks.removeExpiring,
    retryExpiring: mocks.retryExpiring,
    updateSchedule: mocks.updateSchedule,
    setStickyMessageId: mocks.setStickyMessageId,
    findSticky: mocks.findSticky,
  },
}));

vi.mock("../src/services/discordService.js", () => ({
  resolveBotToken: mocks.resolveBotToken,
  deleteChannelMessage: mocks.deleteChannelMessage,
  sendChannelMessageWithToken: mocks.sendChannelMessageWithToken,
  editChannelMessage: mocks.editChannelMessage,
}));

describe("automation service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.listSchedules.mockResolvedValue([]);
    mocks.listExpiring.mockResolvedValue([]);
    mocks.listActiveSticky.mockResolvedValue([]);
    mocks.getNextScheduleAt.mockResolvedValue(null);
    mocks.getNextExpiringAt.mockResolvedValue(null);
    mocks.findDueSchedules.mockResolvedValue([]);
    mocks.findDueExpiring.mockResolvedValue([]);
    mocks.removeExpiring.mockResolvedValue(undefined);
    mocks.retryExpiring.mockResolvedValue(undefined);
    mocks.updateSchedule.mockResolvedValue(undefined);
    mocks.setStickyMessageId.mockResolvedValue(undefined);
    mocks.resolveBotToken.mockResolvedValue("test-token");
    mocks.deleteChannelMessage.mockResolvedValue(undefined);
    mocks.sendChannelMessageWithToken.mockResolvedValue({ id: "new-sticky-id" });
    mocks.editChannelMessage.mockResolvedValue(undefined);
  });

  it("performs no recurring database reads while all automation caches are empty", async () => {
    const service = await import("../src/services/automationService.js");
    await service.initializeAutomationService();
    await service.runAutomationTick();
    await service.runAutomationTick();

    expect(service.getAutomationCacheState()).toMatchObject({
      initialized: true,
      hasSchedules: false,
      hasExpiringMessages: false,
      stickyCount: 0,
    });
    expect(mocks.getNextScheduleAt).toHaveBeenCalledTimes(1);
    expect(mocks.getNextExpiringAt).toHaveBeenCalledTimes(1);
    expect(mocks.listActiveSticky).toHaveBeenCalledTimes(1);
    expect(mocks.listSchedules).not.toHaveBeenCalled();
    expect(mocks.listExpiring).not.toHaveBeenCalled();
    expect(mocks.findDueSchedules).not.toHaveBeenCalled();
    expect(mocks.findDueExpiring).not.toHaveBeenCalled();
  });

  it("deletes due expiring messages and refreshes the empty-table cache", async () => {
    const due = {
      id: 7,
      guild_id: "guild",
      channel_id: "channel",
      message_id: "message",
      delete_at: new Date(Date.now() - 60_000).toISOString(),
      created_by: "staff",
      created_at: new Date().toISOString(),
    };
    mocks.listExpiring.mockResolvedValueOnce([due]).mockResolvedValueOnce([]);
    mocks.getNextExpiringAt.mockResolvedValueOnce(due.delete_at);
    mocks.findDueExpiring.mockResolvedValue([due]);

    const service = await import("../src/services/automationService.js");
    await service.initializeAutomationService();
    await service.runAutomationTick();

    expect(mocks.deleteChannelMessage).toHaveBeenCalledWith("channel", "message", "test-token");
    expect(mocks.removeExpiring).toHaveBeenCalledWith(7);
    expect(service.getAutomationCacheState().hasExpiringMessages).toBe(false);
  });

  it("reschedules expiring messages after transient Discord deletion failures", async () => {
    const due = {
      id: 8,
      guild_id: "guild",
      channel_id: "channel",
      message_id: "message",
      delete_at: new Date(Date.now() - 60_000).toISOString(),
      created_by: "staff",
      created_at: new Date().toISOString(),
    };
    mocks.getNextExpiringAt
      .mockResolvedValueOnce(due.delete_at)
      .mockImplementationOnce(async () => new Date(Date.now() + 60_000).toISOString());
    mocks.findDueExpiring.mockResolvedValue([due]);
    mocks.deleteChannelMessage.mockRejectedValueOnce(
      Object.assign(new Error("Discord is temporarily unavailable"), { status: 503 }),
    );

    const service = await import("../src/services/automationService.js");
    await service.initializeAutomationService();
    await service.runAutomationTick();

    expect(mocks.removeExpiring).not.toHaveBeenCalled();
    expect(mocks.retryExpiring).toHaveBeenCalledWith(8, expect.any(String));
    const retryAt = Date.parse(String(mocks.retryExpiring.mock.calls[0]?.[1]));
    expect(retryAt).toBeGreaterThan(Date.now() + 50_000);
    expect(retryAt).toBeLessThan(Date.now() + 70_000);
    expect(service.getAutomationCacheState().hasExpiringMessages).toBe(true);
  });

  it("does not retry a one-time message send after an ambiguous Discord failure", async () => {
    const due = {
      id: 9,
      guild_id: "guild",
      channel_id: "channel",
      thread_id: null,
      template_id: null,
      target_message_id: null,
      payload_json: { content: "One-time announcement" },
      cron_expr: null,
      run_at: new Date(Date.now() - 60_000).toISOString(),
      timezone: "UTC",
      enabled: 1,
      next_run_at: new Date(Date.now() - 60_000).toISOString(),
      retry_count: 0,
      created_by: "staff",
      created_at: new Date().toISOString(),
    };
    const ambiguousError = Object.assign(new Error("Discord request timed out"), { status: 504 });
    mocks.listSchedules.mockResolvedValueOnce([due]).mockResolvedValueOnce([]);
    mocks.getNextScheduleAt.mockResolvedValueOnce(due.next_run_at);
    mocks.findDueSchedules.mockResolvedValue([due]);
    mocks.sendChannelMessageWithToken.mockRejectedValueOnce(ambiguousError);

    const service = await import("../src/services/automationService.js");
    await service.initializeAutomationService();
    await service.runAutomationTick();

    expect(mocks.sendChannelMessageWithToken).toHaveBeenCalledTimes(1);
    expect(mocks.updateSchedule).toHaveBeenCalledWith(9, expect.objectContaining({
      enabled: 0,
      next_run_at: null,
      retry_count: 0,
    }));
  });

  it("edits an existing scheduled message in place instead of posting a duplicate", async () => {
    const due = {
      id: 4,
      guild_id: "guild",
      channel_id: "channel",
      thread_id: null,
      template_id: null,
      target_message_id: "existing-message",
      payload_json: { content: "Updated announcement" },
      cron_expr: null,
      run_at: new Date(Date.now() - 60_000).toISOString(),
      timezone: "UTC",
      enabled: 1,
      next_run_at: new Date(Date.now() - 60_000).toISOString(),
      created_by: "staff",
      created_at: new Date().toISOString(),
    };
    mocks.listSchedules.mockResolvedValueOnce([due]).mockResolvedValueOnce([]);
    mocks.getNextScheduleAt.mockResolvedValueOnce(due.next_run_at);
    mocks.findDueSchedules.mockResolvedValue([due]);

    const service = await import("../src/services/automationService.js");
    await service.initializeAutomationService();
    await service.runAutomationTick();

    expect(mocks.editChannelMessage).toHaveBeenCalledWith(
      "channel",
      "existing-message",
      { content: "Updated announcement" },
    );
    expect(mocks.sendChannelMessageWithToken).not.toHaveBeenCalled();
    expect(mocks.updateSchedule).toHaveBeenCalledWith(4, expect.objectContaining({ enabled: 0 }));
  });

  it("refreshes a cached sticky message by replacing the previous Discord message", async () => {
    const sticky = {
      id: 2,
      guild_id: "guild",
      channel_id: "channel",
      current_message_id: "old-sticky-id",
      payload_json: { content: "Pinned notice" },
      interval_messages: 10,
      enabled: 1,
      created_by: "staff",
      created_at: new Date().toISOString(),
    };
    mocks.listActiveSticky.mockResolvedValue([sticky]);

    const service = await import("../src/services/automationService.js");
    await service.initializeAutomationService();
    const messageId = await service.refreshStickyMessage("channel");

    expect(mocks.deleteChannelMessage).toHaveBeenCalledWith("channel", "old-sticky-id", "test-token");
    expect(mocks.sendChannelMessageWithToken).toHaveBeenCalledWith(
      "channel",
      { content: "Pinned notice" },
      "test-token",
    );
    expect(mocks.setStickyMessageId).toHaveBeenCalledWith("channel", "new-sticky-id");
    expect(messageId).toBe("new-sticky-id");
  });
});
