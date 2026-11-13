import React, { useEffect, useRef } from "react";

/**
 * Lightweight 3D Perspective Particle-Grid & Orbital Field Hero Canvas.
 * Pauses while hidden, respects reduced motion, and scales its backing buffer
 * for high-DPI screens without creating a large WebGL dependency.
 */
export const ThreeHeroCanvas: React.FC<{ className?: string }> = ({ className = "" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionPreference.matches || navigator.webdriver) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    let frame = 0;
    let width = 1;
    let height = 1;
    let pointerX = 0;
    let pointerY = 0;
    let time = 0;
    const columns = 18;
    const rows = 12;
    const fieldOfView = 340;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointerX = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      pointerY = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
    };

    const render = () => {
      if (document.hidden) {
        frame = requestAnimationFrame(render);
        return;
      }
      time += 0.018;
      context.clearRect(0, 0, width, height);
      const centerX = width * 0.5 + pointerX * 18;
      const centerY = height * 0.52 + pointerY * 12;

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const worldX = (column - columns / 2) * 58;
          const depth = row * 46 + 140;
          const waveY =
            Math.sin(column * 0.42 + time) * 18 +
            Math.cos(row * 0.48 - time * 0.85) * 14 +
            80;
          const scale = fieldOfView / (fieldOfView + depth);
          const screenX = centerX + worldX * scale;
          const screenY = centerY + waveY * scale;
          const radius = Math.max(1.1, 3.2 * scale);
          const alpha = Math.min(0.65, Math.max(0.08, (1 - row / rows) * 0.55));

          context.beginPath();
          context.arc(screenX, screenY, radius, 0, Math.PI * 2);
          context.fillStyle = (column + row) % 5 === 0
            ? `rgba(35, 165, 90, ${alpha})`
            : `rgba(88, 101, 242, ${alpha})`;
          context.fill();
        }
      }
      frame = requestAnimationFrame(render);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) cancelAnimationFrame(frame);
      else frame = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full opacity-75 ${className}`}
    />
  );
};

export default ThreeHeroCanvas;