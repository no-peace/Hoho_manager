import { beforeEach, describe, expect, it, vi } from "vitest";

const listSchedules = vi.fn().mockResolvedValue([]);
const listExpiring = vi.fn().mockResolvedValue([]);
const listActiveSticky = vi.fn().mockResolvedValue([]);

vi.mock("../src/repositories/automationRepository.js", () => ({
  automationRepository: {
    listSchedules,
    listExpiring,
    listActiveSticky,
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
    listSchedules.mockClear();
    listExpiring.mockClear();
    listActiveSticky.mockClear();
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
    expect(listSchedules).toHaveBeenCalledTimes(1);
    expect(listExpiring).toHaveBeenCalledTimes(1);
    expect(listActiveSticky).toHaveBeenCalledTimes(1);
  });
});
