import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EmbedData } from "@dmb/shared";
import { EmbedPreview } from "../EmbedPreview";

vi.mock("../../../store/messageStore", () => ({
  useMessageStore: (selector: (state: { attachedFiles: never[] }) => unknown) =>
    selector({ attachedFiles: [] }),
}));

vi.mock("../../../store/globalStore", () => ({
  useGlobalStore: (selector: (state: { currentUser: null; selectedGuildId: null }) => unknown) =>
    selector({ currentUser: null, selectedGuildId: null }),
}));

vi.mock("../../../store/discordCacheStore", () => ({
  useDiscordCacheStore: (selector: (state: { guilds: never[]; roles: Record<string, never[]> }) => unknown) =>
    selector({ guilds: [], roles: {} }),
}));

vi.mock("../UserPlaceholderPreviewContent", () => ({
  useUserPlaceholderPreview: () => ({
    resolveUserPlaceholders: (value: string) => value,
    showResolved: false,
  }),
}));

const renderEmbed = (url: string) => render(
  <EmbedPreview embed={{ _id: "embed-1", title: "Link title", url } as EmbedData} />,
);

describe("EmbedPreview external links", () => {
  it("keeps valid HTTPS links clickable", () => {
    renderEmbed("https://example.com/path");
    expect(screen.getByRole("link", { name: "Link title" })).toHaveAttribute(
      "href",
      "https://example.com/path",
    );
  });

  it.each([
    "javascript:alert(document.domain)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "//example.com/path",
    "not a URL",
  ])("does not render an unsafe or ambiguous URL as a link: %s", (url) => {
    renderEmbed(url);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Link title")).toBeInTheDocument();
  });

  it("keeps valid HTTP links clickable", () => {
    renderEmbed("http://example.com");
    expect(screen.getByRole("link", { name: "Link title" })).toHaveAttribute(
      "href",
      "http://example.com/",
    );
  });
});
