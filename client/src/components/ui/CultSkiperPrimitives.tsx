import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

/**
 * Skiper UI (skiper42) — Crossfade Icon with Blur & Confirmation Pulse
 * Overlaps old & new icon states using popLayout, filter blur(4px) -> blur(0px),
 * and emits a subtle confirmation pulse when active=true.
 */
export interface AnimatedMorphIconProps {
  active: boolean;
  activeIcon: React.ReactNode;
  inactiveIcon: React.ReactNode;
  pulseOnActive?: boolean;
  className?: string;
}

export const AnimatedMorphIcon: React.FC<AnimatedMorphIconProps> = ({
  active,
  activeIcon,
  inactiveIcon,
  pulseOnActive = true,
  className = "",
}) => (
  <span className={`relative inline-flex items-center justify-center ${className}`}>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={active ? "active" : "inactive"}
        initial={{ opacity: 0, scale: 0.82, filter: "blur(4px)" }}
        animate={{
          opacity: 1,
          scale: 1,
          filter: "blur(0px)",
          transition: { duration: 0.16, ease: [0.16, 1, 0.3, 1] },
        }}
        exit={{
          opacity: 0,
          scale: 0.82,
          filter: "blur(4px)",
          transition: { duration: 0.125, ease: [0.4, 0, 1, 1] },
        }}
        className="inline-flex items-center justify-center"
      >
        {active ? activeIcon : inactiveIcon}
      </motion.span>
    </AnimatePresence>
    {active && pulseOnActive && (
      <motion.span
        initial={{ scale: 0.9, opacity: 0.55 }}
        animate={{ scale: 1.65, opacity: 0 }}
        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none absolute inset-0 rounded-full border border-[#57f287]"
        aria-hidden="true"
      />
    )}
  </span>
);

/**
 * Cult UI — MorphSurface Expandable Action Bar / Inspector Card
 * Uses shared layoutId, mask/clip-path reveal, 165ms ease-out entrance,
 * and 20% shorter (130ms) exit back to the trigger origin.
 */
export interface CultMorphSurfaceProps {
  layoutId: string;
  triggerLabel: React.ReactNode;
  triggerIcon?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export const CultMorphSurface: React.FC<CultMorphSurfaceProps> = ({
  layoutId,
  triggerLabel,
  triggerIcon,
  title,
  children,
  className = "",
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (surfaceRef.current && !surfaceRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={surfaceRef} className={`relative ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        {!open ? (
          <motion.button
            key="morph-trigger"
            layoutId={layoutId}
            type="button"
            onClick={() => setOpen(true)}
            disabled={disabled}
            className="w-full py-2.5 px-4 rounded-xl bg-[#5865f2] hover:bg-[#4752c4] active:scale-[0.97] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-transform duration-75 cursor-pointer"
          >
            {triggerIcon}
            <span>{triggerLabel}</span>
          </motion.button>
        ) : (
          <motion.div
            key="morph-panel"
            layoutId={layoutId}
            initial={{ opacity: 0, scale: 0.95, clipPath: "inset(8% 4% 8% 4% round 12px)" }}
            animate={{
              opacity: 1,
              scale: 1,
              clipPath: "inset(0% 0% 0% 0% round 12px)",
              transition: { duration: 0.165, ease: [0.16, 1, 0.3, 1] },
            }}
            exit={{
              opacity: 0,
              scale: 0.95,
              clipPath: "inset(8% 4% 8% 4% round 12px)",
              transition: { duration: 0.13, ease: [0.4, 0, 1, 1] },
            }}
            style={{ transformOrigin: "top center" }}
            className="rounded-xl bg-[#18191c] border border-[#26282d] p-2.5 space-y-2 shadow-2xl overflow-hidden"
          >
            {title && (
              <div className="flex items-center justify-between px-1.5 pb-1 border-b border-[#26282d]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#949cf7]">
                  {title}
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[10px] font-semibold text-[#949ba4] hover:text-white px-1.5 py-0.5 rounded hover:bg-[#2b2d31] active:scale-[0.97]"
                >
                  Close
                </button>
              </div>
            )}
            <div onClick={() => setOpen(false)}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/**
 * Skiper UI (skiper2) — Dynamic Island Status Pill with Arc Indicator & Rubber-Band Drag
 */
export const SkiperDynamicStatusPill: React.FC<{
  badge: string;
  accentColor?: string;
}> = ({ badge, accentColor = "#5865f2" }) => (
  <motion.div
    drag="x"
    dragConstraints={{ left: 0, right: 0 }}
    dragElastic={0.18}
    className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#18191c] border border-[#26282d] text-[10px] font-bold uppercase tracking-wider text-[#dbdee1] shadow-inner cursor-grab active:cursor-grabbing"
  >
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={badge}
        initial={{ opacity: 0, x: -6, y: 4, filter: "blur(3px)" }}
        animate={{
          opacity: 1,
          x: 0,
          y: [4, -2, 0],
          filter: "blur(0px)",
          transition: { duration: 0.22, ease: [0.45, 0, 0.55, 1] },
        }}
        exit={{
          opacity: 0,
          x: 6,
          y: 3,
          filter: "blur(3px)",
          transition: { duration: 0.14, ease: [0.4, 0, 1, 1] },
        }}
        className="inline-flex items-center gap-1.5"
      >
        <span
          className="h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: accentColor }}
        />
        <span>{badge}</span>
      </motion.span>
    </AnimatePresence>
  </motion.div>
);