# HOHO MANAGER — AGENT CONTROL CENTER

**Repository:** https://github.com/no-peace/Hoho_manager  
**Primary branch:** `main`  
**Controller:** Head Agent (this ChatGPT conversation)  
**Master plan:** `docs/HOHO_MASTER_IMPLEMENTATION_PLAN.md`  
**Baseline code commit reviewed:** `73b344a7316851211339a55e7f98d54b83a38a2e`  
**Control-file policy:** The latest committed version of this file is authoritative.

---

## 1. Head Agent authority

The Head Agent owns the complete implementation program and is the only agent authorized to:
- Start, pause, resume or block an agent.
- Change assignments and priorities.
- Approve architecture, API contracts and shared-file edits.
- Approve handoffs and mark a part complete.
- Authorize merges to `main`.
- Resolve conflicts and integration failures.

Subagents implement only their assigned scope. A subagent's claim of completion is not approval.

## 2. Mandatory read-and-refresh protocol

Every agent must:
1. Fetch the latest `main` and read this entire file before its first action.
2. Read the master plan and relevant current source/handoff documents.
3. Check its current status and the Head Agent directives.
4. Re-fetch `docs/AGENTS.md` before every new implementation batch.
5. Re-fetch it before any commit, branch update, PR creation or merge.
6. Re-fetch it after resuming a paused session.
7. Stop if a newer directive blocks its work or if its assignment is unclear.

Do not rely on a copy of this file from an earlier prompt or session.

## 3. Repository and baseline

The code baseline reviewed by the Head Agent is:
- `main` at `73b344a7316851211339a55e7f98d54b83a38a2e`.
- The master plan was added afterward in commit `b0908177e67727d6967d2d822df297c7374fbf4d`.
- The master plan commit changes documentation only.

The latest `docs/GEMINI_HANDOFF_CURRENT.md` records significant existing work. Agents must inspect current source and history and complete only verified gaps. Do not rebuild the Puck editor, themes, preview behavior or other features just because the master plan lists them.

## 4. Branch and commit policy

To avoid four agents overwriting one another:
- Agent 1 works only on `agent/ui-regressions`.
- Agent 2 works only on `agent/responsive-design-lab`.
- Agent 3 works only on `agent/layout-publishing`, but it is currently blocked.
- Agent 4 works only on `agent/themes-ui`, but is currently inspection-only.

Do not commit implementation directly to `main`.
Do not merge your own branch or another agent's branch.
Do not force-push.
Do not rewrite history.
Do not overwrite another agent's branch.
Create commits only on your assigned branch and only after the Head Agent has authorized implementation/commit. The Head Agent reviews diffs and controls integration into `main`.

If the assigned branch does not exist, ask the Head Agent to create/authorize it; do not guess a branch or create a competing branch.

## 5. Shared-file coordination

Before editing a file, record it in your own section under **Files claimed / in progress**. Check every other agent's claimed files.

No two agents may edit the same file concurrently. If a conflict is found:
- Stop before editing the contested file.
- Report the path and reason to the Head Agent.
- Continue only on clearly non-overlapping files if authorized.

The following paths are especially conflict-prone:
- `client/src/components/layout/StudioLayout.tsx`
- `client/src/components/layout/Header.tsx`
- `client/src/pages/DocsPage.tsx`
- `client/src/styles/globals.css`
- `client/src/config/uiThemeConfig.ts`
- `client/src/pages/DesignLabPage.tsx`
- `client/src/config/puck/*`
- `client/src/utils/puckAppLayout.ts`
- Database migrations and design API routes.

The shared control file itself is a coordination surface. Agents must update only their own section. If simultaneous edits to this file conflict, do not force an update; report the conflict and wait for the Head Agent to consolidate status.

## 6. Global engineering rules

- Read existing source, callers, tests and relevant documentation before changing code.
- Preserve Discord message editing/dispatch, auth, server selection, profile access and critical controls.
- No speculative feature or API contract.
- No arbitrary JavaScript/HTML/unrestricted CSS in Design Lab.
- Enforce permissions server-side.
- Validate both Desktop and Mobile documents before atomic publish.
- Never delete private presets during active-theme cache cleanup.
- Preserve reduced-motion and accessibility behavior.
- Preserve reported mobile Lighthouse Performance baseline 97; no speculative optimization.
- Add focused regression tests where practical.
- Do not claim tests/build/browser/Lighthouse/deployment passed unless actually run.
- Review the complete diff and report changed files and verification honestly.
- Update `docs/GEMINI_HANDOFF_CURRENT.md` only when authorized and coordinate ownership to avoid concurrent edits.

## 7. Status meanings

- **NOT STARTED:** no work authorized yet.
- **INSPECTION ONLY:** source review allowed; no implementation or commits.
- **READY:** dependencies satisfied; waiting for Head Agent start signal.
- **IN PROGRESS:** implementation explicitly authorized.
- **BLOCKED:** must not implement until blocker is removed.
- **REVIEW REQUIRED:** agent submitted work; Head Agent has not approved it.
- **COMPLETED:** Head Agent reviewed and approved acceptance criteria.

## 8. Head Agent directives — authoritative

### Directive 001 — Initial controlled start
- Agent 1: **IN PROGRESS — authorized to inspect and implement Part A** on its assigned branch.
- Agent 2: **IN PROGRESS — authorized to inspect and implement Part B** on its assigned branch.
- Agent 3: **BLOCKED — no implementation.** It may read current backend/database architecture only if needed, but must not create migrations, APIs, schema contracts or runtime integration until the Head Agent approves Agent 2's Part B schema/document handoff.
- Agent 4: **INSPECTION ONLY.** Inspect Parts D/E and report verified current state, gaps, tests and files it proposes to change. Do not edit or commit implementation until the Head Agent gives a start signal.
- Agents 1 and 2 may work in parallel only on non-overlapping files. Agent 1 must avoid Part B Puck configuration files; Agent 2 must avoid Part A preview/editor regression files.
- All agents must use their assigned branch. No direct commits to `main`.

### Directive 002 — Current implementation facts
The latest handoff already documents:
- Part A/V12 work for login, preview selection, mobile quick-edit and FlowBuilder.
- Part D/E work for theme cache/application, Docs and Settings.
- Part B's Puck Responsive Design Lab with independent Desktop/Mobile docs, local drafts, import/export, controls and preview.
- Part C's production persistence/API/runtime publishing as outstanding in the handoff.
These are not assumed to be perfect: agents must verify current source, identify residual defects and avoid duplicate implementation.

### Directive 003 — Agent reporting
After each batch, update only your own status section below with:
- Status and current batch.
- Files claimed/in progress and files changed.
- Findings and implementation decisions.
- Tests actually run and exact results.
- Commit SHA and branch.
- Remaining work, risks and blockers.
- Any Head Agent decision needed.

A commit is not completion. Mark your work REVIEW REQUIRED and wait for Head Agent review.

## 9. Agent 1 — Part A: UI regressions

**Status:** IN PROGRESS — authorized  
**Branch:** `agent/ui-regressions`  
**Scope:** Part A only. Audit the existing V12/login/preview/mobile quick-edit/FlowBuilder work, identify residual gaps and fix only verified issues.  
**Current batch:** A4 — preserve native interactive preview controls while retaining non-interactive inspector navigation  
**Files claimed / in progress:** `client/src/components/layout/StudioLayout.tsx` (Head Agent explicitly authorized focused edit in the 2026-11-17 instruction), `client/src/utils/previewSelection.ts` (new), `client/src/utils/__tests__/previewSelection.test.ts` (new)  
**Files changed:** `client/src/components/editor/PropertyPanel.tsx`, `client/src/utils/tree.ts`, `client/src/utils/__tests__/tree.test.ts`, `client/src/components/reactbits/ThreeHeroCanvas.tsx`, `client/src/components/reactbits/__tests__/ThreeHeroCanvas.test.tsx`, `client/src/components/preview/ActionRowPreview.tsx`, `client/src/components/preview/__tests__/ActionRowPreview.test.tsx`  
**Tests executed:** Added 3 focused tree-lookup Vitest cases, 1 canvas resize-redraw case and 1 dropdown utility-class guard. Not executed: connected Terminal endpoint returned HTTP 404; GitHub reports no status checks or workflow runs for the branch commits.  
**Commit SHA:** Code/test commits: `ba1324cb2dd12748676108701937c12a41b4f829`, `64264c1f17afabe3279cb01fc7ee93dc86c7795d`, `025f42518cdd4498db613d5219af8097bdc3dcba`, `972583df3caa88e3b705c485905abd637c341f09`, `0fcbbb0c0dae8d5370b26f72f0f0cc56d32298b6`, `c4990761da324f45a5fa8247e8bc1022bbdc5e3a`, `ed74665e9031978b577848d38b81a9420f52c74e`, `84db008e9f4606d4c9730bf663ad3bf362ffed80`, `47ea6a0a8cf3ecb975f7348da91198c91895e6de`.  
**Findings:** Quick-edit previously searched only top-level components for TextDisplay, despite nested V2 structures being supported by the editor and tree utilities. It could display an empty field and create a new top-level TextDisplay instead of editing the nested one. V2 detection also differed from MessageEditor/MessagePreview by checking only the flags bit.  
**Implementation:** Added a recursive depth-first component-type lookup; quick-edit now uses it, recognizes both the V2 flag and internal V2 mode, and restores the selected-message inspector if it must synchronize the active message index. Added focused utility regression tests.  
**Verification status:** Source diff reviewed. Typecheck, tests, build and browser interaction checks remain unverified because the connected local Terminal endpoint is unavailable and no GitHub Actions checks ran.  
**Additional A3 finding:** `ActionRowPreview` used `animate-in`, `fade-in` and `zoom-in-95`, but the client does not depend on `tailwindcss-animate` and Tailwind v4 does not provide those plugin utilities. Removed the unsupported classes and added a regression assertion. Runtime verification is still required before this batch can be considered complete.  
**Additional A2 finding:** `MessagePreview` correctly marks buttons/select menus as interactive and passes that flag to `StudioLayout`, but `StudioLayout.handlePreviewComponentSelect` ignores the flag and always opens the inspector/scrolls the editor. This can interfere with the select-menu preview interaction. `StudioLayout.tsx` is explicitly conflict-prone/shared; no edit has been made.  
**Head Agent decision needed:** Approve or reject a focused `StudioLayout.tsx` change that preserves interactive preview controls while keeping non-interactive preview selection navigation.  
**Source audit update:** Reviewed `LoginScreen.tsx`, `PublicPageHeader.tsx`, `ThreeHeroCanvas.tsx`, `MessagePreview.tsx`, `ActionRowPreview.tsx`, `ComponentPreview.tsx`, `StudioLayout.tsx`, `ContentTab.tsx`, `ComponentForms.tsx`, `DiscohookComponentsEditor.tsx`, `FlowBuilder.tsx`, `StepList.tsx`, `Header.tsx`, `Sidebar.tsx`, `globals.css` and `index.html`. Apart from the confirmed issues recorded above, no additional acceptance-critical source defect was confirmed in this pass; no unrelated rewrites were made. Login retains the 5/7 layout, reduced-motion gating, immediate canvas frame, public header and OAuth/dev-login separation.  
**Next action:** Await Head Agent's decision on the shared `StudioLayout.tsx` interactive-preview fix; continue with verification when a test runner is available.

Restrictions: Do not edit Puck Design Lab files or Part C publishing files. Coordinate before touching shared Studio shell files.

## 10. Agent 2 — Part B: Responsive Design Lab

**Status:** IN PROGRESS — authorized  
**Branch:** `agent/responsive-design-lab`  
**Scope:** Part B only. Audit the existing Puck Responsive Design Lab, close verified gaps, and produce a precise Desktop/Mobile schema and runtime contract for Agent 3.  
**Current batch:** Baseline and schema reconciliation  
**Files claimed / in progress:** None reported yet  
**Files changed:** None  
**Tests executed:** None reported  
**Commit SHA:** None  
**Schema handoff:** Not submitted  
**Next action:** Fetch latest main, create/use assigned branch only if Head Agent confirms it exists, inspect Puck source/docs/tests, then report file claims before edits.

Restrictions: Do not implement database/API publishing. Do not edit Part A preview/editor regression files or shared Studio runtime files without Head Agent approval.

## 11. Agent 3 — Part C: Database and publishing

**Status:** BLOCKED — inspection only  
**Branch:** `agent/layout-publishing`  
**Scope:** Part C only.  
**Dependency:** Head Agent must review and approve Agent 2's schema/document handoff.  
**Files claimed / in progress:** None  
**Files changed:** None  
**Tests executed:** None  
**Commit SHA:** None  
**Next action:** Wait. Do not implement migrations, routes, schemas or runtime wiring until explicitly unblocked.

## 12. Agent 4 — Parts D/E: Themes and UI consistency

**Status:** INSPECTION ONLY  
**Branch:** `agent/themes-ui`  
**Scope:** Parts D and E. Verify existing theme/preset/cache, Docs, Settings and shared UI behavior; report only confirmed gaps and proposed file list.  
**Current batch:** Read-only audit  
**Files claimed / in progress:** None  
**Files changed:** None  
**Tests executed:** None  
**Commit SHA:** None  
**Next action:** Inspect current source and handoff; submit findings to Head Agent. No implementation or commits until explicit authorization.

## 13. Architecture decisions

| Decision | State |
|---|---|
| Existing Puck Desktop/Mobile document architecture is the starting point | Confirmed |
| Part C must consume Agent 2's reviewed schema | Required |
| Desktop and Mobile publish atomically | Required |
| Personal themes remain separate from server theme | Required |
| Parallel agents use isolated branches; Head Agent controls main integration | Required |

## 14. Integration/conflict log

No agent-reported conflicts yet. Record path, agents involved, conflict, decision and resolution here.

## 15. Completed batch history

Append a compact record for each reviewed batch:
- Agent and part:
- Batch:
- Branch and commit SHA:
- Files changed:
- Tests run and exact results:
- Head Agent review decision:
- Remaining work:

Only the Head Agent may mark a part COMPLETED.
