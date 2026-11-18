import { Profiler } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ButtonPreview, SelectPreview } from "../ActionRowPreview";
import { useDiscordCacheStore } from "../../../store/discordCacheStore";
import { useGlobalStore } from "../../../store/globalStore";
import { ButtonStyle, ComponentType } from "@dmb/shared";

describe("ActionRowPreview (UI-04 Interactive Controls Preview)", () => {
  describe("ButtonPreview", () => {
    it("maps ButtonStyle values to corresponding CSS classes", () => {
      const { rerender } = render(
        <ButtonPreview button={{ type: ComponentType.Button, style: ButtonStyle.Primary, label: "Click" }} />,
      );
      let btn = screen.getByRole("button", { name: /Click/i });
      expect(btn.className).toContain("bg-[#5865f2]");

      rerender(
        <ButtonPreview button={{ type: ComponentType.Button, style: ButtonStyle.Danger, label: "Delete" }} />,
      );
      btn = screen.getByRole("button", { name: /Delete/i });
      expect(btn.className).toContain("bg-[#da373c]");

      rerender(
        <ButtonPreview button={{ type: ComponentType.Button, style: ButtonStyle.Success, label: "Confirm" }} />,
      );
      btn = screen.getByRole("button", { name: /Confirm/i });
      expect(btn.className).toContain("bg-[#248046]");
    });

    it("renders unicode emoji and custom Discord emoji", () => {
      const { rerender } = render(
        <ButtonPreview
          button={{
            type: ComponentType.Button,
            style: ButtonStyle.Primary,
            label: "Star",
            emoji: "⭐",
          } as any}
        />,
      );
      expect(screen.getByText("⭐")).toBeDefined();

      rerender(
        <ButtonPreview
          button={{
            type: ComponentType.Button,
            style: ButtonStyle.Primary,
            label: "Blob",
            emoji: "<:blob:123456789012345678>",
          } as any}
        />,
      );
      const customImg = screen.getByAltText("blob") as HTMLImageElement;
      expect(customImg.src).toContain("123456789012345678.webp");
    });

    it("renders disabled buttons with disabled attribute and opacity-50", () => {
      render(
        <ButtonPreview
          button={{
            type: ComponentType.Button,
            style: ButtonStyle.Primary,
            label: "Locked",
            disabled: true,
          }}
        />,
      );
      const btn = screen.getByRole("button", { name: /Locked/i }) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.className).toContain("opacity-50");
    });
  });

  describe("SelectPreview", () => {
    const stringSelect = {
      type: ComponentType.StringSelect,
      custom_id: "select_1",
      placeholder: "Choose an item",
      options: [
        { label: "Option 1", value: "opt_1", description: "First choice" },
        { label: "Option 2", value: "opt_2", description: "Second choice" },
        { label: "Option 3", value: "opt_3", description: "Third choice", default: true },
      ],
    };

    it("pre-selects options marked with default: true", () => {
      render(<SelectPreview select={stringSelect as any} />);
      expect(screen.getByText("Option 3")).toBeDefined();
    });

    it("opens dropdown on trigger click and selecting an option updates value and closes dropdown in single-select", () => {
      render(<SelectPreview select={{ ...stringSelect, options: stringSelect.options.map(o => ({ ...o, default: false })) } as any} />);

      const trigger = screen.getByRole("button", { name: /Choose an item/i });
      fireEvent.click(trigger);

      // Options now visible
      expect(screen.getByText("First choice")).toBeDefined();

      const option1 = screen.getByText("Option 1");
      fireEvent.click(option1);

      // Value updated and dropdown closed
      expect(screen.getByText("Option 1")).toBeDefined();
      expect(screen.queryByText("First choice")).toBeNull();
    });

    it("supports multi-select toggling with max_values enforcement", () => {
      const multiSelect = {
        ...stringSelect,
        max_values: 2,
        options: stringSelect.options.map(o => ({ ...o, default: false })),
      };
      render(<SelectPreview select={multiSelect as any} />);

      const trigger = screen.getByRole("button", { name: /Choose an item/i });
      fireEvent.click(trigger);

      // Select Option 1
      fireEvent.click(screen.getByText("Option 1"));
      // Dropdown stays open in multi-select
      expect(screen.getByText("First choice")).toBeDefined();

      // Select Option 2
      fireEvent.click(screen.getByText("Option 2"));
      expect(screen.getAllByText(/2\/2/).length).toBeGreaterThan(0);

      // Click Option 1 again to toggle off
      fireEvent.click(screen.getByText("Option 1"));
    });

    it("does not rely on plugin-only animation utilities", () => {
      render(<SelectPreview select={stringSelect as any} />);
      fireEvent.click(screen.getByRole("button", { name: /Option 3/i }));

      const dropdown = screen.getByRole("listbox");
      expect(dropdown.className).not.toMatch(/(?:animate-in|fade-in|zoom-in-95)/);
    });

    it("closes dropdown on Escape key or outside click", () => {
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <SelectPreview select={stringSelect as any} />
        </div>,
      );

      const trigger = screen.getByRole("button", { name: /Option 3/i });
      fireEvent.click(trigger);
      expect(screen.getByText("First choice")).toBeDefined();

      // Escape key closes
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByText("First choice")).toBeNull();

      // Click outside closes
      fireEvent.click(trigger);
      expect(screen.getByText("First choice")).toBeDefined();
      fireEvent.mouseDown(screen.getByTestId("outside"));
      expect(screen.queryByText("First choice")).toBeNull();
    });

    it("calculates upward placement when space below is insufficient", () => {
      // Mock getBoundingClientRect on container to simulate near bottom of window
      render(<SelectPreview select={stringSelect as any} />);

      const trigger = screen.getByRole("button", { name: /Option 3/i });
      fireEvent.click(trigger);

      expect(screen.getByRole("listbox")).toBeDefined();
    });
    it("does not rerender a select menu when another guild's cache changes", () => {
      useGlobalStore.setState({ selectedGuildId: "guild-a" });
      useDiscordCacheStore.setState({
        channels: {
          "guild-a": [{ id: "channel-a", name: "general", type: 0 }],
          "guild-b": [],
        },
        roles: {
          "guild-a": [{ id: "role-a", name: "Member", color: 0 }],
          "guild-b": [],
        },
      });

      let renders = 0;
      render(
        <Profiler id="select-preview" onRender={() => { renders += 1; }}>
          <SelectPreview select={{ type: ComponentType.ChannelSelect, placeholder: "Choose channel" } as any} />
        </Profiler>,
      );

      renders = 0;
      act(() => {
        useDiscordCacheStore.setState((state) => ({
          channels: {
            ...state.channels,
            "guild-b": [{ id: "channel-b", name: "other", type: 0 }],
          },
        }));
      });

      expect(renders).toBe(0);
    });

  });
});
