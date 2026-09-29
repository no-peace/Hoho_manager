import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Resizable horizontal split.
 *
 * The divider is dragged with pointer events, which unifies mouse and touch and
 * avoids the "drag stops when the cursor leaves the element" problem that plain
 * mousemove listeners have. The ratio is clamped so neither pane can be collapsed
 * by accident.
 */
export interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  initialRatio?: number;
  minRatio?: number;
  maxRatio?: number;
  className?: string;
}

export const SplitPane = ({
  left,
  right,
  initialRatio = 0.5,
  minRatio = 0.25,
  maxRatio = 0.75,
  className = "",
}: SplitPaneProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(initialRatio);
  const draggingRef = useRef(false);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const bounds = containerRef.current.getBoundingClientRect();
      const next = (event.clientX - bounds.left) / bounds.width;
      setRatio(Math.min(Math.max(next, minRatio), maxRatio));
    },
    [minRatio, maxRatio],
  );

  const stopDragging = useCallback(() => {
    draggingRef.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const startDragging = useCallback(() => {
    draggingRef.current = true;
    // Keep the resize cursor while dragging, even outside the divider.
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
    };
  }, [onPointerMove, stopDragging]);

  return (
    <div ref={containerRef} className={`flex min-h-0 min-w-0 flex-1 ${className}`}>
      <div className="flex min-h-0 min-w-0 flex-col" style={{ width: `${ratio * 100}%` }}>
        {left}
      </div>

      {/* Keyboard-resizable divider so the layout is not mouse-only. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize editor and preview"
        tabIndex={0}
        onPointerDown={startDragging}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setRatio((r) => Math.max(minRatio, r - 0.02));
          if (event.key === "ArrowRight") setRatio((r) => Math.min(maxRatio, r + 0.02));
        }}
        className="group relative w-px shrink-0 cursor-col-resize bg-line transition-colors hover:bg-blurple"
      >
        {/* Wider invisible hit area so the 1px line is actually grabbable. */}
        <span className="absolute inset-y-0 -left-1.5 -right-1.5 block" />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{right}</div>
    </div>
  );
};

export default SplitPane;
