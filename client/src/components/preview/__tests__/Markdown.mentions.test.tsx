import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Markdown } from "../Markdown";

const { searchMembers, fetchRoles } = vi.hoisted(() => ({
  searchMembers: vi.fn(),
  fetchRoles: vi.fn(),
}));

vi.mock("../../../api/client", () => ({
  default: {
    discord: {
      searchMembers,
    },
  },
}));

vi.mock("../../../store/globalStore", () => ({
  useGlobalStore: (selector: (state: { currentUser: null; selectedGuildId: string }) => unknown) =>
    selector({ currentUser: null, selectedGuildId: "guild-mentions-test" }),
}));

vi.mock("../../../store/discordCacheStore", () => ({
  useDiscordCacheStore: (selector: (state: {
    guilds: { id: string; name: string; icon: null }[];
    roles: Record<string, never[]>;
    channels: Record<string, never[]>;
    fetchGuilds: () => void;
    fetchRoles: typeof fetchRoles;
    fetchChannels: () => void;
    weaoExploits: never[];
    fetchWeaoExploits: () => void;
  }) => unknown) => selector({
    guilds: [{ id: "guild-mentions-test", name: "Mentions", icon: null }],
    roles: { "guild-mentions-test": [] },
    channels: { "guild-mentions-test": [] },
    fetchGuilds: vi.fn(),
    fetchRoles,
    fetchChannels: vi.fn(),
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

describe("Markdown user mention lookup", () => {
  beforeEach(() => {
    searchMembers.mockReset();
    fetchRoles.mockReset();
    searchMembers.mockImplementation(async (_guildId: string, userId: string) => ({
      members: [{
        id: userId,
        username: `resolved-${userId.slice(-4)}`,
        global_name: null,
        nickname: null,
        avatar: null,
      }],
    }));
  });

  it("resolves user mentions through the guild-scoped member lookup", async () => {
    const userId = "123456789012345678";
    render(<Markdown content={`Hello <@${userId}>`} />);

    await waitFor(() => {
      expect(screen.getByText("@resolved-5678")).toBeTruthy();
    });

    expect(searchMembers).toHaveBeenCalledTimes(1);
    expect(searchMembers).toHaveBeenCalledWith("guild-mentions-test", userId);
  });
});
