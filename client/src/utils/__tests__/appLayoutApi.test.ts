import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultDesktopLayoutData, defaultMobileLayoutData } from "../../config/puck/defaultAppLayouts";
import { appLayoutApi } from "../appLayoutApi";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const documents = () => ({
  desktop: clone(defaultDesktopLayoutData),
  mobile: clone(defaultMobileLayoutData),
});
const jsonResponse = (payload: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: vi.fn().mockResolvedValue(payload),
});

describe("appLayoutApi", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("GETs the published layout with credentials and no cache", async () => {
    const payload = { layout: null, fallback: true };
    fetchMock.mockResolvedValue(jsonResponse(payload));

    await expect(appLayoutApi.getPublished()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("/api/design/app-layout", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  });

  it("PUTs both validated documents as one version-1 payload", async () => {
    const docs = documents();
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, layout: { schemaVersion: 1 } }));

    await appLayoutApi.publish(docs as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/design/app-layout");
    expect(options.method).toBe("PUT");
    expect(options.credentials).toBe("include");
    expect(options.cache).toBe("no-store");
    expect(options.headers).toEqual({
      Accept: "application/json",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(options.body)).toEqual({
      schemaVersion: 1,
      desktop: docs.desktop,
      mobile: docs.mobile,
    });
  });

  it("validates both documents before making a publish request", async () => {
    const docs = documents();
    docs.mobile.content[0].props.defaultPane = "tablet";
    expect(() => appLayoutApi.publish(docs as any)).toThrow(/defaultPane/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces server error messages and HTTP status from failed requests", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Owner access required." }, false, 403));

    const request = appLayoutApi.getPublished();
    await expect(request).rejects.toMatchObject({
      message: "Owner access required.",
      status: 403,
    });
  });

  it("uses a stable fallback error when the server returns no JSON error", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error("invalid json")),
    });

    await expect(appLayoutApi.getPublished()).rejects.toMatchObject({
      message: "Application layout request failed.",
      status: 500,
    });
  });
});
