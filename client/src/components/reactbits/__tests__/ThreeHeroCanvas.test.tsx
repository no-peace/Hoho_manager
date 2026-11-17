import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { ThreeHeroCanvas } from "../ThreeHeroCanvas";

describe("ThreeHeroCanvas", () => {
  const originalHardwareConcurrency = Object.getOwnPropertyDescriptor(navigator, "hardwareConcurrency");

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalHardwareConcurrency) {
      Object.defineProperty(navigator, "hardwareConcurrency", originalHardwareConcurrency);
    } else {
      delete (navigator as Navigator & { hardwareConcurrency?: number }).hardwareConcurrency;
    }
  });

  it("redraws its static frame after resize when animation is disabled", () => {
    const gradient = { addColorStop: vi.fn() };
    const context = {
      clearRect: vi.fn(),
      createLinearGradient: vi.fn(() => gradient),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context);
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, value: 2 });

    render(<ThreeHeroCanvas />);

    expect(context.clearRect).toHaveBeenCalledTimes(1);
    fireEvent.resize(window);
    expect(context.clearRect).toHaveBeenCalledTimes(2);
  });
});
