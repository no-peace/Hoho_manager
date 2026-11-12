import React, { useEffect, useRef } from "react";
import gsap from "gsap";

interface TextProps {
  text: string;
  className?: string;
  stagger?: number;
}

export const SplitTextReveal: React.FC<TextProps> = ({ text, className = "", stagger = 0.025 }) => {
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches || navigator.webdriver) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { duration: 0.42, ease: "power3.out" } });
      tl.set("[data-char]", { yPercent: 100, opacity: 0 });
      tl.to("[data-char]", { yPercent: 0, opacity: 1, stagger });
    }, element);
    return () => ctx.revert();
  }, [text, stagger]);
  return <span ref={root} className={className} aria-label={text}>{text.split(" ").map((word, wi) => <React.Fragment key={wi}><span className="inline-block overflow-hidden">{Array.from(word).map((char, ci) => <span key={ci} data-char className="inline-block will-change-transform">{char}</span>)}</span>{wi < text.split(" ").length - 1 ? " " : ""}</React.Fragment>)}</span>;
};

export const ShinyText: React.FC<TextProps> = ({ text, className = "" }) => (
  <span className={className} style={{ backgroundImage: "linear-gradient(110deg, #949ba4 15%, #ffffff 35%, #a5adff 50%, #949ba4 70%)", backgroundSize: "220% 100%", backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent" }}>{text}</span>
);

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  spotlightColor?: string;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({ children, className = "", spotlightColor = "rgba(88, 101, 242, 0.12)", onMouseMove, ...props }) => (
  <div {...props} className={`relative isolate overflow-hidden ${className}`} onMouseMove={(event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
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

export const CountUpNumber: React.FC<CountUpNumberProps> = ({ value, suffix = "", className = "" }) => {
  const node = useRef<HTMLSpanElement>(null);
  const current = useRef({ value });
  useEffect(() => {
    if (!node.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      current.current.value = value;
      node.current.textContent = `${value}${suffix}`;
      return;
    }
    const tween = gsap.to(current.current, { value, duration: 0.28, ease: "power2.out", onUpdate: () => {
      if (node.current) node.current.textContent = `${Math.round(current.current.value)}${suffix}`;
    }});
    return () => tween.kill();
  }, [value, suffix]);
  return <span ref={node} className={`tabular-nums ${className}`}>{value}{suffix}</span>;
};

export const MagneticButton: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ children, className = "" }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !window.matchMedia("(hover: hover) and (pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const quickX = gsap.quickTo(element, "x", { duration: 0.2, ease: "power3.out" });
    const quickY = gsap.quickTo(element, "y", { duration: 0.2, ease: "power3.out" });
    const move = (event: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      quickX(((event.clientX - rect.left) / rect.width - 0.5) * 6);
      quickY(((event.clientY - rect.top) / rect.height - 0.5) * 6);
    };
    const reset = () => { quickX(0); quickY(0); };
    element.addEventListener("mousemove", move);
    element.addEventListener("mouseleave", reset);
    return () => { element.removeEventListener("mousemove", move); element.removeEventListener("mouseleave", reset); gsap.killTweensOf(element); };
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
};
