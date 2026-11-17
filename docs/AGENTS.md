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
**Current batch:** Baseline reconciliation  
**Files claimed / in progress:** None reported yet  
**Files changed:** None  
**Tests executed:** None reported  
**Commit SHA:** None  
**Next action:** Fetch latest main, create/use assigned branch only if Head Agent confirms it exists, inspect source and handoff, then report file claims before edits.

Restrictions: Do not edit Puck Design Lab files or Part C publishing files. Coordinate before touching shared Studio shell files.

## 10. Agent 2 — Part B: Responsive Design Lab

**Status:** REVIEW REQUIRED — Part B handoff and final CSS-variable consistency correction committed; awaiting Head Agent approval  
**Branch:** `agent/responsive-design-lab`  
**Scope:** Part B only. Completed the requested reconciliation between editable Puck properties, `ResolvedAppLayout`, and the Part C runtime contract. No Part C implementation.  
**Current batch:** B5 — expose independent Mobile Editor/Preview padding CSS variables  
**Files changed:**
- `client/src/utils/puckAppLayout.ts`
- `client/src/utils/__tests__/puckAppLayout.test.ts`
- `docs/PUCK_DESIGN_LAB.md`
- `docs/AGENTS.md` (this Agent 2 status section only)

**Architecture decisions / property classification:**
- **Production-facing motion:** Animation preset, duration and delay are resolved separately for Desktop and Mobile headers, workspaces, panels and Mobile navigation. Each region exposes typed `{ animation, duration, delay }`. Part C must use a fixed code-owned preset mapping, bounded timing values, and a `prefers-reduced-motion: reduce` override that suppresses animation and delay.
- **Production-facing panel labels:** Editor, Preview and Inspector labels are resolved independently for Desktop and Mobile and must render as text in the real panel headings.
- **Production-facing toolbar:** `EditorPanel.showToolbar` resolves to independent Desktop and Mobile booleans and controls only the real editor toolbar at that breakpoint.
- **Production-facing Mobile panel geometry:** `editorPadding`, `previewPadding` and `inspectorPadding` now resolve independently from their corresponding panel nodes. They are not conflated with the workspace-level `panelPadding`.
- **Other production-facing Mobile controls:** `defaultPane`, navigation sizing/order/colors, visual label visibility and Editor/Preview/Dispatch tab labels. Tab labels must be text; accessible names must remain when visual labels are hidden.
- **Preview-only:** Mobile `showInspector` (preview bottom-sheet visibility) and `activeTab` (preview selected-tab highlight). Component IDs are document identity/validation keys only, not production DOM IDs.
- `getAppLayoutCssVariables` remains scoped to CSS dimensions/colors/geometry. Part C applies motion through allowlisted code-owned classes/timing and labels through text content, never document-provided CSS/HTML.

**Final CSS-variable correction:** `getAppLayoutCssVariables()` now exposes `--hoho-layout-mobile-editor-padding` and `--hoho-layout-mobile-preview-padding`, mapped directly to `layout.mobile.editorPadding` and `layout.mobile.previewPadding` with `px` units. Focused assertions verify both values (`17px` and `19px`) and preserve the existing Inspector padding assertion (`21px`). `docs/PUCK_DESIGN_LAB.md` explicitly lists all three independent Mobile panel padding variables and distinguishes them from workspace `panelPadding`.
**Validation/resolution:** Existing strict validation checks every motion preset, duration and delay against fixed enums; validates panel labels (1–48 trimmed characters, no control characters); validates `showToolbar` as `show | hide` with legacy boolean normalization; and validates each panel padding value in the 0–32 range. The resolver now exposes all these validated values for both breakpoints.  
**Regression coverage added:** Focused assertions cover all resolved motion regions, all three panel labels at both breakpoints, independent toolbar visibility, Mobile navigation motion, independent Mobile Editor/Preview/Inspector padding, and the Mobile Editor/Preview CSS variables with pixel units.  
**Tests executed:** None. Per the user/Head Agent instruction, npm checks are deferred to final verification; no test/typecheck/build result is claimed.  
**Final correction commits:**
- `dbe62ca4f2c0643ca0cb8b620a0da399212f1ff5` — expose Mobile Editor/Preview padding CSS variables.
- `51c44b3579f5238d0fd8e73427516b7c3a2dc4e5` — assert both CSS variables use the independently resolved pixel values.
- `98ff698d5fc88d52f840a63e74630d9bb666bdaf` — document the complete Mobile panel padding CSS-variable contract.

**Implementation commits:**
- `c6e3ab251f755f4f134e928e79068e1223dbbd2b` — resolved production motion, labels and toolbar values.
- `9d647bf8d1ab5388821d7e2f656981f8e8e01c04` — regression assertions for resolved production controls.
- `8c608557a3a659fa1fcc65b56787c338eb47ae7c` — documented production vs preview-only behavior and Part C requirements.
- `6c4dd5e53ffce9e670fb7a05cddf4f61f2f2bc4a` — resolved Mobile Editor/Preview panel padding independently.
- `2c02994bf3f9320bc5c566d9738ff563eeff78ac` — regression assertions for independent Mobile panel padding.
- `ff0cd41437711900c513e06f681132a2c290223e` — documented independent Mobile panel padding and Part C application.
**Remaining work:** Head Agent review/approval. Part C must implement the documented runtime application; Agent 2 has not edited production Studio runtime files.  
**Risks / blockers:** npm checks are intentionally deferred to final verification. Production animation and toolbar application remain Part C work.  
**Next action:** Wait for Head Agent approval. Do not implement Part C, edit Agent 1 files/shared Studio runtime, or merge to `main`.

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
