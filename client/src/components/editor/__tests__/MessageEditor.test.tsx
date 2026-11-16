import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ButtonStyle, ComponentType } from "@dmb/shared";
import { MessageEditor } from "../MessageEditor";
import { useMessageStore } from "../../../store/messageStore";
import { useActionStore } from "../../../store/actionStore";

describe("MessageEditor four-tab workspace", () => {
  beforeEach(() => {
    useMessageStore.getState().reset();
    useActionStore.getState().reset();
  });

  it("renders the four workspace tabs and their count badges", () => {
    render(<MessageEditor index={0} />);

    expect(screen.getByRole("button", { name: /^Content$/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Embeds\s*0/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Components V2\s*0/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Actions\s*0/i })).toBeDefined();
  });

  it("shows the embed empty state and creates the first embed", () => {
    render(<MessageEditor index={0} />);

    fireEvent.click(screen.getByRole("button", { name: /Embeds/i }));
    expect(screen.getByText("No embeds yet")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Create First Embed/i }));

    expect(screen.getByText("Embed #1")).toBeDefined();
    expect(screen.getByText("1 / 10")).toBeDefined();
  });

  it("switches between tabs without discarding message content", () => {
    useMessageStore.getState().setField("content", "Keep this message");
    render(<MessageEditor index={0} />);

    fireEvent.click(screen.getByRole("button", { name: /Components V2/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Content$/i }));

    expect((screen.getByLabelText("Content") as HTMLTextAreaElement).value).toBe("Keep this message");
    expect(useMessageStore.getState().data.content).toBe("Keep this message");
  });

  it("shows an empty state when no action flows belong to this message", () => {
    render(<MessageEditor index={0} />);

    fireEvent.click(screen.getByRole("button", { name: /Actions/i }));
    expect(screen.getByText("No actions configured")).toBeDefined();
  });

  it("lists only flows attached to components in the current message", () => {
    const customId = "message-action-button";
    useMessageStore.getState().setField("components", [{
      _id: "component-1",
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      label: "Run workflow",
      custom_id: customId,
    }] as any);
    useActionStore.getState().addStep(customId, "dud");
    useActionStore.getState().addStep("unrelated-component", "dud");

    render(<MessageEditor index={0} />);
    fireEvent.click(screen.getByRole("button", { name: /Actions/i }));

    expect(screen.getByText("Run workflow")).toBeDefined();
    expect(screen.getByText(customId)).toBeDefined();
    expect(screen.getByText("2 steps")).toBeDefined();
    expect(screen.queryByText("unrelated-component")).toBeNull();
  });

  it("selects the component and requests its existing flow inspector when an action is opened", () => {
    const customId = "message-action-button";
    useMessageStore.getState().setField("components", [{
      _id: "component-2",
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      label: "Open workflow",
      custom_id: customId,
    }] as any);
    useActionStore.getState().addStep(customId, "dud");
    const eventHandler = vi.fn();
    window.addEventListener("hoho:open-component-flow", eventHandler);

    render(<MessageEditor index={0} />);
    fireEvent.click(screen.getByRole("button", { name: /Actions/i }));
    fireEvent.click(screen.getByRole("button", { name: /Open workflow/i }));

    expect(useMessageStore.getState().selection).toEqual({ kind: "component", id: "component-2" });
    expect(eventHandler).toHaveBeenCalledOnce();
    expect((eventHandler.mock.calls[0][0] as CustomEvent).detail).toEqual({ componentId: "component-2" });
    window.removeEventListener("hoho:open-component-flow", eventHandler);
  });

  it("clears the active message after confirmation", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    useMessageStore.getState().setField("content", "Remove me");
    useMessageStore.getState().addEmbed();
    render(<MessageEditor index={0} />);

    fireEvent.click(screen.getByRole("button", { name: /Clear All/i }));

    expect(useMessageStore.getState().data.content).toBe("");
    expect(useMessageStore.getState().data.embeds).toHaveLength(0);
    expect(useMessageStore.getState().data.components).toHaveLength(0);
    expect(confirm).toHaveBeenCalledOnce();
    confirm.mockRestore();
  });

  it("renders Rename, Duplicate and Delete buttons in the message header", () => {
    render(<MessageEditor index={0} />);

    expect(screen.getByTitle("Rename Message")).toBeDefined();
    expect(screen.getByTitle("Duplicate Message")).toBeDefined();
    expect(screen.getByTitle("Delete Message")).toBeDefined();
  });

  it("disables Delete when only one message exists", () => {
    render(<MessageEditor index={0} />);

    expect((screen.getByTitle("Delete Message") as HTMLButtonElement).disabled).toBe(true);
  });

  it("duplicates the current message", () => {
    useMessageStore.getState().setField("content", "Original text");
    render(<MessageEditor index={0} />);

    fireEvent.click(screen.getByTitle("Duplicate Message"));

    expect(useMessageStore.getState().messages).toHaveLength(2);
    expect(useMessageStore.getState().messages[1].content).toBe("Original text");
  });

  it("supports inline message renaming", () => {
    render(<MessageEditor index={0} />);

    fireEvent.click(screen.getByTitle("Rename Message"));
    const input = screen.getByPlaceholderText("Message 1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Welcome Announcement" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("Welcome Announcement")).toBeDefined();
  });

  it("collapses and expands the message workspace", () => {
    render(<MessageEditor index={0} />);

    fireEvent.click(screen.getByTitle("Collapse Message"));
    expect(screen.getByTitle("Expand Message")).toBeDefined();
    fireEvent.click(screen.getByTitle("Expand Message"));
    expect(screen.getByRole("button", { name: /^Content$/i })).toBeDefined();
  });
});
