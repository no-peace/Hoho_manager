import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Markdown } from "../Markdown";

vi.mock("../../../store/globalStore", () => ({
  useGlobalStore: (selector: (state: { currentUser: null; selectedGuildId: null }) => unknown) =>
    selector({ currentUser: null, selectedGuildId: null }),
}));

vi.mock("../../../store/discordCacheStore", () => ({
  useDiscordCacheStore: (selector: (state: {
    guilds: never[];
    weaoExploits: never[];
    fetchWeaoExploits: () => void;
  }) => unknown) => selector({
    guilds: [],
    weaoExploits: [],
    fetchWeaoExploits: vi.fn(),
  }),
}));

vi.mock("../UserPlaceholderPreviewContent", () => ({
  useUserPlaceholderPreview: () => ({
    resolveUserPlaceholders: (value: string) => value,
    showResolved: false,
  }),
}));

describe("Markdown spoiler accessibility", () => {
  it("exposes spoiler reveal as a keyboard-operable button without announcing hidden content", async () => {
    const user = userEvent.setup();
    render(<Markdown content="Before ||secret phrase|| after" />);

    const button = screen.getByRole("button", { name: "Reveal spoiler" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.querySelector("[aria-hidden='true']")?.textContent).toBe("secret phrase");

    await user.click(button);

    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(button.getAttribute("aria-label")).toBe("Hide spoiler");
    expect(button.querySelector("[aria-hidden='false']")?.textContent).toBe("secret phrase");
  });
});
