import { beforeEach, describe, expect, it } from "vitest";
import { useMessageStore } from "../messageStore";

describe("messageStore undo and redo", () => {
  beforeEach(() => {
    useMessageStore.getState().reset();
  });

  it("coalesces rapid text edits and supports redo", () => {
    const store = useMessageStore.getState();
    store.setField("content", "first");
    useMessageStore.getState().setField("content", "final");

    expect(useMessageStore.getState().canUndo).toBe(true);
    useMessageStore.getState().undo();
    expect(useMessageStore.getState().data.content).toBe("");
    expect(useMessageStore.getState().canRedo).toBe(true);
    useMessageStore.getState().redo();
    expect(useMessageStore.getState().data.content).toBe("final");
  });

  it("does not add history entries when switching active messages", () => {
    useMessageStore.getState().setField("content", "First message");
    useMessageStore.getState().addMessage({ content: "Second message" });
    useMessageStore.getState().setActiveMessageIndex(0);
    useMessageStore.getState().undo();

    expect(useMessageStore.getState().messages).toHaveLength(1);
    expect(useMessageStore.getState().data.content).toBe("First message");
  });

  it("clears undo history after reset", () => {
    useMessageStore.getState().setField("content", "Something");
    useMessageStore.getState().reset();
    expect(useMessageStore.getState().canUndo).toBe(false);
    expect(useMessageStore.getState().canRedo).toBe(false);
  });
});
