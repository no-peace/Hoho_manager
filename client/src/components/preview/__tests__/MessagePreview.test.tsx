import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { buildCustomId, ComponentType } from "@dmb/shared";
import { MessagePreview } from "../MessagePreview";
import { useMessageStore } from "../../../store/messageStore";

describe("MessagePreview component click routing", () => {
  beforeEach(() => {
    useMessageStore.getState().reset();
  });

  it("renders without a selected guild or cached roles", () => {
    useMessageStore.getState().reset();

    render(<MessagePreview />);

    expect(screen.getByText("Live Preview")).toBeTruthy();
  });

  it("runs a legacy inline action in the docked Test Flow simulator", async () => {
    const customId = buildCustomId("send_ephemeral_reply", {
      content: "Hello {user.username}",
    });
    const message = {
      content: "",
      embeds: [],
      flags: 0,
      components: [{
        _id: "test-flow-row",
        type: ComponentType.ActionRow,
        components: [{
          _id: "test-flow-button",
          type: ComponentType.Button,
          style: 1,
          label: "Run test action",
          custom_id: customId,
        }],
      }],
    } as any;
    useMessageStore.setState({
      data: message,
      messages: [message],
      activeMessageIndex: 0,
      selection: null,
      attachedFiles: [],
    });

    render(<MessagePreview />);
    fireEvent.click(screen.getByRole("button", { name: /Test Flow/i }));
    fireEvent.click(screen.getByRole("button", { name: "Run test action" }));

    expect(await screen.findByText("Flow Simulation")).toBeTruthy();
    expect(await screen.findByText("Hello DemoUser")).toBeTruthy();
  });

  it("keeps the active message and selection unchanged when an interactive select is clicked", () => {
    const firstMessage = {
      content: "First message",
      embeds: [],
      flags: 0,
      components: [],
    } as any;
    const secondMessage = {
      content: "",
      embeds: [],
      flags: 0,
      components: [
        {
          _id: "interactive-row",
          type: ComponentType.ActionRow,
          components: [
            {
              _id: "interactive-select",
              type: ComponentType.StringSelect,
              placeholder: "Choose an option",
              options: [{ _id: "option-one", label: "Alpha", value: "alpha" }],
            },
          ],
        },
      ],
    } as any;
    const originalSelection = { kind: "message", index: 0 } as const;
    useMessageStore.setState({
      data: firstMessage,
      messages: [firstMessage, secondMessage],
      activeMessageIndex: 0,
      selection: originalSelection,
      attachedFiles: [],
    });
    const onSelectPreviewComponent = vi.fn();

    render(<MessagePreview onSelectPreviewComponent={onSelectPreviewComponent} />);

    fireEvent.click(screen.getByRole("button", { name: /Choose an option/i }));

    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(onSelectPreviewComponent).toHaveBeenCalledWith(1, "interactive-select", true);

    // The portaled options list remains interactive and must not hijack Inspector selection.
    fireEvent.click(screen.getByRole("option", { name: "Alpha" }));
    expect(onSelectPreviewComponent).toHaveBeenCalledWith(1, "interactive-select", true);
    expect(useMessageStore.getState().activeMessageIndex).toBe(0);
    expect(useMessageStore.getState().selection).toEqual(originalSelection);
  });

  it("selects a preview button itself rather than its parent Action Row", () => {
    const message = {
      content: "",
      embeds: [],
      flags: 0,
      components: [{
        _id: "button-row",
        type: ComponentType.ActionRow,
        components: [{
          _id: "preview-button",
          type: ComponentType.Button,
          style: 1,
          label: "Configure me",
          custom_id: "configure_me",
        }],
      }],
    } as any;
    useMessageStore.setState({
      data: message,
      messages: [message],
      activeMessageIndex: 0,
      selection: null,
      attachedFiles: [],
    });
    const onSelectPreviewComponent = vi.fn();

    render(<MessagePreview onSelectPreviewComponent={onSelectPreviewComponent} />);
    fireEvent.click(screen.getByRole("button", { name: "Configure me" }));

    expect(onSelectPreviewComponent).toHaveBeenCalledWith(0, "preview-button", false);
  });

  it("selects the correct message and component for a non-interactive preview element", () => {
    const firstMessage = {
      content: "First message",
      embeds: [],
      flags: 0,
      components: [],
    } as any;
    const secondMessage = {
      content: "",
      embeds: [],
      flags: 1 << 15,
      components: [
        {
          _id: "ordinary-text",
          type: ComponentType.TextDisplay,
          content: "Editable preview text",
        },
      ],
    } as any;
    useMessageStore.setState({
      data: firstMessage,
      messages: [firstMessage, secondMessage],
      activeMessageIndex: 0,
      selection: null,
      attachedFiles: [],
    });
    const onSelectPreviewComponent = vi.fn();

    render(<MessagePreview onSelectPreviewComponent={onSelectPreviewComponent} />);

    fireEvent.click(screen.getByText("Editable preview text"));

    expect(useMessageStore.getState().activeMessageIndex).toBe(1);
    expect(onSelectPreviewComponent).toHaveBeenCalledWith(1, "ordinary-text", false);
  });
});
