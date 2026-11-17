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


## 16. Head Agent directives — current decisions (2026-11-17)

These directives supersede earlier status labels and next-action text above where they conflict.

### Directive 004 — Review queue and deferred verification
- Agent 1 / Part A: **REVIEW REQUIRED** on `agent/ui-regressions`. The submitted branch is 27 commits ahead of main and 0 behind at the time of this directive. Head Agent review is pending; do not begin unrelated Part B work or merge.
- Agent 2 / Part B: **REVIEW REQUIRED** on `agent/responsive-design-lab`. The submitted branch is 28 commits ahead of main and 0 behind at the time of this directive. The schema handoff is not yet approved because every editable Puck property must be reconciled with the resolved production runtime contract, including animation settings/reduced-motion, panel labels and `EditorPanel.showToolbar`.
- Agent 3 / Part C: remains **BLOCKED** until the Head Agent explicitly approves Agent 2's schema/runtime handoff. Inspection only; no migrations, API/schema changes or runtime wiring.
- Automated npm verification is deferred until the implementation program is complete at the user's direction. Agents may add or update focused tests, but must not spend time attempting to run npm checks. Record them as not run; do not claim they passed. The Head Agent will tell the user when to pull and run final checks.

### Directive 005 — Server-theme publishing authorization model
- **Decision: Yes, explicitly authorized Design Lab Discord user IDs may publish server themes, but Design Lab access alone does not grant publishing permission.**
- Publishing permission must be granted through a server-side trusted allowlist/authorization check against the authenticated Discord user ID. Never trust a client-supplied ID, hidden UI control, local storage flag, or role claim that the server has not independently verified.
- The authorization check must run on every server-theme publish/update/delete operation. Unauthorized users may preview and edit local/private drafts but must be denied server-theme mutations.
- Keep server themes distinct from personal/private presets. A server-theme publish must not overwrite or delete a user's private preset.
- Agent 4 must inspect the existing authentication, theme routes/services and ownership model, then propose the smallest compatible implementation. Do not invent a new role system or expose a public endpoint merely to implement this decision.
- This decision applies to server themes only. It does not change Part C's owner-only application-layout publishing requirement.

### Directive 006 — Agent 4 Parts D/E inspection and authorization
- Agent 4 remains **INSPECTION ONLY**. Part D/E implementation is **not yet authorized** because no verified inspection report or proposed file ownership list has been submitted.
- Agent 4 must submit: (1) confirmed current behavior with exact source paths, (2) verified gaps against Parts D/E, (3) proposed minimal changes, (4) exact files it wants to claim, (5) shared-file conflicts with Agents 1/2/3, and (6) security/compatibility risks.
- No file may be claimed or edited until the Head Agent approves the file list. In particular, coordinate any proposed edits to `StudioLayout.tsx`, `Header.tsx`, `DocsPage.tsx`, `globals.css`, `uiThemeConfig.ts`, `DesignLabPage.tsx`, Puck files, theme routes/services and database migrations.
- After the report is reviewed, the Head Agent will issue a narrow implementation authorization with exclusive file ownership and batch acceptance criteria. Until then, no commits on `agent/themes-ui`.

### Directive 007 — Agent 1 callback regression
- Agent 1's submitted branch remains under review. Head Agent review must verify that interactive preview controls are checked before `setActiveMessageIndex` is called, and that the actual `MessagePreview` click path is covered by regression tests.
- Interactive controls must not change active message, selected component, inspector state or editor navigation. Non-interactive preview selection/navigation must remain unchanged.
- Do not merge until this is verified in source.



## 17. Head Agent review — 2026-11-17 (latest)

### Part A / Agent 1 review
- **Source review:** A5 interactive-preview callback correction is accepted. In `MessagePreview.tsx`, the interactive marker is checked before active-message synchronization; interactive controls return without changing active message or selection. The non-interactive path retains active-message synchronization and component selection.
- **Regression coverage:** The submitted `MessagePreview.test.tsx` exercises the rendered click path for an interactive select in a non-active message and a non-interactive V2 TextDisplay in a non-active message.
- **Decision:** Part A source implementation is accepted for integration review. Automated test/typecheck/build/browser verification remains deferred under the user's instruction and must be completed in the final verification stage. Do not mark Part A fully verified or claim tests passed.
- **Branch integration:** `agent/ui-regressions` is one commit behind current `main` because it does not contain the Head Agent documentation directive commit. Preserve the current `main` version of `docs/AGENTS.md`; do not overwrite it with the branch copy. Head Agent controls integration.

### Part B / Agent 2 review
- **Schema/runtime handoff:** The Head Agent accepts the documented Desktop/Mobile schema and the reconciliation of production-facing motion, panel labels, toolbar visibility, Mobile panel geometry and explicitly preview-only settings.
- **Small follow-up:** Agent 2 must add CSS variables for Mobile Editor and Preview padding to `getAppLayoutCssVariables()`, matching the already resolved `mobile.editorPadding` and `mobile.previewPadding`, and add focused assertions. This is a consistency correction; it does not reopen the schema design.
- **Decision:** The Part B schema/runtime handoff is approved for Agent 3's backend/API/migration implementation. Agent 2 remains REVIEW REQUIRED until the CSS-variable correction is committed and reviewed. Agent 2 must not edit Part C or production Studio runtime files.

### Part C / Agent 3 authorization
- **Status:** IN PROGRESS — backend/API/migration implementation authorized.
- Agent 3 may inspect and implement the database migration, server-side schema validation, atomic Desktop/Mobile persistence, authenticated owner/authorized-Discord-ID publishing authorization, and public/read endpoint within its assigned branch.
- Before editing, Agent 3 must submit and record its exact file claims in its own section. Do not edit files claimed by Agent 2 or Agent 1.
- **Runtime integration is not yet authorized.** Do not edit `StudioLayout.tsx`, `Header.tsx`, `SplitPane.tsx`, `PropertyPanel.tsx`, shared theme/CSS files, or other Part A/shared UI files until the Head Agent reviews a proposed runtime file list and grants exclusive ownership.
- Agent 3 must use the approved Part B schema/runtime contract, validate both responsive documents server-side before any write, persist the pair atomically, and enforce publisher authorization server-side on every mutation. No client-supplied identity or UI-only permission check is trusted.
- npm checks remain deferred. Add focused tests where practical, but do not spend time running npm checks.

### Part D/E / Agent 4
- Agent 4 remains INSPECTION ONLY until a verified report and exact proposed file list are submitted and reviewed. The server-theme publishing policy is governed by Directive 005 above.


## 18. Head Agent review — Part B/Part C backend batch (2026-11-17)

### Part B final approval
- Agent 2's final Mobile Editor/Preview padding CSS variables, pixel-unit mappings, regression assertions and documentation were verified on `agent/responsive-design-lab`.
- **Decision: Part B schema and Design Lab implementation are APPROVED for integration.** The branch is 32 commits ahead and 2 behind current `main`; preserve the latest `main` control document and integrate deliberately. Do not merge the stale branch copy of `docs/AGENTS.md`.
- Agent 2 must not begin Part C or production Studio runtime work.

### Part C backend review — changes required
- Agent 3's backend batch is submitted on `agent/layout-publishing` (10 commits ahead, 0 behind at review time). The one-row responsive pair and transactional repository write are directionally acceptable, but the batch is **NOT APPROVED**.
- **Critical authorization correction:** application-layout publishing remains owner-only. The separate authorized Design Lab Discord-ID policy applies to server-theme publication only. Do not create an application-layout publisher allowlist, non-owner publisher grants, or publisher management endpoints. Every application-layout publish must be authorized by the authenticated session's Discord ID matching `env.ownerDiscordIds` (with any existing development-only owner simulation remaining strictly non-production). Public read may remain unauthenticated.
- Remove the Part C `app_layout_publishers` table, repository grant/revoke/list methods, publisher-management endpoints and allowlist-based publish authorization. Keep the single published responsive pair record.
- **Server/client schema parity corrections required before approval:**
  1. Server's 256 KiB per-document / 512 KiB pair limits conflict with Part B's 64 KiB combined Desktop+Mobile limit. Enforce the approved 64 KiB combined limit server-side.
  2. Server currently accepts missing component properties because it validates only properties that happen to be present. Require all properties required by the approved Part B schema; preserve only explicitly documented optional version-1 fields.
  3. Server ID validation currently permits leading underscores/hyphens and up to 80 characters. Match Part B's exact ID rule: first character alphanumeric, remaining characters alphanumeric/underscore/hyphen, maximum 64 characters.
  4. Part B accepts an omitted empty `root.props` and normalizes it to `{}`; server must do the same.
  5. Preserve Part B version-1 compatibility: normalize omitted Mobile navigation `activeTab` and labels to documented defaults, and normalize legacy boolean `EditorPanel.showToolbar` to `show | hide`.
  6. Part B requires IDs to be unique within each responsive document. Do not impose cross-document uniqueness unless Part B's approved schema is explicitly amended; keep server and client behavior identical.
- Add focused regression cases for every correction, including missing required fields, optional legacy fields, size boundary, invalid/overlong IDs, omitted root props, and authenticated owner-only publishing. Do not run npm checks; the user deferred them.
- Agent 3 must re-fetch the latest `main` control document before its next batch and before committing, update only its own status section, and report the exact final diff. No runtime integration is authorized until this backend batch is approved.

### Part A integration note
- Agent 1's interactive-preview callback correction and rendered click-path regression coverage were accepted by source review. Its branch is 27 commits ahead and 2 behind current `main`. Preserve the current `main` control document during integration. Automated checks remain deferred.

### Part D/E report status
- Agent 4 reports `REPORT SUBMITTED / REVIEW REQUIRED`, but no report content or changed report file is present in the current Head Agent conversation or the `agent/themes-ui` branch (0 commits ahead, 2 behind). Do not authorize Parts D/E implementation until the actual inspection report and exact proposed file ownership list are available for review.
