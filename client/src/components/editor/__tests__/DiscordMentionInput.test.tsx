import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DiscordMentionInput } from "../DiscordMentionInput";
import { useGlobalStore } from "../../../store/globalStore";

describe("DiscordMentionInput (UI-03 Markdown Ribbon & Shortcuts)", () => {
  beforeEach(() => {
    useGlobalStore.getState().setCurrentUser({ isAdmin: true } as any);
  });
  it("renders toolbar ribbon with role='toolbar' when showToolbar is true", () => {
    render(<DiscordMentionInput value="" onChange={vi.fn()} showToolbar={true} />);
    expect(screen.getByRole("toolbar", { name: "Markdown formatting" })).toBeDefined();
  });

  it("hides toolbar ribbon when showToolbar is false", () => {
    render(<DiscordMentionInput value="" onChange={vi.fn()} showToolbar={false} />);
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("inserts **bold text** when clicking Bold button on empty textarea", () => {
    const handleChange = vi.fn();
    render(<DiscordMentionInput value="" onChange={handleChange} />);

    const boldButton = screen.getByRole("button", { name: "Bold" });
    fireEvent.click(boldButton);

    expect(handleChange).toHaveBeenCalledWith("**bold text**");
  });

  it("wraps highlighted text in *...* when clicking Italic button", () => {
    const handleChange = vi.fn();
    const { container } = render(<DiscordMentionInput value="hello" onChange={handleChange} />);

    const textarea = container.querySelector("textarea")!;
    textarea.selectionStart = 0;
    textarea.selectionEnd = 5;

    const italicButton = screen.getByRole("button", { name: "Italic" });
    fireEvent.click(italicButton);

    expect(handleChange).toHaveBeenCalledWith("*hello*");
  });

  it("toggles unwrap when clicking Bold button on already bolded text", () => {
    const handleChange = vi.fn();
    const { container } = render(<DiscordMentionInput value="**hello**" onChange={handleChange} />);

    const textarea = container.querySelector("textarea")!;
    textarea.selectionStart = 0;
    textarea.selectionEnd = 9;

    const boldButton = screen.getByRole("button", { name: "Bold" });
    fireEvent.click(boldButton);

    expect(handleChange).toHaveBeenCalledWith("hello");
  });

  it("handles keyboard shortcuts Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+E", () => {
    const handleChange = vi.fn();
    const { container } = render(<DiscordMentionInput value="code" onChange={handleChange} />);

    const textarea = container.querySelector("textarea")!;
    textarea.selectionStart = 0;
    textarea.selectionEnd = 4;

    // Ctrl+B
    fireEvent.keyDown(textarea, { key: "b", ctrlKey: true });
    expect(handleChange).toHaveBeenCalledWith("**code**");

    // Ctrl+I
    fireEvent.keyDown(textarea, { key: "i", ctrlKey: true });
    expect(handleChange).toHaveBeenCalledWith("*code*");

    // Ctrl+U
    fireEvent.keyDown(textarea, { key: "u", ctrlKey: true });
    expect(handleChange).toHaveBeenCalledWith("__code__");

    // Ctrl+E
    fireEvent.keyDown(textarea, { key: "e", ctrlKey: true });
    expect(handleChange).toHaveBeenCalledWith("`code`");
  });

  it("detects @ mention trigger and displays autocomplete options", () => {
    const handleChange = vi.fn();
    const { container } = render(<DiscordMentionInput value="" onChange={handleChange} />);

    const textarea = container.querySelector("textarea")!;
    fireEvent.change(textarea, { target: { value: "@", selectionStart: 1, selectionEnd: 1 } });

    // Autocomplete popup appears
    expect(screen.getByText("Matching Users & Roles")).toBeDefined();
  });
});
