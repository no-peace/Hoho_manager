# HoHo Manager — Gemini Handoff & Implementation Report

**Prepared:** 2026-11-14  
**Repository:** https://github.com/no-peace/Hoho_manager  
**Production URL:** https://hoho-manager.onrender.com  
**Default branch:** `main`  
**Current main commit:** `3b5a0e6bed772d2c0a221212aa4e0492991a43f0`  
**Merged performance PR:** [#39](https://github.com/no-peace/Hoho_manager/pull/39)  
**Last verified:** 2026-11-14 09:22 IST

## 1. Read this first

This report is the current project handoff. Read it together with:

1. [V6 master implementation plan](./hoho_v6_master_architecture_plan.md) — the latest 14-stage plan supplied for the work.
2. [V4 Lighthouse/UI plan](./hoho_v4_lighthouse_sileo_skiper_cult_three_plan.md) — the older six-batch plan, useful for the historical Lighthouse targets and design rationale.
3. The actual current source on `main` and the active PR branch. Source code and tests are the final authority; commit titles alone are not proof that a requirement is complete.

The V6 plan is newer than the V4 plan. The V6 plan focuses on the full UI, loader, studio, editor, bot-message, and test-preservation pass. The V4 plan describes earlier Lighthouse, accessibility, SEO, Sileo, Skiper/Cult, canvas, and public-page work.

## 2. What the project is

HoHo Manager is a Discord bot message/embed/Components V2 studio with a live Discord-style preview, action/flow builder, server-side interaction handling, bot slash commands, executor status integration, backups, staff/access controls, and audit logging.

Repository workspaces:
- `client/`: React + TypeScript + Vite + Tailwind + Zustand.
- `server/`: Express API, SQLite/Turso persistence, Discord OAuth/session and interaction/action routes.
- `bot/`: Discord bot and slash commands.
- `shared/`: shared types and contracts.
- `tunnel/`: deployment/tunnel configuration.

Runtime/tooling facts from the repository:
- Node engine range: `>=22 <27`.
- CI tests Node 22 and Node 26.
- Vite production build is used for Lighthouse preview.
- API defaults to port 3001; Vite dev server defaults to 5173.
- The API can run without Discord OAuth/bot credentials for local test/preview use; health readiness depends on the SQLite schema being initialized.

## 3. Implementation history and what is already in main

The V6 stages were implemented in a focused sequence on 2026-11-13. The following commits are on `main` as of the main SHA above.

| V6 stage / area | Implementation commit(s) | Current status |
|---|---|---|
| Stage 1 — theme tokens and global styles | `afe20b80b8` | Implemented |
| Stage 2 — remove route skeleton and restore auth loader | `8d8381ac7e`, later loader refinement `39abfa0c38` | Implemented |
| Stage 3 — login/docs/privacy/404 surfaces | `bd221219c6`, plus public header/docs follow-ups `30a763ec39`, `43fc80a5ad` | Implemented |
| Stage 4 — header toolbar and studio layout | `83a4bc7f3b`, follow-up `7d767c3fc7` | Implemented |
| Stage 5 — shared UI primitives | `9f058465f5`, plus motion refinement `2b2cbced8d` | Implemented |
| Stage 6 — message/embed/Components V2 editor | `932bccffca` | Implemented |
| Stage 7 — mention input and picker | `f70a482852` | Implemented |
| Stage 8 — flow builder/property panel | `42b239c767`, markup correction `3034d9d519` | Implemented |
| Stage 9 — live Discord preview | `ac10efc2f7` | Implemented |
| Stage 10 — studio/admin modals | `5d3667e62a`, server bot access follow-up `8106a8a2ca` | Implemented |
| Stage 11 — bot slash-command messages | `de1f9cebeb`, follow-up formatting `78abc47bf7` | Implemented |
| Stage 12 — server embeds and action replies | `fb8c3b02b2`, `99e86bcb8a`, `6fe803cd31` | Implemented |
| Stage 13 — test preservation and verification | `3f04f7f2ee` and test fixes across the stage commits | Implemented; CI has passed |
| Stage 14 — final self-audit | This report is the start of the audit record | Keep auditing; do not assume complete |

Important follow-up implementation commits:
- `a76f78ff6c`: defer decorative login canvas.
- `8c31fbf731`: reduce decorative canvas work on mobile.
- `8c7f2abb17`: remove animation runtime from login page.
- `a7d6ab92d4`: lazy-load authenticated studio shell.
- `22a371f250`: remove studio dependencies from the not-found page.
- `3c2d0867d7`: lazy-load toast runtime.
- `39abfa0c38`: keep session loader limited to initial auth.
- `2b2cbced8d`: replace broad transitions with focused motion.
- `8918315ab9`: tighten login action and clarify flow branches.
- `4ecfe21f9b`: remove the last lazy modal placeholders.

The history also includes CI hardening, Node 22/26 support, server benchmark validation, dependency updates, and security workflows. PR #23 (the `he` 2.0.0 update) was merged into main as commit `2aab9e6d`. PR #27 was merged earlier. Security workflow hardening was merged as `0ed9b3be9e`.

## 4. Current branch and merged PR

PR #39: [Improve Lighthouse performance on mobile and desktop](https://github.com/no-peace/Hoho_manager/pull/39)

PR #39 is **merged** into `main`. Its merge commit is the current main commit:
`3b5a0e6bed772d2c0a221212aa4e0492991a43f0`.

The merged work includes:
- Login-page contrast and heading hierarchy improvements.
- Accessible logo alt-text handling.
- Route-aware Vite code splitting so studio-only dependencies are not eagerly loaded by the public login page.
- A healthy local API and explicit API proxy in the Lighthouse preview workflow.
- Updated Lighthouse and Gemini handoff documentation.

The latest commit history also contains documentation cleanups after the implementation. Check live `main` before making further changes; do not treat the old PR branch as active work.

## 5. CI and security state observed

For current `main` commit `3b5a0e6bed772d2c0a221212aa4e0492991a43f0`:
- CI run [43547638617](https://github.com/no-peace/Hoho_manager/actions/runs/43547638617): completed successfully on Node 22 and Node 26. Both jobs passed build, workspace typechecks, full tests, server performance benchmarks, benchmark JSON validation, and report upload.
- Lighthouse run [43547638587](https://github.com/no-peace/Hoho_manager/actions/runs/43547638587): mobile and desktop jobs completed successfully; both uploaded Lighthouse reports.
- Security run [43547638586](https://github.com/no-peace/Hoho_manager/actions/runs/43547638586): completed successfully. Dependency audit, secret scanning, and static security analysis all passed.

The CI workflow was triggered twice for the same commit because the branch push and PR update generated separate events. Both CI runs completed successfully. The latest complete check set is green for the exact head SHA above.

## 6. Lighthouse measurements and baseline

### Previous baseline

Lighthouse run [43479437966](https://github.com/no-peace/Hoho_manager/actions/runs/43479437966), before the PR #39 changes:
- Desktop Performance: 72, 72, 72; Accessibility: 94; Best Practices: 96; SEO: 100.
- Mobile Performance: 94, 94, 94; Accessibility: 94; Best Practices: 96; SEO: 100.

### PR #39 before the latest bundle/API fix

Run [43543844339](https://github.com/no-peace/Hoho_manager/actions/runs/43543844339), head `d0e0d301e9b8b709bc77642f5da3286215b5423a`:
- Desktop Performance: 53, 73, 73.
- Mobile Performance: 89, 94, 94.
- Accessibility: 100 on both devices; Best Practices: 96; SEO: 100.

This was the intermediate state: mobile performance median was still 94 and desktop median was 73.

### Latest PR #39 results

Run [43547638587](https://github.com/no-peace/Hoho_manager/actions/runs/43547638587), current head `d0dfe37fd0b033ba4244db04ea2626cb335da751`:

| Device | Performance runs | Median | Accessibility | Best Practices | SEO |
|---|---|---:|---:|---:|---:|
| Mobile | 98, 97, 97 | **97** | 100 | 100 | 100 |
| Desktop | 80, 78, 81 | **80** | 100 | 100 | 100 |

### Median comparison: intermediate PR #39 run → latest run

| Metric | Mobile before | Mobile latest | Desktop before | Desktop latest |
|---|---:|---:|---:|---:|
| Performance | 94 | **97 (+3)** | 73 | **80 (+7)** |
| FCP | 2.263 s | **1.807 s** | 2.186 s | **1.747 s** |
| LCP | 2.724 s | **2.260 s** | 2.729 s | **2.187 s** |
| TBT | 6 ms | **0 ms** | 39 ms | **22 ms** |
| CLS | 0 | **0** | 0 | **0** |

### Payload and JavaScript comparison

- Total initial transfer: about 220,270 bytes → **129,309 bytes** (about 41% lower).
- JavaScript transfer: about 187,491 bytes → **95,550 bytes** (about 49% lower).
- Unused JavaScript opportunity: about 108,643 bytes → **29,379 bytes** (about 73% lower).
- The eager `vendor-react` chunk is gone. The login page no longer preloads the large shared chunk that contained studio-only dependencies.
- The two previous 502 console errors for `/api/health` and `/api/auth/me` are gone.
- Best Practices improved from 96 to **100** on both devices.

The new result is a measured improvement on both devices, not just a passing workflow. The V4 plan's aspirational 99+ performance target has not yet been reached, so do not describe the scores as perfect.

## 7. Lighthouse workflow design

Current workflow: `.github/workflows/lighthouse.yml`.
- Runs a matrix for mobile and desktop.
- Builds shared, client, and server workspaces.
- Starts the Express API on port 3001 with `NODE_ENV=test` and a disposable SQLite database at `./data/lighthouse.sqlite`.
- Waits for `/api/health` to return success before starting Vite preview.
- Vite preview explicitly proxies `/api` to the local API.
- Runs three Lighthouse samples per device and uploads JSON/HTML artifacts.
- No production secrets or Discord OAuth credentials are required for these audits.

Both API startup and preview startup passed in the latest Lighthouse workflow. The latest reports contain no console/network 502 errors.

## 8. Recommended next technical work

The earlier performance issues have been fixed and merged:
1. The broad manual chunk was removed; the initial login route no longer downloads the large eager `vendor-react` chunk.
2. Lighthouse now starts a healthy local API and uses an explicit preview proxy; the 502 errors are gone and Best Practices is 100.

Remaining optional optimization work:
- Lighthouse still reports about 29.4 KB of unused JavaScript in the initial entry bundle. Inspect its coverage before removing any dependency; preserve login functionality and lazy route behavior.
- LCP is now about 2.2–2.26 seconds. Inspect the actual LCP element and resource timing before making further visual or asset changes.
- Keep mobile and desktop Lighthouse runs in the workflow and compare medians, not individual best-case runs.
- Do not lower Lighthouse assertions, hide API failures, or remove real app behavior to inflate scores.

## 9. Human commit-message rule

The project owner explicitly asked for natural, human commit messages, not AI-generated-sounding commit titles. Examples:
- `split the login bundle and fix the lighthouse preview api`
- `keep studio-only libraries out of the public login page`
- `trim the initial page work without changing the editor`

Do not use robotic conventional-commit filler or exaggerated claims.

## 10. Instructions for Gemini

You are reviewing and continuing an existing codebase, not starting a redesign from zero.

1. Read this report and `hoho_v6_master_architecture_plan.md` fully.
2. Read the older V4 plan only for its historical context and specific earlier performance/SEO work.
3. Inspect current `main`, PR #39, the current PR head, the actual workflow files, and the latest Lighthouse artifacts before recommending edits.
4. Preserve existing tests and all Discord payload/API behavior. Do not rewrite working features merely for stylistic preference.
5. The eager `vendor-react` bundle and missing API in Lighthouse preview have already been fixed in the current PR. Do not repeat those changes; inspect the remaining 29.4 KB unused-JS opportunity and LCP evidence first.
6. Run the same CI, security, mobile Lighthouse, and desktop Lighthouse workflows after any code changes.
7. Report actual metrics and artifact evidence. State explicitly when a score is unchanged or regresses.
8. Use human commit messages and keep this handoff report updated with commit SHAs and run URLs.

## 11. Known limitations and open questions

- PR #39 is merged into `main` as commit `3b5a0e6bed772d2c0a221212aa4e0492991a43f0`.
- Latest median Performance is 97 mobile and 80 desktop; the older V4 target of 99+ is not yet met.
- About 29.4 KB of unused JavaScript remains in the initial entry bundle.
- LCP remains around 2.2 seconds on both devices.
- The implementation checks passed for source head `d0dfe37fd0b033ba4244db04ea2626cb335da751`. A subsequent documentation-only branch update also passed CI, Lighthouse, and Security on head `707f1373b6de4b2622298a135246b5389358392b` (CI run `43547912990`, Lighthouse run `43547912926`, Security run `43547912902`). The report may receive further documentation-only updates; always use the live PR head for current status.
- Always refresh branch heads, PR state, and workflow runs before acting; this report is a snapshot, not a substitute for live repository verification.


## 12. Final UI audit — 2026-11-14

This section records a source-level UI audit performed against the merged `main` commit
`3b5a0e6bed772d2c0a221212aa4e0492991a43f0`. This was **not** a complete browser screenshot audit: the production page could not be loaded through the available browser inspection path, so visual claims below are separated from confirmed source-level findings.

### Findings and priority

| Priority | Area | File | Finding | Confidence / next action |
|---|---|---|---|---|
| High | Header responsiveness | `client/src/components/layout/Header.tsx` | The logo/title, server selector, multiple studio actions, settings, staff controls and profile compete for horizontal space. Responsive text hiding exists, but the remaining controls may still become cramped at narrow widths. | Risk identified by source inspection; not visually confirmed. Test 320, 360, 390, 430, 640, 768 and 1024 px. |
| High | Select dropdown viewport fit | `client/src/components/ui/SearchableDiscordSelect.tsx` | Dropdown max-height calculation applies a 120 px minimum even when the actual available space above/below the trigger is smaller. This can allow the menu to extend beyond a short viewport or near-edge trigger. | Confirmed code-level defect. Fix the available-height calculation and add tests for very short viewports and triggers near both edges. |
| Medium | Firefox scrollbar theme | `client/src/styles/globals.css` | Root scrollbar defaults are light, while dark colors are conditional on `:root.dark`. Source search did not find code that applies the `dark` class. | Code-supported concern, not browser-confirmed. Verify Firefox in light and dark themes; ensure the dark class is actually applied or make defaults theme-aware. |
| Medium | Mobile property panel | `client/src/components/editor/PropertyPanel.tsx` | The mobile bottom sheet and overlay need more coverage for short screens, keyboard-open state, long forms, many flow steps and safe-area behaviour. | Additional testing required; no confirmed visual defect. |
| Medium | Mobile editor/preview state | `client/src/components/layout/SplitPane.tsx` | The inactive pane is conditionally unmounted when switching views. Component-local temporary state may be lost when the pane is recreated. | Verify actual user-visible state preservation before changing architecture. |

### Areas reviewed

Source inspection covered:
- `StudioLayout.tsx`, `Header.tsx`, `SplitPane.tsx`, `Sidebar.tsx`, and `StudioModals.tsx`.
- `MessageEditor/index.tsx`, `PropertyPanel.tsx`, `MessagePreview.tsx`, and `FlowBuilder.tsx`.
- `SearchableDiscordSelect.tsx`, `globals.css`, and `uiThemeConfig.ts`.
- Existing layout stress tests and login responsive regression tests.

Some layout foundations appear structurally sound in source: desktop/mobile split-pane handling, wrapping preview toolbar, mobile property-panel overlay, modal scroll/focus handling, and flexible editor card layouts. These observations do not replace rendered browser testing.

### Required visual regression matrix

Check each relevant page/state at:
- Widths: 320, 360, 390, 430, 640, 768, 1024, 1280 and 1440 px.
- Browsers: Chromium and Firefox; include a real mobile browser if available.
- States: signed-out login, authenticated studio, server selector open, header actions, editor with long content, preview, property panel open, flow builder with many steps, modal stack, docs/privacy/404 pages.
- Interaction: keyboard navigation, dropdown placement, page scroll locking, focus return, mobile editor/preview switching, and state preservation.
- Layout checks: horizontal overflow, clipped text, overlapping controls, incorrect stacking, safe-area insets and content hidden behind fixed bars.

### Audit limitations

- Production visual inspection was unavailable during this audit. Do not tell Gemini that screenshots or every viewport have already been visually verified.
- The dropdown height issue is supported by the implementation logic; the other responsive findings are risks or test requests unless explicitly stated otherwise.
- CI, Security and Lighthouse passing do not prove the absence of layout defects.

### Instructions for Gemini — UI follow-up

1. Start from live `main` at `3b5a0e6bed772d2c0a221212aa4e0492991a43f0`, not the stale PR state documented in older history.
2. Inspect the current implementation and tests before proposing changes.
3. Reproduce the dropdown overflow with viewport-edge and short-height test cases; fix the calculation without introducing a forced minimum that exceeds available space.
4. Use actual browser screenshots at the viewport matrix above to decide whether the header, property panel, and split-pane concerns are real defects.
5. Do not redesign components based only on source-level suspicion. Preserve editor behaviour, Discord payloads, keyboard accessibility and existing tests.
6. Report each issue as reproduced, not reproduced, or not tested, with screenshot/test evidence.

## 13. Follow-up viewport fixes and verification — 2026-11-14

### Implemented on main

The dropdown positioning fix now derives its height from the actual visible viewport space and does not enforce a 120px minimum:

- Available space below accounts for the 4px trigger gap and 8px bottom viewport margin.
- Available space above is capped to the viewport's usable height, preserving 8px top and bottom margins even if the trigger is outside the visible viewport.
- The dropdown's top position is clamped so `top + maxHeight` stays inside the viewport.
- The 260px preferred height remains the maximum, not a forced height.

Regression coverage was updated in:
- `client/src/__tests__/m4_challenger2_layout_stress.test.ts`
- `client/src/components/ui/__tests__/SearchableDiscordSelect.test.tsx`

The tests cover 180px-tall viewports, triggers close to the top and bottom edges, triggers outside the visible viewport, and randomized viewport containment.

Other fixes:
- `:root` in `client/src/styles/globals.css` now defaults to `scrollbar-color: #1A1B1E #2B2D31`; the redundant `:root.dark` override was removed.
- The scrollable inspector body in `PropertyPanel.tsx` now includes `pb-[env(safe-area-inset-bottom)]`.

### CI and Lighthouse verification

Verified against code commit `7d956098d202d52e9d8bdf6871a350a2f4daa2f5`:

- CI run [43566662508](https://github.com/no-peace/Hoho_manager/actions/runs/43566662508): **passed** on Node 22 and Node 26. Both matrix jobs passed build, typecheck, full tests, server performance benchmarks, and benchmark JSON validation.
- Lighthouse run [43566662513](https://github.com/no-peace/Hoho_manager/actions/runs/43566662513): **passed** for mobile and desktop. Each device completed three Lighthouse samples and uploaded its report artifact.
  - Mobile artifact ID: `14103210770`
  - Desktop artifact ID: `14102602624`
- Security run [43566662547](https://github.com/no-peace/Hoho_manager/actions/runs/43566662547): **passed**.

The Lighthouse workflow passing confirms the audit completed; it does not by itself establish a particular LCP node or coverage result. Do not infer score changes without reading the JSON reports.

### Requested earlier Lighthouse run and LCP investigation

Run [43547638587](https://github.com/no-peace/Hoho_manager/actions/runs/43547638587) completed successfully on both devices and uploaded `lighthouse-mobile` and `lighthouse-desktop` artifacts. GitHub artifact metadata identifies its source as branch `perf/mobile-lighthouse-optimizations`, commit `d0dfe37fd0b033ba4244db04ea2626cb335da751`.

**The JSON coverage data and LCP node from that run have not been inspected.** The downloaded ZIPs could not be analyzed in this session. Therefore no conclusion is recorded about the exact unused-JavaScript sources or LCP element, and no bundle edit was made.

Source-only observations in `client/src/App.tsx`:
- `NotFoundPage` is statically imported rather than lazy-loaded.
- The `not_found` route returns before the `authLoading` check.
- On the normal application route, `authLoading` returns `SessionAuthLoader` before `LoginScreen` is rendered.

These facts identify possible bundle/startup considerations, but they do not prove either is responsible for the Lighthouse LCP. Inspect the requested report's LCP node and resource timing before changing lazy loading or auth gating.

### Browser screenshot status and Header decision

The requested six-width screenshot pass has **not** been performed. Required widths are 320, 360, 390, 430, 768, and 1280 px for `Header.tsx`, `PropertyPanel.tsx`, and `LoginScreen.tsx`.

No secondary Header actions were collapsed. The 320px/360px overflow condition has not been visually confirmed, so changing the action layout without screenshots would be speculative. Complete this matrix in an interactive browser session and only then decide whether actions need to collapse below 430px.

### Protected PR #39 configuration

No Vite configuration file was modified. `client/vite.config.ts` retains the existing `manualChunks` and `/api` preview proxy setup from PR #39.

### Relevant implementation commits

- `af002f4` — fix select dropdown height on short screens
- `5e8cb4b` — cover select dropdown placement on short viewports
- `1728e67` — test select dropdown near viewport edges
- `02e72a6` — default root scrollbar colors to dark theme
- `8a31fa9` — add safe area padding to the property panel
- `f10d5b3` — keep dropdown margins inside the viewport
- `02a996c` — cover triggers outside the viewport in layout tests
- `7d95609` — fix crowded viewport expectations in layout tests
