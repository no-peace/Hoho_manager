import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listAll: vi.fn(),
  recordCheckInMemory: vi.fn(),
  deleteById: vi.fn(),
  updateHashAndCheck: vi.fn(),
  findByTitle: vi.fn(),
  findTemplateById: vi.fn(),
  interpolate: vi.fn(),
  resolveAuthor: vi.fn(),
  getChannelGuildId: vi.fn(),
  editChannelMessage: vi.fn(),
}));

vi.mock("../src/repositories/trackedMessageRepository.js", () => ({
  trackedMessageRepository: {
    listAll: mocks.listAll,
    recordCheckInMemory: mocks.recordCheckInMemory,
    deleteById: mocks.deleteById,
    updateHashAndCheck: mocks.updateHashAndCheck,
  },
}));

vi.mock("../src/repositories/customExecutorRepository.js", () => ({
  customExecutorRepository: {
    findByTitle: mocks.findByTitle,
  },
}));

vi.mock("../src/repositories/templateRepository.js", () => ({
  templateRepository: {
    findById: mocks.findTemplateById,
  },
}));

vi.mock("../src/services/weaoService.js", () => ({
  interpolateWeaoPlaceholders: mocks.interpolate,
}));

vi.mock("../src/services/authorService.js", () => ({
  resolveAuthorPlaceholders: mocks.resolveAuthor,
}));

vi.mock("../src/services/discordService.js", () => ({
  getChannelGuildId: mocks.getChannelGuildId,
  editChannelMessage: mocks.editChannelMessage,
}));

import { computePayloadHash, syncTrackedMessages } from "../src/services/messageTrackerService.js";

describe("message tracker performance safeguards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findByTitle.mockResolvedValue(undefined);
    mocks.findTemplateById.mockResolvedValue(undefined);
    mocks.interpolate.mockImplementation(async (payload: unknown) => ({ payload }));
    mocks.resolveAuthor.mockImplementation(async (payload: unknown) => ({ payload }));
    mocks.getChannelGuildId.mockResolvedValue(null);
    mocks.recordCheckInMemory.mockReturnValue(undefined);
    mocks.deleteById.mockResolvedValue(undefined);
    mocks.updateHashAndCheck.mockResolvedValue(undefined);
  });

  it("memoizes repeated executor and channel-guild lookups within one sync sweep", async () => {
    const payload = { content: "same tracked payload" };
    const hash = computePayloadHash(payload);
    mocks.listAll.mockResolvedValue([
      {
        id: 1,
        channel_id: "channel-1",
        message_id: "message-1",
        template_id: null,
        exploit_name: "Shared Executor",
        author_user_id: null,
        raw_payload: JSON.stringify(payload),
        last_payload_hash: hash,
        expires_at: null,
      },
      {
        id: 2,
        channel_id: "channel-1",
        message_id: "message-2",
        template_id: null,
        exploit_name: "shared executor",
        author_user_id: null,
        raw_payload: JSON.stringify(payload),
        last_payload_hash: hash,
        expires_at: null,
      },
    ]);

    const result = await syncTrackedMessages();

    expect(result).toEqual({ checked: 2, updated: 0, removed: 0, errors: 0 });
    expect(mocks.findByTitle).toHaveBeenCalledTimes(1);
    // Two tracked messages in the same channel require only one Discord channel lookup.
    expect(mocks.getChannelGuildId).toHaveBeenCalledTimes(1);
    expect(mocks.getChannelGuildId).toHaveBeenCalledWith("channel-1");
    // An unchanged payload must only advance the in-memory check timestamp.
    // updateHashAndCheck is the repository path that issues SQL UPDATE.
    expect(mocks.recordCheckInMemory).toHaveBeenCalledTimes(2);
    expect(mocks.recordCheckInMemory).toHaveBeenNthCalledWith(1, 1);
    expect(mocks.recordCheckInMemory).toHaveBeenNthCalledWith(2, 2);
    expect(mocks.updateHashAndCheck).not.toHaveBeenCalled();
  });

  it("shares an in-flight sweep instead of starting overlapping polling work", async () => {
    let release!: (records: unknown[]) => void;
    const pending = new Promise<unknown[]>((resolve) => {
      release = resolve;
    });
    mocks.listAll.mockReturnValue(pending);

    const first = syncTrackedMessages();
    const second = syncTrackedMessages();

    expect(mocks.listAll).toHaveBeenCalledTimes(1);
    release([]);
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toEqual({ checked: 0, updated: 0, removed: 0, errors: 0 });
    expect(secondResult).toBe(firstResult);

    await syncTrackedMessages();
    expect(mocks.listAll).toHaveBeenCalledTimes(2);
  });
});
