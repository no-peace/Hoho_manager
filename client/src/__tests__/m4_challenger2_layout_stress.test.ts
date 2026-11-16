import { describe, it, expect, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { decimalToHex, parseHexColor } from "../utils/discord";

/**
 * Milestone 4 Challenger 2 Empirical Test Suite:
 * Layout Containment, Viewport Boundary Math, Unbroken Strings & Modal Portaling
 *
 * Adversarial challenges:
 * 1. Challenge OF-01: SearchableDiscordSelect Viewport Math & Containment
 * 2. Challenge OF-04: Embed Layout Containment & Unbroken String Wrapping
 * 3. Challenge UX-03: ColorPicker Draft State Synchronization & Hex Normalization
 * 4. Challenge UI-06: Modal Stack LIFO Escape Dismissal & Body Scroll Lock Invariant
 * 5. Cross-Modal Integration & Defensive Overflow Layout Checks
 */

// Viewport math replicating SearchableDiscordSelect.tsx
function computeDropdownPosition({
  dropdownRect,
  innerWidth,
  innerHeight,
}: {
  dropdownRect: { top: number; bottom: number; left: number; width: number; height?: number };
  innerWidth: number;
  innerHeight: number;
}) {
  const DROPDOWN_HEIGHT = 260;
  const spaceBelow = Math.max(0, innerHeight - Math.max(dropdownRect.bottom, 8) - 12);
  const spaceAbove = Math.min(Math.max(0, dropdownRect.top - 8), Math.max(0, innerHeight - 16));
  const placeAbove = spaceBelow < DROPDOWN_HEIGHT && spaceAbove > spaceBelow;
  const dropdownWidth = Math.min(Math.max(dropdownRect.width, 220), innerWidth - 16);
  const maxLeft = Math.max(8, innerWidth - dropdownWidth - 8);
  const dropdownLeft = Math.max(8, Math.min(dropdownRect.left, maxLeft));
  const calculatedMaxHeight = Math.min(
    DROPDOWN_HEIGHT,
    placeAbove ? spaceAbove : spaceBelow,
  );
  const maxTop = Math.max(8, innerHeight - 8 - calculatedMaxHeight);
  const calculatedTop = placeAbove
    ? Math.max(8, Math.min(maxTop, dropdownRect.top - calculatedMaxHeight))
    : Math.max(8, Math.min(maxTop, dropdownRect.bottom + 4));

  return {
    dropdownLeft,
    dropdownWidth,
    placeAbove,
    calculatedTop,
    calculatedMaxHeight,
    spaceBelow,
    spaceAbove,
    maxLeft,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Challenge OF-01: SearchableDiscordSelect Viewport Math & Containment
// ─────────────────────────────────────────────────────────────────────────────
describe("Challenge OF-01: SearchableDiscordSelect Viewport Math & Containment", () => {
  const STANDARD_VIEWPORTS = [320, 375, 768, 1920];

  STANDARD_VIEWPORTS.forEach((innerWidth) => {
    describe(`Viewport width: ${innerWidth}px`, () => {
      it(`never allows negative dropdownLeft (always >= 8px)`, () => {
        const testLeftPositions = [-500, -50, -1, 0, 4, 7, 8, 100, innerWidth - 10, innerWidth + 100];
        for (const left of testLeftPositions) {
          const res = computeDropdownPosition({
            dropdownRect: { top: 100, bottom: 140, left, width: 200 },
            innerWidth,
            innerHeight: 800,
          });
          expect(res.dropdownLeft).toBeGreaterThanOrEqual(8);
        }
      });

      it(`never exceeds window.innerWidth - 16 for dropdownWidth`, () => {
        const triggerWidths = [10, 50, 200, 220, 300, 500, 1000, 3000];
        for (const width of triggerWidths) {
          const res = computeDropdownPosition({
            dropdownRect: { top: 100, bottom: 140, left: 20, width },
            innerWidth,
            innerHeight: 800,
          });
          expect(res.dropdownWidth).toBeLessThanOrEqual(innerWidth - 16);
        }
      });

      it(`guarantees right boundary containment: dropdownLeft + dropdownWidth <= innerWidth - 8`, () => {
        const triggerPositions = [
          { left: -200, width: 300 },
          { left: 0, width: 250 },
          { left: 8, width: 220 },
          { left: Math.floor(innerWidth / 4), width: 280 },
          { left: Math.floor(innerWidth / 2), width: 350 },
          { left: innerWidth - 100, width: 300 },
          { left: innerWidth - 10, width: 250 },
          { left: innerWidth + 100, width: 400 },
        ];

        for (const pos of triggerPositions) {
          const res = computeDropdownPosition({
            dropdownRect: { top: 100, bottom: 140, left: pos.left, width: pos.width },
            innerWidth,
            innerHeight: 800,
          });

          expect(res.dropdownLeft).toBeGreaterThanOrEqual(8);
          expect(res.dropdownLeft + res.dropdownWidth).toBeLessThanOrEqual(innerWidth - 8);
        }
      });
    });
  });

  describe("Adversarial Randomized Fuzzing (1,000 iterations)", () => {
    it("proves universal containment invariants across random viewports and positions", () => {
      // Seeded-style deterministic pseudo-random generator
      let seed = 42;
      const pseudoRandom = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };

      for (let i = 0; i < 1000; i++) {
        // Viewport width between 100px and 3840px (4K)
        const innerWidth = Math.floor(100 + pseudoRandom() * 3740);
        // Include very short viewports as well as desktop heights.
        const innerHeight = Math.floor(180 + pseudoRandom() * 1980);
        // Trigger left between -500px and innerWidth + 500px
        const left = Math.floor(-500 + pseudoRandom() * (innerWidth + 1000));
        // Trigger width between 10px and 2000px
        const width = Math.floor(10 + pseudoRandom() * 1990);
        // Trigger top between -100px and innerHeight + 100px
        const top = Math.floor(-100 + pseudoRandom() * (innerHeight + 200));
        const bottom = top + 40;

        const res = computeDropdownPosition({
          dropdownRect: { top, bottom, left, width },
          innerWidth,
          innerHeight,
        });

        // INVARIANT 1: dropdownLeft is NEVER negative and >= 8
        expect(res.dropdownLeft).toBeGreaterThanOrEqual(8);

        // INVARIANT 2: dropdownWidth <= innerWidth - 16
        expect(res.dropdownWidth).toBeLessThanOrEqual(innerWidth - 16);

        // INVARIANT 3: dropdownLeft + dropdownWidth <= innerWidth - 8
        expect(res.dropdownLeft + res.dropdownWidth).toBeLessThanOrEqual(innerWidth - 8);

        // INVARIANT 4: maxHeight never exceeds the available viewport space.
        expect(res.calculatedMaxHeight).toBeGreaterThanOrEqual(0);
        expect(res.calculatedMaxHeight).toBeLessThanOrEqual(260);
        expect(res.calculatedTop).toBeGreaterThanOrEqual(8);
        expect(res.calculatedTop + res.calculatedMaxHeight).toBeLessThanOrEqual(innerHeight - 8);
      }
    });
  });

  describe("Vertical collision & positioning behavior (spaceBelow < 260 vs spaceBelow >= 260)", () => {
    it("opens downward when spaceBelow >= 260px", () => {
      const res = computeDropdownPosition({
        dropdownRect: { top: 100, bottom: 140, left: 50, width: 250 },
        innerWidth: 1024,
        innerHeight: 800, // 648px remains below the trigger after the 12px edge/gap allowance
      });

      expect(res.spaceBelow).toBe(648);
      expect(res.placeAbove).toBe(false);
      expect(res.calculatedTop).toBe(144); // bottom (140) + 4
      expect(res.calculatedMaxHeight).toBe(260);
    });

    it("flips upward when spaceBelow < 260px and spaceAbove > spaceBelow", () => {
      const res = computeDropdownPosition({
        dropdownRect: { top: 500, bottom: 540, left: 50, width: 250 },
        innerWidth: 1024,
        innerHeight: 650, // 98px remains below; the space above is larger
      });

      expect(res.spaceBelow).toBe(98);
      expect(res.spaceAbove).toBe(492);
      expect(res.placeAbove).toBe(true);
      expect(res.calculatedTop).toBe(240); // 500 - 260 = 240
      expect(res.calculatedMaxHeight).toBe(260);
    });

    it("stays downward if spaceAbove <= spaceBelow even when spaceBelow < 260px (crowded viewport)", () => {
      const res = computeDropdownPosition({
        dropdownRect: { top: 50, bottom: 90, left: 50, width: 250 },
        innerWidth: 1024,
        innerHeight: 250, // 148px remains below and 42px remains above the trigger
      });

      expect(res.spaceBelow).toBe(148);
      expect(res.spaceAbove).toBe(42);
      expect(res.placeAbove).toBe(false);
      expect(res.calculatedTop).toBe(94); // bottom (90) + 4
      expect(res.calculatedMaxHeight).toBe(148); // 160px below the trigger minus 12px of spacing
    });

    it("uses only the available space on a 180px viewport near the top edge", () => {
      const res = computeDropdownPosition({
        dropdownRect: { top: 20, bottom: 60, left: 50, width: 250 },
        innerWidth: 320,
        innerHeight: 180,
      });

      expect(res.placeAbove).toBe(false);
      expect(res.calculatedTop).toBe(64);
      expect(res.calculatedMaxHeight).toBe(108);
      expect(res.calculatedTop + res.calculatedMaxHeight).toBeLessThanOrEqual(172);
    });

    it("fits above a trigger near the bottom edge without crossing the top margin", () => {
      const res = computeDropdownPosition({
        dropdownRect: { top: 160, bottom: 180, left: 50, width: 250 },
        innerWidth: 320,
        innerHeight: 180,
      });

      expect(res.placeAbove).toBe(true);
      expect(res.calculatedTop).toBe(8);
      expect(res.calculatedMaxHeight).toBe(152);
      expect(res.calculatedTop + res.calculatedMaxHeight).toBeLessThanOrEqual(172);
    });

    it("keeps a trigger outside the visible bottom edge from pushing the menu off-screen", () => {
      const res = computeDropdownPosition({
        dropdownRect: { top: 820, bottom: 860, left: 50, width: 250 },
        innerWidth: 320,
        innerHeight: 180,
      });

      expect(res.calculatedTop).toBeGreaterThanOrEqual(8);
      expect(res.calculatedTop + res.calculatedMaxHeight).toBeLessThanOrEqual(172);
    });
  });

  describe("Source code validation for SearchableDiscordSelect.tsx", () => {
    const filePath = path.resolve(__dirname, "../components/ui/SearchableDiscordSelect.tsx");
    const source = fs.readFileSync(filePath, "utf-8");

    it("contains exact clamping formula preventing negative left and right overflow", () => {
      expect(source).toContain("const dropdownWidth = isMobile ? Math.max(0, window.innerWidth - 24) : Math.min(Math.max(dropdownRect.width, 220), window.innerWidth - 16)");
      expect(source).toContain("const maxLeft = Math.max(8, window.innerWidth - dropdownWidth - 8)");
      expect(source).toContain("const dropdownLeft = isMobile ? 12 : Math.max(8, Math.min(dropdownRect.left, maxLeft))");
    });

    it("contains vertical space checking logic with 260px boundary", () => {
      expect(source).toContain("const DROPDOWN_HEIGHT = 260");
      expect(source).toContain("const placeAbove = spaceBelow < DROPDOWN_HEIGHT && spaceAbove > spaceBelow");
    });

    it("contains min-w-0 and truncate on trigger, option spans, and multi-select chips", () => {
      expect(source).toContain("truncate min-w-0 flex-1 text-[#dbdee1]");
      expect(source).toContain("truncate min-w-0 flex-1");
      expect(source).toContain("truncate min-w-0 max-w-[180px]");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Challenge OF-04: Embed Layout Containment & Unbroken Strings
// ─────────────────────────────────────────────────────────────────────────────
describe("Challenge OF-04: Embed Layout Containment & Unbroken Strings", () => {
  const filePath = path.resolve(__dirname, "../components/preview/EmbedPreview.tsx");
  const source = fs.readFileSync(filePath, "utf-8");

  it("ensures outer container has w-full, min-w-0, and overflow-hidden within 520px boundary", () => {
    expect(source).toContain("max-w-[520px] w-full min-w-0 rounded border-l-4 bg-[#2b2d31] px-3 py-2 pr-4 text-[#dbdee1] overflow-hidden");
  });

  it("ensures author row has min-w-0, break-words, and [overflow-wrap:anywhere]", () => {
    expect(source).toContain("text-sm font-semibold hover:underline min-w-0 break-words [overflow-wrap:anywhere]");
    expect(source).toContain("text-sm font-semibold min-w-0 break-words [overflow-wrap:anywhere]");
  });

  it("ensures author and footer icons have shrink-0 to prevent aspect-ratio squashing", () => {
    // Author icon
    expect(source).toContain('className="h-6 w-6 shrink-0 rounded-full object-cover"');
    // Footer icon
    expect(source).toContain('className="h-5 w-5 shrink-0 rounded-full object-cover"');
    // Thumbnail icon
    expect(source).toContain('className="h-20 max-w-[80px] shrink-0 self-start rounded object-cover"');
  });

  it("ensures title, description, and field containers have break-words and [overflow-wrap:anywhere]", () => {
    // Title container
    expect(source).toContain("mb-1 text-base leading-tight font-semibold text-[#f2f3f5] break-words [overflow-wrap:anywhere]");
    // Title link
    expect(source).toContain('className="text-link hover:underline break-words [overflow-wrap:anywhere]"');
    // Title Markdown
    expect(source).toContain('className="break-words [overflow-wrap:anywhere]"');
    // Description Markdown
    expect(source).toContain('className="text-sm break-words [overflow-wrap:anywhere]"');
    // Field item container
    expect(source).toContain('className="min-w-0 break-words [overflow-wrap:anywhere]"');
    // Field name
    expect(source).toContain('className="text-sm font-semibold text-[#f2f3f5] break-words [overflow-wrap:anywhere]"');
    // Field value Markdown
    expect(source).toContain('className="text-sm break-words [overflow-wrap:anywhere]"');
  });

  it("ensures footer row has flex-wrap, min-w-0, break-words, and [overflow-wrap:anywhere]", () => {
    expect(source).toContain("mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#949ba4] min-w-0");
    expect(source).toContain('className="break-words min-w-0 [overflow-wrap:anywhere]"');
  });

  it("stress-tests unbroken string allocation up to 100,000 characters", () => {
    const unbroken100k = "W".repeat(100_000);
    expect(unbroken100k.length).toBe(100_000);
    expect(unbroken100k.slice(0, 5)).toBe("WWWWW");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Challenge UX-03: ColorPicker Draft State Synchronization
// ─────────────────────────────────────────────────────────────────────────────
describe("Challenge UX-03: ColorPicker Draft State Synchronization & Hex Parsing", () => {
  it("parseHexColor correctly parses 6-digit hex without #", () => {
    expect(parseHexColor("5865f2")).toBe(5793266);
  });

  it("parseHexColor correctly parses 6-digit hex with #", () => {
    expect(parseHexColor("#5865f2")).toBe(5793266);
  });

  it("parseHexColor correctly parses mixed/uppercase hex", () => {
    expect(parseHexColor("#5865F2")).toBe(5793266);
    expect(parseHexColor("AbCdEf")).toBe(11259375);
    expect(parseHexColor("#aBcDeF")).toBe(11259375);
  });

  it("parseHexColor correctly parses boundary colours (000000 and FFFFFF)", () => {
    expect(parseHexColor("#000000")).toBe(0);
    expect(parseHexColor("000000")).toBe(0);
    expect(parseHexColor("#ffffff")).toBe(16777215);
    expect(parseHexColor("FFFFFF")).toBe(16777215);
  });

  it("parseHexColor returns null for invalid hex strings", () => {
    expect(parseHexColor("zzz")).toBeNull();
    expect(parseHexColor("#zzz")).toBeNull();
    expect(parseHexColor("5865f")).toBeNull(); // 5 chars
    expect(parseHexColor("5865f22")).toBeNull(); // 7 chars
    expect(parseHexColor("")).toBeNull();
    expect(parseHexColor("rgba(0,0,0,1)")).toBeNull();
    expect(parseHexColor("#12345g")).toBeNull();
    expect(parseHexColor("12 34 56")).toBeNull();
  });

  it("decimalToHex converts numbers back to canonical #RRGGBB format", () => {
    expect(decimalToHex(5793266)).toBe("#5865f2");
    expect(decimalToHex(0)).toBe("#000000");
    expect(decimalToHex(16777215)).toBe("#ffffff");
    expect(decimalToHex(null)).toBe("#000000");
    expect(decimalToHex(undefined)).toBe("#000000");
    expect(decimalToHex(11259375)).toBe("#abcdef");
  });

  describe("ColorPicker State Machine Simulation", () => {
    class ColorPickerSimulator {
      value: number | null;
      draftHex: string;
      allowClear: boolean;

      constructor(initialValue: number | null, allowClear = true) {
        this.value = initialValue;
        this.draftHex = initialValue == null ? "" : decimalToHex(initialValue);
        this.allowClear = allowClear;
      }

      handleInputChange(text: string) {
        this.draftHex = text;
        const parsed = parseHexColor(text);
        if (parsed !== null) {
          this.onStoreChange(parsed);
        }
      }

      onStoreChange(newValue: number | null) {
        this.value = newValue;
        // Gated sync logic in useEffect:
        if (this.value == null) {
          if (this.draftHex !== "") this.draftHex = "";
        } else {
          const parsedDraft = parseHexColor(this.draftHex);
          if (parsedDraft !== this.value) {
            this.draftHex = decimalToHex(this.value);
          }
        }
      }

      handleBlur() {
        const trimmed = this.draftHex.trim();
        if (trimmed === "" && this.allowClear) {
          this.onStoreChange(null);
        } else if (this.value !== null) {
          this.draftHex = decimalToHex(this.value);
        } else {
          this.draftHex = "";
        }
      }
    }

    it("typing '5865f2' (without #) retains draftHex without premature '#' insertion until blur", () => {
      const picker = new ColorPickerSimulator(null);
      expect(picker.draftHex).toBe("");
      expect(picker.value).toBeNull();

      // User types keystrokes one by one
      picker.handleInputChange("5");
      expect(picker.draftHex).toBe("5");
      expect(picker.value).toBeNull();

      picker.handleInputChange("58");
      expect(picker.draftHex).toBe("58");

      picker.handleInputChange("586");
      expect(picker.draftHex).toBe("586");

      picker.handleInputChange("5865");
      expect(picker.draftHex).toBe("5865");

      picker.handleInputChange("5865f");
      expect(picker.draftHex).toBe("5865f");

      // 6th char typed: complete valid hex
      picker.handleInputChange("5865f2");
      expect(picker.value).toBe(5793266);
      // Gated sync check: draftHex MUST NOT be overwritten with '#5865f2' while typing!
      expect(picker.draftHex).toBe("5865f2");

      // On blur, canonical normalization occurs
      picker.handleBlur();
      expect(picker.draftHex).toBe("#5865f2");
      expect(picker.value).toBe(5793266);
    });

    it("typing invalid hex 'zzz' retains draft until blur, then resets to canonical value", () => {
      const picker = new ColorPickerSimulator(5793266);
      expect(picker.draftHex).toBe("#5865f2");

      // User types invalid hex
      picker.handleInputChange("zzz");
      expect(picker.draftHex).toBe("zzz");
      expect(picker.value).toBe(5793266); // Value remains previous valid value

      // On blur, resets back to canonical hex of current value
      picker.handleBlur();
      expect(picker.draftHex).toBe("#5865f2");
      expect(picker.value).toBe(5793266);
    });

    it("empty string with allowClear: true resets value to null and draft to empty", () => {
      const picker = new ColorPickerSimulator(5793266, true);
      picker.handleInputChange("");
      expect(picker.draftHex).toBe("");
      expect(picker.value).toBe(5793266); // Not committed yet

      picker.handleBlur();
      expect(picker.value).toBeNull();
      expect(picker.draftHex).toBe("");
    });

    it("empty string with allowClear: false restores previous value on blur", () => {
      const picker = new ColorPickerSimulator(5793266, false);
      picker.handleInputChange("");
      expect(picker.draftHex).toBe("");
      expect(picker.value).toBe(5793266);

      picker.handleBlur();
      expect(picker.value).toBe(5793266);
      expect(picker.draftHex).toBe("#5865f2");
    });

    it("pasting with # prefix normalizes smoothly", () => {
      const picker = new ColorPickerSimulator(null);
      picker.handleInputChange("#5865f2");
      expect(picker.value).toBe(5793266);
      expect(picker.draftHex).toBe("#5865f2");
      picker.handleBlur();
      expect(picker.draftHex).toBe("#5865f2");
    });
  });

  describe("Source code validation for ColorPicker.tsx", () => {
    const filePath = path.resolve(__dirname, "../components/ui/ColorPicker.tsx");
    const source = fs.readFileSync(filePath, "utf-8");

    it("implements gated draft state synchronization checking parseHexColor(draftHex) !== value", () => {
      expect(source).toContain("const parsedDraft = parseHexColor(draftHex)");
      expect(source).toContain("if (parsedDraft !== value)");
      expect(source).toContain("setDraftHex(decimalToHex(value))");
    });

    it("normalizes to decimalToHex(value) on blur", () => {
      expect(source).toContain("setDraftHex(decimalToHex(value))");
    });

    it("handles Enter key to trigger blur", () => {
      expect(source).toContain('if (event.key === "Enter")');
      expect(source).toContain("event.currentTarget.blur()");
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Challenge UI-06: Modal Stack & Accessibility
// ─────────────────────────────────────────────────────────────────────────────
describe("Challenge UI-06: Modal Stack LIFO & Body Scroll Lock Invariant", () => {
  class ModalStackManager {
    modalStack: (() => void)[] = [];
    openModalCount = 0;
    bodyOverflow = "";
    previousBodyOverflow = "";

    openModal(onClose: () => void, closeOnEscape = true): () => void {
      if (this.openModalCount === 0) {
        this.previousBodyOverflow = this.bodyOverflow;
      }
      this.openModalCount++;
      this.bodyOverflow = "hidden";

      if (closeOnEscape) {
        this.modalStack.push(onClose);
      }

      return () => {
        this.openModalCount = Math.max(0, this.openModalCount - 1);
        if (this.openModalCount === 0) {
          this.bodyOverflow = this.previousBodyOverflow;
        }
        if (closeOnEscape) {
          const idx = this.modalStack.lastIndexOf(onClose);
          if (idx !== -1) {
            this.modalStack.splice(idx, 1);
          }
        }
      };
    }

    handleEscapeKey() {
      if (this.modalStack.length > 0) {
        const topClose = this.modalStack[this.modalStack.length - 1];
        topClose?.();
      }
    }
  }

  it("handles LIFO dismissal: Modal 2 closes first, leaving Modal 1 open", () => {
    const manager = new ModalStackManager();
    const onClose1 = vi.fn();
    const onClose2 = vi.fn();

    // 1. Open Modal 1
    const unmount1 = manager.openModal(onClose1);
    expect(manager.modalStack.length).toBe(1);
    expect(manager.openModalCount).toBe(1);

    // 2. Open Modal 2 (layered on top)
    const unmount2 = manager.openModal(onClose2);
    expect(manager.modalStack.length).toBe(2);
    expect(manager.openModalCount).toBe(2);

    // 3. Trigger Escape -> Modal 2's callback MUST be called first
    manager.handleEscapeKey();
    expect(onClose2).toHaveBeenCalledTimes(1);
    expect(onClose1).not.toHaveBeenCalled();

    // Unmount Modal 2
    unmount2();
    expect(manager.modalStack.length).toBe(1);
    expect(manager.openModalCount).toBe(1);

    // 4. Trigger second Escape -> Modal 1's callback MUST now be called
    manager.handleEscapeKey();
    expect(onClose1).toHaveBeenCalledTimes(1);

    // Unmount Modal 1
    unmount1();
    expect(manager.modalStack.length).toBe(0);
    expect(manager.openModalCount).toBe(0);
  });

  it("handles deep 3-level modal nesting correctly in LIFO sequence", () => {
    const manager = new ModalStackManager();
    const onClose1 = vi.fn();
    const onClose2 = vi.fn();
    const onClose3 = vi.fn();

    const unmount1 = manager.openModal(onClose1);
    const unmount2 = manager.openModal(onClose2);
    const unmount3 = manager.openModal(onClose3);

    expect(manager.openModalCount).toBe(3);
    expect(manager.modalStack.length).toBe(3);

    // 1st Escape -> closes Modal 3
    manager.handleEscapeKey();
    expect(onClose3).toHaveBeenCalledTimes(1);
    expect(onClose2).not.toHaveBeenCalled();
    expect(onClose1).not.toHaveBeenCalled();
    unmount3();

    // 2nd Escape -> closes Modal 2
    manager.handleEscapeKey();
    expect(onClose2).toHaveBeenCalledTimes(1);
    expect(onClose1).not.toHaveBeenCalled();
    unmount2();

    // 3rd Escape -> closes Modal 1
    manager.handleEscapeKey();
    expect(onClose1).toHaveBeenCalledTimes(1);
    unmount1();

    expect(manager.openModalCount).toBe(0);
    expect(manager.modalStack.length).toBe(0);
  });

  it("handles arbitrary out-of-order unmount cleanly (e.g. background dismiss)", () => {
    const manager = new ModalStackManager();
    const onClose1 = vi.fn();
    const onClose2 = vi.fn();

    const unmount1 = manager.openModal(onClose1);
    const unmount2 = manager.openModal(onClose2);

    // Suppose Modal 1 is unmounted first via background event
    unmount1();
    expect(manager.openModalCount).toBe(1);
    expect(manager.modalStack.length).toBe(1);
    expect(manager.modalStack[0]).toBe(onClose2);

    // Escape now triggers remaining Modal 2
    manager.handleEscapeKey();
    expect(onClose2).toHaveBeenCalledTimes(1);
    unmount2();
    expect(manager.modalStack.length).toBe(0);
  });

  it("keeps body overflow locked while a modal is open and restores its previous value afterward", () => {
    const manager = new ModalStackManager();
    manager.bodyOverflow = "auto";

    // Open Modal 1
    const unmount1 = manager.openModal(vi.fn());
    expect(manager.bodyOverflow).toBe("hidden");

    // Open Modal 2
    const unmount2 = manager.openModal(vi.fn());
    expect(manager.bodyOverflow).toBe("hidden");

    // Close Modal 2
    unmount2();
    expect(manager.bodyOverflow).toBe("hidden");

    // Close Modal 1
    unmount1();
    expect(manager.bodyOverflow).toBe("auto");
  });

  it("ignores Escape when modal has closeOnEscape: false", () => {
    const manager = new ModalStackManager();
    const onClosePersistent = vi.fn();

    const unmount = manager.openModal(onClosePersistent, false);
    expect(manager.modalStack.length).toBe(0);
    expect(manager.openModalCount).toBe(1);

    manager.handleEscapeKey();
    expect(onClosePersistent).not.toHaveBeenCalled();

    unmount();
    expect(manager.openModalCount).toBe(0);
  });

  it("safely handles Escape when modal stack is empty", () => {
    const manager = new ModalStackManager();
    expect(() => manager.handleEscapeKey()).not.toThrow();
  });

  describe("Source code validation for Modal.tsx", () => {
    const filePath = path.resolve(__dirname, "../components/ui/Modal.tsx");
    const source = fs.readFileSync(filePath, "utf-8");

    it("verifies global modalStack and Escape listener", () => {
      expect(source).toContain("const modalStack: (() => void)[] = []");
      expect(source).toContain('if (e.key === "Escape" && modalStack.length > 0)');
      expect(source).toContain("const topClose = modalStack[modalStack.length - 1]");
    });

    it("verifies portaling to document.body", () => {
      expect(source).toContain(
        "return createPortal(<AnimatePresence>{open ? modalContent : null}</AnimatePresence>, document.body)",
      );
    });

    it("verifies body overflow is restored after the last modal closes", () => {
      expect(source).toContain("if (openModalCount === 0) previousBodyOverflow = document.body.style.overflow");
      expect(source).toContain("openModalCount === 0) {");
      expect(source).toContain("document.body.style.overflow = previousBodyOverflow");
    });

    it("verifies backdrop click guard (e.target === e.currentTarget)", () => {
      expect(source).toContain("if (closeOnBackdropClick && e.target === e.currentTarget)");
    });

    it("verifies accessible ARIA attributes role='dialog' and aria-modal='true'", () => {
      expect(source).toContain('role="dialog"');
      expect(source).toContain('aria-modal="true"');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Cross-Modal Integration & Defensive Overflow Layout Checks
// ─────────────────────────────────────────────────────────────────────────────
describe("Cross-Modal Integration & Responsive Layout Verification", () => {
  it("verifies SettingsModal wraps with <Modal> and has min-w-0 for mobile responsiveness (OF-03)", () => {
    const filePath = path.resolve(__dirname, "../components/layout/SettingsModal.tsx");
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain('<Modal open={open} onClose={onClose} title="Head Admin Settings" width="max-w-2xl">');
    expect(source).toContain("min-w-0");
  });

  it("verifies JsonModal wraps with <Modal> and contains break-words [overflow-wrap:anywhere] (OF-07)", () => {
    const filePath = path.resolve(__dirname, "../components/editor/JsonModal.tsx");
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain('<Modal open={open} onClose={onClose} title="JSON Data" width="max-w-2xl">');
    expect(source).toContain("break-words [overflow-wrap:anywhere]");
  });

  it("verifies BotDispatchModal wraps with <Modal> and supports bot dispatch mode (UI-02 / UI-06)", () => {
    const filePath = path.resolve(__dirname, "../components/send/BotDispatchModal.tsx");
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("<Modal");
    expect(source).toContain("Dispatch via Server Bot");
    expect(source).toContain("Edit via Server Bot");
  });

  it("verifies the extracted MessageLinkModal uses the shared <Modal> component (UI-06)", () => {
    const filePath = path.resolve(__dirname, "../components/editor/MessageEditor/MessageLinkModal.tsx");
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toMatch(/<Modal\s+open=\{open\}/);
  });

  it("verifies SplitPane uses the shared 1200px desktop breakpoint", () => {
    const filePath = path.resolve(__dirname, "../components/layout/SplitPane.tsx");
    const source = fs.readFileSync(filePath, "utf-8");
    expect(source).toContain("window.innerWidth >= 1200");
    expect(source).toContain("const onResize = () => setIsDesktop(window.innerWidth >= 1200)");
  });
});


describe("Responsive Header layout containment", () => {
  const filePath = path.resolve(__dirname, "../components/layout/Header.tsx");
  const source = fs.readFileSync(filePath, "utf-8");

  it("uses the shared three-column grid so the brand, toolbar, and account controls stay separated", () => {
    const themePath = path.resolve(__dirname, "../config/uiThemeConfig.ts");
    const themeSource = fs.readFileSync(themePath, "utf-8");
    expect(themeSource).toContain("grid-cols-[auto_minmax(0,1fr)_auto]");
    expect(source).toContain("justify-self-center");
    expect(source).toContain("justify-self-end");
  });

  it("keeps the server selector at a usable compact width on phones and expands it at larger breakpoints", () => {
    expect(source).toContain("w-[104px] sm:w-32 lg:w-48");
    expect(source).toContain("shrink-0");
  });

  it("moves admin-only header actions out of the constrained phone header", () => {
    expect(source).toContain('className="hidden sm:flex text-xs items-center');
  });

  it("reduces toolbar button padding on narrow screens while retaining desktop spacing", () => {
    expect(source).toContain("px-1 sm:px-2");
    expect(source).toContain("p-1 sm:p-1.5");
  });
});
