import dns from "node:dns/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchUrlAttachments } from "../src/utils/urlAttachments.js";

describe("URL attachment SSRF protections", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects loopback and private literal addresses", async () => {
    await expect(
      fetchUrlAttachments([{ url: "http://127.0.0.1/admin" }]),
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      fetchUrlAttachments([{ url: "http://192.168.1.10/private" }]),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects IPv6 NAT64 metadata destinations", async () => {
    await expect(
      fetchUrlAttachments([{ url: "http://[64:ff9b::a9fe:a9fe]/latest/meta-data/" }]),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects hostnames that resolve to a private address before connecting", async () => {
    const lookup = vi.spyOn(dns, "lookup").mockResolvedValue([
      { address: "127.0.0.1", family: 4 },
    ]);

    await expect(
      fetchUrlAttachments([{ url: "https://rebind.example/attachment.png" }]),
    ).rejects.toMatchObject({ status: 400 });

    expect(lookup).toHaveBeenCalledWith("rebind.example", {
      all: true,
      verbatim: true,
    });
  });

  it("returns an empty list when no URL attachments are supplied", async () => {
    await expect(fetchUrlAttachments([])).resolves.toEqual([]);
  });
});
