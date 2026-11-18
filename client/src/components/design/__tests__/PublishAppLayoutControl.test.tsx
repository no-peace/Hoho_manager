import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultDesktopLayoutData, defaultMobileLayoutData } from "../../../config/puck/defaultAppLayouts";
import { appLayoutApi } from "../../../utils/appLayoutApi";
import { PublishAppLayoutControl } from "../PublishAppLayoutControl";

vi.mock("../../../utils/appLayoutApi", () => ({
  appLayoutApi: {
    getPublished: vi.fn(),
    publish: vi.fn(),
  },
}));

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const makeDocuments = () => ({
  desktop: clone(defaultDesktopLayoutData),
  mobile: clone(defaultMobileLayoutData),
});
const publishedRecord = {
  schemaVersion: 1 as const,
  desktop: clone(defaultDesktopLayoutData),
  mobile: clone(defaultMobileLayoutData),
  publisher: { discordId: "owner-123" },
  updatedAt: "2026-11-17T10:00:00.000Z",
};

const getPublished = vi.mocked(appLayoutApi.getPublished);
const publish = vi.mocked(appLayoutApi.publish);

describe("PublishAppLayoutControl", () => {
  beforeEach(() => {
    getPublished.mockReset();
    publish.mockReset();
    getPublished.mockResolvedValue({ layout: null, fallback: true });
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  it("does not render the publishing control or request server state for non-owners", () => {
    const { container } = render(
      <PublishAppLayoutControl isOwner={false} documents={makeDocuments() as any} />,
    );

    expect(container.firstChild).toBeNull();
    expect(getPublished).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("validates both Desktop and Mobile documents before confirmation or publishing", async () => {
    const docs = makeDocuments();
    docs.mobile.content[0].props.panelPadding = 999;

    render(<PublishAppLayoutControl isOwner documents={docs as any} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish Desktop + Mobile" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/panelPadding/i));
    expect(window.confirm).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it("requires confirmation and shows success only after the server confirms publishing", async () => {
    let resolvePublish: ((value: any) => void) | undefined;
    publish.mockImplementation(() => new Promise((resolve) => { resolvePublish = resolve; }));

    render(<PublishAppLayoutControl isOwner documents={makeDocuments() as any} />);
    await waitFor(() => expect(getPublished).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Publish Desktop + Mobile" }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Publish both Desktop and Mobile"));
    expect(screen.getByRole("button", { name: /Publishing both layouts/i })).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();

    await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    resolvePublish?.({ ok: true, layout: publishedRecord });

    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/published successfully/i));
    expect(screen.getByText(/by owner-123/i)).toBeTruthy();
  });

  it("shows server errors without reporting a successful publish", async () => {
    publish.mockRejectedValue(new Error("Owner access required."));
    render(<PublishAppLayoutControl isOwner documents={makeDocuments() as any} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish Desktop + Mobile" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Owner access required."));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not publish when the owner cancels confirmation", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    render(<PublishAppLayoutControl isOwner documents={makeDocuments() as any} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish Desktop + Mobile" }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
  });

  it("reports a published-status load failure separately from publish errors", async () => {
    getPublished.mockRejectedValue(new Error("Status endpoint unavailable."));
    render(<PublishAppLayoutControl isOwner documents={makeDocuments() as any} />);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Status endpoint unavailable."));
    expect(screen.getByText(/Published status unavailable/i)).toBeTruthy();
  });
});
