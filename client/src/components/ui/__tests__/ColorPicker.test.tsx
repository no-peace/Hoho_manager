import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColorPicker } from "../ColorPicker";
import { EMBED_COLOR_PRESETS } from "../../../utils/constants";

describe("ColorPicker (UX-03 Controlled Hex Draft Typing)", () => {
  it("displays canonical hex string corresponding to integer decimal value", () => {
    // 5793266 is #5865F2 (Discord blurple)
    render(<ColorPicker value={5793266} onChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("#5865f2") as HTMLInputElement;
    expect(input.value.toLowerCase()).toBe("#5865f2");
  });

  it("retains partial draft input without premature reset or overwriting", () => {
    const handleChange = vi.fn();
    render(<ColorPicker value={5793266} onChange={handleChange} />);

    const input = screen.getByPlaceholderText("#5865f2") as HTMLInputElement;

    // Type partial string "5"
    fireEvent.change(input, { target: { value: "5" } });
    expect(input.value).toBe("5");
    expect(handleChange).not.toHaveBeenCalled();

    // Type partial string "58"
    fireEvent.change(input, { target: { value: "58" } });
    expect(input.value).toBe("58");
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("commits valid 6-character hex color to integer onChange", () => {
    const handleChange = vi.fn();
    render(<ColorPicker value={null} onChange={handleChange} />);

    const input = screen.getByPlaceholderText("#5865f2") as HTMLInputElement;

    // Complete valid hex "#5865f2"
    fireEvent.change(input, { target: { value: "5865f2" } });
    expect(handleChange).toHaveBeenCalledWith(5793266);
  });

  it("normalizes hex to canonical #RRGGBB format on blur", () => {
    render(<ColorPicker value={5793266} onChange={vi.fn()} />);

    const input = screen.getByPlaceholderText("#5865f2") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "5865f2" } });
    fireEvent.blur(input);

    expect(input.value.toLowerCase()).toBe("#5865f2");
  });

  it("calls onChange with preset integer value when clicking preset button", () => {
    const handleChange = vi.fn();
    render(<ColorPicker value={null} onChange={handleChange} />);

    const firstPreset = EMBED_COLOR_PRESETS[0];
    const presetBtn = screen.getByLabelText(firstPreset.name);
    fireEvent.click(presetBtn);

    expect(handleChange).toHaveBeenCalledWith(firstPreset.value);
  });

  it("calls onChange(null) when clicking 'None' button", () => {
    const handleChange = vi.fn();
    render(<ColorPicker value={5793266} onChange={handleChange} allowClear={true} />);

    const noneBtn = screen.getByRole("button", { name: "None" });
    fireEvent.click(noneBtn);

    expect(handleChange).toHaveBeenCalledWith(null);
  });
});
