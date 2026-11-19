import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMessageStore } from "../messageStore";

describe("messageStore history", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-19T10:00:00.000Z"));
    useMessageStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("undoes and redoes message edits", () => {
    useMessageStore.getState().setContent("First version");
    expect(useMessageStore.getState().canUndo).toBe(true);

    useMessageStore.getState().undo();
    expect(useMessageStore.getState().data.content).toBe("");
    expect(useMessageStore.getState().canRedo).toBe(true);

    useMessageStore.getState().redo();
    expect(useMessageStore.getState().data.content).toBe("First version");
  });

  it("coalesces rapid typing into one undo entry", () => {
    useMessageStore.getState().setContent("H");
    vi.advanceTimersByTime(200);
    useMessageStore.getState().setContent("Ho");
    vi.advanceTimersByTime(200);
    useMessageStore.getState().setContent("Hoho");

    expect(useMessageStore.getState().past).toHaveLength(1);
    useMessageStore.getState().undo();
    expect(useMessageStore.getState().data.content).toBe("");
  });

  it("keeps the history stack bounded to 40 snapshots", () => {
    for (let index = 0; index < 45; index += 1) {
      useMessageStore.getState().setContent(`Message ${index}`);
      vi.advanceTimersByTime(601);
    }

    expect(useMessageStore.getState().past).toHaveLength(40);
  });
});
