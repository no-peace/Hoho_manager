import { Profiler } from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ComponentType } from "@dmb/shared";
import { useMessageStore } from "../../../store/messageStore";
import { LayersPanel } from "../LayersPanel";

describe("LayersPanel render isolation", () => {
  beforeEach(() => {
    useMessageStore.getState().reset();
  });

  it("does not rerender when message fields change but the component tree is unchanged", () => {
    const message = {
      content: "Before",
      embeds: [],
      components: [{ _id: "layer-text", type: ComponentType.TextDisplay, content: "Layer" }],
      flags: 1 << 15,
    } as any;
    useMessageStore.setState({
      data: message,
      messages: [message],
      activeMessageIndex: 0,
      selection: null,
      attachedFiles: [],
    });

    let renders = 0;
    render(
      <Profiler id="layers-panel" onRender={() => { renders += 1; }}>
        <LayersPanel />
      </Profiler>,
    );

    renders = 0;
    act(() => {
      useMessageStore.getState().setField("content", "After");
    });

    expect(renders).toBe(0);
  });
});
