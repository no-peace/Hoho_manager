import { describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "./clipboard";

describe("copyTextToClipboard", () => {
  it("uses navigator.clipboard when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    await expect(copyTextToClipboard("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to a textarea when the clipboard API is unavailable", async () => {
    const originalClipboard = navigator.clipboard;
    const originalDocument = globalThis.document;

    const body = {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    };
    const textarea = {
      value: "",
      setAttribute: vi.fn(),
      style: {},
      focus: vi.fn(),
      select: vi.fn(),
      setSelectionRange: vi.fn(),
    };

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });

    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        body,
        createElement: vi.fn(() => textarea),
        execCommand: vi.fn(() => true),
      },
    });

    await expect(copyTextToClipboard("hello")).resolves.toBe(true);
    expect((globalThis.document as any).execCommand).toHaveBeenCalledWith("copy");

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });

    if (originalDocument) {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: originalDocument,
      });
    } else {
      delete (globalThis as { document?: Document }).document;
    }
  });
});
