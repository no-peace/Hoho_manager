# HoHo Manager — Gemini Handoff & Implementation Report

**Prepared:** 2026-11-14  
**Repository:** https://github.com/no-peace/Hoho_manager  
**Production URL:** https://hoho-manager.onrender.com  
**Default branch:** `main`  
**Current main commit:** `2aab9e6dc283fe2fd35011981d45af08b042de1a`  
**Active performance branch:** `perf/mobile-lighthouse-optimizations`  
**Performance branch commit at report start:** `d0e0d301e9b8b709bc77642f5da3286215b5423a`  
**Open PR:** [#39](https://github.com/no-peace/Hoho_manager/pull/39)

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

## 4. Current branch and open PR

PR #39: [Improve Lighthouse performance on mobile and desktop](https://github.com/no-peace/Hoho_manager/pull/39)

Branch: `perf/mobile-lighthouse-optimizations`  
Current head: `d0dfe37fd0b033ba4244db04ea2626cb335da751`

The PR contains:
- `LoginScreen.tsx`: darker green demo-button background for white-text contrast and corrected showcase heading hierarchy.
- `HoHoLogoMark.tsx`: optional `alt` prop.
- `PublicPageHeader.tsx`: decorative logo gets `alt=""` beside the visible product name.
- `client/vite.config.ts`: removed the broad forced React/Zustand/Sileo vendor chunk so Vite can split route-only libraries; added an explicit API proxy for `vite preview`.
- `.github/workflows/lighthouse.yml`: build and start the API with a disposable SQLite database before running the production preview and Lighthouse.
- `docs/hoho_v6_master_architecture_plan.md`: project-side V6 plan.
- `docs/GEMINI_HANDOFF_REPORT.md`: this implementation and performance handoff.

The latest commit message is `split the login bundle and fix the lighthouse preview api` (natural wording, not a generated conventional-commit title).

PR #39 remains open and unmerged. Check its current head SHA, mergeability, and checks again before merging.

## 5. CI and security state observed

For the current PR #39 head `d0dfe37fd0b033ba4244db04ea2626cb335da751`:
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

The two high-priority issues from the earlier report have been fixed and verified:
1. The broad manual chunk was removed; the initial login route no longer downloads the large eager `vendor-react` chunk.
2. Lighthouse now starts a healthy local API and uses an explicit preview proxy; the 502 errors are gone and Best Practices is 100.

Remaining optional optimization work:
- Lighthouse still reports about 29.4 KB of unused JavaScript in the initial entry bundle. Inspect its coverage before removing any dependency; preserve login functionality and lazy route behavior.
- LCP is now about 2.2–2.26 seconds. Inspect the actual LCP element and resource timing before making further visual or asset changes.
- Keep mobile and desktop Lighthouse runs in the workflow and compare medians, not individual best-case runs.
- Do not lower Lighthouse assertions, hide API failures, or remove real app behavior to inflate scores.
- Do not merge PR #39 until its latest required checks and mergeability are re-checked.

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

- PR #39 is still open and unmerged at the time of this update.
- Latest median Performance is 97 mobile and 80 desktop; the older V4 target of 99+ is not yet met.
- About 29.4 KB of unused JavaScript remains in the initial entry bundle.
- LCP remains around 2.2 seconds on both devices.
- The latest CI, Lighthouse, and Security workflows all passed for head `d0dfe37fd0b033ba4244db04ea2626cb335da751`.
- Always refresh branch heads, PR state, and workflow runs before acting; this report is a snapshot, not a substitute for live repository verification.
