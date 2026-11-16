export interface FloatingAnchorRect {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

export interface FloatingViewport {
  width: number;
  height: number;
  offsetTop?: number;
}

export interface FloatingPosition {
  side: "top" | "bottom";
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

export interface FloatingPositionOptions {
  menuWidth?: number;
  maxMenuHeight?: number;
  margin?: number;
  gap?: number;
}

/**
 * Calculate a viewport-clamped position for a menu anchored to an input.
 * The side with more usable vertical space is selected; the menu height and
 * horizontal position are then constrained to the current visual viewport.
 */
export const calculateFloatingPosition = (
  anchor: FloatingAnchorRect,
  viewport: FloatingViewport,
  options: FloatingPositionOptions = {},
): FloatingPosition => {
  const margin = options.margin ?? 8;
  const gap = options.gap ?? 6;
  const maxMenuHeight = options.maxMenuHeight ?? 320;
  const menuWidth = options.menuWidth ?? Math.min(288, anchor.width);

  const viewportTop = viewport.offsetTop ?? 0;
  const spaceAbove = Math.max(0, anchor.top - viewportTop - margin);
  const spaceBelow = Math.max(0, viewportTop + viewport.height - anchor.bottom - margin);
  const side = spaceAbove > spaceBelow ? "top" : "bottom";
  const availableSpace = side === "top" ? spaceAbove : spaceBelow;
  const maxHeight = Math.min(maxMenuHeight, Math.max(0, availableSpace - gap));
  const width = Math.max(0, Math.min(menuWidth, viewport.width - margin * 2));
  const left = Math.max(margin, Math.min(anchor.left, viewport.width - width - margin));
  const top = side === "top"
    ? Math.max(viewportTop + 4, anchor.top - maxHeight - gap)
    : anchor.bottom + gap;

  return { side, top, left, width, maxHeight };
};
