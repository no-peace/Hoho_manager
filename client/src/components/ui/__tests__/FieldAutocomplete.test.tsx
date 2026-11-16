import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TextArea, TextField } from "../Field";

const ControlledTextField = () => {
  const [value, setValue] = useState("");
  return <TextField aria-label="Variable input" value={value} onChange={(event) => setValue(event.target.value)} />;
};

const ControlledTextArea = () => {
  const [value, setValue] = useState("");
  return <TextArea aria-label="Variable textarea" value={value} onChange={(event) => setValue(event.target.value)} />;
};

describe("shared field autocomplete", () => {
  it("shows user variables in TextField when typing an opening brace", () => {
    render(<ControlledTextField />);
    const input = screen.getByRole("textbox", { name: "Variable input" });
    fireEvent.change(input, { target: { value: "{user.", selectionStart: 6, selectionEnd: 6 } });
    expect(screen.getByRole("listbox", { name: "Variable suggestions" })).toBeDefined();
    expect(screen.getByText("{user.mention}")).toBeDefined();
    expect(screen.getByText("{user.username}")).toBeDefined();
  });

  it("shows WEAO suggestions in TextArea while the exploit prefix is being typed", () => {
    render(<ControlledTextArea />);
    const input = screen.getByRole("textbox", { name: "Variable textarea" });
    fireEvent.change(input, { target: { value: "{explo", selectionStart: 6, selectionEnd: 6 } });
    expect(screen.getByRole("listbox", { name: "Variable suggestions" })).toBeDefined();
    expect(screen.getByText("WEAO")).toBeDefined();
  });

  it("supports ArrowDown and Enter to insert a selected variable", () => {
    render(<ControlledTextField />);
    const input = screen.getByRole("textbox", { name: "Variable input" });
    fireEvent.change(input, { target: { value: "{user.", selectionStart: 6, selectionEnd: 6 } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect((input as HTMLInputElement).value).toContain("{user.");
    expect(screen.queryByRole("listbox", { name: "Variable suggestions" })).toBeNull();
  });
});
