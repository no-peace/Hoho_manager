import { describe, expect, it, vi } from "vitest";
import { applyPreviewComponentSelection } from "../previewSelection";

describe("applyPreviewComponentSelection", () => {
  it("leaves interactive preview controls in control without opening the inspector", () => {
    const store = {
      setActiveMessageIndex: vi.fn(),
      select: vi.fn(),
    };
    const navigateToEditor = vi.fn();

    applyPreviewComponentSelection({
      index: 2,
      componentId: "select-menu",
      isInteractive: true,
      isMobileWorkspace: false,
      store,
      navigateToEditor,
    });

    expect(store.setActiveMessageIndex).not.toHaveBeenCalled();
    expect(store.select).not.toHaveBeenCalled();
    expect(navigateToEditor).not.toHaveBeenCalled();
  });

  it("opens the matching inspector and navigates on desktop for non-interactive elements", () => {
    const store = {
      setActiveMessageIndex: vi.fn(),
      select: vi.fn(),
    };
    const navigateToEditor = vi.fn();

    applyPreviewComponentSelection({
      index: 2,
      componentId: "text-display",
      isInteractive: false,
      isMobileWorkspace: false,
      store,
      navigateToEditor,
    });

    expect(store.setActiveMessageIndex).toHaveBeenCalledOnce();
    expect(store.setActiveMessageIndex).toHaveBeenCalledWith(2);
    expect(store.select).toHaveBeenCalledOnce();
    expect(store.select).toHaveBeenCalledWith({ kind: "component", id: "text-display" });
    expect(navigateToEditor).toHaveBeenCalledOnce();
  });

  it("opens the matching inspector without switching away from mobile preview", () => {
    const store = {
      setActiveMessageIndex: vi.fn(),
      select: vi.fn(),
    };
    const navigateToEditor = vi.fn();

    applyPreviewComponentSelection({
      index: 1,
      componentId: "container",
      isInteractive: false,
      isMobileWorkspace: true,
      store,
      navigateToEditor,
    });

    expect(store.setActiveMessageIndex).toHaveBeenCalledWith(1);
    expect(store.select).toHaveBeenCalledWith({ kind: "component", id: "container" });
    expect(navigateToEditor).not.toHaveBeenCalled();
  });
});
