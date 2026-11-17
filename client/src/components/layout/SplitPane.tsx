import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import type { ResolvedAppLayoutMotion } from "../../utils/puckAppLayout";

export interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  initialRatio?: number;
  minRatio?: number;
  maxRatio?: number;
  panelOrder?: "editor-first" | "preview-first";
  workspaceMotion?: ResolvedAppLayoutMotion;
  mobileActivePane?: "left" | "right";
  onMobilePaneChange?: (pane: "left" | "right") => void;
  className?: string;
}

export const SplitPane = ({
  left,
  right,
  initialRatio = 0.5,
  minRatio = 0.28,
  maxRatio = 0.72,
  panelOrder = "editor-first",
  workspaceMotion,
  mobileActivePane = "left",
  onMobilePaneChange,
  className = "",
}: SplitPaneProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(initialRatio);
  useEffect(() => {
    setRatio(Math.min(maxRatio, Math.max(minRatio, initialRatio)));
  }, [initialRatio, minRatio, maxRatio]);
  const [isDragging, setIsDragging] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1200 : true,
  );
  const draggingRef = useRef(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const workspaceMotionStyle = workspaceMotion ? ({
    "--hoho-motion-duration": workspaceMotion.duration,
    "--hoho-motion-delay": workspaceMotion.delay,
  } as CSSProperties) : undefined;

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1200);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const bounds = containerRef.current.getBoundingClientRect();
      if (bounds.width <= 0) return;
      const next = (event.clientX - bounds.left) / bounds.width;
      setRatio(Math.min(Math.max(next, minRatio), maxRatio));
    },
    [minRatio, maxRatio],
  );

  const stopDragging = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const startDragging = useCallback(() => {
    draggingRef.current = true;
    setIsDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
      if (draggingRef.current) {
        draggingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
  }, [onPointerMove, stopDragging]);

  // Mobile & tablet (< 1200px): one full-width pane, switched without unmounting either pane
  if (!isDesktop) {
    return (
      <div
        ref={containerRef}
        onTouchStart={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("button, a, input, textarea, select, [role='button'], [data-no-pane-swipe]")) {
            touchStartXRef.current = null;
            touchStartYRef.current = null;
            return;
          }
          const touch = e.touches[0];
          if (!touch) return;
          touchStartXRef.current = touch.clientX;
          touchStartYRef.current = touch.clientY;
        }}
        onTouchEnd={(e) => {
          const startX = touchStartXRef.current;
          const startY = touchStartYRef.current;
          touchStartXRef.current = null;
          touchStartYRef.current = null;
          if (startX === null || startY === null || !onMobilePaneChange) return;
          const touch = e.changedTouches[0];
          if (!touch) return;
          const dx = touch.clientX - startX;
          const dy = touch.clientY - startY;
          if (Math.abs(dx) > 72 && Math.abs(dx) > Math.abs(dy) * 1.8) {
            if (dx < 0 && mobileActivePane === "left") onMobilePaneChange("right");
            else if (dx > 0 && mobileActivePane === "right") onMobilePaneChange("left");
          }
        }}
        onTouchCancel={() => {
          touchStartXRef.current = null;
          touchStartYRef.current = null;
        }}
        className={`relative flex min-h-0 min-w-0 flex-1 overflow-hidden hoho-runtime-workspace hoho-runtime-workspace--mobile ${className}`}
        data-hoho-motion={workspaceMotion?.animation ?? "none"}
        data-hoho-panel-order={panelOrder}
        style={workspaceMotionStyle}
      >
        <motion.div
          aria-hidden={mobileActivePane !== "left"}
          inert={mobileActivePane !== "left"}
          className={`absolute inset-0 flex min-h-0 min-w-0 flex-col hoho-runtime-mobile-pane hoho-runtime-mobile-pane--editor ${mobileActivePane === "left" ? "z-10" : "invisible pointer-events-none z-0"}`}
          animate={{ opacity: mobileActivePane === "left" ? 1 : 0, x: prefersReducedMotion ? 0 : mobileActivePane === "left" ? 0 : -8 }}
          transition={{ duration: prefersReducedMotion ? 0.12 : 0.16, ease: [0.16, 1, 0.3, 1] }}
          style={{ pointerEvents: mobileActivePane === "left" ? "auto" : "none" }}
        >
          <ErrorBoundary level="pane" fallbackTitle="Editor Pane Error">
            {left}
          </ErrorBoundary>
        </motion.div>
        <motion.div
          aria-hidden={mobileActivePane !== "right"}
          inert={mobileActivePane !== "right"}
          className={`absolute inset-0 flex min-h-0 min-w-0 flex-col hoho-runtime-mobile-pane hoho-runtime-mobile-pane--preview ${mobileActivePane === "right" ? "z-10" : "invisible pointer-events-none z-0"}`}
          animate={{ opacity: mobileActivePane === "right" ? 1 : 0, x: prefersReducedMotion ? 0 : mobileActivePane === "right" ? 0 : 8 }}
          transition={{ duration: prefersReducedMotion ? 0.12 : 0.16, ease: [0.16, 1, 0.3, 1] }}
          style={{ pointerEvents: mobileActivePane === "right" ? "auto" : "none" }}
        >
          <ErrorBoundary level="pane" fallbackTitle="Live Preview Error">
            {right}
          </ErrorBoundary>
        </motion.div>
      </div>
    );
  }

  // Wide screens (>= 1200px): resizable side-by-side Studio workbench
  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 min-w-0 flex-1 overflow-hidden hoho-runtime-workspace hoho-runtime-workspace--desktop ${className}`}
      data-hoho-motion={workspaceMotion?.animation ?? "none"}
      data-hoho-panel-order={panelOrder}
      style={workspaceMotionStyle}
    >
      <div className="hoho-runtime-editor-pane flex min-h-0 min-w-0 flex-col shrink-0" style={{ width: `${ratio * 100}%` }}>
        <ErrorBoundary level="pane" fallbackTitle="Editor Pane Error">
          {left}
        </ErrorBoundary>
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={Math.round(minRatio * 100)}
        aria-valuemax={Math.round(maxRatio * 100)}
        aria-label="Resize editor and preview (double-click to reset)"
        tabIndex={0}
        onPointerDown={startDragging}
        onDoubleClick={() => setRatio(initialRatio)}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setRatio((r) => Math.max(minRatio, r - 0.02));
          if (event.key === "ArrowRight") setRatio((r) => Math.min(maxRatio, r + 0.02));
        }}
        className={`hoho-runtime-splitter group relative w-1.5 shrink-0 cursor-col-resize transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:bg-[#818CF8]/60 ${isDragging ? "bg-[#818CF8]" : "bg-[#202531] hover:bg-[#818CF8]/60"}`}
      >
        <div className={`w-0.5 h-8 rounded-full transition-[transform,background-color,box-shadow] duration-150 ${isDragging ? "scale-y-150 bg-[#F1F3F9]" : "bg-[#343C4E] group-hover:scale-y-125 group-hover:bg-[#F1F3F9]"}`} />
        {isDragging && (
          <span className="pointer-events-none absolute top-3 left-3 z-50 rounded-md bg-[#161A23] border border-[#818CF8] px-2 py-0.5 font-mono text-[0.625rem] font-bold text-white shadow-xl tabular-nums whitespace-nowrap">
            {Math.round(ratio * 100)}% / {100 - Math.round(ratio * 100)}%
          </span>
        )}
        <span className="absolute inset-y-0 -left-2 -right-2 block" />
      </div>

      <div className="hoho-runtime-preview-pane flex min-h-0 min-w-0 flex-1 flex-col">
        <ErrorBoundary level="pane" fallbackTitle="Live Preview Error">
          {right}
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default SplitPane;
