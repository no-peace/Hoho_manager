import { beforeEach, describe, expect, it } from "vitest";
import { EDITOR_MODES } from "../utils/constants";
import { newContainer, newTextDisplay } from "../utils/componentsV2";
import { useMessageStore } from "./messageStore";

beforeEach(() => useMessageStore.getState().reset());

describe("removeComponentById selection", () => {
  it("clears selection when deleting an ancestor of the selected component", () => {
    const child = newTextDisplay("Nested text");
    const parent = newContainer([child]);
    useMessageStore.getState().load({
      mode: EDITOR_MODES.V2,
      data: {
        content: "",
        embeds: [],
        components: [parent],
        username: "",
        avatar_url: "",
        thread_name: "",
      },
    });
    useMessageStore.getState().select({ kind: "component", id: child._id! });

    useMessageStore.getState().removeComponentById(parent._id!);

    expect(useMessageStore.getState().selection).toBeNull();
  });

  it("keeps a selected sibling when another component is deleted", () => {
    const selected = newTextDisplay("Selected");
    const removed = newTextDisplay("Removed");
    useMessageStore.getState().load({
      mode: EDITOR_MODES.V2,
      data: {
        content: "",
        embeds: [],
        components: [selected, removed],
        username: "",
        avatar_url: "",
        thread_name: "",
      },
    });
    useMessageStore.getState().select({ kind: "component", id: selected._id! });

    useMessageStore.getState().removeComponentById(removed._id!);

    expect(useMessageStore.getState().selection).toEqual({ kind: "component", id: selected._id });
  });
});