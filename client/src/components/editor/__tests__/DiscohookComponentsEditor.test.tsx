import { Profiler } from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ComponentType } from "@dmb/shared";
import { useMessageStore } from "../../../store/messageStore";
import { DiscohookComponentsEditor } from "../DiscohookComponentsEditor";

describe("DiscohookComponentsEditor render isolation", () => {
  beforeEach(() => {
    useMessageStore.getState().reset();
  });

  it("does not rerender a message-scoped editor when another active message changes", () => {
    const first = { content: "First", embeds: [], components: [], flags: 0 } as any;
    const second = { content: "Second", embeds: [], components: [], flags: 0 } as any;
    const firstMessageComponents = [{
      _id: "first-action-row",
      type: ComponentType.ActionRow,
      components: [],
    }] as any;

    useMessageStore.setState({
      data: second,
      messages: [first, second],
      activeMessageIndex: 1,
      selection: null,
      attachedFiles: [],
    });

    let renders = 0;
    render(
      <Profiler id="message-components" onRender={() => { renders += 1; }}>
        <DiscohookComponentsEditor componentsOverride={firstMessageComponents} />
      </Profiler>,
    );

    renders = 0;
    act(() => {
      useMessageStore.getState().setField("content", "Updated second message");
    });

    expect(renders).toBe(0);
  });
});
