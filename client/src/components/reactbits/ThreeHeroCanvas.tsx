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

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isAutomatedBrowser = navigator.webdriver === true;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0;
    const isConstrainedDevice = Boolean(connection?.saveData || navigator.hardwareConcurrency <= 4 || (deviceMemory > 0 && deviceMemory <= 4));
    let shouldAnimate = false;
    let columns = 18;
    let rows = 10;
    const frameInterval = 1000 / 30;
    let frameId = 0;
    let startTimer: ReturnType<typeof setTimeout> | null = null;
    let animationReady = false;
    let width = 1;
    let height = 1;
    let pointerX = 0;
    let pointerY = 0;
    let time = 0;
    let lastFrameTime = 0;
    let isVisible = true;
    let isPageVisible = !document.hidden;
    let disposed = false;

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const centerX = width * 0.5 + pointerX * 12;
      const centerY = height * 0.54 + pointerY * 8;
      for (let row = 0; row < rows; row += 1) {
        const depth = row * 54 + 130;
        const scale = 340 / (340 + depth);
        const alpha = Math.max(0.07, (1 - row / rows) * 0.38);
        const spacingX = columns <= 12 ? 52 : 62;
        const radius = Math.max(0.7, 2.1 * scale);
        for (let color = 0; color < 2; color += 1) {
          context.beginPath();
          for (let column = 0; column < columns; column += 1) {
            if (((row + column) % 6 === 0) !== (color === 1)) continue;
            const worldX = (column - (columns - 1) / 2) * spacingX;
            const wave = motionQuery.matches ? 0 : Math.sin(column * 0.38 + time + row * 0.12) * 12;
            const x = centerX + worldX * scale;
            const y = centerY + (row * 32 + wave + 48) * scale;
            context.moveTo(x + radius, y);
            context.arc(x, y, radius, 0, Math.PI * 2);
          }
          context.fillStyle = color === 1
            ? "rgba(87, 242, 135, " + alpha + ")"
            : "rgba(148, 156, 247, " + alpha + ")";
          context.fill();
        }
      }
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const isCompactMobile = width < 640;
      shouldAnimate = !isAutomatedBrowser && !motionQuery.matches && !isCompactMobile && !isConstrainedDevice;
      columns = isCompactMobile ? 10 : 18;
      rows = isCompactMobile ? 5 : 10;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, isCompactMobile ? 1.25 : 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      draw();
      if (shouldAnimate) scheduleStart();
      else {
        animationReady = false;
        if (startTimer) clearTimeout(startTimer);
        startTimer = null;
        stop();
      }
    };

    const stop = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
    };

    const tick = (timestamp: number) => {
      frameId = 0;
      if (disposed || !shouldAnimate || !isVisible || !isPageVisible) return;

      if (timestamp - lastFrameTime >= frameInterval) {
        lastFrameTime = timestamp;
        time += 0.035;
        draw();
      }

      // Schedule exactly one next frame. Never create parallel animation loops.
      frameId = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (disposed || !animationReady || !shouldAnimate || !isVisible || !isPageVisible || frameId) return;
      lastFrameTime = 0;
      frameId = window.requestAnimationFrame(tick);
    };

    const scheduleStart = () => {
      if (!shouldAnimate || disposed) return;
      if (startTimer) clearTimeout(startTimer);
      startTimer = setTimeout(() => {
        startTimer = null;
        animationReady = true;
        start();
      }, 1500);
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointerX = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      pointerY = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
    };

    const handleVisibilityChange = () => {
      isPageVisible = !document.hidden;
      if (isPageVisible) start();
      else stop();
    };

    const handleMotionChange = () => {
      resize();
    };

    resize();
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(resize)
      : null;
    resizeObserver?.observe(canvas);
    if (!resizeObserver) window.addEventListener("resize", resize, { passive: true });

    const visibilityObserver = typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => {
          isVisible = Boolean(entry?.isIntersecting);
          if (isVisible) start();
          else stop();
        }, { threshold: 0 })
      : null;
    visibilityObserver?.observe(canvas);

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    motionQuery.addEventListener?.("change", handleMotionChange);

    if (motionQuery.matches) draw();
    else scheduleStart();

    return () => {
      disposed = true;
      if (startTimer) clearTimeout(startTimer);
      startTimer = null;
      stop();
      resizeObserver?.disconnect();
      visibilityObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      motionQuery.removeEventListener?.("change", handleMotionChange);
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