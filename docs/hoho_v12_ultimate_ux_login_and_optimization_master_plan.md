# HoHo Manager — V12 Ultimate UX, Atmospheric Login, Preview Interactivity & Core Web Vitals Master Plan

**Implementation status (2026-11-18):** The core V12 login atmosphere, preview/editor selection, mobile inspector/quick-edit, FlowBuilder and styling work is integrated on current `main`. The requested Guest Sandbox is **not** implemented; Local Developer login remains development-only. Automated tests, browser QA and Lighthouse verification are pending. The root-cause descriptions and line references below belong to the historical audited snapshot and must be rechecked against current source before acting on them. See `docs/GEMINI_HANDOFF_CURRENT.md` for current status.

- **Repository**: [`no-peace/Hoho_manager`](https://github.com/no-peace/Hoho_manager) (`main` branch)
- **Audited Snapshot Commit**: `a04f66ae5acaf97227052ef4807bb697d3409b28` ([HoHo Manager NotebookLM](https://gemini.google.com/notebook/e8f024b3-7812-4f1f-97cd-afa0966538fd))
- **Golden Layout Reference Commit**: [`2b1f77b81e23380202a991276eb71600e81250e6`](https://github.com/no-peace/Hoho_manager/commit/2b1f77b81e23380202a991276eb71600e81250e6)
- **Production URL**: [https://hoho-manager.onrender.com](https://www.google.com/search?q=https://hoho-manager.onrender.com)

---

## 0. Non-Negotiable Architecture & Execution Rules for ChatGPT

1. **Maintain 97–100 Lighthouse Performance & 100 Accessibility**:
   - Every visual upgrade on `LoginScreen.tsx` and `ThreeHeroCanvas.tsx` **must** have zero layout shift (`CLS = 0`), zero main-thread blocking before LCP (`FCP <= 0.6s` desktop, `TBT <= 30ms`), and strictly GPU-composited or radial-gradient CSS layers.
2. **Zero Truncation & Casual Commit Discipline**:
   - Write complete, unabridged TypeScript/TSX files—never leave `// ... rest of file` placeholders.
   - Use natural, casual lowercase commit messages (e.g., `upgrade login screen atmosphere and constellation canvas`, `fix live preview select menu click capture and inspector routing`, `fix mobile v2 quick edit sheet and flowbuilder tokens`).

---

## 1. Root-Cause Findings from the Full Source Audit (`a04f66ae5acaf97227052ef4807bb697d3409b28`)

### Finding 1 — Why `LoginScreen.tsx` Looks Empty in the Background
- **Top 55% of the Viewport is Completely Blank**: In `client/src/components/reactbits/ThreeHeroCanvas.tsx`, the dot grid starts at `centerY = height * 0.54` (`y = centerY + (row * 32 + wave + 48) * scale`), leaving the upper 54% of the screen completely empty flat `#10131A`.
- **Practically Invisible Alpha (`0.04–0.22`)**: `ThreeHeroCanvas.tsx` draws `0.7px–2.1px` dots with `alpha = Math.max(0.07, (1 - row / rows) * 0.38)` inside a `<canvas className="... opacity-60">`, resulting in an effective opacity of `0.04` to `0.22`.
- **Disabled on 4-Core / Mobile Devices with No Static Backdrop**: `isConstrainedDevice` disables animation whenever `hardwareConcurrency <= 4`, `deviceMemory <= 4`, or `width < 640`, and `LoginScreen.tsx` has zero CSS radial aurora spotlights, zero architectural grid lines, and zero ambient card glow behind the 12-column grid.
- **Detached `PublicPageHeader` & Legacy `#2b2d31` Card Surfaces**: `LoginScreen.tsx` puts `p-3.5 sm:p-6 lg:p-8` on the outermost root `<div>`, which indents `<PublicPageHeader activePage="studio" />` away from the top/side viewport edges (unlike `/docs` and `/privacy` where `PublicPageHeader` is flush edge-to-edge). Furthermore, the two main cards on `LoginScreen.tsx` (lines 87 and 178) still use legacy Discord gray `bg-[#2b2d31]/95` instead of elevated studio glass `bg-[#161A23]/90 backdrop-blur-md border border-[#272D3A]`.

### Finding 2 — Critical Live Preview Click Capture Conflict (`MessagePreview.tsx` vs `ActionRowPreview.tsx` & `ComponentPreview.tsx`)
- **Select Menus Cannot Be Opened in Live Preview**: In `MessagePreview.tsx` (lines 253–264), `onClickCapture` on the message card intercepts every click inside `[data-preview-component-id]`, calls `event.stopPropagation()` during the **capture phase**, and triggers `onSelectPreviewComponent(...)`. Because propagation is stopped in the capture phase, the click event **never reaches `<SelectPreview>`'s toggle handler** in `ActionRowPreview.tsx`—making it impossible to open and test Select Menus in the Live Preview!
- **Missing `data-preview-interactive="true"` on Select Menus**: In `ActionRowPreview.tsx`, `ButtonPreview` has `data-preview-interactive="true"`, but `SelectPreview` does not. Clicking a Select Menu in the desktop preview therefore treats it as `isInteractive === false` and scrolls the left editor instead of opening the Select Menu or selecting it in the right-hand `PropertyPanel` / `FlowBuilder`.
- **Conflicting `select(...)` Calls in Child Preview Components**: Both `ComponentPreview.tsx` (`AutoComponent` line 155) and `ActionRowPreview.tsx` (`ButtonPreview` line 103) still have their own `onClick` handlers that unconditionally call `select({ kind: "component", id })`, bypassing `StudioLayout.tsx`'s `handlePreviewComponentSelect` routing logic.

### Finding 3 — Mobile V2 Quick-Edit Sheet Bug & Multi-Message Desync (`PropertyPanel.tsx`)
- In `PropertyPanel.tsx` (line 19), `const messageData = (messages && messages[activeMessageIndex]) || data;` reads `activeMessageIndex` instead of `selection.index` when `selection?.kind === "message"`.
- Even worse, when a message is in **Components V2 mode** (`isV2` is true), `messageData.content` is empty (`""`) because V2 stores message text inside `ComponentType.TextDisplay` blocks (`type: 10`). Typing into the mobile Message Quick-Edit sheet on a V2 message writes into `message.content`, which V2 ignores and never renders!

### Finding 4 — Undefined Legacy Tailwind Classes in `FlowBuilder.tsx`
- When `FlowBuilder.tsx` was restored to the `2b1f77b8` layout, lines 113–138 kept legacy utility classes (`text-ink-muted`, `text-blurple`, `text-ink-faint`, `bg-chrome`, `text-ink`, `bg-warning/10`, `text-warning`) that do **not** exist in `tailwind.config.js` or `globals.css`. As a result, the `FlowBuilder` header, `custom_id` badge, server mode note box, and unsaved warning banner render with broken/missing colors, and line 127 still says `"bot token mode"` instead of `"Server Bot mode"`.

### Finding 5 — Inverted Input Tokens & Leftover Legacy Surfaces (`ContentTab.tsx`, `Header.tsx`, `Sidebar.tsx`, `ComponentForms.tsx`, `DiscohookComponentsEditor.tsx`, `index.html`)
- `ContentTab.tsx` (lines 65, 89): `Existing Thread ID` and `Forum Thread Name` inputs have **inverted background and border colors** (`bg-[#272D3A] border-[#161A23]` instead of `bg-[#1D2230] border-[#272D3A]`).
- `ComponentForms.tsx` (lines 60, 134, 174, 297, 329): Helper notice boxes use `bg-[#1D2230] border-[#10131A]` instead of recessed `bg-[#10131A] border-[#272D3A]`.
- `Header.tsx` (lines 105, 198, 289, 302) & `Sidebar.tsx` (lines 38, 40, 56): Still contain legacy `#2b2d31` backgrounds instead of `#10131A` / `#161A23` / `#1D2230`.
- `DiscohookComponentsEditor.tsx` (lines 351, 365): `+ Add Button` and `+ Add Select Menu` dashed buttons still use `border-[#313338]` instead of `border-[#272D3A]`.
- `client/index.html` (lines 29, 39): Still uses `<meta name="theme-color" content="#1e1f22" />` and `<body class="bg-discord-darker ...">` instead of `#0B0D12`.

### Finding 6 — Lighthouse Timespan Non-Composited Button Transitions & Touch Scroll Polish (`uiThemeConfig.ts`, `editorSmoothScroll.ts`)
- Lighthouse Timespan flagged non-composited animations on buttons transitioning `border-color` and `box-shadow` on every hover/focus state.
- `editorSmoothScroll.ts` initializes `Lenis` on all viewports; disabling wheel smoothing on coarse/touch pointers (`window.matchMedia("(pointer: coarse)").matches`) eliminates unnecessary touch-scroll overhead on mobile devices.

---

## 2. Batch-by-Batch Implementation Plan (7 Batches — Parallelizable Across ChatGPT Subagents)

| Batch | Scope | Target Files | Safe to Run in Parallel? |
| :--- | :--- | :--- | :--- |
| **Batch 1** | Atmospheric Login Screen Backdrop, Full-Viewport Constellation Canvas & Card Polish | `client/src/components/layout/LoginScreen.tsx`, `client/src/components/reactbits/ThreeHeroCanvas.tsx`, `client/src/styles/globals.css` | Yes (Independent) |
| **Batch 2** | Live Preview Select Menu Interactivity & Unified Click Routing | `client/src/components/preview/MessagePreview.tsx`, `client/src/components/preview/ActionRowPreview.tsx`, `client/src/components/preview/ComponentPreview.tsx`, `client/src/components/layout/StudioLayout.tsx` | Yes (Independent) |
| **Batch 3** | Mobile V2 Quick-Edit Sheet & Multi-Message Selection Sync | `client/src/components/editor/PropertyPanel.tsx` | Yes (Independent) |
| **Batch 4** | Fix Undefined Tailwind Tokens in `FlowBuilder.tsx` & Action Studio Polish | `client/src/components/actions/FlowBuilder.tsx`, `client/src/components/actions/StepList.tsx` | Yes (Independent) |
| **Batch 5** | Inverted Input Tokens, Header/Sidebar Surfaces & `index.html` Theme Color | `client/src/components/editor/MessageEditor/ContentTab.tsx`, `client/src/components/editor/ComponentForms.tsx`, `client/src/components/editor/DiscohookComponentsEditor.tsx`, `client/src/components/layout/Header.tsx`, `client/src/components/layout/Sidebar.tsx`, `client/index.html` | Yes (Independent) |
| **Batch 6** | Core Web Vitals: GPU-Friendly Transitions & Desktop-Only Lenis Wheel Smoothing | `client/src/config/uiThemeConfig.ts`, `client/src/utils/editorSmoothScroll.ts` | Yes (Independent) |
| **Batch 7** | Automated Tests, Layout Stress Verification & Handoff Update | `client/src/components/layout/__tests__/LoginScreen.test.tsx`, `client/src/components/editor/__tests__/MessageEditor.test.tsx`, `docs/GEMINI_HANDOFF_CURRENT.md` | Run After Batches 1–6 |

---

## Batch 1 — Atmospheric Login Screen Backdrop, Full-Viewport Constellation Canvas & Card Polish

### 1.1 Add Zero-Cost Atmospheric Backdrop Utilities in `client/src/styles/globals.css`
Add the following studio atmosphere classes to `client/src/styles/globals.css` (preserving all existing tokens and utilities):

```css
/* Studio Atmospheric Login Backdrop — Zero-CLS, GPU-composited */
.hoho-studio-backdrop {
  background-color: #0B0D12;
  background-image:
    radial-gradient(ellipse 75% 55% at 18% 14%, rgba(129, 140, 248, 0.16) 0%, rgba(99, 102, 241, 0.05) 45%, transparent 72%),
    radial-gradient(ellipse 65% 50% at 84% 22%, rgba(167, 139, 250, 0.12) 0%, rgba(129, 140, 248, 0.04) 48%, transparent 74%),
    radial-gradient(ellipse 70% 55% at 76% 88%, rgba(52, 211, 153, 0.09) 0%, rgba(59, 130, 246, 0.04) 50%, transparent 75%),
    linear-gradient(180deg, #0B0D12 0%, #10131A 52%, #0B0D12 100%);
}

.hoho-studio-grid-overlay {
  background-size: 44px 44px;
  background-image:
    linear-gradient(to right, rgba(129, 140, 248, 0.065) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(129, 140, 248, 0.065) 1px, transparent 1px);
  mask-image: radial-gradient(ellipse 88% 78% at 50% 42%, #000 35%, transparent 88%);
  -webkit-mask-image: radial-gradient(ellipse 88% 78% at 50% 42%, #000 35%, transparent 88%);
}
```

### 1.2 Upgrade `client/src/components/reactbits/ThreeHeroCanvas.tsx` to a Full-Viewport Studio Constellation & Wave Field
Replace `client/src/components/reactbits/ThreeHeroCanvas.tsx` so that:
1. It covers the **entire viewport** (both the upper constellation nodes + connecting filaments AND the lower perspective wave horizon), never leaving the top 55% of the screen blank.
2. It renders a crisp, high-contrast initial frame **immediately** on mount (even on reduced-motion, mobile, or 4-core devices), so the background always looks rich and intentional while keeping `LCP` and `TBT` untouched.
3. On capable desktop devices without `prefers-reduced-motion`, it gently animates after `requestIdleCallback` at a capped `28 FPS`.

```tsx
import React, { useEffect, useRef } from "react";

interface ConstellationNode {
  xRatio: number;
  yRatio: number;
  radius: number;
  color: string;
  alpha: number;
  phase: number;
  speed: number;
}

const CONSTELLATION_NODES: ConstellationNode[] = [
  { xRatio: 0.08, yRatio: 0.14, radius: 2.2, color: "129, 140, 248", alpha: 0.55, phase: 0.2, speed: 0.9 },
  { xRatio: 0.19, yRatio: 0.09, radius: 1.8, color: "167, 139, 250", alpha: 0.42, phase: 1.1, speed: 0.7 },
  { xRatio: 0.15, yRatio: 0.26, radius: 2.5, color: "129, 140, 248", alpha: 0.62, phase: 2.0, speed: 1.1 },
  { xRatio: 0.28, yRatio: 0.19, radius: 1.7, color: "96, 165, 250", alpha: 0.38, phase: 0.7, speed: 0.8 },
  { xRatio: 0.36, yRatio: 0.11, radius: 2.1, color: "129, 140, 248", alpha: 0.48, phase: 1.6, speed: 1.0 },
  { xRatio: 0.48, yRatio: 0.16, radius: 1.9, color: "167, 139, 250", alpha: 0.40, phase: 2.5, speed: 0.85 },
  { xRatio: 0.63, yRatio: 0.10, radius: 2.4, color: "129, 140, 248", alpha: 0.58, phase: 0.4, speed: 0.95 },
  { xRatio: 0.74, yRatio: 0.18, radius: 2.6, color: "52, 211, 153", alpha: 0.52, phase: 1.9, speed: 0.75 },
  { xRatio: 0.86, yRatio: 0.12, radius: 2.0, color: "129, 140, 248", alpha: 0.48, phase: 2.8, speed: 1.05 },
  { xRatio: 0.91, yRatio: 0.27, radius: 2.3, color: "167, 139, 250", alpha: 0.54, phase: 0.9, speed: 0.8 },
  { xRatio: 0.79, yRatio: 0.33, radius: 1.8, color: "96, 165, 250", alpha: 0.40, phase: 1.4, speed: 0.9 },
  { xRatio: 0.11, yRatio: 0.44, radius: 2.1, color: "52, 211, 153", alpha: 0.46, phase: 2.2, speed: 0.7 },
  { xRatio: 0.24, yRatio: 0.38, radius: 1.9, color: "129, 140, 248", alpha: 0.42, phase: 3.0, speed: 0.85 },
  { xRatio: 0.88, yRatio: 0.48, radius: 2.2, color: "129, 140, 248", alpha: 0.50, phase: 1.2, speed: 0.95 },
];

const CONSTELLATION_EDGES: Array<[number, number]> = [
  [0, 1],
  [0, 2],
  [1, 3],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [7, 9],
  [7, 10],
  [9, 10],
  [2, 11],
  [2, 12],
  [3, 12],
  [10, 13],
];

export const ThreeHeroCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let idleCallbackId: number | null = null;
    let timeoutId: number | null = null;
    let width = 0;
    let height = 0;
    let lastFrameTime = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      width = parent?.clientWidth || window.innerWidth;
      height = parent?.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawScene = (timeSeconds: number) => {
      context.clearRect(0, 0, width, height);

      // 1. Upper & Mid-Viewport Studio Constellation Nodes + Filaments
      const computedNodes = CONSTELLATION_NODES.map((node) => {
        const driftX = Math.sin(timeSeconds * node.speed + node.phase) * 10;
        const driftY = Math.cos(timeSeconds * (node.speed * 0.85) + node.phase) * 8;
        return {
          ...node,
          x: node.xRatio * width + driftX,
          y: node.yRatio * height + driftY,
        };
      });

      context.lineWidth = 1;
      for (const [aIndex, bIndex] of CONSTELLATION_EDGES) {
        const nodeA = computedNodes[aIndex];
        const nodeB = computedNodes[bIndex];
        if (!nodeA || !nodeB) continue;

        const gradient = context.createLinearGradient(nodeA.x, nodeA.y, nodeB.x, nodeB.y);
        gradient.addColorStop(0, `rgba(${nodeA.color}, 0.16)`);
        gradient.addColorStop(1, `rgba(${nodeB.color}, 0.16)`);
        context.strokeStyle = gradient;
        context.beginPath();
        context.moveTo(nodeA.x, nodeA.y);
        context.lineTo(nodeB.x, nodeB.y);
        context.stroke();
      }

      for (const node of computedNodes) {
        const pulse = 0.85 + 0.15 * Math.sin(timeSeconds * 1.6 + node.phase);
        const currentAlpha = Math.min(0.85, node.alpha * pulse);

        // Soft outer glow halo
        context.fillStyle = `rgba(${node.color}, ${currentAlpha * 0.24})`;
        context.beginPath();
        context.arc(node.x, node.y, node.radius * 3.4, 0, Math.PI * 2);
        context.fill();

        // Crisp core point
        context.fillStyle = `rgba(${node.color}, ${currentAlpha})`;
        context.beginPath();
        context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        context.fill();
      }

      // 2. Lower Perspective Studio Horizon Wave Matrix
      const cols = width < 640 ? 14 : 24;
      const rows = width < 640 ? 7 : 10;
      const centerX = width * 0.5;
      const horizonY = height * 0.52;

      for (let row = 0; row < rows; row += 1) {
        const depthRatio = row / Math.max(1, rows - 1);
        const perspectiveScale = 0.42 + depthRatio * 0.78;

        for (let col = 0; col < cols; col += 1) {
          const normX = (col - (cols - 1) / 2) / ((cols - 1) / 2);
          const wave =
            Math.sin(col * 0.42 + timeSeconds * 1.15 + row * 0.35) * 12 +
            Math.cos(row * 0.55 - timeSeconds * 0.9) * 8;

          const x = centerX + normX * (width * 0.56) * perspectiveScale;
          const y = horizonY + depthRatio * (height * 0.44) + wave * perspectiveScale;
          const radius = Math.max(1.0, (1.15 + depthRatio * 1.35));
          const alpha = Math.min(0.58, 0.16 + depthRatio * 0.36);

          const isAccentNode = (row + col) % 7 === 0;
          const rgb = isAccentNode ? "52, 211, 153" : row % 2 === 0 ? "129, 140, 248" : "167, 139, 250";

          context.fillStyle = `rgba(${rgb}, ${alpha})`;
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }
      }
    };

    const renderLoop = (timestamp: number) => {
      if (timestamp - lastFrameTime >= 34) {
        lastFrameTime = timestamp;
        drawScene(timestamp * 0.001);
      }
      animationFrame = window.requestAnimationFrame(renderLoop);
    };

    resize();
    // Always paint an immediate rich static frame so the screen never looks blank
    drawScene(1.25);

    const isLowPowerDevice =
      mediaQuery.matches ||
      ((navigator.hardwareConcurrency || 8) <= 4 && window.innerWidth < 768);

    if (!isLowPowerDevice) {
      const startAnimation = () => {
        animationFrame = window.requestAnimationFrame(renderLoop);
      };

      const win = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };

      if (typeof win.requestIdleCallback === "function") {
        idleCallbackId = win.requestIdleCallback(startAnimation, { timeout: 1200 });
      } else {
        timeoutId = window.setTimeout(startAnimation, 450);
      }
    }

    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      const win = window as Window & { cancelIdleCallback?: (id: number) => void };
      if (idleCallbackId !== null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-90"
    />
  );
};
```

### 1.3 Upgrade `client/src/components/layout/LoginScreen.tsx` Atmosphere & Flush Header While Keeping the Exact `2b1f77b8` Layout
In `client/src/components/layout/LoginScreen.tsx`:
1. Keep the exact `2b1f77b8` 12-column (`lg:col-span-5` Auth Card + `lg:col-span-7` Showcase Card) structure and content.
2. Move the outer padding (`px-3.5 py-5 sm:px-6 sm:py-8 lg:px-8`) from the root wrapper onto a wrapper around `<main>` and `<footer>` so `<PublicPageHeader activePage="studio" />` sits flush edge-to-edge at the top of the screen just like `/docs` and `/privacy`.
3. Layer `.hoho-studio-backdrop`, `.hoho-studio-grid-overlay`, ambient radial glow orbs, and `<ThreeHeroCanvas />` inside the fixed background container.
4. Upgrade both primary cards from `bg-[#2b2d31]/95` to `bg-[#161A23]/90 backdrop-blur-xl border border-[#272D3A] shadow-[0_24px_64px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]`, and replace the remaining `#1e1f22` / `#2b2d31` inner boxes with `#10131A` and `#1D2230`.

```tsx
// Key structural update in client/src/components/layout/LoginScreen.tsx:
  return (
    <div className="hoho-studio-backdrop relative min-h-screen w-full overflow-x-hidden overflow-y-auto text-[#F1F3F9] flex flex-col justify-between selection:bg-[#818CF8]/30 selection:text-white">
      {/* Multi-layer atmospheric studio background */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div className="hoho-studio-grid-overlay absolute inset-0" />
        <div className="absolute -top-28 left-1/4 h-[26rem] w-[38rem] -translate-x-1/2 rounded-full bg-[#818CF8]/14 blur-[110px]" />
        <div className="absolute top-1/3 right-[-6rem] h-[24rem] w-[32rem] rounded-full bg-[#A78BFA]/10 blur-[120px]" />
        <div className="absolute -bottom-24 left-1/2 h-[22rem] w-[36rem] -translate-x-1/2 rounded-full bg-[#34D399]/8 blur-[120px]" />
        <ThreeHeroCanvas />
      </div>

      <PublicPageHeader activePage="studio" />

      <div className="relative z-10 flex flex-1 flex-col justify-between px-3.5 py-5 sm:px-6 sm:py-8 lg:px-8">
        <main className="mx-auto my-auto w-full max-w-6xl py-2 sm:py-4">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6 items-stretch">
            {/* Left Column (lg:col-span-5): Studio Auth Card */}
            <section className="lg:col-span-5 rounded-2xl border border-[#272D3A] bg-[#161A23]/90 backdrop-blur-xl p-5 sm:p-7 shadow-[0_24px_64px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] flex flex-col justify-between relative overflow-hidden">
              <div className="pointer-events-none absolute -top-20 -left-20 h-44 w-44 rounded-full bg-[#818CF8]/12 blur-3xl" aria-hidden="true" />
              {/* Keep exact existing Auth header, status alerts, Discord Sign-In CTA, and Guest Sandbox button; replace inner bg-[#1e1f22] with bg-[#10131A] and bg-[#2b2d31] with bg-[#1D2230] */}
            </section>

            {/* Right Column (lg:col-span-7): Live Capability Showcase Card */}
            <section className="lg:col-span-7 rounded-2xl border border-[#272D3A] bg-[#161A23]/90 backdrop-blur-xl p-5 sm:p-7 shadow-[0_24px_64px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)] flex flex-col justify-between relative overflow-hidden">
              <div className="pointer-events-none absolute -top-24 -right-20 h-52 w-52 rounded-full bg-[#A78BFA]/12 blur-3xl" aria-hidden="true" />
              {/* Keep exact existing Live Capability Showcase header, 2x2 capability cards (using bg-[#10131A]/90 border-[#272D3A] hover:border-[#818CF8]/40), and Interactive Component Mockup container (using bg-[#10131A]/95 border-[#272D3A]) */}
            </section>
          </div>
        </main>

        {/* Keep exact footer with Public Legal & Product Information links */}
      </div>
    </div>
  );
```

---

## Batch 2 — Fix Live Preview Click Capture & Select Menu Interactivity (`MessagePreview.tsx`, `ActionRowPreview.tsx`, `ComponentPreview.tsx`, `StudioLayout.tsx`)

### 2.1 Why Select Menus Are Broken in Live Preview & How to Fix Them
Currently:
1. `MessagePreview.tsx` attaches `onClickCapture` to the message card and calls `event.stopPropagation()` whenever `[data-preview-component-id]` is clicked. Because `stopPropagation()` runs during the **capture phase**, the click never reaches `<SelectPreview>`'s toggle button inside `ActionRowPreview.tsx`.
2. Furthermore, `<SelectPreview>` does not have `data-preview-interactive="true"`, and both `AutoComponent` (`ComponentPreview.tsx`) and `ButtonPreview` (`ActionRowPreview.tsx`) have duplicate `onClick` handlers calling `select({ kind: "component", id })`.

### 2.2 Update `client/src/components/preview/ActionRowPreview.tsx`
1. In `ButtonPreview`:
   - Keep `data-preview-component-id={button._id}` and `data-preview-interactive="true"`.
   - Remove the direct `select({ kind: "component", id: button._id })` call inside `ButtonPreview`'s `onClick` (or let it bubble to `MessagePreview`'s bubble-phase `onClick` handler so `StudioLayout`'s `handlePreviewComponentSelect` handles both message activation and inspector opening cleanly).
2. In `SelectPreview`:
   - Add `data-preview-interactive="true"` and `data-preview-select="true"` to the root wrapper of `SelectPreview`.
   - When the user clicks the `<SelectPreview>` trigger bar or options:
     - Allow the dropdown to open/close and select preview options normally so users can interactively test their Select Menus in the Live Preview!
     - Also trigger component selection (`select({ kind: "component", id: selectComp._id })` on desktop or via a dedicated `"Configure Flow"` pill or non-blocking selection) **without** swallowing the dropdown toggle!

```tsx
// In client/src/components/preview/ActionRowPreview.tsx:
// 1. Inside ButtonPreview:
  return (
    <button
      type="button"
      data-preview-component-id={button._id}
      data-preview-interactive="true"
      onClick={() => {
        if (isLink && button.url) {
          window.open(button.url, "_blank", "noopener,noreferrer");
        }
      }}
      className={...}
    >
      ...
    </button>
  );

// 2. Inside SelectPreview:
  return (
    <div
      className="relative max-w-[400px] mt-1 font-sans"
      ref={dropdownRef}
      data-preview-component-id={selectComp._id}
      data-preview-interactive="true"
      data-preview-select="true"
    >
      <div
        onClick={() => {
          if (!selectComp.disabled) {
            setIsOpen((prev) => !prev);
          }
        }}
        className={`flex items-center justify-between w-full min-h-[38px] px-3 py-1.5 bg-[#1e1f22] border rounded-[4px] text-sm transition-colors ${
          selectComp.disabled
            ? "opacity-50 cursor-not-allowed border-[#1e1f22]"
            : isSelected
            ? "cursor-pointer border-[#5865f2] ring-2 ring-[#5865f2]/40"
            : isOpen
            ? "cursor-pointer border-[#5865f2]"
            : "cursor-pointer border-[#1e1f22] hover:border-[#3f4147]"
        }`}
      >
        ...
```

### 2.3 Update `client/src/components/preview/ComponentPreview.tsx`
In `client/src/components/preview/ComponentPreview.tsx` (`AutoComponent`):
- Remove the unconditional `onClick={(e) => { e.stopPropagation(); select({ kind: "component", id: component._id }); }}` from `AutoComponent`'s wrapper `<div>` so it does not conflict with `MessagePreview.tsx` and `StudioLayout.tsx`! Keep `data-preview-component-id={component._id}` on `AutoComponent`'s wrapper `<div>`.

```tsx
// In client/src/components/preview/ComponentPreview.tsx:
export const AutoComponent: React.FC<{ component: ComponentNode }> = ({ component }) => {
  const { selection } = useMessageStore();
  const isSelected = selection?.kind === "component" && selection.id === component._id;
  ...
  return (
    <div
      data-preview-component-id={component._id}
      className={`relative group rounded transition-all cursor-pointer ${
        isSelected ? "ring-2 ring-[#5865f2] bg-[#5865f2]/10" : "hover:ring-1 hover:ring-white/10"
      }`}
    >
      {inner}
    </div>
  );
};
```

### 2.4 Replace `onClickCapture` with Bubble-Phase `onClick` in `client/src/components/preview/MessagePreview.tsx`
In `client/src/components/preview/MessagePreview.tsx` (lines 253–269):
- Remove `onClickCapture` completely!
- Handle `[data-preview-component-id]` inside the standard bubble-phase `onClick` handler on the message card. Because it runs in the bubble phase:
  - Clicking a `<SelectPreview>` trigger first toggles `isOpen` inside `SelectPreview`, and then bubbles up to `MessagePreview` where `onSelectPreviewComponent(index, componentId, true)` selects the Select Menu in the desktop Inspector / `FlowBuilder` without blocking the dropdown!
  - Clicking a `<ButtonPreview>` triggers `onSelectPreviewComponent(index, componentId, true)` to open its Inspector / `FlowBuilder`.
  - Clicking a non-interactive V2 block (`TextDisplay`, `Section`, `MediaGallery`, `Separator`, `File`, `Container`) triggers `onSelectPreviewComponent(index, componentId, false)`, which smoothly scrolls to that component in the left `MessageEditor` on desktop (or opens the component editor sheet on mobile).

```tsx
// In client/src/components/preview/MessagePreview.tsx:
            <div
              key={index}
              onClick={(event) => {
                const target = event.target as HTMLElement | null;
                const componentNode = target?.closest<HTMLElement>("[data-preview-component-id]");
                const componentId = componentNode?.dataset.previewComponentId;
                if (componentId && onSelectPreviewComponent) {
                  event.stopPropagation();
                  const isInteractive = Boolean(componentNode?.closest('[data-preview-interactive="true"]'));
                  onSelectPreviewComponent(index, componentId, isInteractive);
                  return;
                }
                onSelectMessage(index);
              }}
              className={`group relative rounded-lg border px-4 py-3 transition-colors duration-150 cursor-pointer ${
                isActive
                  ? "border-[#818CF8]/40 bg-[#32353b]/55 ring-1 ring-[#818CF8]/30"
                  : "border-transparent hover:border-white/5 hover:bg-[#32353b]/30"
              }`}
            >
```

---

## Batch 3 — Fix Mobile V2 Quick-Edit Sheet & Multi-Message Inspector Sync (`PropertyPanel.tsx`)

In `client/src/components/editor/PropertyPanel.tsx`:
1. Fix the message lookup when `selection?.kind === "message"` so it uses `selection.index` (falling back to `activeMessageIndex`):
   ```tsx
   const targetMessageIndex =
     selection?.kind === "message" ? selection.index : activeMessageIndex;
   const messageData = (messages && messages[targetMessageIndex]) || data;
   ```
2. Detect whether `messageData` is in **Components V2 mode**:
   ```tsx
   const isV2Message = Boolean((messageData.flags ?? 0) & (1 << 15));
   const primaryTextDisplay = isV2Message
     ? (messageData.components || []).find((comp) => comp.type === ComponentType.TextDisplay)
     : undefined;
   ```
3. In the mobile `selection.kind === "message"` sheet:
   - Ensure `activeMessageIndex` is synced if `selection.index !== activeMessageIndex` (call `setActiveMessageIndex(selection.index)` on edit if needed).
   - If `isV2Message` is `true`:
     - Bind the quick-edit `<textarea>` to `primaryTextDisplay?.content || ""` and update it via `updateComponent(primaryTextDisplay._id, { content: event.target.value })` (or if no `TextDisplay` exists yet, call `addComponent(ComponentType.TextDisplay)` and update its content) so typing in the mobile Quick-Edit sheet immediately updates the V2 message preview!
     - Show a clear badge `Components V2 Text Block` next to the label so the user knows they are editing the V2 text block.
   - Add a convenient `"Open Full Editor"` button in the quick-edit sheet header that switches `setMobileActivePane("editor")` and clears selection (`select(null)`) so mobile users can jump from the quick-edit drawer straight to the full `MessageEditor` with one tap.

---

## Batch 4 — Fix Undefined Legacy Tailwind Classes in `FlowBuilder.tsx` & Polish `StepList.tsx`

In `client/src/components/actions/FlowBuilder.tsx` (lines 111–145):
Replace all undefined legacy token classes (`text-ink-muted`, `text-blurple`, `text-ink-faint`, `bg-chrome`, `text-ink`, `bg-warning/10`, `text-warning`) with the explicit SaaS Studio hex tokens while preserving the exact `2b1f77b8` layout:

```tsx
// In client/src/components/actions/FlowBuilder.tsx:
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[#272D3A] pb-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A1A8B8] block">
            Interaction Flow
          </span>
          <span className="text-xs font-mono text-[#818CF8]">{customId}</span>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-[#6F788A] block">Trigger Event</span>
          <span className="text-xs font-medium text-[#F1F3F9]">
            {componentType === ComponentType.Button ? "Button Click" : "Select Option"}
          </span>
        </div>
      </div>

      <div className="rounded-lg bg-[#10131A] p-3 text-xs text-[#A1A8B8] border border-[#272D3A]">
        Define what happens when a user interacts with this component in Discord.
        <span className="block mt-1 text-[11px] text-[#6F788A]">
          Note: Requires dispatching via Server Bot mode to listen for interactions.
        </span>
      </div>

      {hasUnsavedChanges && (
        <div className="flex items-center justify-between rounded-lg bg-[#FBBF24]/10 px-3 py-2 text-xs text-[#FBBF24] border border-[#FBBF24]/30">
          <span>Unsaved changes to flow</span>
          <Button size="sm" variant="primary" onClick={handleSave} isLoading={isLoading}>
            Save Flow
          </Button>
        </div>
      )}

      <StepList
        steps={localSteps}
        onChange={handleStepsChange}
        onSave={handleSave}
      />
    </div>
  );
```

---

## Batch 5 — Fix Inverted Input Tokens, Header/Sidebar Surfaces & `index.html` Theme Color

1. **`client/src/components/editor/MessageEditor/ContentTab.tsx` (lines 65 & 89)**:
   - Replace `bg-[#272D3A] border border-[#161A23]` on the `Existing Thread ID (Optional)` and `Forum Thread Name (New Post)` inputs with `bg-[#1D2230] border border-[#272D3A] focus:border-[#818CF8]` so they match all other studio inputs instead of having inverted border/background colors.
2. **`client/src/components/editor/ComponentForms.tsx` (lines 60, 134, 174, 297, 329)**:
   - Replace `bg-[#1D2230] border border-[#10131A]` on the helper callout boxes with `bg-[#10131A] border border-[#272D3A] text-[#A1A8B8]`.
3. **`client/src/components/editor/DiscohookComponentsEditor.tsx` (lines 351, 365)**:
   - Replace `border-[#313338]` on `+ Add Button` and `+ Add Select Menu` dashed buttons with `border-[#272D3A] hover:border-[#818CF8]/50 hover:bg-[#1D2230]/50`.
4. **`client/src/components/layout/Header.tsx` (lines 105, 198, 289, 302)**:
   - Replace remaining `bg-[#2b2d31]` and `border-[#2b2d31]` instances with `bg-[#161A23]`, `hover:bg-[#1D2230]`, and `border-[#272D3A]`.
5. **`client/src/components/layout/Sidebar.tsx` (lines 38, 40, 56)**:
   - Replace `bg-[#2b2d31]/50`, `bg-[#2b2d31]`, and `bg-[#272D3A]/30` header/item surfaces with `bg-[#10131A]`, `bg-[#161A23]`, and `border-[#272D3A]`.
6. **`client/index.html` (lines 29 & 39)**:
   - Update `<meta name="theme-color" content="#0B0D12" />` and `<body class="bg-[#0B0D12] text-[#F1F3F9] antialiased selection:bg-[#818CF8] selection:text-white">`.

---

## Batch 6 — Core Web Vitals: GPU-Friendly Transitions & Desktop-Only Lenis Wheel Smoothing

1. **`client/src/config/uiThemeConfig.ts`**:
   - Update `UI_THEME_CONFIG.button.base` from:
     `transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150`
     to:
     `transition-[transform,background-color,color,opacity] duration-150`
     (Eliminates the Lighthouse Timespan non-composited `border-color` / `box-shadow` paint warning while keeping tactile `active:scale-[0.99]` and smooth background/text state transitions).
2. **`client/src/utils/editorSmoothScroll.ts`**:
   - In `attachSmoothScroll(container)`, check if the device uses a coarse pointer (`window.matchMedia("(pointer: coarse)").matches`). If coarse pointer is true, skip initializing `Lenis` and use native momentum scrolling (`return () => {}`), ensuring `0ms` touch input delay on mobile phones and tablets while preserving silky smooth wheel scrolling on desktop.

---

## Batch 7 — Automated Tests, Layout Stress Verification & Handoff Update

1. **Update `client/src/components/layout/__tests__/LoginScreen.test.tsx`**:
   - Verify `LoginScreen` renders `<PublicPageHeader activePage="studio" />`, `.hoho-studio-backdrop`, `.hoho-studio-grid-overlay`, the 12-column grid (`lg:col-span-5` and `lg:col-span-7`), Discord OAuth CTA, and Guest Sandbox button.
2. **Update `client/src/components/editor/__tests__/MessageEditor.test.tsx`**:
   - Add a test verifying that clicking a `<SelectPreview>` inside `MessagePreview` opens its dropdown options list AND notifies `onSelectPreviewComponent(index, componentId, true)` without being blocked by capture-phase `stopPropagation()`.
   - Add a test verifying that `PropertyPanel` in mobile message quick-edit mode edits the first `TextDisplay` block when the selected message has the Components V2 flag (`1 << 15`).
3. **Run Full Verification Suite**:
   - `npm run test` (ensure all test files and tests pass).
   - `npm run build` (verify clean TypeScript + Vite production bundle).
   - Update `docs/GEMINI_HANDOFF_CURRENT.md` with the final commit SHA and test results.
