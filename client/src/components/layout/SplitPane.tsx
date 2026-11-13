import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
export interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  initialRatio?: number;
  minRatio?: number;
  maxRatio?: number;
  mobileActivePane?: "left" | "right";
  className?: string;
}

export const SplitPane = ({
  left,
  right,
  initialRatio = 0.5,
  minRatio = 0.28,
  maxRatio = 0.72,
  mobileActivePane = "left",
  className = "",
}: SplitPaneProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(initialRatio);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1280 : true,
  );
  const draggingRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1280);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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

  // Mobile & Tablet (< 1280px): Full-width single pane switched via bottom navigation
  if (!isDesktop) {
    return (
      <div ref={containerRef} className={`relative flex min-h-0 min-w-0 flex-1 overflow-hidden ${className}`}>
        <motion.div
          aria-hidden={mobileActivePane !== "left"}
          inert={mobileActivePane !== "left"}
          className={`absolute inset-0 flex min-h-0 min-w-0 flex-col ${mobileActivePane === "left" ? "z-10" : "pointer-events-none z-0"}`}
          animate={{ opacity: mobileActivePane === "left" ? 1 : 0, x: prefersReducedMotion ? 0 : mobileActivePane === "left" ? 0 : -8 }}
          transition={{ duration: prefersReducedMotion ? 0.12 : 0.16, ease: [0.16, 1, 0.3, 1] }}
          style={{ pointerEvents: mobileActivePane === "left" ? "auto" : "none" }}
        >
          {mobileActivePane === "left" ? left : null}
        </motion.div>
        <motion.div
          aria-hidden={mobileActivePane !== "right"}
          inert={mobileActivePane !== "right"}
          className={`absolute inset-0 flex min-h-0 min-w-0 flex-col ${mobileActivePane === "right" ? "z-10" : "pointer-events-none z-0"}`}
          animate={{ opacity: mobileActivePane === "right" ? 1 : 0, x: prefersReducedMotion ? 0 : mobileActivePane === "right" ? 0 : 8 }}
          transition={{ duration: prefersReducedMotion ? 0.12 : 0.16, ease: [0.16, 1, 0.3, 1] }}
          style={{ pointerEvents: mobileActivePane === "right" ? "auto" : "none" }}
        >
          {mobileActivePane === "right" ? right : null}
        </motion.div>
      </div>
    );
  }

  // Desktop (>= 1280px): Resizable side-by-side Studio Workbench
  return (
    <div ref={containerRef} className={`flex min-h-0 min-w-0 flex-1 overflow-hidden ${className}`}>
      <div
        className="flex min-h-0 min-w-0 flex-col shrink-0"
        style={{ width: `${ratio * 100}%` }}
      >
        {left}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize editor and preview (double-click to reset)"
        tabIndex={0}
        onPointerDown={startDragging}
        onDoubleClick={() => setRatio(initialRatio)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setRatio((r) => Math.max(minRatio, r - 0.02));
          if (event.key === "ArrowRight") setRatio((r) => Math.min(maxRatio, r + 0.02));
        }}
        className="group relative w-1.5 shrink-0 cursor-col-resize bg-[#111214] hover:bg-[#5865f2] transition-colors flex items-center justify-center"
      >
        <div className="h-8 w-0.5 rounded-full bg-[#4e5058] group-hover:bg-white transition-colors" />
        <span className="absolute inset-y-0 -left-2 -right-2 block" />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{right}</div>
    </div>
  );
};

export default SplitPane;