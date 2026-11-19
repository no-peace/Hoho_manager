import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initializeEditorLenis, scrollToMessageEditor } from "../editorSmoothScroll";

describe("editorSmoothScroll", () => {
  let originalMatchMedia: typeof window.matchMedia;
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn((query: string) => ({
      matches: query.includes("(pointer: coarse)"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })) as typeof window.matchMedia;
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    window.matchMedia = originalMatchMedia;
    document.body.innerHTML = "";
  });

  it("scrolls the editor wrapper to the exact target on touch devices", () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-editor-scroll-container", "");
    const content = document.createElement("div");
    content.setAttribute("data-editor-scroll-content", "");
    const message = document.createElement("section");
    message.setAttribute("data-message-editor-index", "1");
    const embed = document.createElement("div");
    embed.setAttribute("data-editor-target-id", "embed-target");
    const footer = document.createElement("div");
    footer.setAttribute("data-editor-target-id", "embed-target");
    footer.setAttribute("data-editor-target-part", "footer");
    embed.append(footer);
    message.append(embed);
    content.append(message);
    wrapper.append(content);
    document.body.append(wrapper);

    wrapper.getBoundingClientRect = () => new DOMRect(0, 0, 420, 600);
    embed.getBoundingClientRect = () => new DOMRect(0, 120, 300, 80);
    footer.getBoundingClientRect = () => new DOMRect(0, 180, 300, 40);
    Object.defineProperty(wrapper, "scrollTo", { configurable: true, value: vi.fn() });

    cleanup = initializeEditorLenis(wrapper);
    scrollToMessageEditor(1, "embed-target", "footer");

    expect(wrapper.scrollTo).toHaveBeenCalledWith({ top: 164, behavior: "smooth" });
  });

  it("uses immediate native scrolling when reduced motion is requested", () => {
    window.matchMedia = vi.fn((query: string) => ({
      matches: query.includes("(pointer: coarse)") || query.includes("(prefers-reduced-motion: reduce)"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })) as typeof window.matchMedia;

    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-editor-scroll-container", "");
    const message = document.createElement("section");
    message.setAttribute("data-message-editor-index", "0");
    const target = document.createElement("div");
    target.setAttribute("data-editor-target-id", "component-target");
    message.append(target);
    wrapper.append(message);
    document.body.append(wrapper);

    wrapper.getBoundingClientRect = () => new DOMRect(0, 0, 420, 600);
    target.getBoundingClientRect = () => new DOMRect(0, 96, 300, 40);
    Object.defineProperty(wrapper, "scrollTo", { configurable: true, value: vi.fn() });

    cleanup = initializeEditorLenis(wrapper);
    scrollToMessageEditor(0, "component-target");

    expect(wrapper.scrollTop).toBe(80);
    expect(wrapper.scrollTo).not.toHaveBeenCalled();
  });
  it("waits for a hidden mobile editor pane to become visible after delayed state changes", async () => {
    const pane = document.createElement("div");
    pane.className = "invisible";
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-editor-scroll-container", "");
    const message = document.createElement("section");
    message.setAttribute("data-message-editor-index", "0");
    const target = document.createElement("div");
    target.setAttribute("data-editor-target-id", "delayed-target");
    message.append(target);
    wrapper.append(message);
    pane.append(wrapper);
    document.body.append(pane);

    wrapper.getBoundingClientRect = () => new DOMRect(0, 0, 420, 600);
    target.getBoundingClientRect = () => new DOMRect(0, 140, 300, 50);
    Object.defineProperty(wrapper, "scrollTo", { configurable: true, value: vi.fn() });

    cleanup = initializeEditorLenis(wrapper);
    scrollToMessageEditor(0, "delayed-target");
    expect(wrapper.scrollTo).not.toHaveBeenCalled();

    // MutationObserver should react even when visibility changes well after the
    // original eight-frame retry window.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 180));
    pane.classList.remove("invisible");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

    expect(wrapper.scrollTo).toHaveBeenCalledWith({ top: 124, behavior: "smooth" });
  });

  it("waits for a target that is mounted after navigation is requested", async () => {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-editor-scroll-container", "");
    document.body.append(wrapper);
    wrapper.getBoundingClientRect = () => new DOMRect(0, 0, 420, 600);
    Object.defineProperty(wrapper, "scrollTo", { configurable: true, value: vi.fn() });

    cleanup = initializeEditorLenis(wrapper);
    scrollToMessageEditor(2, "late-target");
    expect(wrapper.scrollTo).not.toHaveBeenCalled();

    const message = document.createElement("section");
    message.setAttribute("data-message-editor-index", "2");
    const target = document.createElement("div");
    target.setAttribute("data-editor-target-id", "late-target");
    target.getBoundingClientRect = () => new DOMRect(0, 96, 300, 40);
    message.append(target);
    wrapper.append(message);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));

    expect(wrapper.scrollTo).toHaveBeenCalledWith({ top: 80, behavior: "smooth" });
  });

  it("waits for a hidden mobile editor pane to become visible", async () => {
    const pane = document.createElement("div");
    pane.className = "invisible";
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-editor-scroll-container", "");
    const message = document.createElement("section");
    message.setAttribute("data-message-editor-index", "0");
    const target = document.createElement("div");
    target.setAttribute("data-editor-target-id", "nested-target");
    message.append(target);
    wrapper.append(message);
    pane.append(wrapper);
    document.body.append(pane);

    wrapper.getBoundingClientRect = () => new DOMRect(0, 0, 420, 600);
    target.getBoundingClientRect = () => new DOMRect(0, 140, 300, 50);
    Object.defineProperty(wrapper, "scrollTo", { configurable: true, value: vi.fn() });

    cleanup = initializeEditorLenis(wrapper);
    scrollToMessageEditor(0, "nested-target");
    expect(wrapper.scrollTo).not.toHaveBeenCalled();

    pane.classList.remove("invisible");
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

    expect(wrapper.scrollTo).toHaveBeenCalledWith({ top: 124, behavior: "smooth" });
  });

});
