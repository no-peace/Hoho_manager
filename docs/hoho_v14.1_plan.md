# HoHo Manager — V14 Professional UI/Mobile Overhaul, Speed Optimization & Clean Dialogs Plan

- **Repository**: [`no-peace/Hoho_manager`](https://github.com/no-peace/Hoho_manager) (`main` branch)
- **Audited Baseline**: Commit `9cbca79624353b87218febeb75d5ab10d04a77e5` / `9b8905fca3a1fd775e68f4676e5a34e2e05d17ed` ([HoHo Manager NotebookLM](https://gemini.google.com/notebook/e8f024b3-7812-4f1f-97cd-afa0966538fd))
- **Hosting Constraints**: **Render Free Plan** (`0.1 CPU`, `512 MB RAM`) + **Turso Free Plan**
- **Verification Rule for ChatGPT**:
  - **DO NOT run `npm test`, `npm run typecheck`, or `npm run build`**, and **DO NOT rely on GitHub Actions** (Actions are intentionally disabled by the owner).
  - Commit clean, complete, unabridged source files directly on GitHub with casual lowercase commit messages. Double-check every import, TypeScript type, and JSX closing tag by reading each modified file back before moving to the next batch.
  - Once all batches are committed, the owner will pull locally and run `npm run typecheck`, `npm test`, and `npm run build` themselves.

---

## 0. What This Plan Fixes (Step-by-Step Overview)

1. **Speed (Build + UI + Server)**: Parallelize workspace builds (`client`, `server`, `bot` after `shared`), audit and remove unused heavy client dependencies, drop `gsap` (smooth scrolling uses `lenis`, which stays untouched!), and add server config caching.
2. **Unified Toasts & Confirm Dialogs**: Audit the entire `client/src/` tree to eliminate any native `window.alert`, `window.confirm`, or `window.prompt` calls and ensure all user feedback uses the shared **Sileo toast** (`useGlobalStore.getState().showToast(...)`) and shared **Confirm Modal** (`openConfirm(...)`).
3. **High-Craft Login Page & Background (Linear/Vercel Studio Grade)**: Replace the generic neon aurora blobs and canvas dots (`ThreeHeroCanvas`) with a **precision architectural blueprint grid**, **GPU-accelerated 1px gliding light beams** along the grid tracks (zero JS/canvas overhead), **metallic specular card rims + mouse-follow hover spotlight**, equal-height 12-column desktop cards (`lg:items-stretch`), and an **interactive IDE-style Discord Preview window** with live ephemeral reply feedback when clicking demo buttons.
4. **Professional Mobile & Desktop Studio Layout**: Remove the double `"Live Preview"` / `"Message Editor"` headers, fix the `#2b2d31` gray editor background clash, hide the duplicate top-bar Send button on mobile, redesign the mobile bottom dock into a crisp native-feeling segmented control, simplify the 3-line mobile Inspector header, fix raw Guild IDs in the server selector, and fix button contrast + mobile input auto-zoom.

---

## Batch 1 — Build Speed, Dependency Audit & Dropping Unused Animation Weight

### 1.1 Parallelize `npm run build` in Root `package.json`
Update `"build"` in root `package.json` so `@dmb/shared` builds first, then `client`, `server`, and `bot` build in parallel via `concurrently`:
```json
"build": "npm run build:shared && concurrently --kill-others-on-fail -n client,server,bot -c magenta,blue,green \"npm:build:client\" \"npm:build:server\" \"npm:build:bot\""
```

### 1.2 Audit Unused Heavy Client Dependencies (`client/package.json`) & Remove `gsap` (Keep `lenis` Intact)
1. **Keep `lenis` untouched** — `client/src/utils/editorSmoothScroll.ts` uses `lenis` for desktop smooth scrolling.
2. Search `client/src/` for imports of `@base-ui/react`, `emoji-mart`, `@emoji-mart/data`, `chrono-node`, and `highlight.js`:
   - Remove any package from `client/package.json` that has **zero** active imports in `client/src/`.
   - If `highlight.js` IS imported via full default import (`import hljs from "highlight.js"`), switch it to `highlight.js/lib/core` registering only common Discord languages (`javascript`, `typescript`, `json`, `python`, `bash`, `lua`, `css`, `xml`).
3. Replace `gsap` in `client/src/components/reactbits/ReactBitsPrimitives.tsx` with zero-dependency React/CSS implementations so `gsap` can be removed from `client/package.json`:
   - `SplitTextReveal`: render crisp text with a lightweight CSS fade-in.
   - `CountUpNumber`: render `<span className={\`tabular-nums ${className}\`}>{value}{suffix}&lt;/span&gt;` directly (`0ms` INP, no GSAP tween).
   - `MagneticButton`: render `<div className={className}>{children}</div>` without mousemove GSAP listeners.
   - Keep `ShinyText` and `SpotlightCard` exported with identical prop signatures so zero callers break.
4. Remove `"gsap"` from `client/package.json`.

### 1.3 Lightweight Server Config Caching (`server/src/routes/config.ts`)
- In `server/src/routes/config.ts`, set `res.setHeader("Cache-Control", "public, max-age=300")` on `GET /api/config`.

---

## Batch 2 — Strict Toast & Confirm Dialog Audit Across `client/src/`

1. Scan all files in `client/src/` (excluding `*.test.*`) for any occurrence of `window.alert(`, `alert(`, `window.confirm(`, `confirm(`, `window.prompt(`, or `prompt(`.
2. Replace any native browser `alert(...)` with `useGlobalStore.getState().showToast(message, "error" | "info" | "success")` (rendered via `<SileoToaster />`).
3. Replace any native browser `confirm(...)` with `useGlobalStore.getState().openConfirm({ title, message, confirmLabel, danger, onConfirm })`.
4. Ensure consistent toast feedback in key flows:
   - **`client/src/components/editor/FileAttachmentsSection.tsx`**: Fire `useGlobalStore.getState().showToast(msg, "error")` when a file exceeds 25 MB, >10 files are added, or an invalid URL is submitted.
   - **`client/src/components/send/BotDispatchModal.tsx`**: Fire `useGlobalStore.getState().showToast(...)` on send/edit success and failure alongside the inline status box.
   - **`client/src/pages/DocsPage.tsx`**: Fire `useGlobalStore.getState().showToast("Could not copy to clipboard", "error")` if clipboard copy fails.

---

## Batch 3 — High-Craft Architectural Login Page & Kinetic Grid Beams (`globals.css`, `LoginScreen.tsx`)

### 3.1 Upgrade `.hoho-studio-backdrop` & `.hoho-studio-grid-overlay` with Kinetic Grid Beams (`client/src/styles/globals.css`)
Replace the generic neon aurora blobs with a **precision dark studio blueprint + GPU-only gliding 1px light beams** (zero JS, zero canvas, 60fps compositor-only `transform: translate3d`, disabled automatically under `prefers-reduced-motion`):

```css
.hoho-studio-backdrop {
  background-color: #080A0F;
  background-image:
    radial-gradient(ellipse 70% 45% at 50% -5%, rgba(88, 101, 242, 0.14) 0%, rgba(129, 140, 248, 0.04) 42%, transparent 72%),
    radial-gradient(ellipse 50% 35% at 85% 95%, rgba(52, 211, 153, 0.06) 0%, transparent 65%),
    linear-gradient(180deg, #080A0F 0%, #0C0F17 55%, #080A0F 100%);
}

.hoho-studio-grid-overlay {
  background-size: 48px 48px;
  background-image:
    linear-gradient(to right, rgba(241, 243, 249, 0.042) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(241, 243, 249, 0.042) 1px, transparent 1px);
  mask-image: radial-gradient(ellipse 85% 75% at 50% 38%, #000 30%, transparent 90%);
  -webkit-mask-image: radial-gradient(ellipse 85% 75% at 50% 38%, #000 30%, transparent 90%);
}

@keyframes hoho-beam-x {
  0% { transform: translate3d(-15%, 0, 0); opacity: 0; }
  12% { opacity: 0.85; }
  88% { opacity: 0.85; }
  100% { transform: translate3d(115%, 0, 0); opacity: 0; }
}

@keyframes hoho-beam-y {
  0% { transform: translate3d(0, -15%, 0); opacity: 0; }
  15% { opacity: 0.7; }
  85% { opacity: 0.7; }
  100% { transform: translate3d(0, 115%, 0); opacity: 0; }
}

.hoho-grid-beam-x {
  position: absolute;
  height: 1px;
  width: 240px;
  background: linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.75), rgba(241, 243, 249, 0.9), transparent);
  animation: hoho-beam-x 9s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  will-change: transform, opacity;
}

.hoho-grid-beam-y {
  position: absolute;
  width: 1px;
  height: 200px;
  background: linear-gradient(180deg, transparent, rgba(52, 211, 153, 0.6), rgba(129, 140, 248, 0.75), transparent);
  animation: hoho-beam-y 11s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  will-change: transform, opacity;
}

@media (prefers-reduced-motion: reduce) {
  .hoho-grid-beam-x,
  .hoho-grid-beam-y {
    display: none;
  }
}
```

### 3.2 Upgrade `client/src/components/layout/LoginScreen.tsx` (Equal-Height Tactile Studio Split + Interactive Preview)
Update `client/src/components/layout/LoginScreen.tsx`:
1. **Replace `ThreeHeroCanvas` + the 3 blurry neon orbs** with the architectural `.hoho-studio-grid-overlay` plus **2 crisp gliding grid beams** (`.hoho-grid-beam-x` positioned at `top-[192px] left-0` and `.hoho-grid-beam-y` positioned at `left-[288px] top-0`, hidden on narrow phones if desired or shown cleanly at `opacity-60`).
2. **Remove `select-none`** from the outer scroll container so users can copy error messages normally.
3. **Equal-Height 12-Column Grid (`lg:items-stretch`)**:
   - Change `<main>` to `items-stretch` so the Left Auth Card (`lg:col-span-5`) and Right Studio Preview Window (`lg:col-span-7`) match heights cleanly on desktop.
   - Wrap both cards with your existing lightweight CSS `SpotlightCard` (subtle mouse-follow sheen on desktop hover) and add a crisp `1px` metallic top specular rim (`<div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#818CF8]/60 to-transparent" aria-hidden="true" />`).
   - **Left Card (`lg:col-span-5`)**:
     - Elevated studio surface: `bg-[#11141B]/95 border border-[#222734] rounded-2xl p-5 sm:p-7 shadow-[0_24px_64px_rgba(0,0,0,0.55)] flex flex-col justify-between`.
     - Official Discord Blurple CTA (`bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3C45A5] text-white`) with crisp contrast.
     - Recessed security specs block (`bg-[#0B0E14] border border-[#1D2230] rounded-xl divide-y divide-[#1D2230]`) for the 3 trust items.
   - **Right Card (`lg:col-span-7`) — Interactive Studio Preview Window**:
     - Styled like a real developer tool window (`bg-[#11141B]/95 border border-[#222734] rounded-2xl overflow-hidden flex flex-col justify-between shadow-[0_24px_64px_rgba(0,0,0,0.55)]`):
       - **Top Window Chrome**: Subtle window dots + `#announcements` label on the left; 3 showcase tabs on the right inside a **single-line horizontal scroll strip** (`flex items-center gap-1 overflow-x-auto no-scrollbar`) with `whitespace-nowrap` so tabs never wrap onto 2 lines on mobile.
       - **Interactive Discord Preview Body**: Authentic `#1B1E26` / `#2B2D31` Discord preview stage. Keep `IS_COMPONENTS_V2 (32768)` and `● BOT DISPATCH` strictly single-line (`whitespace-nowrap shrink-0`). Wire the demo buttons (`Read Changelog`, `Verify Role`, `Submit Application`, etc.) using the existing `clickedBtn` state to render a **live in-card Discord Ephemeral Reply banner** (e.g. `Only you can see this · Triggered "${clickedBtn}" flow`) so visitors can interactively test a button click right on the Login page!
       - **Bottom Studio Status Bar**: A `1px` top-bordered footer bar (`bg-[#0B0E14] border-t border-[#1D2230] px-4 py-2.5 flex items-center justify-between text-[0.6875rem] font-mono text-[#6F788A]`) showing `Components V2 · Action Flows · Dynamic Variables` and a green `● Ready` indicator, visually anchoring the bottom of the right card.

---

## Batch 4 — Desktop & Mobile Studio Layout Overhaul (`StudioLayout.tsx`, `Header.tsx`, `PropertyPanel.tsx`, `SearchableDiscordSelect.tsx`)

### 4.1 Eliminate Double Headers & Fix Left Editor Background Color (`StudioLayout.tsx`)
In `client/src/components/layout/StudioLayout.tsx`:
1. **Left Pane (`Editor`)**:
   - Change the outer wrapper `<section>` from `bg-[#2b2d31]` to `bg-[#0B0D12]` and **remove** the redundant `"Message Editor"` header strip (`<div className="shrink-0 border-b border-[#272D3A] px-3 py-2"><h2>Message Editor</h2></div>`).
   - Use edge-to-edge layout on mobile (`rounded-none border-0 min-[1200px]:rounded-[10px] min-[1200px]:border min-[1200px]:border-[#272D3A]`).
   - Change the two `"Choose Message Mode"` cards inside `CultMorphSurface` from `bg-[#2b2d31]` to `bg-[#1D2230] border-[#272D3A]`.
2. **Right Pane (`Live Preview`)**:
   - **Remove** the redundant outer `"Live Preview"` header strip (`MessagePreview.tsx` already renders its own `"LIVE PREVIEW | Message X: Components V2 | #1 #2"` bar).
   - Use edge-to-edge layout on mobile (`rounded-none border-0 min-[1200px]:rounded-[10px] min-[1200px]:border min-[1200px]:border-[#272D3A]`) while preserving `#313338` inside `MessagePreview`.

### 4.2 Redesign the Mobile Bottom Navigation Dock (`StudioLayout.tsx`)
Replace the chunky mobile `<nav>` in `client/src/components/layout/StudioLayout.tsx` with a sleek, native-feeling segmented dock:
- Container: `min-[1200px]:hidden flex items-center gap-2.5 border-t border-[#202531] bg-[#0D1017]/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md shrink-0 z-30`.
- **Segmented `Editor` / `Preview` Switcher**: Wrap both buttons in `<div className="flex flex-1 items-center gap-1 rounded-xl border border-[#232836] bg-[#141821] p-1">`.
  - Active tab: `bg-[#242A3A] text-[#F1F3F9] border border-[#818CF8]/40 shadow-xs` (high contrast, crisp dark studio feel—no washed-out white text on light lavender).
  - Inactive tab: `text-[#8B93A7] hover:text-[#F1F3F9] border border-transparent`.
- **Primary `Dispatch` Action**: Remove `<MagneticButton>` and render a clean `min-h-[42px] px-4 rounded-xl bg-[#248046] hover:bg-[#1a6334] active:scale-[0.98] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-sm`.

### 4.3 Clean Up Mobile & Desktop Header (`Header.tsx` & `SearchableDiscordSelect.tsx`)
1. In `client/src/components/layout/Header.tsx`:
   - Hide the duplicate green Send icon button on mobile/tablet (`hidden min-[1200px]:inline-flex`) so mobile users only have one green `Dispatch` button (in the bottom dock).
   - Give the Server selector more breathing room on mobile (`min-w-[120px] flex-1 max-w-[175px] sm:flex-none sm:w-44 lg:w-52`).
2. In `client/src/components/ui/SearchableDiscordSelect.tsx`:
   - When `type === "guild"` and `value` is a raw 17–20 digit snowflake ID whose guild name hasn't loaded into `options` yet, show `"Loading server…"` (while loading) or `"Select Server…"` instead of raw numbers like `906426036772818954`.

### 4.4 Simplify the Crowded Mobile Inspector Bottom Sheet (`PropertyPanel.tsx`)
In `client/src/components/editor/PropertyPanel.tsx`:
- In all three inspector views (`selection.kind === "message"`, `"embed"`, and `"component"`), remove the redundant `Properties` micro-label stacked above `Message Quick Edit` / `Embed Inspector` / `Component Inspector`.
- Add `pb-[max(1rem,env(safe-area-inset-bottom))]` on the scrollable inspector body.

---

## Batch 5 — Button Contrast, Form Inputs & Web Interface Guidelines Polish (`uiThemeConfig.ts`, `globals.css`, `ContentTab.tsx`, `ComponentsTab.tsx`, `FileAttachmentsSection.tsx`, `CultSkiperPrimitives.tsx`, `BotDispatchModal.tsx`, `Sidebar.tsx`)

### 5.1 Fix Washed-Out White Text on `#818CF8` Lavender Buttons
- In `client/src/config/uiThemeConfig.ts`, `client/src/components/editor/MessageEditor/index.tsx` (`+ Add`), `client/src/components/editor/FileAttachmentsSection.tsx` (`Upload`), and `client/src/components/ui/CultSkiperPrimitives.tsx` (`CultMorphSurface` trigger):
  - Change primary indigo action buttons from `bg-[#818CF8] text-white` to `bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3C45A5] text-white` (4.6:1+ WCAG AA contrast).

### 5.2 Safe Web Interface Guidelines CSS (`client/src/styles/globals.css` & `client/index.html`)
1. In `client/index.html`: add `class="dark"` and `style="color-scheme: dark;"` on `<html>`.
2. In `client/src/styles/globals.css`:
   - Add `html { color-scheme: dark; -webkit-text-size-adjust: 100%; }`.
   - Add `touch-action: manipulation; -webkit-tap-highlight-color: transparent;` on interactive elements.
   - Add explicit dark styling on native `<select>` and `<option>` (`background-color: #161A23; color: #F1F3F9;`).
   - Add `overscroll-behavior: contain;` on `.custom-scrollbar` and `[role="dialog"]`.
   - Add mobile `<16px` input auto-zoom protection (`@media (max-width: 639px)` `font-size: 16px` on text inputs, textareas, and selects).
   - Add `.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { scrollbar-width: none; }`.

### 5.3 Fix Remaining Inverted Input & Surface Tokens + Unsaved-Work Guard
- `client/src/components/editor/MessageEditor/ContentTab.tsx`: change `Forum Thread Name` input to `bg-[#1D2230] border-[#272D3A] focus:border-[#818CF8]`, and hover `hover:bg-[#282a2e]` to `hover:bg-[#252B3A]`.
- `client/src/components/editor/MessageEditor/ComponentsTab.tsx`: change `Thumbnail Image URL` input to `bg-[#1D2230] border-[#272D3A] focus:border-[#818CF8]`.
- `client/src/components/send/BotDispatchModal.tsx`: change `#dispatch-target-message-id` to `bg-[#1D2230] border-[#272D3A] focus:border-[#818CF8]`.
- `client/src/components/layout/Sidebar.tsx`: change header and tab-bar backgrounds from `bg-[#272D3A]` to `bg-[#10131A]`.
- `client/src/components/layout/StudioLayout.tsx`: add a `beforeunload` listener when any message has content, embeds, components, or attachments.

---

## Batch 6 — Update Affected Tests & `docs/GEMINI_HANDOFF_CURRENT.md`

1. Update `client/src/components/layout/__tests__/LoginScreen.test.tsx`:
   - Remove the `ThreeHeroCanvas` mock (since `LoginScreen.tsx` no longer imports it).
   - Keep assertions verifying `.hoho-studio-backdrop`, `.hoho-studio-grid-overlay`, 12-column grid (`lg:col-span-5` and `lg:col-span-7`), public header active state, and `"Login with Discord"` CTA.
2. Check if anything else imports `ThreeHeroCanvas`; keep `ThreeHeroCanvas.tsx` and its unit test intact (or delete both together only if nothing imports it).
3. Update `docs/GEMINI_HANDOFF_CURRENT.md` with the exact V14 commits and note that local `npm run typecheck`, `npm test`, and `npm run build` will be run by the owner after pulling.