import { useState } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "../Modal";

describe("Modal (UI-06 Accessible Modal Portaling & LIFO Stack)", () => {
  beforeEach(() => {
    document.body.style.overflow = "";
  });

  it("portals dialog into document.body with role='dialog' and aria-modal='true'", () => {
    render(
      <Modal open={true} onClose={vi.fn()} title="Test Dialog">
        <p>Dialog Body</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText("Test Dialog")).toBeDefined();
    expect(screen.getByText("Dialog Body")).toBeDefined();
  });

  it("locks body scroll to overflow: hidden when open", () => {
    const { rerender } = render(
      <Modal open={true} onClose={vi.fn()} title="Scroll Lock">
        <p>Content</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Modal open={false} onClose={vi.fn()} title="Scroll Lock">
        <p>Content</p>
      </Modal>,
    );
  });

  it("calls onClose on backdrop click when closeOnBackdropClick is true", () => {
    const handleClose = vi.fn();
    render(
      <Modal open={true} onClose={handleClose} title="Backdrop Test" closeOnBackdropClick={true}>
        <p>Inside Content</p>
      </Modal>,
    );

    // Click inside modal box does not close
    fireEvent.click(screen.getByText("Inside Content"));
    expect(handleClose).not.toHaveBeenCalled();

    // Click outside backdrop overlay closes
    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement as HTMLElement;
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("enforces LIFO Escape stack: closes topmost modal first", () => {
    const handleCloseA = vi.fn();
    const handleCloseB = vi.fn();

    const NestedModals = () => {
      const [openB, setOpenB] = useState(true);
      return (
        <div>
          <Modal open={true} onClose={handleCloseA} title="Modal A">
            <button onClick={() => setOpenB(true)}>Open B</button>
          </Modal>
          <Modal open={openB} onClose={() => { setOpenB(false); handleCloseB(); }} title="Modal B">
            <p>Nested B</p>
          </Modal>
        </div>
      );
    };

    render(<NestedModals />);

    expect(screen.getByText("Modal A")).toBeDefined();
    expect(screen.getByText("Modal B")).toBeDefined();

    // Press Escape: Modal B closes first (top of stack)
    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleCloseB).toHaveBeenCalledTimes(1);
    expect(handleCloseA).not.toHaveBeenCalled();

    // Press Escape again: Modal A closes next
    fireEvent.keyDown(document, { key: "Escape" });
    expect(handleCloseA).toHaveBeenCalledTimes(1);
  });

  it("restores previously focused element on unmount/close", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open Modal";
    document.body.appendChild(trigger);
    trigger.focus();

    expect(document.activeElement).toBe(trigger);

    const { unmount } = render(
      <Modal open={true} onClose={vi.fn()} title="Focus Restore">
        <button>Inside</button>
      </Modal>,
    );

    // On unmount/close, focus returns to trigger
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
