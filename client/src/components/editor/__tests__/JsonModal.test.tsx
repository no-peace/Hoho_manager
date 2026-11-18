import { Profiler } from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useMessageStore } from "../../../store/messageStore";
import { JsonModal } from "../JsonModal";

describe("JsonModal render isolation", () => {
  beforeEach(() => {
    useMessageStore.getState().reset();
  });

  it("does not rerender for editor updates while closed", () => {
    let renders = 0;
    render(
      <Profiler id="json-modal" onRender={() => { renders += 1; }}>
        <JsonModal open={false} onClose={() => undefined} />
      </Profiler>,
    );

    renders = 0;
    act(() => {
      useMessageStore.getState().setField("content", "Updated while modal is closed");
    });

    expect(renders).toBe(0);
  });
});
