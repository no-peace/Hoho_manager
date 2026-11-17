import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultDesktopLayoutData, defaultMobileLayoutData } from "../../config/puck/defaultAppLayouts";
import { appLayoutApi, type PublishedAppLayoutResponse } from "../../utils/appLayoutApi";
import { usePublishedAppLayout } from "../usePublishedAppLayout";

vi.mock("../../utils/appLayoutApi", () => ({
  appLayoutApi: { getPublished: vi.fn(), publish: vi.fn() },
}));

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const published = (desktopHeight = 72, mobileHeight = 64): PublishedAppLayoutResponse => {
  const desktop = clone(defaultDesktopLayoutData);
  const mobile = clone(defaultMobileLayoutData);
  desktop.content[0].props.height = desktopHeight;
  mobile.content[0].props.height = mobileHeight;
  return {
    fallback: false,
    layout: {
      schemaVersion: 1,
      desktop,
      mobile,
      updatedAt: "2026-11-17T10:00:00.000Z",
      publisher: { discordId: "owner-1" },
    },
  };
};

const getPublished = vi.mocked(appLayoutApi.getPublished);

describe("usePublishedAppLayout", () => {
  let mediaMatches = false;
  let mediaChange: (() => void) | undefined;
  let removeMediaListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mediaMatches = false;
    mediaChange = undefined;
    removeMediaListener = vi.fn();
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      matches: mediaMatches,
      media: "(min-width: 1200px)",
      onchange: null,
      addEventListener: (_type: string, listener: () => void) => { mediaChange = listener; },
      removeEventListener: removeMediaListener,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    getPublished.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses built-in Desktop and Mobile defaults when no published layout exists", async () => {
    getPublished.mockResolvedValue({ layout: null, fallback: true });
    const { result } = renderHook(() => usePublishedAppLayout());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.isFallback).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.publishedRecord).toBeNull();
    expect(result.current.layout.desktop.headerHeight).toBe(56);
    expect(result.current.layout.mobile.headerHeight).toBe(56);
    expect(result.current.activeLayout.headerHeight).toBe(56);
  });

  it("keeps built-in defaults when the initial request fails or returns invalid API data", async () => {
    getPublished.mockRejectedValueOnce(new Error("network unavailable"));
    const failed = renderHook(() => usePublishedAppLayout());
    await waitFor(() => expect(failed.result.current.isLoaded).toBe(true));
    expect(failed.result.current.isFallback).toBe(true);
    expect(failed.result.current.layout.desktop.headerHeight).toBe(56);
    expect(failed.result.current.error).toBe("network unavailable");
    failed.unmount();

    const invalid = published();
    invalid.layout!.desktop = { root: { props: {} }, content: [] } as any;
    getPublished.mockResolvedValueOnce(invalid);
    const malformed = renderHook(() => usePublishedAppLayout());
    await waitFor(() => expect(malformed.result.current.isLoaded).toBe(true));
    expect(malformed.result.current.isFallback).toBe(true);
    expect(malformed.result.current.layout.desktop.headerHeight).toBe(56);
    expect(malformed.result.current.error).toMatch(/required shell sections/i);
    malformed.unmount();

    getPublished.mockResolvedValueOnce({
      ...published(),
      layout: { ...published().layout!, schemaVersion: 9 } as any,
    });
    const unsupported = renderHook(() => usePublishedAppLayout());
    await waitFor(() => expect(unsupported.result.current.isLoaded).toBe(true));
    expect(unsupported.result.current.isFallback).toBe(true);
    expect(unsupported.result.current.layout.desktop.headerHeight).toBe(56);
    expect(unsupported.result.current.error).toMatch(/version is not supported/i);
  });

  it("selects the responsive Desktop or Mobile document and cleans up the media listener", async () => {
    getPublished.mockResolvedValue(published());
    const { result, unmount } = renderHook(() => usePublishedAppLayout());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.activeLayout.headerHeight).toBe(64);

    mediaMatches = true;
    act(() => mediaChange?.());
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.activeLayout.headerHeight).toBe(72);

    unmount();
    expect(removeMediaListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("keeps the last valid published layout after a failed refresh", async () => {
    getPublished
      .mockResolvedValueOnce(published(74, 66))
      .mockRejectedValueOnce(new Error("temporary server error"));
    const { result } = renderHook(() => usePublishedAppLayout());

    await waitFor(() => expect(result.current.publishedRecord).not.toBeNull());
    expect(result.current.activeLayout.headerHeight).toBe(66);

    await act(async () => {
      await result.current.refresh(true);
    });

    expect(result.current.publishedRecord).not.toBeNull();
    expect(result.current.isFallback).toBe(false);
    expect(result.current.activeLayout.headerHeight).toBe(66);
    expect(result.current.error).toBe("temporary server error");
  });

  it("refreshes on navigation return and removes lifecycle listeners on unmount", async () => {
    getPublished.mockResolvedValue(published());
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => usePublishedAppLayout());

    await waitFor(() => expect(getPublished).toHaveBeenCalledTimes(1));
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    await waitFor(() => expect(getPublished).toHaveBeenCalledTimes(2));

    unmount();
    expect(removeSpy).toHaveBeenCalledWith("popstate", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("pageshow", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("popstate", expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
