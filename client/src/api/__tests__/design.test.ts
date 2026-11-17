import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { designApi } from "../design";

const fetchMock = vi.fn<typeof fetch>();

describe("design API theme-publishing permissions", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the server-derived publishing capability with the theme list", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      themes: [],
      isOwner: false,
      canPublishServerTheme: true,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const response = await designApi.themes();

    expect(response.canPublishServerTheme).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/design/themes", expect.objectContaining({
      credentials: "include",
    }));
  });

  it("updates a user's delegated publishing capability through the owner API", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      discordId: "222222222222222222",
      canPublishServerTheme: true,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const response = await designApi.setServerThemePublishAccess("222222222222222222", true);

    expect(response).toEqual({
      ok: true,
      discordId: "222222222222222222",
      canPublishServerTheme: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/design/access/222222222222222222",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canPublishServerTheme: true }),
      }),
    );
  });

  it("surfaces a server-side permission error instead of treating it as success", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      error: "Only the HoHo Manager owner can manage Design Lab access.",
    }), { status: 403, headers: { "Content-Type": "application/json" } }));

    await expect(
      designApi.setServerThemePublishAccess("222222222222222222", true),
    ).rejects.toMatchObject({ message: "Only the HoHo Manager owner can manage Design Lab access.", status: 403 });
  });
});
