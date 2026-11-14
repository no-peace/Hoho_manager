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

PR #39: [perf(client): improve mobile Lighthouse score](https://github.com/no-peace/Hoho_manager/pull/39)

Branch: `perf/mobile-lighthouse-optimizations`

The PR currently contains four source changes:
- `LoginScreen.tsx`: darken the green “Verify Role” demo button to improve white-text contrast.
- `LoginScreen.tsx`: correct the showcase heading level.
- `HoHoLogoMark.tsx`: support an `alt` prop.
- `PublicPageHeader.tsx`: use an empty alt for the decorative logo next to the visible product name.
- `client/vite.config.ts`: remove the forced Motion/GSAP vendor chunk, although another broad `vendor-react` manual chunk still remains and is the next performance target.

PR #39 was open and mergeable when this report was prepared. Do not merge it without checking the current head SHA, mergeability, and required checks again.

## 5. CI and security state observed

For PR #39 head `d0e0d301e9b8b709bc77642f5da3286215b5423a`:
- CI run [43543844374](https://github.com/no-peace/Hoho_manager/actions/runs/43543844374): completed successfully.
- Lighthouse run [43543844339](https://github.com/no-peace/Hoho_manager/actions/runs/43543844339): mobile and desktop jobs completed successfully and uploaded reports.
- Security run [43543844542](https://github.com/no-peace/Hoho_manager/actions/runs/43543844542): completed successfully.

The CI run passed Node 22 and Node 26 build/typecheck/test steps and performance benchmarks. The Security run passed dependency audit, secret scanning, and static security analysis. These results apply to the exact PR head SHA above; re-check after any new commit.

## 6. Lighthouse measurements and baseline

### Previous baseline
Lighthouse run [43479437966](https://github.com/no-peace/Hoho_manager/actions/runs/43479437966), on the pre-PR39 code:
- Desktop Performance: 72, 72, 72; Accessibility: 94; Best Practices: 96; SEO: 100.
- Mobile Performance: 94, 94, 94; Accessibility: 94; Best Practices: 96; SEO: 100.

### PR #39 results
Lighthouse run [43543844339](https://github.com/no-peace/Hoho_manager/actions/runs/43543844339):
- Desktop Performance: 53, 73, 73; Accessibility: 100; Best Practices: 96; SEO: 100.
- Mobile Performance: 89, 94, 94; Accessibility: 100; Best Practices: 96; SEO: 100.

Median comparison:
| Device | Performance before | Performance on PR #39 | Accessibility before | Accessibility on PR #39 |
|---|---:|---:|---:|---:|
| Mobile | 94 | 94 | 94 | 100 |
| Desktop | 72 | 73 | 94 | 100 |

Do not describe the current PR as a proven performance improvement on mobile: the median score is unchanged. Desktop median is up by one point only, with run-to-run variation. Accessibility is consistently improved to 100 on both devices.

Representative PR #39 timing data:
- Mobile: FCP about 2.16–2.30 s; LCP about 2.72–2.73 s; TBT 1–237 ms; CLS 0.
- Desktop: FCP about 2.17–2.23 s; LCP about 2.72–2.74 s; TBT 16–454 ms in the three reports; CLS 0.
- Initial page transfer: about 220 KB total.
- JavaScript transfer: about 187 KB.
- The reports have a clear unused-JavaScript opportunity of about 106 KiB.

### Main findings from the PR reports

1. The initial `vendor-react` asset is approximately 496,620 bytes uncompressed / 158,153 bytes transferred. Lighthouse estimates 108,643 bytes (about 106 KiB) unused on the public login route. It is marked as a link preload and is downloaded immediately.
2. `client/vite.config.ts` manually groups every dependency path containing `react`, plus Zustand and Sileo, into `vendor-react`. This is too broad: it can pull dependencies used by lazy studio pages/modals into an eagerly loaded shared chunk. The V6 performance follow-up should let Vite split route-only libraries naturally.
3. The `vendor-icons` asset is about 31 KB raw / 11 KB transferred. It is not the largest problem; keep or remove that grouping only after checking build output.
4. The decorative login canvas is already dynamically imported and its animation is disabled on compact mobile/constrained devices. Avoid reintroducing an eager animation runtime on the login route.
5. Lighthouse records two 502 console/network errors: `/api/health` and `/api/auth/me`. The workflow currently builds and starts only the Vite preview server. The frontend proxies `/api` to port 3001, but no API server is started in that workflow. These are test-environment setup errors, not proof that the production API is broken.
6. Best Practices remains 96 in the reports. Re-run after providing a healthy local API during Lighthouse collection to determine whether the 502s account for the remaining audit finding.
7. LCP is consistently around 2.7 seconds on both devices, while CLS is zero. After chunk splitting and the API preview fix, inspect the next reports' LCP element and opportunities before making further visual changes.

## 7. Lighthouse workflow design

Current workflow: `.github/workflows/lighthouse.yml`.
- Runs a matrix for mobile and desktop.
- Builds shared + client.
- Starts Vite preview at `127.0.0.1:4173`.
- Runs three Lighthouse samples per device and uploads JSON/HTML artifacts.
- The workflow currently does not start the Express API, so preview proxy requests fail.

The next implementation should:
- Build the server in the Lighthouse job after building shared/client.
- Start the server on port 3001 with an isolated test SQLite database, e.g. `NODE_ENV=test`, `PORT=3001`, and `DATABASE_URL=./data/lighthouse.sqlite`.
- Wait for `/api/health` to return success before starting Lighthouse.
- Configure Vite preview to proxy `/api` to the same local API target (do not rely on an implicit preview default).
- Do not add production secrets or Discord credentials to the Lighthouse workflow.
- Confirm `/api/auth/me` returns the normal unauthenticated response and the health endpoint reports a ready database.
- Re-run both devices and compare median results, not a single run.

## 8. Recommended next technical work

Priority 1 — Fix initial JavaScript chunking:
- Remove the broad manual chunk rule that places every module with `react`, Zustand, or Sileo in `vendor-react`.
- Preserve code splitting for lazily imported Docs, Privacy, Studio, modals, pickers, and animation dependencies.
- Inspect generated assets and Lighthouse network requests to confirm studio-only motion/UI code is not downloaded on the login route.
- Keep React itself and the minimal login dependencies in the initial graph.

Priority 2 — Make Lighthouse API requests valid:
- Start a disposable SQLite-backed server as part of the Lighthouse workflow.
- Add explicit Vite preview proxy configuration.
- Confirm the 502 errors disappear and inspect the Best Practices score.

Priority 3 — Re-measure and decide:
- Collect fresh mobile and desktop reports after both changes.
- Compare median Performance, FCP, LCP, TBT, CLS, total transfer, and unused JS.
- Do not chase a numeric target by weakening assertions or hiding real app behavior.
- If LCP remains near 2.7 s, inspect the actual LCP element and resource timing before choosing the next optimization.

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
5. Prioritize the eager `vendor-react` bundle and broken Lighthouse API preview described above.
6. Run the same CI, security, mobile Lighthouse, and desktop Lighthouse workflows after changes.
7. Report actual metrics and artifact evidence. State explicitly when a score is unchanged or regresses.
8. Use human commit messages and keep this handoff report updated with commit SHAs and run URLs.

## 11. Known limitations and open questions

- PR #39 is not merged at the point of this report.
- The mobile performance median has not improved yet.
- Desktop performance is noisy and remains below the V4 plan's aspirational 99+ target.
- Best Practices is 96; investigate after fixing the Lighthouse API setup.
- The report records the repository state and workflow artifacts observed on 2026-11-14. Always refresh branch heads, PR state, and workflow runs before acting.
