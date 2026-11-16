import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageEditor } from "../MessageEditor";
import { useMessageStore } from "../../../store/messageStore";

describe("MessageEditor", () => {
  beforeEach(() => {
    useMessageStore.getState().reset();
  });

  it("renders Message 1 header with badge", () => {
    render(<MessageEditor index={0} />);

    expect(screen.getByText("Message 1")).toBeDefined();
    expect(screen.getByText("Classic")).toBeDefined();
  });

  it("shows the embed empty state and creates the first embed from its call to action", () => {
    render(<MessageEditor index={0} />);

    expect(screen.getByText("No embeds yet")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Create First Embed/i }));

    expect(screen.getByText("Embed #1")).toBeDefined();
    expect(screen.getByText("1 / 10")).toBeDefined();
  });

  it("renders Rename, Duplicate and Delete buttons in toolbar", () => {
    render(<MessageEditor index={0} />);

    expect(screen.getByTitle("Rename Message")).toBeDefined();
    expect(screen.getByTitle("Duplicate Message")).toBeDefined();
    expect(screen.getByTitle("Delete Message")).toBeDefined();
  });

  it("disables Delete button when only one message exists", () => {
    render(<MessageEditor index={0} />);

    const deleteBtn = screen.getByTitle("Delete Message") as HTMLButtonElement;
    expect(deleteBtn.disabled).toBe(true);
  });

  it("duplicates message when Duplicate Message button is clicked", () => {
    useMessageStore.getState().setField("content", "Original text");
    render(<MessageEditor index={0} />);

    const dupBtn = screen.getByTitle("Duplicate Message");
    fireEvent.click(dupBtn);

    const messages = useMessageStore.getState().messages;
    expect(messages.length).toBe(2);
    expect(messages[1].content).toBe("Original text");
  });

  it("allows renaming message through inline rename prompt", () => {
    render(<MessageEditor index={0} />);

    const renameBtn = screen.getByTitle("Rename Message");
    fireEvent.click(renameBtn);

    const renameInput = screen.getByPlaceholderText("Message 1") as HTMLInputElement;
    expect(renameInput).toBeDefined();

    fireEvent.change(renameInput, { target: { value: "Welcome Announcement" } });
    fireEvent.keyDown(renameInput, { key: "Enter" });

    expect(screen.getByText("Welcome Announcement")).toBeDefined();
  });

  it("toggles collapsible content area when clicking header toggle", () => {
    render(<MessageEditor index={0} />);

    const collapseBtn = screen.getByTitle("Collapse Message");
    expect(collapseBtn).toBeDefined();
    fireEvent.click(collapseBtn);

    // After collapsing, title changes to Expand Message
    expect(screen.getByTitle("Expand Message")).toBeDefined();
  });
});
