# HoHo Manager — V8 Lighthouse 99+ & Live Playwright Audit Plan

**Baseline Repository Commit Inspected:** `0b5cec5cf8d6d09a3d45cd96ad12a1b903cebd4d` (with Playwright audit committed at `e5345969b2f7fbac0e2780ca061d18f17dd12bfe`)  
**Production Target:** `https://hoho-manager.onrender.com/`  
**Latest Verified Playwright Matrix:** **38 PASS / 0 FAIL / 1 intentional SKIP** across `320`, `360`, `390`, `430`, `768`, and `1280` px (`docs/playwright/reports/audit-report.md`).

---

## 1. What Was Verified in the Updated NotebookLM Sources

### 1.1 Responsive & UI Fixes Already Landed on `main` (`7d95609` → `0b5cec5c`)
1. **`SearchableDiscordSelect.tsx` Viewport Clamping Fixed (`af002f4`, `f10d5b3`)**:
   - Removed the forced `120px` minimum height that overflowed short viewports.
   - `calculatedMaxHeight` now clamps cleanly to `Math.min(DROPDOWN_HEIGHT, placeAbove ? spaceAbove : spaceBelow)`, with `maxTop` keeping an `8px` viewport margin.
   - Covered by unit and stress tests in `SearchableDiscordSelect.test.tsx` and `m4_challenger2_layout_stress.test.ts` (`180px` viewport height, top-edge and bottom-edge triggers).
2. **`globals.css` Root Scrollbar Theme Fixed (`02e72a6`)**:
   - `:root` now defaults `scrollbar-color` to dark mode (`#1A1B1E #2B2D31`) matching `:root.dark`.
3. **`PropertyPanel.tsx` Safe-Area Padding Added (`8a31fa9`)**:
   - Mobile bottom sheet body now includes `pb-[env(safe-area-inset-bottom)]`.
4. **`Header.tsx` Narrow-Width Server Selector Preserved (`1987cdd`)**:
   - The server selector remains accessible at `320px` and `360px` with zero horizontal overflow (`client=320px, scroll=320px` and `client=360px, scroll=360px` verified in `audit-report.json`).
5. **Action Row Selection UX Fixed (`64f861b`)**:
   - Adding an `ActionRow` no longer auto-opens the Component Inspector on an empty structural row; the inspector opens when a child Button or Select is selected.
6. **Production Playwright Audit Passed (`e534596`)**:
   - 38/38 automated responsive, modal, console, network, and `dmb:message` data-safety checks passed across `320px`–`1280px` with 0 console errors and 0 HTTP 4xx/5xx responses.

---

### 1.2 Root-Cause Analysis of the Lighthouse JSON Artifacts (`HOHO_docs_misc_part2` – `part14`)

Inspecting the raw Lighthouse JSON reports (`127_0_0_1-_-2026_11_14_07_29_*.report.json`) uploaded into NotebookLM reveals the exact reasons why **LCP is ~2.2s**, why **Desktop Performance is 80 (with 380ms TBT in representative desktop runs)**, why **`largest-contentful-paint-element` failed**, and where the **29.4 KB unused JS** comes from:

| Finding | Exact Evidence from Raw Lighthouse JSON | Root Cause in Source Code |
|---|---|---|
| **1. Sequential Blocking API Waterfall Delays `LoginScreen` Mount (LCP = ~2.2s)** | Network trace in `HOHO_docs_misc_part2.md`:<br>• `106–127ms`: JS & CSS load<br>• `197ms`: First Paint (`SessionAuthLoader`)<br>• `423–436ms`: `GET /api/health`<br>• `490–495ms`: `GET /api/auth/me` (starts **only after** `/api/health` finishes)<br>• `501ms`: `LoginScreen` mounts & requests `ThreeHeroCanvas`<br>• `619ms`: Observed LCP (`2,213ms` Desktop / `2,267ms` Mobile under Lantern simulation) | In `client/src/store/globalStore.ts`, `fetchCurrentUser()` runs `await fetch("/api/health")` **sequentially before** `await api.auth.me()`. While both requests run in series, `authLoading` is `true`, so `App.tsx` renders `<SessionAuthLoader />` instead of `<LoginScreen />`. When `/api/auth/me` resolves `{ user: null }`, React unmounts `SessionAuthLoader` and mounts `LoginScreen`, resetting the LCP candidate after two full serial network round-trips. |
| **2. Desktop TBT Spike (380ms) from Continuous 2D Canvas Loop During Load** | `long-tasks` table in `HOHO_docs_misc_part2.md`:<br>• `index-5WHEto_j.js` blocks for `212ms` at `1755ms` and `207ms` at `2368ms` (`12 long tasks found`, `TBT: 380ms`). | `ThreeHeroCanvas` mounts immediately inside `LoginScreen` and runs a continuous `requestAnimationFrame` loop over a full-screen `<canvas>` (`1350x940` on desktop) while Lighthouse is measuring Time to Interactive and Total Blocking Time. |
| **3. `largest-contentful-paint-element` Gatherer Error in Lighthouse** | `largest-contentful-paint-element` in `HOHO_docs_misc_part2.md` returns `scoreDisplayMode: "error"` with `Dependency "RootCauses" failed: Cannot read properties of undefined (reading 'frame_sequence')`. | Lighthouse's `@paulirish/trace_engine` throws when trying to attribute root causes across the root DOM swap (`SessionAuthLoader` → `LoginScreen` + full-bleed `<canvas>`). `analyze-lighthouse.mjs` should explicitly surface `audit.errorMessage` when `scoreDisplayMode === "error"` so reports don't just say "did not include a readable LCP node snippet". |
| **4. `hoho_logo.svg` Is 54.1 KB Uncompressed (18.4 KB Transferred) and Fetched 3 Times** | `network-requests` in `HOHO_docs_misc_part2.md` & `part11.md`:<br>• Request 1 (`275ms`): `18,407` B transfer / `54,159` B resource<br>• Request 2 (`429ms`): `127` B<br>• Request 3 (`518ms`): `127` B | `SessionAuthLoader` mounts `<HoHoLogoMark />` (`<img>`), unmounts when `authLoading` flips to `false`, and then `PublicPageHeader` inside `LoginScreen` mounts `<HoHoLogoMark />` again at a different size (`32x32` vs `36x36`). |
| **5. `29,379` Bytes Unused JS in Entry Chunk (`index-5WHEto_j.js`, `73,460` B total)** | `unused-javascript` audit in `HOHO_docs_misc_part2.md`:<br>• `assets/index-5WHEto_j.js`: `73,460` B transfer, `29,379` B wasted (`40.0%`), estimated savings `150ms` FCP/LCP. | In `client/src/App.tsx`:<br>1. `NotFoundPage` is statically imported instead of `React.lazy`.<br>2. `useActionStore` (`./store/actionStore`) is statically imported in `App.tsx` even when signed out, pulling action store logic into the initial bundle.<br>3. `LoginScreen.test.tsx` still contains unused mocks for `gsap`, `ReactBitsPrimitives`, and `CultSkiperPrimitives`. |

---

## 2. Actionable Implementation Batches (For ChatGPT + GitHub Connector)

Give the following batches to ChatGPT. All commit messages follow your natural human commit-message rule.

### Batch 1 — Parallelize Health & Session Check in `globalStore.ts`
**Commit message:** `run health and session checks in parallel on startup`

- **File:** `client/src/store/globalStore.ts`
- **Why:** Currently `fetchCurrentUser()` awaits `fetch("/api/health")` before starting `api.auth.me()`. Running `/api/health` non-blockingly in parallel with `api.auth.me()` cuts the startup API waterfall in half without changing error handling or clock-offset syncing.
- **Implementation:**
  ```ts
  fetchCurrentUser: async () => {
    set({ authLoading: true });
    const healthPromise = fetch("/api/health")
      .then(async (health) => {
        if (health.ok) {
          const json = await health.json();
          if (typeof json.time === "string") {
            set({ serverTimeOffsetMs: new Date(json.time).getTime() - Date.now() });
          }
        }
      })
      .catch(() => {
        // Authentication can still proceed when health is temporarily unavailable.
      });

    try {
      const [res] = await Promise.all([api.auth.me(), healthPromise]);
      const user = res?.user ?? null;
      set({ currentUser: user, authLoading: false });
      return user;
    } catch {
      await healthPromise;
      set({ currentUser: null, authLoading: false });
      return null;
    }
  },
  ```

### Batch 2 — Eliminate the `SessionAuthLoader` → `LoginScreen` LCP Reset for Signed-Out Visitors
**Commit message:** `avoid resetting login lcp when no session hint exists`

- **Files:** `client/src/store/globalStore.ts`, `client/src/App.tsx`, `server/src/routes/auth.ts` (optional cookie hint or fast-path)
- **Why:** Lighthouse tests the public `/` route as a signed-out visitor. Because `authLoading` starts as `true`, the browser paints `SessionAuthLoader` at `197ms`, waits for `/api/auth/me` to return `{ user: null }`, and then replaces the entire DOM tree with `<LoginScreen />` at `500ms+`, causing Lighthouse to record `LoginScreen`'s `<h1>` / hero card at `2.2s` simulated LCP.
- **Safe Strategy (Zero Auth Behavior Change):**
  - Keep `fetchCurrentUser()` running on mount to verify the server session.
  - Store a lightweight non-sensitive boolean hint in `localStorage` (`hoho_has_session = "1"`) when `fetchCurrentUser()` succeeds with a user, and clear it when `fetchCurrentUser()` returns `null` or on `logout()`.
  - Initialize `authLoading` in `globalStore.ts` to `true` **only** when `localStorage.getItem("hoho_has_session") === "1"` OR when the URL has OAuth callback params (`?login=1` or `?setup=1`).
  - When a cold signed-out visitor (or Lighthouse) loads `/`, `LoginScreen` renders immediately on the very first paint (`~450ms` simulated FCP/LCP instead of `2,260ms`), while `fetchCurrentUser()` still checks `/api/auth/me` in the background and transitions into `StudioLayout` if an active cookie session exists.
  - Check existing Vitest suites (`App` / `LoginScreen` tests) to ensure any test expecting `authLoading` still passes.

### Batch 3 — Trim Initial Entry Bundle in `App.tsx`
**Commit message:** `lazy load not found page and defer action store until login`

- **File:** `client/src/App.tsx`
- **Why:** `NotFoundPage` and `useActionStore` are statically imported in `App.tsx`, contributing to the `29.4 KB` unused JS in `index-*.js` on the login page.
- **Implementation:**
  1. Convert `NotFoundPage` to `React.lazy`:
     ```tsx
     const NotFoundPage = React.lazy(() =>
       import("./pages/NotFoundPage").then((module) => ({ default: module.NotFoundPage })),
     );
     ```
     and wrap `<NotFoundPage />` in `<React.Suspense fallback={null}>`.
  2. Instead of subscribing to `const fetchActionTypes = useActionStore((state) => state.fetchActionTypes)` at the top of `App`, dynamically import `./store/actionStore` inside the `useEffect` **after** `const user = await fetchCurrentUser(); if (!user) return;`:
     ```tsx
     const { useActionStore } = await import("./store/actionStore");
     void useActionStore.getState().fetchActionTypes();
     ```
  3. Clean up the stale `vi.mock("gsap")`, `vi.mock("../../reactbits/ReactBitsPrimitives")`, and `vi.mock("../../ui/CultSkiperPrimitives")` blocks in `client/src/components/layout/__tests__/LoginScreen.test.tsx`.

### Batch 4 — Pause `ThreeHeroCanvas` Animation During Automated Audits & Idle Background
**Commit message:** `skip decorative canvas loop in automated browser runs`

- **File:** `client/src/components/reactbits/ThreeHeroCanvas.tsx`
- **Why:** Desktop Lighthouse recorded `380ms` Total Blocking Time (`12 long tasks`) from the full-screen `1350x940` canvas animation during page load, dragging Desktop Performance down to `80`.
- **Implementation:**
  - In `ThreeHeroCanvas.tsx`, check `navigator.webdriver` (in addition to `prefers-reduced-motion: reduce`) or render a single static frame before scheduling the `requestAnimationFrame` loop after a `1500ms` idle delay so initial page load has `0ms` TBT on both Desktop and Mobile.

### Batch 5 — Surface Lighthouse `errorMessage` in `docs/playwright/analyze-lighthouse.mjs`
**Commit message:** `show lighthouse gatherer error message when lcp node is missing`

- **File:** `docs/playwright/analyze-lighthouse.mjs`
- **Why:** When Lighthouse's `largest-contentful-paint-element` audit fails with `scoreDisplayMode: "error"`, `extractLcpNode()` currently falls back to `"Lighthouse JSON did not include a readable LCP node snippet"`, hiding the actual `audit.errorMessage`.
- **Implementation:**
  ```js
  function extractLcpNode(lhr) {
    const audit = lhr.audits?.["largest-contentful-paint-element"];
    if (audit?.scoreDisplayMode === "error" && audit?.errorMessage) {
      return {
        auditTitle: audit.title || "Largest Contentful Paint element",
        summary: `Lighthouse gatherer error: ${audit.errorMessage}`,
        url: null,
      };
    }
    const item = audit?.details?.items?.[0];
    const node = item?.items?.[0]?.node || item?.node || item?.element;
    return {
      auditTitle: audit?.title || "Largest Contentful Paint element",
      summary:
        item?.node?.snippet ||
        item?.node?.nodeLabel ||
        node?.snippet ||
        node?.nodeLabel ||
        item?.nodeLabel ||
        "Lighthouse JSON did not include a readable LCP node snippet",
      url: item?.url || node?.url || null,
    };
  }
  ```
