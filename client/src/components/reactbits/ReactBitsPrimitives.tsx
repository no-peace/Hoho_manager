import React from "react";

interface TextProps {
  text: string;
  className?: string;
  stagger?: number;
}

export const SplitTextReveal: React.FC<TextProps> = ({ text, className = "" }) => (
  <span className={className} aria-label={text}>{text}</span>
);

export const ShinyText: React.FC<TextProps> = ({ text, className = "" }) => (
  <span className={className} style={{ backgroundImage: "linear-gradient(110deg, #949ba4 15%, #ffffff 35%, #a5adff 50%, #949ba4 70%)", backgroundSize: "220% 100%", backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent" }}>{text}</span>
);

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  spotlightColor?: string;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({ children, className = "", spotlightColor = "rgba(88, 101, 242, 0.12)", onMouseMove, ...props }) => (
  <div {...props} className={`relative isolate overflow-hidden ${className}`} onMouseMove={(event) => {
    if (typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      const rect = event.currentTarget.getBoundingClientRect();
      event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
      event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
    }
    onMouseMove?.(event);
  }}>
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 [@media(hover:hover)_and_(pointer:fine)]:hover:opacity-100" style={{ background: `radial-gradient(280px circle at var(--spot-x,50%) var(--spot-y,50%), ${spotlightColor}, transparent 72%)` }} />
    <div className="relative z-[1]">{children}</div>
  </div>
);

interface CountUpNumberProps {
  value: number;
  suffix?: string;
  className?: string;
}

export const CountUpNumber: React.FC<CountUpNumberProps> = ({ value, suffix = "", className = "" }) => (
  <span className={`tabular-nums ${className}`}>{value}{suffix}</span>
);

export const MagneticButton: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = "" }) => (
  <div className={className}>{children}</div>
);
