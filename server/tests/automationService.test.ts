import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listSchedules: vi.fn().mockResolvedValue([]),
  listExpiring: vi.fn().mockResolvedValue([]),
  listActiveSticky: vi.fn().mockResolvedValue([]),
}));

vi.mock("../src/repositories/automationRepository.js", () => ({
  automationRepository: {
    listSchedules: mocks.listSchedules,
    listExpiring: mocks.listExpiring,
    listActiveSticky: mocks.listActiveSticky,
    findDueSchedules: vi.fn().mockResolvedValue([]),
    findDueExpiring: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../src/services/discordService.js", () => ({
  resolveBotToken: vi.fn(),
  sendChannelMessageWithToken: vi.fn(),
  editChannelMessage: vi.fn(),
  deleteChannelMessage: vi.fn(),
}));

import {
  getAutomationCacheState,
  initializeAutomationService,
  runAutomationTick,
} from "../src/services/automationService.js";

describe("automation service idle caches", () => {
  beforeEach(() => {
    mocks.listSchedules.mockClear();
    mocks.listExpiring.mockClear();
    mocks.listActiveSticky.mockClear();
  });

  it("loads each automation table once and performs no recurring reads when caches are empty", async () => {
    await initializeAutomationService();
    await runAutomationTick();
    await runAutomationTick();

    expect(getAutomationCacheState()).toMatchObject({
      initialized: true,
      hasSchedules: false,
      hasExpiringMessages: false,
      stickyCount: 0,
    });
    expect(mocks.listSchedules).toHaveBeenCalledTimes(1);
    expect(mocks.listExpiring).toHaveBeenCalledTimes(1);
    expect(mocks.listActiveSticky).toHaveBeenCalledTimes(1);
  });
});
