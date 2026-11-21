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

  it("returns to the clean saved state when undo restores the saved snapshot", () => {
    useMessageStore.getState().setContent("Saved version");
    useMessageStore.getState().markClean();
    useMessageStore.getState().setContent("Unsaved version");

    expect(useMessageStore.getState().isDirty).toBe(true);
    useMessageStore.getState().undo();
    expect(useMessageStore.getState().data.content).toBe("Saved version");
    expect(useMessageStore.getState().isDirty).toBe(false);
  });

  it("records message reordering in undo history", () => {
    useMessageStore.getState().load({
      messages: [
        { _id: "first", content: "First" },
        { _id: "second", content: "Second" },
      ],
    });

    useMessageStore.getState().reorderMessages(0, 1);
    expect(useMessageStore.getState().messages.map((message) => message._id)).toEqual(["second", "first"]);
    expect(useMessageStore.getState().canUndo).toBe(true);

    useMessageStore.getState().undo();
    expect(useMessageStore.getState().messages.map((message) => message._id)).toEqual(["first", "second"]);
    expect(useMessageStore.getState().isDirty).toBe(false);
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
