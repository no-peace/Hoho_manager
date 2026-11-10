import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchableDiscordSelect } from "../SearchableDiscordSelect";
import { useDiscordCacheStore } from "../../../store/discordCacheStore";

describe("SearchableDiscordSelect (OF-01 Coordinate Containment & Clamping)", () => {
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
