import { describe, expect, it } from "vitest";
import { calculateFloatingPosition } from "../floatingPosition";

describe("calculateFloatingPosition", () => {
  it("opens above the anchor when more space is available above", () => {
    const result = calculateFloatingPosition(
      { top: 420, bottom: 460, left: 120, width: 300 },
      { width: 390, height: 844 },
    );

    expect(result.side).toBe("top");
    expect(result.top).toBeLessThan(420);
    expect(result.left).toBe(120);
  });

  it("opens below the anchor when more space is available below", () => {
    const result = calculateFloatingPosition(
      { top: 80, bottom: 120, left: 24, width: 280 },
      { width: 360, height: 800 },
    );

    expect(result.side).toBe("bottom");
    expect(result.top).toBeGreaterThan(120);
  });

  it("clamps menu width and horizontal position to narrow viewports", () => {
    const result = calculateFloatingPosition(
      { top: 300, bottom: 340, left: 280, width: 320 },
      { width: 320, height: 640 },
      { menuWidth: 288 },
    );

    expect(result.width).toBe(288);
    expect(result.left).toBe(24);
  });

  it("accounts for the visual viewport offset when the mobile keyboard is open", () => {
    const result = calculateFloatingPosition(
      { top: 360, bottom: 400, left: 16, width: 280 },
      { width: 360, height: 300, offsetTop: 280 },
    );

    expect(result.side).toBe("top");
    expect(result.top).toBeGreaterThanOrEqual(284);
  });
});
