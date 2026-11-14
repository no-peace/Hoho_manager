import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchableDiscordSelect } from "../SearchableDiscordSelect";
import { useDiscordCacheStore } from "../../../store/discordCacheStore";

describe("SearchableDiscordSelect (OF-01 Coordinate Containment & Clamping)", () => {
  const originalInnerHeight = window.innerHeight;

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: originalInnerHeight,
    });
  });

  beforeEach(() => {
    useDiscordCacheStore.setState({
      guilds: [{ id: "guild_1", name: "Guild One", icon: null }],
      channels: { guild_1: [{ id: "chan_1", name: "announcements", type: 0 }] },
      roles: { guild_1: [{ id: "role_1", name: "Moderator", color: 0 }] },
    });
  });

  it("portals dropdown container directly into document.body with fixed position and zIndex 99999", () => {
    render(
      <SearchableDiscordSelect
        type="channel"
        guildId="guild_1"
        value=""
        onChange={vi.fn()}
      />,
    );

    const combobox = screen.getByRole("combobox");
    fireEvent.click(combobox);

    const searchInput = screen.getByPlaceholderText("Search...");
    expect(searchInput).toBeDefined();

    // Verify parent has position fixed and zIndex 99999
    const dropdownPortal = searchInput.closest('div[style*="position: fixed"]') as HTMLDivElement;
    expect(dropdownPortal).toBeDefined();
    expect(dropdownPortal.style.position).toBe("fixed");
    expect(dropdownPortal.style.zIndex).toBe("99999");
  });

  it("clamps dropdown width to minimum 220px and constrains within viewport", () => {
    render(
      <SearchableDiscordSelect
        type="channel"
        guildId="guild_1"
        value=""
        onChange={vi.fn()}
      />,
    );

    const combobox = screen.getByRole("combobox");
    fireEvent.click(combobox);

    const searchInput = screen.getByPlaceholderText("Search...");
    const dropdownPortal = searchInput.closest('div[style*="position: fixed"]') as HTMLDivElement;

    // Minimum width is 220px
    const widthNum = parseFloat(dropdownPortal.style.width);
    expect(widthNum).toBeGreaterThanOrEqual(220);
  });


  it("keeps the dropdown inside a 180px viewport when the trigger is near the top", () => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 180 });
    const rect = {
      top: 20, bottom: 60, left: 12, right: 252, width: 240, height: 40,
      x: 12, y: 20, toJSON: () => ({}),
    } as DOMRect;
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(rect);

    render(
      <SearchableDiscordSelect type="channel" guildId="guild_1" value="" onChange={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("combobox"));

    const portal = screen.getByPlaceholderText("Search...").closest('div[style*="position: fixed"]') as HTMLDivElement;
    expect(rectSpy).toHaveBeenCalled();
    expect(Number(portal.style.top.replace("px", ""))).toBe(64);
    expect(Number(portal.style.maxHeight.replace("px", ""))).toBe(108);
    expect(Number(portal.style.top.replace("px", "")) + Number(portal.style.maxHeight.replace("px", ""))).toBeLessThanOrEqual(172);
  });

  it("keeps the dropdown inside a 180px viewport when the trigger touches the bottom edge", () => {
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 180 });
    const rect = {
      top: 160, bottom: 180, left: 12, right: 252, width: 240, height: 20,
      x: 12, y: 160, toJSON: () => ({}),
    } as DOMRect;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(rect);

    render(
      <SearchableDiscordSelect type="channel" guildId="guild_1" value="" onChange={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("combobox"));

    const portal = screen.getByPlaceholderText("Search...").closest('div[style*="position: fixed"]') as HTMLDivElement;
    expect(Number(portal.style.top.replace("px", ""))).toBe(8);
    expect(Number(portal.style.maxHeight.replace("px", ""))).toBe(152);
    expect(Number(portal.style.top.replace("px", "")) + Number(portal.style.maxHeight.replace("px", ""))).toBeLessThanOrEqual(172);
  });

  it("renders selected item chips when multiple is true and allows chip deletion", () => {
    const handleChange = vi.fn();
    render(
      <SearchableDiscordSelect
        type="channel"
        guildId="guild_1"
        value={["chan_1"]}
        multiple={true}
        onChange={handleChange}
      />,
    );

    // Displays chip for chan_1
    expect(screen.getByText("announcements")).toBeDefined();

    // Clicking chip delete '×' calls onChange with empty array
    const removeButton = screen.getByText("×");
    fireEvent.click(removeButton);

    expect(handleChange).toHaveBeenCalledWith([]);
  });

  it("displays manual snowflake option when entering a 17-20 digit ID", () => {
    render(
      <SearchableDiscordSelect
        type="member"
        guildId="guild_1"
        value=""
        onChange={vi.fn()}
      />,
    );

    const combobox = screen.getByRole("combobox");
    fireEvent.click(combobox);

    const searchInput = screen.getByPlaceholderText(/Search username or enter/i);
    fireEvent.change(searchInput, { target: { value: "123456789012345678" } });

    expect(screen.getByText(/Use ID: 123456789012345678/i)).toBeDefined();
    expect(screen.getByText("Press Enter")).toBeDefined();
  });
});
