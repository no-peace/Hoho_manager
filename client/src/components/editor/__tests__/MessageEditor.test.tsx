import { Profiler } from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { MessageEditor } from "../MessageEditor";
import { useMessageStore } from "../../../store/messageStore";
import { MessagePreview } from "../../preview/MessagePreview";
import { PropertyPanel } from "../PropertyPanel";
import { ComponentType } from "@dmb/shared";

describe("MessageEditor", () => {
  beforeEach(() => {
    useMessageStore.getState().reset();
  });

  it("renders Message 1 header with badge", () => {
    render(<MessageEditor index={0} />);

    expect(screen.getByText("Message 1")).toBeDefined();
    expect(screen.getByText("Classic")).toBeDefined();
  });


  it("does not rerender an unrelated message editor when another message is edited", () => {
    const first = { content: "First message", embeds: [], components: [], flags: 0 } as any;
    const second = { content: "Second message", embeds: [], components: [], flags: 0 } as any;
    useMessageStore.setState({
      data: second,
      messages: [first, second],
      activeMessageIndex: 1,
      selection: null,
      attachedFiles: [],
    });

    let firstEditorRenders = 0;
    let secondEditorRenders = 0;
    render(
      <>
        <Profiler id="first-editor" onRender={() => { firstEditorRenders += 1; }}>
          <MessageEditor index={0} />
        </Profiler>
        <Profiler id="second-editor" onRender={() => { secondEditorRenders += 1; }}>
          <MessageEditor index={1} />
        </Profiler>
      </>,
    );

    firstEditorRenders = 0;
    secondEditorRenders = 0;
    act(() => {
      useMessageStore.getState().setField("content", "Updated second message");
    });

    expect(firstEditorRenders).toBe(0);
    expect(secondEditorRenders).toBe(1);
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

  it("opens a Select Menu in Live Preview and routes selection to the inspector", () => {
    const message = {
      content: "",
      embeds: [],
      flags: 0,
      components: [{
        _id: "row-preview",
        type: ComponentType.ActionRow,
        components: [{
          _id: "select-preview",
          type: ComponentType.StringSelect,
          placeholder: "Choose one",
          options: [{ _id: "option-one", label: "Alpha", value: "alpha" }],
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

    fireEvent.click(screen.getByRole("button", { name: /Choose one/i }));

    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(onSelectPreviewComponent).toHaveBeenCalledWith(0, "select-preview", true);
  });

  it("edits the selected V2 TextDisplay block from the mobile message quick editor", () => {
    const classic = { content: "Classic", embeds: [], components: [], flags: 0 } as any;
    const v2 = {
      content: "",
      embeds: [],
      flags: 1 << 15,
      components: [{ _id: "v2-text-block", type: ComponentType.TextDisplay, content: "Before" }],
    } as any;
    useMessageStore.setState({
      data: classic,
      messages: [classic, v2],
      activeMessageIndex: 0,
      selection: { kind: "message", index: 1 },
      attachedFiles: [],
    });
    render(<PropertyPanel />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Updated V2 text" } });

    const updated = useMessageStore.getState().messages[1];
    expect(updated.components?.[0]?.content).toBe("Updated V2 text");
    expect(useMessageStore.getState().activeMessageIndex).toBe(1);
    expect(useMessageStore.getState().selection).toEqual({ kind: "message", index: 1 });
    expect(screen.getByText("Components V2 Text Block")).toBeTruthy();
  });

  it("routes clicks on an embed author to the owning embed", () => {
    const message = {
      content: "",
      embeds: [{
        _id: "preview-embed",
        author: { name: "Preview Author" },
        title: "Preview Title",
        description: "Preview description",
        fields: [],
        footer: { text: "Preview Footer" },
      }],
      flags: 0,
      components: [],
    } as any;
    useMessageStore.setState({
      data: message,
      messages: [message],
      activeMessageIndex: 0,
      selection: null,
      attachedFiles: [],
    });
    const onSelectPreviewEmbed = vi.fn();
    render(<MessagePreview onSelectPreviewEmbed={onSelectPreviewEmbed} />);

    fireEvent.click(screen.getByText("Preview Author"));

    expect(onSelectPreviewEmbed).toHaveBeenCalledWith(0, "preview-embed", "author", undefined);
  });

  it("routes clicks on an embed footer to the owning embed", () => {
    const message = {
      content: "",
      embeds: [{
        _id: "footer-embed",
        title: "Footer Embed",
        fields: [],
        footer: { text: "Footer target text" },
      }],
      flags: 0,
      components: [],
    } as any;
    useMessageStore.setState({
      data: message,
      messages: [message],
      activeMessageIndex: 0,
      selection: null,
      attachedFiles: [],
    });
    const onSelectPreviewEmbed = vi.fn();
    render(<MessagePreview onSelectPreviewEmbed={onSelectPreviewEmbed} />);

    fireEvent.click(screen.getByText("Footer target text"));

    expect(onSelectPreviewEmbed).toHaveBeenCalledWith(0, "footer-embed", "footer", undefined);
  });

  it("selects the deepest nested Components V2 preview component", () => {
    const message = {
      content: "",
      embeds: [],
      flags: 1 << 15,
      components: [{
        _id: "container-preview",
        type: ComponentType.Container,
        components: [{
          _id: "nested-text-preview",
          type: ComponentType.TextDisplay,
          content: "Nested preview content",
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

    fireEvent.click(screen.getByText("Nested preview content"));

    expect(onSelectPreviewComponent).toHaveBeenCalledWith(0, "nested-text-preview", false);
  });

  it("renders the embed inspector for an embed selection on the active message", () => {
    const first = { content: "First", embeds: [], components: [], flags: 0 } as any;
    const second = {
      content: "",
      embeds: [{
        _id: "selected-embed",
        author: { name: "Selected Author" },
        title: "Selected Embed",
        fields: [],
        footer: { text: "Selected Footer" },
      }],
      components: [],
      flags: 0,
    } as any;
    useMessageStore.setState({
      data: second,
      messages: [first, second],
      activeMessageIndex: 1,
      selection: { kind: "embed", id: "selected-embed", part: "footer" },
      attachedFiles: [],
    });
    render(<PropertyPanel />);

    expect(screen.getByText("Embed Inspector")).toBeTruthy();
    expect(screen.getByText(/Footer · Selected Embed/)).toBeTruthy();
    expect(screen.getByText("Footer & Timestamp")).toBeTruthy();
  });

  it("reopens a collapsed message card when a preview component is selected", () => {
    const message = {
      content: "",
      embeds: [],
      flags: 1 << 15,
      components: [{
        _id: "reveal-text-target",
        type: ComponentType.TextDisplay,
        content: "Reveal this editor card",
      }],
    } as any;
    useMessageStore.setState({
      data: message,
      messages: [message],
      activeMessageIndex: 0,
      selection: null,
      attachedFiles: [],
    });
    render(<MessageEditor index={0} />);

    fireEvent.click(screen.getByTitle("Collapse Message"));
    expect(screen.queryByText("Text #1")).toBeNull();

    act(() => {
      useMessageStore.getState().select({ kind: "component", id: "reveal-text-target" });
    });

    expect(screen.getByText("Text #1")).toBeTruthy();
  });

});
