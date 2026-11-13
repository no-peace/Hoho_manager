import React, { useEffect, useRef } from "react";

/**
 * Lightweight perspective particle field used as a decorative login backdrop.
 * Draws a still frame for reduced-motion users and animates only when allowed.
 */
export const ThreeHeroCanvas: React.FC<{ className?: string }> = ({ className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let width = 1;
    let height = 1;
    let pointerX = 0;
    let pointerY = 0;
    let time = 0;
    const columns = 24;
    const rows = 14;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      draw();
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const centerX = width * 0.5 + pointerX * 16;
      const centerY = height * 0.54 + pointerY * 10;
      for (let row = 0; row < rows; row += 1) {
        context.beginPath();
        for (let column = 0; column < columns; column += 1) {
          const worldX = (column - (columns - 1) / 2) * 58;
          const depth = row * 48 + 120;
          const wave = reducedMotion ? 0 : Math.sin(column * 0.38 + time + row * 0.12) * 16;
          const scale = 360 / (360 + depth);
          const x = centerX + worldX * scale;
          const y = centerY + (row * 30 + wave + 50) * scale;
          const radius = Math.max(0.8, 2.5 * scale);
          context.moveTo(x + radius, y);
          context.arc(x, y, radius, 0, Math.PI * 2);
          const alpha = Math.max(0.08, (1 - row / rows) * 0.48);
          context.fillStyle = (row + column) % 6 === 0
            ? `rgba(87, 242, 135, ${alpha})`
            : `rgba(148, 156, 247, ${alpha})`;
          context.fill();
        }
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointerX = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      pointerY = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
      if (reducedMotion) draw();
    };

    const render = () => {
      if (document.hidden) return;
      frame = requestAnimationFrame(render);
      time += 0.018;
      draw();
      frame = window.requestAnimationFrame(render);
    };

    const handleVisibilityChange = () => {
      window.cancelAnimationFrame(frame);
      if (!document.hidden && !reducedMotion) frame = window.requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (!reducedMotion) frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full opacity-60 ${className}`}
    />
  );
};

export default ThreeHeroCanvas;