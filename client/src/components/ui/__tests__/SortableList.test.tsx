import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DragHandle, SortableItem, SortableList, useIsListDragging } from "../SortableList";

const DragStateProbe = () => <span data-testid="drag-state">{String(useIsListDragging())}</span>;

describe("SortableList V16 drag behavior", () => {
  it("provides list-scoped drag state and a compact, non-scaling sortable item", () => {
    const { container } = render(
      <SortableList items={["message-1"]} onReorder={() => undefined} renderOverlay={() => "Message 1"}>
        <SortableItem id="message-1">
          <div>Message card</div>
          <DragHandle label="Drag message" />
          <DragStateProbe />
        </SortableItem>
      </SortableList>,
    );

    expect(screen.getByText("Message card")).toBeTruthy();
    expect(screen.getByTestId("drag-state").textContent).toBe("false");
    expect(screen.getByRole("button", { name: "Drag message" })).toBeTruthy();
    expect(container.querySelector('[data-list-dragging="true"]')).toBeNull();
    expect(container.querySelector('[style*="scaleY"]')).toBeNull();
    expect(container.textContent).not.toContain("scaleY");
  });

  it("keeps the original sortable slot and CSS-only collapse rule in the DOM", () => {
    const { container } = render(
      <SortableList items={["field-1"]} onReorder={() => undefined}>
        <SortableItem id="field-1">
          <div className="sortable-collapse-on-drag">Field editor body</div>
        </SortableItem>
      </SortableList>,
    );

    expect(screen.getByText("Field editor body")).toBeTruthy();
    expect(container.querySelector(".sortable-collapse-on-drag")).not.toBeNull();
    expect(container.querySelector('[data-list-dragging="true"] .sortable-collapse-on-drag')).toBeNull();
  });
});
