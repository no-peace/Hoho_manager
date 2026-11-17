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

## 11. Agent 3 — Part C: Studio runtime integration

**Status:** REVIEW REQUIRED — two targeted regression-test corrections submitted; awaiting Head Agent review  
**Branch:** `agent/layout-publishing`  
**Scope:** Part C Studio runtime integration and its explicitly authorized client regression tests. Backend/API/migration work remains integrated through PR #47; runtime source remains source-review accepted.

**Current batch:** Applied the two Head Agent-requested test corrections. Both invalid property assignments now target `docs.mobile.content[0]`, the `MobileWorkspace` component that owns the respective properties:
- API test: `defaultPane = "tablet"` now targets `docs.mobile.content[0].props.defaultPane`.
- Publish-control test: `panelPadding = 999` now targets `docs.mobile.content[0].props.panelPadding`.

**Files changed in this correction batch (exactly):**
1. `client/src/utils/__tests__/appLayoutApi.test.ts`
2. `client/src/components/design/__tests__/PublishAppLayoutControl.test.tsx`

**Correction commits:**
- API validation test correction: `8e2389a407b23c0b15cedda1943171974fa90c1d`
- Publish-control validation test correction: `855e6432ed96113130f790f6181881b3fdaf6350`

**Earlier accepted correction retained:** `client/src/hooks/__tests__/usePublishedAppLayout.test.tsx` uses a dynamic `matchMedia().matches` getter; commit `37f4db89f299c899ae8941e9ead68f954bc2ea0c`.

**Verification:** No npm tests, typecheck or build were run, as explicitly deferred. These corrections have not been executed.

**Restrictions observed:** No other test or runtime source files were modified. No merge, rebase or force-push was performed. The correction batch is **REVIEW REQUIRED**; wait for Head Agent review.
 
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

## 19. Head Agent review — Agent 4 Parts D/E inspection report (2026-11-17)

### Report review and decisions
- Agent 4's inspection report was received in the Head Agent conversation. It reports no files changed, no commits and no automated checks run. The report is accepted as a useful source-level inventory, not as browser QA or runtime verification.
- **Part D architecture:** Preserve the existing separation between server themes, per-user active-theme cache, community themes and private presets. The 14-day expiry applies only to active-theme cache; private preset libraries and portable exports must remain independent and durable.
- **Server-theme authorization:** Approve a distinct server-side `canPublishServerTheme` capability for explicitly authorized Design Lab Discord IDs, in addition to existing owners. Design Lab access alone must not imply publishing permission. Check the authenticated session identity and trusted server-side permission on every server-theme mutation; never trust client-supplied IDs, local storage, UI visibility or unverified role claims. Return the capability separately from `isOwner`. Keep Part C application-layout publishing owner-only.
- **Permission storage/UI:** The report's proposal to add a separate capability to `design_access_users` and manage it through the existing owner-only access UI is approved in principle, subject to implementation review and coordination with Agent 3. Do not modify the already-applied migration 013; use a new forward-only migration. Permission revocation must take effect on the next mutation request.
- **Part D implementation is NOT YET AUTHORIZED.** Agent 3 currently has an active Part C branch touching `server/src/routes/design.ts` and `server/src/config/migrations.ts`; Agent 4 must not edit these or any other Part D files until Part C backend integration is resolved and the Head Agent grants exact exclusive file ownership. `DesignLabPage.tsx` also requires a fresh ownership check before assignment.
- **Part E implementation is AUTHORIZED as a separate narrow batch** on `agent/themes-ui`, limited exclusively to:
  1. `client/src/pages/DocsPage.tsx`: correct the outdated statement that bot membership is always required, while accurately limiting non-member access to discoverable servers with a public Guild Preview and its available fields.
  2. `client/src/components/layout/SettingsModal.tsx`: remove the no-op General tab button/navigation interaction (use a static selected section label or a clear non-interactive layout) and ensure the checked custom checkbox indicator retains the keyboard-visible focus ring.
- No other files are authorized in this Part E batch. In particular, no theme utilities/tests/routes/migrations, `DesignLabPage.tsx`, shared CSS/theme config, Studio runtime, Puck files or `docs/AGENTS.md` edits by Agent 4.
- Agent 4 must re-fetch this latest main control document before editing and before committing, record its two-file claim in its own status section, implement only these fixes, add focused regression coverage only if it can do so without editing unapproved files (otherwise report the test gap), and commit only to `agent/themes-ui`. Do not run npm checks; the user deferred them. Report commit SHA and exact diff, then mark REVIEW REQUIRED. No self-merge.

### Report corrections / current branch state
Fresh compare against current `main` during review:
- Agent 1: 27 commits ahead, 3 behind.
- Agent 2: 32 commits ahead, 3 behind.
- Agent 3: 10 commits ahead, 1 behind; Part C remains not approved pending the corrections in section 18.
- Agent 4: 0 commits ahead, 3 behind; inspection only, no committed files.
The report's branch counts were stale and must not be used as current status. Preserve current `main` control document during all integrations.
- Source spot-checks on current `main` confirm the no-op General tab handler in `SettingsModal.tsx`, and the owner-only server-theme checks in `server/src/routes/design.ts`. The report's Docs membership inconsistency is consistent with the current Docs variable descriptions and the report's cited Guild Preview fallback; implementation must retain that limitation.
- No browser QA, npm tests, typecheck, build or Lighthouse checks were run as part of this review. Do not claim they passed.

## 20. Head Agent review — Agent 3 Part C backend and Agent 4 Part E (2026-11-17)

### Agent 3 — Part C backend batch
- Current branch comparison: `agent/layout-publishing` is 24 commits ahead and 2 behind `main`. The submitted diff includes the stale branch copy of `docs/AGENTS.md`; preserve the current `main` control document during integration.
- Reviewed source files: `server/src/config/migrations.ts`, `server/src/repositories/appLayoutRepository.ts`, `server/src/routes/design.ts`, `server/src/utils/appLayoutValidation.ts`, and `server/tests/appLayoutPublishing.test.ts`.
- **Source review decision: Part C backend/API/migration batch APPROVED for integration review.** The earlier blockers have been addressed:
  - one authoritative row stores the complete Desktop/Mobile pair;
  - repository publication uses a database transaction;
  - both documents are validated and normalized before persistence;
  - public GET and owner-only authenticated PUT endpoints are present;
  - publisher identity is taken from the verified session, and the non-production admin simulation is explicitly gated by `!env.isProd`;
  - no application-layout publisher allowlist or publisher-management endpoint remains;
  - combined pair limit is 65,536 bytes;
  - required component properties, exact ID format/length, omitted root props, v1 navigation defaults, boolean `showToolbar` compatibility, and per-document (not cross-document) ID uniqueness are handled;
  - regression cases cover the corrected validation and authorization paths.
- Migration 015 creates the single published-pair table. Migration 016 safely removes the abandoned `app_layout_publishers` table with `DROP TABLE IF EXISTS`; do not rewrite or remove already-numbered migrations.
- **Important scope boundary:** This approval covers backend/API/migration source only. It does not approve Studio runtime integration, production UI wiring, or the overall Part C completion. Agent 3 must wait for an exact runtime file list and exclusive ownership authorization before touching `StudioLayout.tsx`, `Header.tsx`, `SplitPane.tsx`, `PropertyPanel.tsx` or shared UI/theme/CSS.
- Automated checks were not run. The submitted tests are source-reviewed only; do not claim they passed.
- Integration remains Head Agent-controlled. Do not merge the stale `docs/AGENTS.md` from the branch.

### Agent 4 — Part E batch
- Current branch comparison: `agent/themes-ui` is 5 commits ahead and 0 behind `main`.
- Source review accepted the two authorized code changes:
  - `client/src/pages/DocsPage.tsx`: accurately distinguishes full Guild access from discoverable-server public Guild Preview access.
  - `client/src/components/layout/SettingsModal.tsx`: replaces the no-op General button with a static current-section label and applies the keyboard focus ring to both checked and unchecked custom checkbox states.
- **Decision: Part E two-file source batch APPROVED for integration.** The branch also changes `docs/AGENTS.md` for its status record. Do not merge that branch copy; preserve the latest `main` control document.
- Agent 4's Part D remains **BLOCKED / NOT AUTHORIZED**. It must not start theme permission routes, migrations, theme utility changes or Design Lab UI work until Part C integration is resolved and the Head Agent grants exact file ownership.
- No npm tests, typecheck, build or browser QA were run. Do not claim verification beyond source review.

### Branch state at this review
- Agent 3: 24 ahead / 2 behind; backend source approved for integration review, runtime work not authorized.
- Agent 4: 5 ahead / 0 behind; Part E two-file source batch approved for integration, Part D blocked.


## 21. Head Agent integration — approved Agent 3 backend and Agent 4 Part E (2026-11-17)

- A clean integration branch, `integration/approved-agent-batches-2026-11-17`, was created from the then-current `main` commit `6ff923859951e5a9794d1ba573cd6534c7d8344f`.
- Selected source files were copied from the reviewed agent branches; stale agent copies of `docs/AGENTS.md` were deliberately excluded.
- Agent 3 / Part C backend files integrated on the clean branch:
  - `server/src/config/migrations.ts`
  - `server/src/repositories/appLayoutRepository.ts`
  - `server/src/routes/design.ts`
  - `server/src/utils/appLayoutValidation.ts`
  - `server/tests/appLayoutPublishing.test.ts`
- Agent 4 / Part E files integrated on the clean branch:
  - `client/src/components/layout/SettingsModal.tsx`
  - `client/src/pages/DocsPage.tsx`
- This is selective integration, not a merge of either agent branch. No other agent files are included.
- Source-level review was previously accepted for these exact batches. No npm tests, typecheck, build, browser QA or deployment checks were run.
- Part C backend/API/migration integration does not complete Part C. Studio runtime integration remains pending explicit Head Agent authorization and an exact file list.
- Part D remains blocked. Part A and Part B have separate approved source batches and have not been included in this integration branch.
- Next action: Head Agent to review the clean integration diff, then create/merge a PR to `main` only after confirming the seven-file diff and control-document preservation.


## 22. Head Agent integration result — PR #47 (2026-11-17)

- **Merged:** PR #47, `Integrate approved Part C backend and Part E UI batches`.
- **Merge commit:** `25c139ca30e91047c98c2f5a60036d2d7ccf608d`.
- The seven approved source files and this control-center update are now on `main`.
- Agent 3 Part C backend/API/migration work is integrated, but Part C remains incomplete until Studio runtime integration is separately authorized, implemented and reviewed.
- Agent 4 Part E's two-file batch is integrated. Part D remains blocked/not authorized.
- No automated checks were run. Final npm verification remains deferred until the implementation program is complete.


## 23. Head Agent integration — Parts A and B (2026-11-17)

- **Part A integrated:** PR #50, merge commit `2a9f35ba17958cf4a011a40a8508f4c460a77670`. The 12 reviewed UI regression source/test files are on `main`.
- **Part B integrated:** PR #51, merge commit `fcce7410045315ae2204162388f95a07f2224c49`. The five reviewed Responsive Design Lab schema/runtime-contract files are on `main`.
- Both agent branches had their stale `docs/AGENTS.md` replaced with the latest main control document before PR creation. Neither PR changed the control document.
- No automated checks were run. Verification remains deferred to Part H.
- Agent 1 Part A source batch and Agent 2 Part B schema/runtime handoff are accepted and integrated. Do not claim runtime/browser verification or automated tests passed.

## 24. Head Agent directive — Agent 3 Part C Studio runtime authorization (2026-11-17)

- **Agent 3 / Part C runtime: IN PROGRESS — implementation authorized.**
- Backend/API/migration batch is already integrated on main through PR #47. Parts A and B are integrated through PRs #50 and #51. Agent 3 must now fetch latest main and read this complete control document, the master plan, and `docs/PUCK_DESIGN_LAB.md` before coding.
- Exclusive Agent 3 runtime file ownership is granted for this batch:
  1. `client/src/components/layout/StudioLayout.tsx`
  2. `client/src/components/layout/Header.tsx`
  3. `client/src/components/layout/SplitPane.tsx`
  4. `client/src/components/editor/PropertyPanel.tsx`
  5. `client/src/pages/DesignLabPage.tsx`
  6. `client/src/hooks/usePublishedAppLayout.ts` (new file; create only if absent)
  7. `client/src/utils/appLayoutApi.ts` (new file; create only if absent)
  8. `client/src/components/design/PublishAppLayoutControl.tsx` (new file; create only if absent)
  9. `client/src/styles/appLayoutRuntime.css` (new file; create only if absent)
- If an authorized new-file path already exists, do not overwrite it; report the existing implementation and use it if appropriate. Do not create additional files or edit any other shared/global CSS, theme configuration, Puck schema/config, backend route, repository, migration, Agent 4 file, or docs control file without further Head Agent approval.
- Runtime requirements:
  - Fetch the published pair from the existing GET `/app-layout` endpoint and resolve it through the approved Part B schema/default utilities.
  - Keep Desktop and Mobile documents independent; select the appropriate resolved layout at runtime using a responsive media query with proper cleanup.
  - Apply supported settings to actual production header, editor/preview split, inspector, panel order/surfaces/padding/radius/labels, mobile editor/preview pane and bottom navigation.
  - Use the CSS variables already emitted by `getAppLayoutCssVariables()`, including the Mobile Editor/Preview padding variables. Do not execute arbitrary CSS/HTML/JS from documents.
  - Preserve built-in defaults and current Studio behavior if the API fails, returns missing/invalid data, or the user is offline.
  - Refresh at controlled lifecycle points; no polling loop. Avoid resetting unsaved editor/message state on refresh.
  - Keep local Design Lab drafts distinct from published server state. Add owner-only publish UI using the existing PUT `/app-layout` endpoint; authorization must remain server-enforced. Non-owners may edit local drafts but must not see or invoke a successful publish path.
  - Validate both documents before publish, clearly show draft/published state, loading, validation/API errors and actual success response; no optimistic success.
  - Preserve Discord-native message preview rendering, existing dispatch/auth/navigation, accessibility, keyboard focus, reduced-motion behavior and mobile layout.
  - Add focused regression tests for API fallback, responsive selection/application, owner-only publishing UI behavior and refresh/state preservation where existing test conventions allow.
- Before first edit, record the exact files claimed in Agent 3's section of `docs/AGENTS.md`. Re-fetch this file before each batch and before committing. Work only on `agent/layout-publishing`; never commit to main, merge, rebase or force-push.
- Automated npm checks remain deferred. Tests may be added but must not be run. Mark the runtime batch REVIEW REQUIRED when submitted.

## 25. Current agent status after Parts A/B integration

- Agent 1 / Part A: **COMPLETED — source reviewed and integrated**. Final automated/browser verification remains part H.
- Agent 2 / Part B: **COMPLETED — schema/runtime handoff approved and integrated**. Final automated/browser verification remains part H.
- Agent 3 / Part C: **IN PROGRESS — runtime implementation authorized under Directive 024**. Backend/API/migration batch already integrated.
- Agent 4 / Part D: **BLOCKED — not authorized**. Part E: **COMPLETED — source reviewed and integrated**. Do not start Part D until Agent 3 runtime is integrated and Head Agent provides a separate exact file authorization.
- Head Agent owns Parts F, G and H. Do not run npm verification until the complete implementation program is ready for final verification.


## 26. Head Agent review — Agent 3 Part C Studio runtime (2026-11-17)

- **Branch reviewed:** `agent/layout-publishing`, submitted HEAD `12181bedb6ae82f3a48afbed6d3f942107fe17ad`.
- The branch comparison against main is diverged (39 commits ahead / 83 behind at review time). The comparison includes the previously integrated Part C backend batch and the submitted runtime batch. Do not merge the branch wholesale. Head Agent will selectively integrate only explicitly accepted files onto current main and preserve this control document.
- **Runtime source review:** The nine authorized runtime files were inspected. No source-level blocker was found in the API request shape, use of the public GET /api/design/app-layout and owner-only PUT endpoint, Desktop/Mobile resolution, fallback behavior, controlled refresh, owner-gated Design Lab UI, draft separation, or the production Studio wiring. The footer-toolbar selector was checked against the existing MessageEditor DOM and targets its footer action bar, not message content or preview controls.
- The implementation consumes `resolveAppLayoutData()` and `getAppLayoutCssVariables()` from the current Part B utility on main. During selective integration, do not copy the stale branch copy of any shared utility; use the current main version, which includes the Mobile Editor/Preview padding variables.
- **Decision:** Runtime implementation is **SOURCE REVIEW ACCEPTED — REGRESSION TESTS REQUIRED**. This is not merge approval or Part C completion. No npm checks, browser QA, or deployment verification were run.
- The agent did not add client regression tests because test paths were not in Directive 024. The Head Agent now grants exclusive test-file ownership on `agent/layout-publishing` for this follow-up batch:
  1. `client/src/hooks/__tests__/usePublishedAppLayout.test.tsx` (new)
  2. `client/src/utils/__tests__/appLayoutApi.test.ts` (new)
  3. `client/src/components/design/__tests__/PublishAppLayoutControl.test.tsx` (new)
- Add focused Vitest tests using existing repository conventions for: built-in fallback on missing/failed/invalid API data; responsive Desktop/Mobile selection and listener cleanup; preserving last valid published state across failed refresh; credentialed GET/PUT request contract and validation; owner-only publish UI; both-document validation; and server-confirmed success/error behavior. Mock network and browser confirmation; do not make live requests.
- Do not modify any existing source file or any path outside the three authorized test paths, except for updating only Agent 3's own status section in `docs/AGENTS.md` to record the exact test-file claim and final report. Re-fetch the latest main control document before editing and before committing. The Head Agent will exclude the branch copy of `docs/AGENTS.md` during selective integration. Work only on `agent/layout-publishing`; no merge/rebase/force-push and no npm test/typecheck/build. Mark the test batch REVIEW REQUIRED and report exact changed paths and commit SHA.
- Agent 3 Part C remains **REVIEW REQUIRED** until the tests are source-reviewed and the nine runtime files plus accepted tests are selectively integrated. Agent 4 Part D remains blocked until Part C integration is complete and separate exact authorization is issued.
