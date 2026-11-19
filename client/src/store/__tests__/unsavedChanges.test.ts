import { beforeEach, describe, expect, it } from "vitest";
import { useActionStore } from "../actionStore";
import { useMessageStore } from "../messageStore";

describe("editor unsaved-change tracking", () => {
  beforeEach(() => {
    useMessageStore.getState().reset();
    useActionStore.getState().reset();
  });

  it("starts clean and does not treat loaded message content as unsaved", () => {
    useMessageStore.getState().load({
      data: {
        content: "A previously saved message",
        components: [{
          _id: "saved-row",
          type: 1,
          components: [{
            _id: "saved-button",
            type: 2,
            style: 1,
            label: "Saved button",
            custom_id: "saved_button",
          }],
        }],
      },
    });

    expect(useMessageStore.getState().isDirty).toBe(false);
  });

  it("marks real message edits as unsaved and clears them after save", () => {
    useMessageStore.getState().setContent("A new message");

    expect(useMessageStore.getState().isDirty).toBe(true);

    useMessageStore.getState().markClean();

    expect(useMessageStore.getState().isDirty).toBe(false);
  });

  it("tracks attachment and target changes", () => {
    useMessageStore.getState().addUrlAttachment("https://example.com/file.png");

    expect(useMessageStore.getState().isDirty).toBe(true);
  });

  it("tracks action-flow edits but keeps flows loaded from a template clean", () => {
    useActionStore.getState().setFlow("button:test", [{
      _id: "step-1",
      type: "send_ephemeral_reply",
      config: { content: "Hello" },
    }]);

    expect(useActionStore.getState().isDirty).toBe(true);

    useActionStore.getState().loadFromList([{
      customId: "button:test",
      actionType: "send_ephemeral_reply",
      config: { content: "Saved flow" },
      executionOrder: 0,
    }]);

    expect(useActionStore.getState().isDirty).toBe(false);
  });
});
