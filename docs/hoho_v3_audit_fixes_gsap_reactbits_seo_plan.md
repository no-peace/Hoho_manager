# HoHo Manager V3 — Full Audit Bugfix, GSAP + React Bits UI/UX & SEO Master Plan (For ChatGPT Execution)

> **HOW TO USE THIS PLAN WITH CHATGPT (FREE ACCOUNT / CONTEXT-WINDOW SAFE)**
> 1. Save this file into your ChatGPT Project folder (or attach it when starting a chat).
> 2. This plan is based on your latest repository snapshot (**commit `d46cbfd`**).
> 3. Because ChatGPT Free has a strict message/output limit, this plan is divided into **6 self-contained Prompt Batches (`BATCH 1` through `BATCH 6`)**.
> 4. In each chat, copy and paste the **"Session Starter Prompt"** at the top of that Batch along with that Batch's steps.
> 5. **Strict Rule for ChatGPT:** Output ONLY exact `File` / `Search` / `Replace` blocks (or full file contents for brand-new files) and `Verification` commands—never `// ... existing code ...`, never `TODO` placeholders, and never unrequested rewrites.

---

## Audit Summary of Commit `d46cbfd` (Bugs Found in Current Repo)

| ID | Severity | File(s) | Exact Bug Found in `d46cbfd` | Fix Batch |
| :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | **P0 Critical** | `client/src/components/send/BotDispatchModal.tsx` | Line 49 uses double-escaped `/\\{user\\.\\d{17,20}\\./i` inside a regex literal AND only runs inside `useState(() => ...)` on initial mount when `open={false}`, so `trackAfterSend` never auto-enables when opening the modal after typing `{user.<ID>.*}`. | **Batch 1** |
| **BUG-02** | **P0 UI Bug** | `client/src/components/layout/Header.tsx` & `client/src/App.tsx` | Both `Header.tsx` (lines 285–326) and `App.tsx` (lines 805–870) render the `Backups / JSON / Share / Clear / Bot Send / Edit` command bar—causing a **duplicate stacked toolbar** on screen. | **Batch 1** |
| **BUG-03** | **P1 UI Bug** | `client/src/components/ui/DateTimePickerPopover.tsx` | 1) Popover uses `absolute top-full` inside `overflow-y-auto` modals, clipping the bottom of the calendar inside `BotDispatchModal` and `BackupsModal`.<br>2) Hour/minute buttons only increment (`+1`) with no `-1` or quick time presets, and clicking `Clear` does not close the popover. | **Batch 1** |
| **BUG-04** | **P1 UI Bug** | `client/src/components/editor/EmbedEditor.tsx` & `ComponentForms.tsx` | `EmbedEditor.tsx` (line 612) still uses native `<input type="datetime-local">` and native `<input type="checkbox">` with client `new Date()` instead of `DateTimePickerPopover` and `getServerNow()`. `ComponentForms.tsx` (line 253) still uses a native checkbox. | **Batch 1** |
| **BUG-05** | **P0 Backend** | `server/src/config/database.ts`, `session.ts`, `auth.ts` | 1) Partial `TURSO_*` env vars silently fall back to local ephemeral SQLite in prod.<br>2) Turso `transaction()` is a no-op (`return await fn()`) instead of batching statements.<br>3) `session.ts` falls back to `"default-session-secret"` in prod.<br>4) `auth.ts` skips `oauth_state` check in dev and never clears the `oauth_state` cookie. | **Batch 2** |
| **BUG-06** | **P1 Cleanup** | `server/src/routes/send.ts`, `profiles.ts`, `profileService.ts`, `profileRepository.ts` | `send.ts` still contains a dead `if (mode === "webhook")` block (lines 284–325) after line 78 blocks non-bot modes. Dead profile files still reference dropped tables `webhook_profiles` & `bot_profiles`. | **Batch 2** |
| **BUG-07** | **P1 Arch** | `client/src/main.tsx`, `client/src/App.tsx` | Missing React `ErrorBoundary` (a bad JSON import crashes the whole screen) and missing `React.lazy` code-splitting (>500 KB Vite bundle warning). | **Batch 3** |
| **BUG-08** | **P1 SEO** | `client/index.html`, `client/src/App.tsx` | `<meta name="robots" content="noindex, nofollow">` blocks indexing; missing `<link rel="canonical">`, OpenGraph/Twitter tags, and JSON-LD Schema.org (`SoftwareApplication` / `WebApplication` / `TechArticle`) markup. | **Batch 4** |
| **UX-09** | **P1 Motion** | `client/src/components/reactbits/*`, `App.tsx`, `Header.tsx`, `DocsPage.tsx` | Upgrade typography, text effects, and interactive cards using **GSAP (`gsap.timeline`)** + **React Bits** components (`SplitTextReveal`, `ShinyText`, `SpotlightCard`, `CountUpNumber`, `MagneticButton`). | **Batch 5 & 6** |

---

## Global Rules for ChatGPT Across All Batches

1. **Output Format:** Every edit must provide:
   - **File:** `path/to/file`
   - **Search:** Verbatim lines from commit `d46cbfd`
   - **Replace:** Complete replacement code (no `// ...` omissions)
   - **Verification:** `npm run typecheck && npm test`
2. **GSAP Timeline Discipline (`@gsap-timeline`):**
   - Always create timelines with defaults: `const tl = gsap.timeline({ defaults: { duration: 0.45, ease: "power3.out" } });`.
   - Use position parameters (`"<"`, `"<0.06"`, `"+=0.1"`) and labels (`tl.addLabel("reveal", 0)`) instead of chained `delay` values.
   - Always clean up GSAP animations inside `useEffect` / `useLayoutEffect` via `const ctx = gsap.context(() => { ... }, scopeRef); return () => ctx.revert();`.
3. **Motion Craft Bar (`@review-animations` & `@impeccable-design-polish`):**
   - UI micro-interactions must stay **under 300ms** (`140ms–220ms`), animating only GPU properties (`transform` and `opacity`—never `transition: all`, `width`, `height`, `top`, `left`).
   - Popovers/dropdowns must scale from their trigger (`transformOrigin`), starting at `scale(0.96)` (never `scale(0)`), and never use `ease-in` on entrances.
   - Respect `@media (prefers-reduced-motion: reduce)` (skip movement, keep subtle opacity fade) and gate hover effects behind `@media (hover: hover) and (pointer: fine)`.
   - Zero animation on high-frequency keyboard typing or arrow-key navigation.

---

## BATCH 1 — Fix UI & Logic Regressions in Commit `d46cbfd` (Duplicate Toolbar, `BotDispatchModal` Regex/Sync, Calendar Clipping & Native Inputs)

### Copy-Paste Session Starter Prompt for ChatGPT (Batch 1)
> "You are implementing **BATCH 1** of the HoHo Manager V3 Master Plan on commit `d46cbfd`. Fix BUG-01 (`BotDispatchModal.tsx`), BUG-02 (duplicate toolbar in `Header.tsx`), BUG-03 (`DateTimePickerPopover.tsx` viewport positioning and `-`/`+` time controls), and BUG-04 (`EmbedEditor.tsx` & `ComponentForms.tsx` native inputs). Output exact `File` / `Search` / `Replace` blocks with zero placeholders."

### Step 1.1 — Fix Regex & Re-Sync `trackAfterSend` When Opening `BotDispatchModal.tsx`
- **File:** `client/src/components/send/BotDispatchModal.tsx`
- **Search:**
```tsx
  const [trackAfterSend, setTrackAfterSend] = useState(() => {
    const payload = JSON.stringify(useMessageStore.getState().getAllPayloads());
    return /\\{user\\.\\d{17,20}\\./i.test(payload) || payload.includes("{exploit.") || payload.includes("discord.com/users/");
  });
```
- **Replace Specification:**
  1. Fix the regex to single-escaped `/\{user\.\d{17,20}\./i.test(payload)`.
  2. Inside the `useEffect(() => { if (!open) return; ... }, [open, ...])` hook when the modal opens, recompute `const payloadStr = JSON.stringify(useMessageStore.getState().getAllPayloads());` and call `setTrackAfterSend(/\{user\.\d{17,20}\./i.test(payloadStr) || payloadStr.includes("{exploit.") || payloadStr.includes("discord.com/users/"));` so opening the modal after typing `{user.1347945399238918195.name}` automatically checks **"Track this message"**!

### Step 1.2 — Remove Duplicate Command Bar from `Header.tsx` (Keep Single Clean Studio Command Bar in `App.tsx`)
- **File:** `client/src/components/layout/Header.tsx`
- **Search:**
```tsx
      {(onOpenBackups || onOpenJson || onShare || onClearAll || onOpenSend) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#26282d] bg-[#18191c] px-3 py-2">
```
- **Replace Specification:**
  Remove the duplicate second `<div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#26282d] bg-[#18191c] px-3 py-2">...</div>` block from `Header.tsx` so the studio toolbar only renders once inside the Editor pane in `App.tsx`.

### Step 1.3 — Fix Calendar Clipping Inside Modals & Upgrade Time Controls in `DateTimePickerPopover.tsx`
- **File:** `client/src/components/ui/DateTimePickerPopover.tsx`
- **Search:**
```tsx
  return (
    <div className={`relative inline-block ${className}`}>
      <button type="button" onClick={() => setOpen((current) => !current)}
```
- **Replace Specification:**
  1. Add a `triggerRef = useRef<HTMLButtonElement>(null)` and measure `triggerRef.current.getBoundingClientRect()` when `open` becomes `true`.
  2. Render the backdrop and `<motion.div>` popover via `createPortal(..., document.body)` using `position: fixed` with smart viewport clamping:
     - If `window.innerHeight - rect.bottom < 360 && rect.top > 360`, position above the trigger (`top: Math.max(12, rect.top - 8)`, `transform: translateY(-100%)`, `transformOrigin: "bottom left"`).
     - Otherwise position below the trigger (`top: rect.bottom + 8`, `left: Math.min(rect.left, window.innerWidth - 304)`, `transformOrigin: "top left"`).
     - Set `z-[10050]` so it floats cleanly above `Modal` (`z-[9990]`) without ever clipping inside `overflow-y-auto` containers!
  3. Upgrade the `TIME` bar:
     - Provide `-` and `+` stepper buttons for both Hour (`01–12`) and Minute (`00–59`, stepping by 1 min on click or 5 min on Shift+click) plus quick preset pills (`+1h`, `+24h`, `14d`) alongside `AM/PM`.
     - When `Clear` is clicked, call `onChange(null); setOpen(false);`.

### Step 1.4 — Replace Remaining Native `<input type="datetime-local">` & `<input type="checkbox">` in `EmbedEditor.tsx` & `ComponentForms.tsx`
- **File:** `client/src/components/editor/EmbedEditor.tsx`
- **Search:**
```tsx
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-[#b5bac1] flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(embed.timestamp)}
                        onChange={(e) =>
                          updateEmbed(id, {
                            timestamp: e.target.checked ? new Date().toISOString() : null,
                          })
                        }
                        className="rounded bg-[#1e1f22] border-[#383a40] text-[#5865f2] focus:ring-0"
                      />
                      Include Timestamp
                    </label>
                  </div>
                  {embed.timestamp && (
                    <div className="flex items-center gap-2">
                      <input
                        type="datetime-local"
```
- **Replace Specification:**
  Replace the native `<input type="checkbox">` and `<input type="datetime-local">` in `EmbedEditor.tsx` with the custom `<Checkbox>` from `../ui/Field` and `<DateTimePickerPopover allowPastDates={true} value={embed.timestamp} onChange={(iso) => updateEmbed(id, { timestamp: iso })} />` using `getServerNow().toISOString()` for the `"Now"` button!
- **File:** `client/src/components/editor/ComponentForms.tsx`
- **Search:**
```tsx
                <label className="flex items-center gap-1.5 text-[11px] text-[#dbdee1] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(option.default)}
                    onChange={(e) => replaceOption(index, { default: e.target.checked })}
                    className="rounded bg-[#2b2d31] border-[#383a40] text-[#5865f2] focus:ring-0"
                  />
                  Default
                </label>
```
- **Replace Specification:**
  Replace with `<Checkbox label="Default" checked={Boolean(option.default)} onChange={(checked) => replaceOption(index, { default: checked })} className="text-[11px]" />`.

### Batch 1 Verification
```bash
npm run typecheck
npm test
```

---

## BATCH 2 — Backend Security, Real Turso Batch Transactions & Dead Code Cleanup (`What's Worse` Fixes)

### Copy-Paste Session Starter Prompt for ChatGPT (Batch 2)
> "You are implementing **BATCH 2** of the HoHo Manager V3 Master Plan on commit `d46cbfd`. Fix the backend issues in `database.ts` (fail fast on partial Turso config + real Turso pipeline transaction batching), `session.ts` & `auth.ts` (production secret enforcement, OAuth state cookie verification & cleanup), and `send.ts` (remove dead webhook branch). Output exact `File` / `Search` / `Replace` blocks."

### Step 2.1 — Fail Fast on Partial Turso Config & Support Atomic Turso Pipeline Transactions in `server/src/config/database.ts`
- **File:** `server/src/config/database.ts`
- **Search:**
```ts
const tursoUrlRaw = (process.env.TURSO_DATABASE_URL ?? "").trim();
const tursoAuthToken = (process.env.TURSO_AUTH_TOKEN ?? "").trim();
const useTurso =
  env.nodeEnv !== "test" &&
  Boolean(tursoUrlRaw) &&
  Boolean(tursoAuthToken) &&
  /^(libsql|https?):\/\//i.test(tursoUrlRaw);
```
- **Replace Specification:**
  1. If `env.nodeEnv !== "test"` and `(Boolean(tursoUrlRaw) !== Boolean(tursoAuthToken))` or `(Boolean(tursoUrlRaw) && !/^(libsql|https?):\/\//i.test(tursoUrlRaw))`, throw a descriptive startup `Error("Invalid Turso configuration: both TURSO_DATABASE_URL (libsql:// or https://) and TURSO_AUTH_TOKEN must be provided together.")` so production never silently falls back to ephemeral local SQLite.
  2. In `db.transaction<T>(fn)`, when `useTurso` is active, use an `AsyncLocalStorage<Array<{ sql: string; params?: QueryParams }>>()` (from `"node:async_hooks"`) or a `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK` multi-request pipeline batch sent in a single HTTP `/v2/pipeline` POST call when `run()` is called inside `transaction()`, ensuring atomic execution on Turso!

### Step 2.2 — Enforce Session Secret in Production & Clear `oauth_state` Cookie in `server/src/utils/session.ts` & `server/src/routes/auth.ts`
- **File:** `server/src/utils/session.ts`
- **Search:**
```ts
const getSecret = (): string => env.sessionSecret || env.adminApiKey || "default-session-secret";
```
- **Replace Specification:**
  ```ts
  const getSecret = (): string => {
    const secret = env.sessionSecret || env.adminApiKey;
    if (!secret && env.isProd) {
      throw new Error("CRITICAL: SESSION_SECRET or ADMIN_API_KEY must be configured in production");
    }
    return secret || "dev-only-session-secret";
  };
  ```
- **File:** `server/src/routes/auth.ts`
- **Search:**
```ts
    const cookies = parseCookies(req.headers.cookie);
    if (env.isProd && (!state || !cookies.oauth_state || cookies.oauth_state !== state)) {
      log.warn("OAuth state parameter mismatch or missing");
      return res.redirect(`${clientBase}/?error=invalid_oauth_state`);
    }
```
- **Replace Specification:**
  1. Verify `state` whenever `cookies.oauth_state` is present (and always require it in `env.isProd`), using `crypto.timingSafeEqual` on buffers of equal length.
  2. Immediately clear the cookie with `res.clearCookie("oauth_state", { path: "/" });` so it cannot be replayed.

### Step 2.3 — Remove Dead `if (mode === "webhook")` Branch from `server/src/routes/send.ts`
- **File:** `server/src/routes/send.ts`
- **Search:**
```ts
    if (mode === "webhook") {
      if (typeof webhookUrl !== "string") {
        throw ApiError.badRequest('`webhookUrl` is required when mode is "webhook"');
      }
```
- **Replace Specification:**
  Delete the unreachable `if (mode === "webhook") { ... }` block (lines 284–325) since line 78 (`if (mode !== "bot")`) already enforces bot-only mode.

### Batch 2 Verification
```bash
npm run typecheck
npm test
```

---

## BATCH 3 — React ErrorBoundary, Lazy Code-Splitting (`React.lazy` + `Suspense`) & Bundle Optimization

### Copy-Paste Session Starter Prompt for ChatGPT (Batch 3)
> "You are implementing **BATCH 3** of the HoHo Manager V3 Master Plan on commit `d46cbfd`. Create `client/src/components/ui/ErrorBoundary.tsx`, wrap `<App />` in `client/src/main.tsx`, and lazy-load `DocsPage`, `BotDispatchModal`, `SettingsModal`, and `AccessPanel` using `React.lazy` and `<Suspense>` to eliminate the >500 KB chunk warning. Output exact file/patch blocks."

### Step 3.1 — Create `client/src/components/ui/ErrorBoundary.tsx` (New File)
- **File:** `client/src/components/ui/ErrorBoundary.tsx`
- **Specification:**
  - Class component catching render/lifecycle errors (`getDerivedStateFromError`, `componentDidCatch`).
  - Renders a clean dark recovery card (`bg-[#18191c] border border-[#26282d] rounded-xl p-6 max-w-md mx-auto my-16 text-center`) with the error message, a **"Reload Studio"** button (`window.location.reload()`), and a **"Reset Local Workspace Draft"** button (clears corrupted draft keys in `localStorage` and reloads).

### Step 3.2 — Wrap `<App />` in `client/src/main.tsx`
- **File:** `client/src/main.tsx`
- **Search:**
```tsx
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```
- **Replace Specification:**
  Wrap `<App />` inside `<ErrorBoundary><App /></ErrorBoundary>`.

### Step 3.3 — Code-Split Heavy Modals & `DocsPage` in `client/src/App.tsx` & `client/vite.config.ts`
- **File:** `client/src/App.tsx`
- **Search:**
```tsx
import { DocsPage } from "./pages/DocsPage";
import { JsonModal } from "./components/editor/JsonModal";
import { BotDispatchModal } from "./components/send/BotDispatchModal";
```
- **Replace Specification:**
  Use `React.lazy` for `DocsPage`, `JsonModal`, and `BotDispatchModal` and wrap their render sites in `<React.Suspense fallback={null}>` (or a subtle skeleton for `DocsPage`) so initial studio load is fast and chunks split cleanly below 500 KB.

### Batch 3 Verification
```bash
npm run typecheck
npm test
npm run build
```

---

## BATCH 4 — Complete SEO Checklist (Canonical Tags, JSON-LD Schema Markup, OpenGraph, `robots.txt` & `sitemap.xml`)

### Copy-Paste Session Starter Prompt for ChatGPT (Batch 4)
> "You are implementing **BATCH 4 (SEO Checklist)** of the HoHo Manager V3 Master Plan on commit `d46cbfd`. Upgrade `client/index.html` with canonical tags, OpenGraph/Twitter metadata, and Schema.org JSON-LD (`SoftwareApplication` & `WebSite`), create `client/src/utils/seo.ts` for dynamic route canonical/schema updates on `/` and `/docs`, and add `client/public/robots.txt` and `client/public/sitemap.xml`. Output exact file/patch blocks."

### Step 4.1 — Upgrade `client/index.html` with Canonical Link, OpenGraph, and JSON-LD Schema Markup
- **File:** `client/index.html`
- **Search:**
```html
    <meta
      name="description"
      content="HoHo Manager Discord Bot Message, Embed, and Components V2 Studio."
    />
    <meta name="robots" content="noindex, nofollow" />
    <title>HoHo Manager</title>
    <link rel="icon" type="image/png" href="/hoho_logo.png" />
    <link rel="apple-touch-icon" href="/hoho_logo.png" />
  </head>
```
- **Replace Specification:**
  1. Replace `<meta name="robots" content="noindex, nofollow" />` with `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />`.
  2. Add `<link rel="canonical" id="canonical-link" href="https://hoho-manager.onrender.com/" />`.
  3. Add OpenGraph (`og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image`) and Twitter Card (`twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`) meta tags.
  4. Add `<script type="application/ld+json" id="schema-jsonld">` with valid Schema.org `@graph` containing:
     - `WebSite` (`name: "HoHo Manager"`, `url: "https://hoho-manager.onrender.com/"`)
     - `SoftwareApplication` / `WebApplication` (`name: "HoHo Manager"`, `applicationCategory: "DeveloperApplication"`, `operatingSystem: "Web"`, `description: "Visual Discord Bot Message, Embed, Components V2, and Dynamic Placeholder Studio for HoHo Hub."`, `offers: { "@type": "Offer", "price": "0", "priceCurrency": "USD" }`).

### Step 4.2 — Create Dynamic Route SEO Manager (`client/src/utils/seo.ts`) & Wire into `App.tsx` / `DocsPage.tsx`
- **File:** `client/src/utils/seo.ts` (New File)
- **Specification:**
  - Export `updatePageSeo({ title, description, path, schemaType }: { title: string; description: string; path: string; schemaType?: "SoftwareApplication" | "TechArticle" })`.
  - Updates `document.title`, `<meta name="description">`, `<link rel="canonical" href={\`${window.location.origin}${path}\`}>`, `meta[property="og:url"]`, and updates `#schema-jsonld` so `/docs` emits a `TechArticle` + `SoftwareApplication` JSON-LD graph while `/` emits the Studio `SoftwareApplication` graph.
  - Call `updatePageSeo` inside `App.tsx` (on `currentPath` change) and `DocsPage.tsx`.

### Step 4.3 — Create `client/public/robots.txt` & `client/public/sitemap.xml`
- **Files:** `client/public/robots.txt` and `client/public/sitemap.xml` (New Files)
- **Specification:**
  - `robots.txt`: Allow `/`, `/docs`; Disallow `/api/`; `Sitemap: https://hoho-manager.onrender.com/sitemap.xml`.
  - `sitemap.xml`: Include `https://hoho-manager.onrender.com/` (`priority: 1.0`) and `https://hoho-manager.onrender.com/docs` (`priority: 0.8`).

### Batch 4 Verification
```bash
npm run typecheck
npm test
npm run build
```

---

## BATCH 5 — Install GSAP & Create "React Bits" Interactive Text/UI Primitives (`client/src/components/reactbits/`)

### Copy-Paste Session Starter Prompt for ChatGPT (Batch 5)
> "You are implementing **BATCH 5** of the HoHo Manager V3 Master Plan on commit `d46cbfd`. Install `gsap` in `client`, and create `client/src/components/reactbits/ReactBitsPrimitives.tsx` containing GSAP-powered React Bits components (`SplitTextReveal`, `ShinyText`, `SpotlightCard`, `CountUpNumber`, `MagneticButton`) following strict `@gsap-timeline` and `@review-animations` rules. Output exact commands and full file code."

### Step 5.1 — Install `gsap` in `client` Workspace
Run:
```bash
npm install gsap --workspace client
```

### Step 5.2 — Create `client/src/components/reactbits/ReactBitsPrimitives.tsx` (New File)
- **File:** `client/src/components/reactbits/ReactBitsPrimitives.tsx`
- **Components to Implement (Self-Contained, TypeScript Strict, Reduced-Motion Safe):**
  1. **`<SplitTextReveal text={...} className={...} stagger={0.025} />`** *(React Bits SplitText + GSAP Timeline)*:
     - Splits `text` into words/characters wrapped in `<span className="inline-block overflow-hidden"><span data-char className="inline-block will-change-transform">...</span></span>`.
     - Uses `gsap.context()` and `gsap.timeline({ defaults: { duration: 0.42, ease: "power3.out" } })` to animate `[data-char]` from `{ yPercent: 100, opacity: 0 }` to `{ yPercent: 0, opacity: 1, stagger: 0.02 }` at position `0`.
     - Skips transform animation if `window.matchMedia("(prefers-reduced-motion: reduce)").matches` or `navigator.webdriver` / Vitest happy-dom is active, rendering the text immediately so unit tests never fail!
  2. **`<ShinyText text={...} className={...} />`** *(React Bits ShinyText)*:
     - Renders crisp metallic shimmer text using a background-clip gradient sweep for badges (`IS_COMPONENTS_V2`, `SERVER BOT STUDIO`, `LIVE VARIABLES`).
  3. **`<SpotlightCard className={...} spotlightColor="rgba(88, 101, 242, 0.12)">`** *(React Bits SpotlightCard)*:
     - Tracks mouse coordinates via CSS custom properties (`--spot-x`, `--spot-y`) on the card element (zero React state re-renders on mousemove!) and renders a pointer-events-none radial spotlight layer gated behind `@media (hover: hover) and (pointer: fine)`.
  4. **`<CountUpNumber value={number} suffix={...} className={...} />`** *(React Bits CountUp + GSAP)*:
     - Smoothly tweens numeric changes over `0.28s` (`ease: "power2.out"`) using `tabular-nums` for character counters, message badges, and template counts.
  5. **`<MagneticButton>`** *(GSAP QuickTo micro-interaction)*:
     - Uses `gsap.quickTo(el, "x", { duration: 0.2, ease: "power3.out" })` and `gsap.quickTo(el, "y", { duration: 0.2, ease: "power3.out" })` for a subtle `±3px` magnetic pull on primary CTA buttons (desktop fine pointer only; snaps back in `0.18s` on `mouseleave`).

### Batch 5 Verification
```bash
npm run typecheck
npm test
```

---

## BATCH 6 — Wire GSAP Timelines & React Bits Across Login Showcase, Studio Command Bar, `MessageEditor`, and `DocsPage`

### Copy-Paste Session Starter Prompt for ChatGPT (Batch 6)
> "You are implementing **BATCH 6** of the HoHo Manager V3 Master Plan on commit `d46cbfd`. Integrate the GSAP + React Bits primitives (`SplitTextReveal`, `ShinyText`, `SpotlightCard`, `CountUpNumber`, `MagneticButton`) and choreographed GSAP timelines into `client/src/App.tsx`, `client/src/pages/DocsPage.tsx`, and `client/src/components/editor/MessageEditor.tsx`. Output exact `File` / `Search` / `Replace` blocks."

### Step 6.1 — Upgrade Login Showcase & Studio Command Bar in `client/src/App.tsx`
- **File:** `client/src/App.tsx`
- **Specification:**
  1. **Login / Landing Showcase (`!currentUser` view):**
     - Render the main hero title with `<SplitTextReveal text="HoHo Manager Studio" />` and the badge with `<ShinyText text="COMPONENTS V2 & DYNAMIC TRACKING" />`.
     - Wrap the left authentication bento card and right interactive preview showcase in `<SpotlightCard>`.
     - Use a `gsap.timeline({ defaults: { duration: 0.35, ease: "power3.out" } })` when switching showcase tabs (`Components V2`, `Live Status & Variables`, `Button & Modal Flows`) so the preview card badge, title, and action buttons sequence smoothly (`"<0.05"`).
  2. **Studio Command Bar (Editor Top Bar):**
     - Wrap the primary **Bot Send** button in `<MagneticButton>` and use `<CountUpNumber value={displayMessages.length} suffix="/10" />` on the Add Message / mobile Editor badge.

### Step 6.2 — Upgrade `DocsPage.tsx` Hero, Category Filter Pills & Variable Cards with React Bits
- **File:** `client/src/pages/DocsPage.tsx`
- **Specification:**
  1. Use `<SplitTextReveal text="Variables, Dynamic Tracking & Executors" />` in the `/docs` hero header and `<ShinyText text="FULL SYSTEM GUIDE & REFERENCE" />` on the kicker badge.
  2. Wrap the 3 feature highlight cards (`Author Profile Auto-Fetch`, `WEAO Exploit Variables`, `Interactive Flows`) and variable catalog cards in `<SpotlightCard>`.
  3. Add an animated `motion.span` `layoutId="docsCategoryPill"` active background on the category filter tabs (`all`, `user`, `author`, `exploit`, `time`, `server`, `form`) with a crisp spring (`{ type: "spring", stiffness: 520, damping: 38 }`).

### Step 6.3 — Polish `MessageEditor.tsx` Card Header & Character Counters
- **File:** `client/src/components/editor/MessageEditor.tsx`
- **Specification:**
  - Use `<ShinyText text="Components V2" />` inside the V2 format badge when `isV2` is active.
  - Ensure the `+ Add ▾` and `Options ▾` menus use `<AnimatePresence>` + `<motion.div>` (`duration: 0.14`, `scale: 0.96 -> 1`, `transformOrigin: "bottom left"`) instead of abrupt mount/unmount.

### Final Verification Commands (Run After Batch 6)
```bash
npm run typecheck
npm test
npm run build
```
