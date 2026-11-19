# HoHo Manager — V14 Professional UI/Mobile Overhaul, Speed Optimization & Clean Dialogs Plan

* **Repository**: [`no-peace/Hoho_manager`](https://github.com/no-peace/Hoho_manager) (`main` branch)

* **Audited Baseline**: Commit `9cbca79624353b87218febeb75d5ab10d04a77e5` / `9b8905fca3a1fd775e68f4676e5a34e2e05d17ed` ([HoHo Manager NotebookLM](https://gemini.google.com/notebook/e8f024b3-7812-4f1f-97cd-afa0966538fd))

* **Hosting Constraints**: **Render Free Plan** (`0.1 CPU`, `512 MB RAM`) + **Turso Free Plan**

* **Verification Rule for ChatGPT**:

  * **DO NOT run `npm test`, `npm run typecheck`, or `npm run build`**, and **DO NOT rely on GitHub Actions** (Actions are intentionally disabled by the owner).

  * Commit clean, complete, unabridged source files directly on GitHub with casual lowercase commit messages. Double-check every import, TypeScript type, and JSX closing tag by reading each modified file back before moving to the next batch.

  * Once all batches are committed, the owner will pull locally and run `npm run typecheck`, `npm test`, and `npm run build` themselves.

## 0. What This Plan Fixes (Step-by-Step Overview)

1. **Speed (Build + UI + Server)**: Parallelize workspace builds (`client`, `server`, `bot` after `shared`), audit and remove unused heavy client dependencies (and drop `gsap` in favor of lightweight CSS/React), eliminate GPU-heavy login canvas/blur orbs, and add static/config response caching.

2. **Unified Toasts & Confirm Dialogs**: Audit the entire `client/src/` tree to eliminate any native `window.alert`, `window.confirm`, or `window.prompt` calls and ensure all user feedback uses the shared **Sileo toast** (`useGlobalStore.getState().showToast(...)`) and shared **Confirm Modal** (`openConfirm(...)`).

3. **High-Craft Login Page & Background (No More "Cheap" AI Glow)**: Replace the neon aurora blobs and floating constellation canvas (`ThreeHeroCanvas`) with a restrained, Linear/Vercel-inspired architectural dark studio canvas (`#090B10`), equal-height 12-column desktop cards (`lg:items-stretch`), an IDE-style preview window frame, and non-wrapping mobile pills.

4. **Professional Mobile & Desktop Studio Layout**: Remove the double `"Live Preview"` / `"Message Editor"` headers, fix the `#2b2d31` gray editor background clash, hide the duplicate top-bar Send button on mobile, redesign the mobile bottom dock into a crisp native-feeling segmented control, simplify the 3-line mobile Inspector header, fix raw Guild IDs in the server selector, and fix button contrast + mobile input auto-zoom.

## Batch 1 — Build Speed, Dependency Audit & Dropping Redundant Animation Weight

### 1.1 Parallelize `npm run build` in Root `package.json`

Currently, root `package.json` runs all 4 workspaces sequentially:
`"build": "npm run build:shared && npm run build:client && npm run build:server && npm run build:bot"`

Update `"build"` in root `package.json` to build `@dmb/shared` first and then compile `client`, `server`, and `bot` in parallel using `concurrently` (already installed in root `devDependencies`):

```
"build": "npm run build:shared && concurrently --kill-others-on-fail -n client,server,bot -c magenta,blue,green \"npm:build:client\" \"npm:build:server\" \"npm:build:bot\""

```

### 1.2 Audit Unused Heavy Client Dependencies (`client/package.json`) & Remove `gsap`

1. Search `client/src/` for imports of `@base-ui/react`, `emoji-mart`, `@emoji-mart/data`, `chrono-node`, and `highlight.js`.

   * Remove any package from `client/package.json` that has **zero** active imports in `client/src/` (keep any package that is actively imported).

   * If `highlight.js` IS imported via full default import (`import hljs from "highlight.js"`), switch it to `highlight.js/lib/core` registering only the common Discord languages (`javascript`, `typescript`, `json`, `python`, `bash`, `lua`, `css`, `xml`) so Rollup does not bundle 190+ languages during `vite build`.

2. Replace `gsap` in `client/src/components/reactbits/ReactBitsPrimitives.tsx` with zero-dependency React/CSS implementations so `gsap` can be removed from `client/package.json`:

   * `SplitTextReveal`: render crisp text with a lightweight CSS fade-in (no per-character GSAP timeline).

   * `CountUpNumber`: render `<span className={\`tabular-nums \${className}\`}>{value}{suffix}</span>`directly (instant`0ms\` INP, no GSAP tween).

   * `MagneticButton`: render a lightweight wrapper `<div className={className}>{children}</div>` without mousemove GSAP `quickTo` listeners.

   * Keep `ShinyText` and `SpotlightCard` exported with identical prop signatures so zero callers break.

3. Remove `"gsap"` from `client/package.json`.

### 1.3 Lightweight Server Config Caching (`server/src/routes/config.ts`)

* In `server/src/routes/config.ts`, set `res.setHeader("Cache-Control", "public, max-age=300")` on `GET /api/config` since `actionTypes` and `features` are static for the lifetime of the server process.

## Batch 2 — Strict Toast & Confirm Dialog Audit Across `client/src/`

1. Scan all files in `client/src/` (excluding `*.test.*`) for any occurrence of:

   * `window.alert(`, `alert(`

   * `window.confirm(`, `confirm(`

   * `window.prompt(`, `prompt(`

2. Replace any native browser `alert(...)` with `useGlobalStore.getState().showToast(message, "error" | "info" | "success")` (which renders through the single `<SileoToaster />` in `ToastAndConfirmHost`).

3. Replace any native browser `confirm(...)` with `useGlobalStore.getState().openConfirm({ title, message, confirmLabel, danger, onConfirm })`.

4. Ensure consistent toast feedback in key interactive flows:

   * **`client/src/components/editor/FileAttachmentsSection.tsx`**: When a user drops/selects too many files (>10), an oversized file (>25 MB), or an invalid URL, call `useGlobalStore.getState().showToast(msg, "error")` in addition to the inline error message.

   * **`client/src/components/send/BotDispatchModal.tsx`**: When a send or edit succeeds or fails, also fire `useGlobalStore.getState().showToast(...)` so feedback matches the rest of the studio.

   * **`client/src/pages/DocsPage.tsx`**: If clipboard copy fails, fire `useGlobalStore.getState().showToast("Could not copy to clipboard", "error")` instead of failing silently.

## Batch 3 — High-Craft Login Page & Architectural Background (`LoginScreen.tsx`, `globals.css`, `PublicPageHeader.tsx`)

### 3.1 Replace the "Cheap" Neon Aurora / Constellation Backdrop with an Architectural Studio Canvas

In `client/src/styles/globals.css`:

* Replace `.hoho-studio-backdrop` and `.hoho-studio-grid-overlay` with a refined, Linear/Vercel-inspired dark studio surface:

  * Base `#090B10` with a single subtle, cool top-center studio wash (`rgba(148, 163, 184, 0.055)` + whisper of `#5865F2` at `0.07` opacity — no glowing purple/green neon blobs).

  * Ultra-fine `32px × 32px` architectural dot matrix (`radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px)`) masked cleanly at the edges so it fades naturally into `#090B10`.

```
.hoho-studio-backdrop {
  background-color: #090B10;
  background-image:
    radial-gradient(ellipse 65% 42% at 50% 0%, rgba(88, 101, 242, 0.09) 0%, rgba(148, 163, 184, 0.03) 45%, transparent 72%),
    linear-gradient(180deg, #090B10 0%, #0C0F16 60%, #090B10 100%);
}

.hoho-studio-grid-overlay {
  background-size: 32px 32px;
  background-image: radial-gradient(rgba(241, 243, 249, 0.09) 1px, transparent 1px);
  mask-image: radial-gradient(ellipse 80% 70% at 50% 35%, #000 20%, transparent 85%);
  -webkit-mask-image: radial-gradient(ellipse 80% 70% at 50% 35%, #000 20%, transparent 85%);
}

```

### 3.2 Redesign `client/src/components/layout/LoginScreen.tsx` (Equal-Height Editorial Split + Clean Mobile Layout)

Update `client/src/components/layout/LoginScreen.tsx`:

1. **Remove `ThreeHeroCanvas` and the 3 giant neon blur orbs** from `LoginScreen.tsx` (cuts JS/GPU overhead and eliminates the generic AI template look). Keep `hoho-studio-backdrop` and `hoho-studio-grid-overlay` so `LoginScreen.test.tsx` continues to pass.

2. **Remove `select-none`** from the outer scroll container so users can copy error messages normally.

3. **Equal-Height 12-Column Grid (`lg:items-stretch`)**:

   * Change `<main>` from `items-start lg:items-center` to `items-stretch` so the Left Auth Card (`lg:col-span-5`) and Right Studio Preview Window (`lg:col-span-7`) align to the **exact same height** on desktop with zero awkward empty gaps.

   * **Left Card (`lg:col-span-5`)**:

     * Crisp elevated dark surface: `bg-[#11141B] border border-[#222734] rounded-2xl p-5 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] flex flex-col justify-between`.

     * Use official Discord Blurple (`bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3C45A5] text-white`) for the primary `"Login with Discord"` button for instant brand recognition and strong WCAG AA contrast.

     * Keep `"Continue as Local Developer"` dev-only button clean and subtle underneath when `import.meta.env.DEV` is true.

     * Keep the 3 security rows (`Mutual-Guild & Role Check`, `24-Hour Session Expiry`, `Workspace Backups`) separated by crisp `divide-y divide-[#1E2330]` hairlines inside a subtle recessed container (`bg-[#0C0F16] border border-[#1E2330] rounded-xl`).

   * **Right Card (`lg:col-span-7`) — Full-Height Studio Preview Window**:

     * Styled like a real developer tool window (`bg-[#11141B] border border-[#222734] rounded-2xl overflow-hidden flex flex-col justify-between shadow-[0_20px_50px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]`):

       * **Top Window Bar**: Left side shows subtle window dots + `#announcements` channel label; right side shows the 3 showcase tabs inside a **single-line horizontal scroll strip** (`flex items-center gap-1 overflow-x-auto no-scrollbar`) with `whitespace-nowrap` so tabs NEVER wrap awkwardly onto 2 lines on mobile!

       * **Middle Discord Preview Body**: Authentic `#1A1D24` / `#2B2D31` inner preview stage. Keep the badge (`IS_COMPONENTS_V2 (32768)`) and status pill (`● BOT DISPATCH`) strictly single-line using `whitespace-nowrap shrink-0` and `flex-wrap gap-2` so neither pill ever breaks onto two lines on 360px–390px phones!

       * **Bottom Window Status Strip**: A clean `1px` top-bordered studio telemetry strip (`bg-[#0C0F16] border-t border-[#1E2330] px-4 py-2.5 flex items-center justify-between text-[0.6875rem] font-mono text-[#6F788A]`) showing `Components V2 · Action Flows · Dynamic Variables` and `Ready`, anchoring the bottom of the right card so it balances the left card visually.

## Batch 4 — Desktop & Mobile Studio Layout Overhaul (`StudioLayout.tsx`, `Header.tsx`, `PropertyPanel.tsx`, `MessagePreview.tsx`)

### 4.1 Eliminate Double Headers & Fix Left Editor Background Color (`StudioLayout.tsx`)

In `client/src/components/layout/StudioLayout.tsx`:

1. **Left Pane (`Editor`)**:

   * Change the outer wrapper `<section>` from `bg-[#2b2d31]` (old Discord gray) to `bg-[#0B0D12]` and **remove** the redundant `<div className="shrink-0 border-b border-[#272D3A] px-3 py-2"><h2>Message Editor</h2></div>` header strip!

   * Remove the `rounded-[10px] border` wrapper on mobile (`rounded-none border-0 min-[1200px]:rounded-[10px] min-[1200px]:border min-[1200px]:border-[#272D3A]`) so mobile uses 100% of the screen width cleanly with zero nested box-in-box borders.

   * Change the two `"Choose Message Mode"` cards inside `CultMorphSurface` from `bg-[#2b2d31]` to `bg-[#1D2230] border-[#272D3A]`.

2. **Right Pane (`Live Preview`)**:

   * **Remove** the redundant outer `<div className="shrink-0 border-b border-[#272D3A] px-3 py-2"><h2>Live Preview</h2></div>` header strip! `MessagePreview.tsx` already renders its own `"LIVE PREVIEW | Message X: Components V2 | #1 #2"` bar.

   * Use edge-to-edge layout on mobile (`rounded-none border-0 min-[1200px]:rounded-[10px] min-[1200px]:border min-[1200px]:border-[#272D3A]`) and keep the authentic `#313338` Discord background inside `MessagePreview`.

### 4.2 Redesign the Mobile Bottom Navigation Dock (`StudioLayout.tsx`)

Replace the chunky mobile `<nav>` in `client/src/components/layout/StudioLayout.tsx` with a sleek, native-feeling segmented dock:

* Container: `min-[1200px]:hidden flex items-center gap-2.5 border-t border-[#202531] bg-[#0D1017]/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md shrink-0 z-30`.

* **Segmented `Editor` / `Preview` Switcher**: Wrap both buttons in `<div className="flex flex-1 items-center gap-1 rounded-xl border border-[#232836] bg-[#141821] p-1">`.

  * Active tab: `bg-[#242A3A] text-[#F1F3F9] border border-[#818CF8]/40 shadow-xs` (high contrast, crisp dark studio feel—no washed-out white text on light lavender!).

  * Inactive tab: `text-[#8B93A7] hover:text-[#F1F3F9] border border-transparent`.

* **Primary `Dispatch` Action**: Remove the `<MagneticButton>` wrapper and render a clean `min-h-[42px] px-4 rounded-xl bg-[#248046] hover:bg-[#1a6334] active:scale-[0.98] text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-sm`.

### 4.3 Clean Up Mobile & Desktop Header (`Header.tsx` & `SearchableDiscordSelect.tsx`)

1. In `client/src/components/layout/Header.tsx`:

   * **Hide the duplicate green Send icon button on mobile/tablet**: add `hidden min-[1200px]:inline-flex` to the top-bar Send button so mobile users only have one clear green `Dispatch` button (in the bottom dock), freeing up valuable header width on 360px–390px screens!

   * Give the Server selector slightly more breathing room on mobile (`min-w-[120px] flex-1 max-w-[175px] sm:flex-none sm:w-44 lg:w-52`) so server names aren't crushed to `[ HoHo ... ]`.

2. In `client/src/components/ui/SearchableDiscordSelect.tsx`:

   * When `type === "guild"` and `value` is a raw 17–20 digit snowflake ID whose guild name hasn't loaded into `options` yet, show `"Loading server…"` (while loading) or `"Select Server…"` (if not found in loaded guilds) instead of displaying raw numbers like `906426036772818954` in the top bar!

### 4.4 Simplify the Crowded Mobile Inspector Bottom Sheet (`PropertyPanel.tsx`)

In `client/src/components/editor/PropertyPanel.tsx`:

* In all three inspector views (`selection.kind === "message"`, `"embed"`, and `"component"`), **remove the redundant `Properties` micro-label** (`<span className="...">Properties</span>`) stacked above `Message Quick Edit` / `Embed Inspector` / `Component Inspector`.

* Keep the clean 2-line header (`COMPONENT INSPECTOR` in `10px` muted uppercase + `Text Display` in `15px` crisp white bold) and add `pb-[max(1rem,env(safe-area-inset-bottom))]` on the scrollable body so mobile gesture bars never cover the bottom input.

## Batch 5 — Button Contrast, Form Inputs & Web Interface Guidelines Polish (`uiThemeConfig.ts`, `globals.css`, `ContentTab.tsx`, `ComponentsTab.tsx`, `FileAttachmentsSection.tsx`, `CultSkiperPrimitives.tsx`, `BotDispatchModal.tsx`, `Sidebar.tsx`)

### 5.1 Fix Washed-Out White Text on `#818CF8` Lavender Buttons

* In `client/src/config/uiThemeConfig.ts`, `client/src/components/editor/MessageEditor/index.tsx` (`+ Add`), `client/src/components/editor/FileAttachmentsSection.tsx` (`Upload`), and `client/src/components/ui/CultSkiperPrimitives.tsx` (`CultMorphSurface` trigger):

  * Change primary indigo action buttons from `bg-[#818CF8] text-white` (3.2:1 contrast — fails WCAG AA) to `bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3C45A5] text-white` (4.6:1+ contrast, crisp and cohesive with Discord).

### 5.2 Safe Web Interface Guidelines CSS (`client/src/styles/globals.css` & `client/index.html`)

1. In `client/index.html`: add `class="dark"` and `style="color-scheme: dark;"` on `<html>`.

2. In `client/src/styles/globals.css`:

   * Add `html { color-scheme: dark; -webkit-text-size-adjust: 100%; }`.

   * Add `touch-action: manipulation; -webkit-tap-highlight-color: transparent;` on interactive elements (`button, a, input, select, textarea, label`).

   * Add explicit dark styling on native `<select>` and `<option>` (`background-color: #161A23; color: #F1F3F9;`) so Windows dropdowns never flash white.

   * Add `overscroll-behavior: contain;` on `.custom-scrollbar` and `[role="dialog"]` so scrolling inside modals/drawers never scrolls the page behind them.

   * Add mobile auto-zoom protection:

     ```
     @media (max-width: 639px) {
       input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]),
       textarea,
       select {
         font-size: 16px;
       }
     }
     
     ```

   * Add `.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { scrollbar-width: none; }` for the mobile Login preview tab strip.

### 5.3 Fix Remaining Inverted Input & Surface Tokens

* `client/src/components/editor/MessageEditor/ContentTab.tsx`: change `Forum Thread Name` input from `bg-[#272D3A]` to `bg-[#1D2230] border-[#272D3A] focus:border-[#818CF8]`, and hover `hover:bg-[#282a2e]` to `hover:bg-[#252B3A]`.

* `client/src/components/editor/MessageEditor/ComponentsTab.tsx`: change `Thumbnail Image URL` input from `bg-[#272D3A] border-[#161A23]` to `bg-[#1D2230] border-[#272D3A] focus:border-[#818CF8]`.

* `client/src/components/send/BotDispatchModal.tsx`: change `#dispatch-target-message-id` from `bg-[#161A23] border-[#10131A]` to `bg-[#1D2230] border-[#272D3A] focus:border-[#818CF8]`.

* `client/src/components/layout/Sidebar.tsx`: change header and tab-bar backgrounds from `bg-[#272D3A]` to `bg-[#10131A]`.

* `client/src/components/layout/StudioLayout.tsx`: add a clean `beforeunload` listener that prompts before leaving when any message has content, embeds, components, or attachments.

## Batch 6 — Update Affected Tests & `docs/GEMINI_HANDOFF_CURRENT.md`

1. Update `client/src/components/layout/__tests__/LoginScreen.test.tsx`:

   * Remove the `ThreeHeroCanvas` mock (if `ThreeHeroCanvas` is no longer imported by `LoginScreen.tsx`).

   * Keep assertions verifying `.hoho-studio-backdrop`, `.hoho-studio-grid-overlay`, 12-column grid (`lg:col-span-5` and `lg:col-span-7`), public header active state, and `"Login with Discord"` CTA.

2. Check if any test imports `ThreeHeroCanvas` directly; keep `ThreeHeroCanvas.tsx` and its unit test intact (or delete both cleanly together only if nothing else imports it).

3. Update `docs/GEMINI_HANDOFF_CURRENT.md` with the exact V14 commits and note that local `npm run typecheck`, `npm test`, and `npm run build` will be run by the owner after pulling.