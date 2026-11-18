# CURRENT AUTHORITATIVE SNAPSHOT — 2026-11-18

> This snapshot supersedes conflicting status statements in the historical handoff below. Historical entries are retained for decision/commit context; current `main` and this snapshot take precedence.

## Repository state
- Repository: `no-peace/Hoho_manager`; authoritative branch: `main`.
- Implementation source head audited: `65878192c036ae8a35d1e1c03d37b5ce92173d85` — `feat(studio): integrate responsive runtime and security hardening`.
- Documentation-only reconciliation commits were then added for this handoff, `docs/AGENTS.md` and this master plan; the latest repository HEAD is the newest documentation commit in `git log` (the handoff update itself creates a new documentation commit).
- Recursive Git tree: 418 entries, 356 files and 62 directories (not truncated): client 159, server 133, bot 23, shared 10, docs 7, remainder root/infrastructure.
- Last checked: only `main` branch remains and no PRs are open. The owner manually deleted the former working branches.
- GitHub Actions are intentionally disabled by the owner. Do not enable them or treat absent workflow runs as a code defect.
- No npm checks, browser QA, Lighthouse run, or deployment verification was performed for this snapshot.

## Current implementation status (verified against current source)

### Part A — UI and preview/editor
- V12 login atmosphere/public header and reduced-motion canvas behavior are present.
- Preview/editor routing covers classic messages, embeds, action rows and nested Components V2; mobile message quick-edit and component inspector flows are present.
- FlowBuilder labels and Server Bot terminology are updated.
- Classic/Components V2 conversion uses conservative compatibility checks; it is not a universal lossless converter for future component types.
- Discord button labels intentionally do not support variable insertion.
- Guest Sandbox is not implemented. Local Developer login is development-only; do not invent a production guest login.

### Part B — Responsive Design Lab
- Puck has independent Desktop and Mobile documents, separate drafts, protected shell components, versioned `hoho-app-layout.json` import/export, validation and a representative preview.
- The preview intentionally does not mount a second live Studio instance.
- Controls cover supported header, workspace/panel, sizing, labels, surfaces, padding, radius, toolbar, motion, mobile pane and navigation settings.
- Local draft state is distinct from server-published state.

### Part C — Publishing and live runtime (integrated on main)
- Migration/table, repository, server-side responsive-pair validation, public read endpoint and owner-only publish endpoint exist.
- Desktop and Mobile are validated together and persisted as one pair in a database transaction. Publisher identity comes from the verified session, not the request body.
- Client API, publish control, published-layout hook and runtime CSS are integrated into the actual Studio.
- Runtime consumes supported values for header, split pane, panel order/size/surfaces/padding/radius, labels, toolbar visibility, inspector, mobile default pane/navigation and motion; missing/invalid published data falls back to built-in defaults.
- Source tests exist: `server/tests/appLayoutPublishing.test.ts`, `client/src/hooks/__tests__/usePublishedAppLayout.test.tsx`, `client/src/utils/__tests__/puckAppLayout.test.ts`, `client/src/utils/__tests__/appLayoutApi.test.ts`, `client/src/components/design/__tests__/PublishAppLayoutControl.test.tsx`.
- **Correction:** the dedicated server publishing test file exists on current main. The previous pre-check claim that it was missing was incorrect.
- Tests are authored but were not executed for this snapshot.

### Parts D/E — Themes, Docs and Settings
- Guest/authenticated active-theme cache paths, per-user isolation, theme editor error handling, scoped theme CSS, responsive Docs, Settings focus/checkbox behavior and server-theme publishing permissions exist.
- Server-theme publish permission is distinct from app-layout publish permission: owner and explicitly delegated `can_publish_server_theme` users may publish themes; Design Lab access alone is insufficient. The server enforces this on mutation.
- Private presets are separate from active-theme cache expiry; portable `.hoho-theme.json` import/export exists.

## Repository-wide audit findings and limits

The recursive repository inventory, project plans/control docs, root/workspace manifests, and representative critical source/test paths across client, server, bot and shared were inspected. **A literal line-by-line audit of all 356 files is not complete.** Do not claim the whole repository has passed a complete audit. Continue with a file ledger and mark each tracked file reviewed, not applicable, or pending.

### Confirmed limitations / incomplete product scope
1. **Webhook URL sending is deliberately disabled.** `server/src/actions/sendWebhookMessage.ts` is retained only to fail old saved flows clearly; `server/src/routes/send.ts` rejects a non-empty `webhookUrl`. This is an explicit deprecation, not an active half-built sender. Do not re-enable without a separate approved secure design.
2. **Custom bot-profile dispatch is disabled end-to-end in the main send route.** `server/src/routes/send.ts` rejects `profileId` and uses the configured server bot. Profile storage/resolution elsewhere does not mean multi-profile dispatch is available.
3. **Sender username/avatar overrides are unsupported.** The send route strips legacy `username` and `avatar_url` fields before dispatch.
4. **Puck `MobileBottomNavigation.activeTab` is preview state, not live selected-pane state.** Puck's sample uses it to illustrate the highlighted tab. The actual Studio selected tab is interactive state in `StudioLayout.mobileView`; the resolved `activeTab` value has no live runtime consumer. Keep it explicitly preview-only or remove it from the production resolved model in a dedicated cleanup. Do not force the user's selected pane during layout refresh.
5. **Action failure classification is coupled to presentation text.** `server/src/services/actionExecutor.ts` detects failures by checking whether response content starts with the warning emoji. Consider structured outcomes in a separate compatibility-safe batch.
6. **Interaction ACK/defer logic needs executed integration verification.** `interactionHandler.ts` uses a 2,200 ms deadline, deferred response handling and a 30-second safeguard. This is designed around Discord's 3-second deadline, but duplicate-delivery, timeout races, webhook delivery and gateway relay still need executed integration tests.

### Security controls observed (source review only; not certification)
- URL attachments reject private/reserved IPv4/IPv6, resolve DNS and pin the validated address to avoid DNS-rebinding, and enforce 25 MiB/file, 50 MiB aggregate and 10-file limits.
- Send route checks staff permissions, channel/guild restrictions, attachment permissions, WEAO/Components V2 permissions and revalidates payloads after interpolation.
- Webhook interactions verify Discord signatures; gateway relay uses the admin key and validates required fields.
- Guild placeholders use Guild/Preview resources and approximate counts; they do not imply access to separate full member lists, bans or audit logs.
- No penetration test or production-configuration audit was performed.

## Remaining work — ordered

### P0: complete the actual repository audit
- Build the 356-file audit ledger across root/infrastructure, client (159), server (133), bot (23), shared (10), docs (7), tests and assets.
- Trace routes, action handlers, bot commands/listeners, migrations/repositories, auth/session, external requests and cross-package types/callers.
- Reconcile `docs/AGENTS.md`: its older agent statuses/directives still say Part C is blocked and describe branches that have since been merged/deleted. Those directives are historical, not current.
- Reconcile master-plan status and all old handoff claims with current main.

### P1: resolve remaining feature questions
- Decide whether `activeTab` remains explicitly preview-only or is removed from the production resolved model.
- Decide whether custom bot-profile dispatch and sender identity overrides are intentionally out of scope or should be restored through separately designed features.
- Keep webhook URL sending disabled unless explicitly re-authorized.
- Consider structured action execution outcomes and add/execute timeout/deferred/duplicate interaction tests.

### P2: verification
- The owner will run checks locally; do not run them as part of this documentation update.
- When requested, run separately from repository root: `npm run typecheck`, `npm test`, `npm run build`.
- Browser QA remains pending at 1440, 1200, 768, 390 and 320 px for login/auth, Studio editor/preview/inspector, dispatch, themes, Design Lab, import/export, publishing, Docs and Settings.
- Preserve the owner-reported mobile Lighthouse Performance baseline of 97; no speculative optimization.
- Production deployment and live database migration status are unconfirmed.

## Audit ledger status
| Area | Inventory | Source review | Status |
|---|---:|---|---|
| Root manifests/scripts/README | Enumerated | Selected files reviewed | Partial |
| Docs/control files | 7 files | Master plan, handoff, AGENTS reviewed | Reconciliation needed |
| Client | 159 files | Critical runtime, Design Lab, API and selected UI/tests reviewed | Partial |
| Server | 133 files | Design, layout validation/repository/tests, auth, send, interaction, attachment/action paths reviewed | Partial |
| Bot | 23 files | Startup/relay/API representative files reviewed | Partial |
| Shared | 10 files | Inventory only | Pending |
| Assets/deployment/CI | Enumerated | Inventory only | Pending |
| Full caller/cross-reference audit | Not complete | Not complete | Pending |
| npm/browser/Lighthouse/deployment verification | Not run | Not run | Pending |

**Do not mark the overall repository audit complete until every tracked file has a ledger disposition and every confirmed finding is fixed or explicitly accepted/deferred.**

---

## Historical handoff (retained below)
Older entries preserve implementation history and owner decisions. If any historical status conflicts with this snapshot or current main, this snapshot/current source wins.

---

## Batch C — responsive Studio layout editor (committed)

- Replaced the old generic marketing-page Puck starter with two independent Puck documents: Desktop and Mobile. Each mode has its own editor viewport and local draft.
- Starter values are mapped from the existing Studio source: 56 px header, desktop 50/50 editor/preview split, 440 px inspector overlay, mobile Editor default pane, 60 px bottom navigation, and the existing editor/preview/inspector surfaces.
- The preview models the real Studio shell and its Editor, Live Preview, Inspector and navigation regions. It intentionally uses representative panel content rather than mounting a second live Studio instance inside Puck; duplicating the message editor, preview, store subscriptions and event handlers would increase CPU/memory use and risk changing the user's live message state while editing. Batch D connects the same layout values to the real application shell.
- Puck 0.24 integration uses `renderFields`, `FieldTab`, `FieldGroup variant="card"`, allowlisted slot fields, fixed component permissions, static DnD, a 1440 px Desktop viewport, a 390 px Mobile viewport, and explicit iframe style synchronization.
- Desktop controls include header sizing/colors, editor ratio, panel order, inspector width/side, workspace gap, per-panel surfaces/padding/radius, and safe motion presets. Mobile controls include header sizing/colors, default pane, workspace spacing, optional inspector bottom-sheet preview, tab order, bottom-nav dimensions/colors/labels, and motion.
- The fixed shell cannot be deleted, duplicated, inserted or dragged. The panel order and dimensions are controlled through fields so critical message/editor/preview/dispatch controls are not accidentally removed.
- Local draft writes are debounced by 450 ms and keyed per signed-in user. Export/import uses a versioned `hoho-app-layout.json` file containing both responsive documents. Client validation checks the required shell regions, panel set, component allowlist and unique IDs.
- Error recovery now preserves both private theme-library records and the new app-layout draft keys.
- The editor page uses Puck's documented `iframe.syncHostStyles` and `waitForStyles` options so the canvas receives the same layout styles without an unstyled flash.
- Added `puckAppLayout.test.ts` for current defaults, independent desktop/mobile state, safe value clamping, malformed/duplicate document rejection, optional Puck root props, and per-user draft persistence. Tests are authored but not executed in this environment.
- **Not yet complete:** no production layout API or database migration exists in this batch; the editor saves local drafts and exports files. Batch D must add owner-only atomic publishing and wire the resolved values into the real Studio header, split pane, inspector and mobile navigation.
- **Batch C commit:** `9fa2eabd55919758ea4b5d15bc9e2379ef24a983` — [view commit](https://github.com/no-peace/Hoho_manager/commit/9fa2eabd55919758ea4b5d15bc9e2379ef24a983). GitHub compare confirms 10 files changed.
- Files in this batch: `client/src/pages/DesignLabPage.tsx`, `client/src/config/puck/appLayoutConfig.tsx`, `client/src/config/puck/defaultAppLayouts.ts`, `client/src/utils/puckAppLayout.ts`, `client/src/pages/app-layout-preview.css`, `client/src/pages/layout-lab.css`, `client/src/components/ui/ErrorBoundary.tsx`, `client/src/utils/__tests__/puckAppLayout.test.ts`, `docs/PUCK_DESIGN_LAB.md`, and this handoff.
- Verification remains source/static review only. The local Terminal MCP endpoint is still unavailable (404); do not claim npm or browser checks passed on these changes.

## Current repair program — batch ledger (2026-11-17)

- **Verified baseline:** `c3cd6ad78ab7275bf786431b64db76ffe3c72903`.
- **Plan commit:** `0dbc926cccfde0d3b316deec9095d51766029a7a`; plan: `docs/REPOSITORY_AUDIT_EXECUTION_PLAN.md`.
- **Batch B implementation commit:** `a6072fd6675ca233dbc4970890c66d8542989b3d` — [view commit](https://github.com/no-peace/Hoho_manager/commit/a6072fd6675ca233dbc4970890c66d8542989b3d).
- **Batch A — complete:** pinned the main baseline, enumerated 321 tracked files, mapped the current theme/design architecture, reviewed Puck 0.24 API surfaces, and documented the full batch plan. The audit itself remains incomplete.
- **Batch B — committed:** theme application now has a guest-safe local cache path as well as the authenticated-user path; modal loading no longer treats a failed optional community-gallery request as failure of the whole theme editor; live theme tokens cover more actual Studio surface classes and preserve intentional accent opacity variants; the Theme button now exposes dialog semantics and a visible lazy-load fallback; Docs has scoped layout CSS and a constrained desktop table with the existing mobile-card view retained; General Settings no longer has a no-op single-tab button and checkbox focus styling applies to both checked and unchecked states; added focused theme token/cache tests.
- **Batch B files:** `client/src/App.tsx`, `client/src/components/layout/Header.tsx`, `client/src/components/layout/ThemeSettingsModal.tsx`, `client/src/components/layout/SettingsModal.tsx`, `client/src/config/puck/publishedTheme.css`, `client/src/pages/DocsPage.tsx`, `client/src/pages/docs-page.css`, and `client/src/utils/__tests__/puckTheme.test.ts`.
- **Theme behavior detail:** guest selection is stored under the separate `guest` cache key and restored at app startup; authenticated users retain per-user cache isolation. Server theme remains the fallback. Community gallery CRUD still requires authentication. Private theme preset files remain independent portable backups.
- **Docs behavior detail:** the existing responsive split is preserved (desktop horizontally scrollable table, mobile cards). The new scoped CSS does not touch public route styles outside Docs. The published-theme CSS is scoped to `.hoho-studio-shell`; Docs is not supposed to inherit those selectors.
- **Settings behavior detail:** General is the only current tab, so it is rendered as a selected tab rather than a button with a no-op handler. Event rows keep a stable surface; the custom checkbox indicator alone changes checked state and receives a visible keyboard focus ring.
- **Verification:** compare confirms exactly nine files changed in the Batch B commit. No npm commands or browser visual checks were run in this batch because the connected local Terminal service returned an unavailable/404 response. The user reported that the earlier `npm run typecheck`, `npm test`, and `npm run build` all passed before these new changes; those earlier results do not verify this batch. Rerun all checks after implementation.
- **Still outstanding:** Batch C onward (real responsive Studio Puck editor, atomic DB publishing and runtime application, preset durability audit, performance/security work, full repository audit, and final verification). The Design Lab still uses the separate promotional page builder at this point.
- **Important process rule:** only commits on `main` count as implementation. This handoff was synchronized to Batch C commit `9fa2eabd...`.


# HoHo Manager — Current Gemini Handoff & Repair Plan

## Latest main status — Preview/editor navigation repair (2026-11-17)

This section supersedes older preview-routing and editor-scroll descriptions below.

- **Latest code commit:** `97d38f0e7da375c656b29b7fcf4a99bebbcc9cfe`.
- **Implementation plan and acceptance criteria:** [`docs/PREVIEW_EDITOR_NAVIGATION_REPAIR_PLAN.md`](PREVIEW_EDITOR_NAVIGATION_REPAIR_PLAN.md), documented in commit `618e8f95703229a76d6a478777bea325cd419452`.
- **Preview selection:** Embed author/title/description/fields/images/footer/timestamp regions now identify their owning embed. Nested Components V2 items resolve to their nearest component. Classic/V2 action rows, Section thumbnails, and disabled preview controls are selectable.
- **Desktop:** Component and embed selections open the inspector and navigate the left editor to the matching editor target. Embed sub-parts can navigate to the matching author/body/field/image/footer editor section.
- **Mobile/tablet:** Component and embed clicks keep Preview active and open the relevant inspector sheet. **Open Full Editor** and manual Editor-pane navigation wait for the pane to become active, then scroll to the selected target.
- **Scroll behavior:** Lenis is limited to fine-pointer, motion-enabled contexts. Touch and reduced-motion paths use the editor wrapper's native scroll position. Hidden/inert panes are not scrolled; collapsed message cards are expanded by preview selection.
- **Mobile gesture fix:** Swipes starting on buttons, links, inputs, or other interactive controls no longer switch panes; touch cancellation clears gesture state.
- **Regression coverage added:** Embed author/footer click routing, nested V2 selection, embed inspector rendering, collapsed message expansion, touch/reduced-motion scrolling, hidden-pane deferral, and exact footer-section navigation.
- **Verification:** These tests, client typecheck, and production build have **not** been run. The desktop terminal MCP endpoint returned HTTP 404, and GitHub returned no commit statuses or workflow runs. Browser QA and Lighthouse are also pending. Do not mark these checks as passing.
- **Run when a terminal is available:** `npm test`, `npm run typecheck`, and `npm run build` from the repository root (optionally repeat the client-only commands with `--workspace client`) , followed by desktop/mobile browser QA.

## Current main status — V12 audit follow-up (2026-11-17)

This section supersedes older branch/PR status statements in the historical notes below.

- **Latest code source commit:** `e1fe1b3bb177d9b34e3c5b4d1f36e06990e18eb8`.
- **Direct-to-main follow-up commits:** FlowBuilder polish (`89e70bec0b385a40bec244310b740ad2d3ac7c6b`, followed by unused-import cleanup `07d0cb4bb4b01dda7cff4082e3c4af0044a2aec9`); icon-button transition cleanup (`c3c024203ad2d3dd66e1797852a363c79a405178`); LoginScreen active-public-navigation regression assertion (`e1fe1b3bb177d9b34e3c5b4d1f36e06990e18eb8`).
- **FlowBuilder:** Added the Interaction Flow / Trigger Event header, derives Button Click versus Select Option from the component type, restores the Server Bot mode wording, and uses the current studio palette. The existing implementation persists changes immediately; it has no separate unsaved-draft/save lifecycle, so no misleading unsaved-changes banner or nonfunctional Save button was introduced.
- **StepList:** No structural rewrite was made. Its `#313338` surfaces are confined to the Discord modal mock preview and intentionally preserve Discord's native preview appearance rather than representing a studio shell surface.
- **Motion:** `UI_THEME_CONFIG.button.iconButtonBase` no longer transitions `border-color`; the shared base and icon-button transition lists are now aligned.
- **Login regression test:** Added checks that the public navigation renders and that Studio is marked as the current page, alongside the existing backdrop, grid, 5/7 layout, and Discord OAuth assertions.
- **Guest Sandbox discrepancy:** The V12 plan asks for a Guest Sandbox CTA, but the current LoginScreen has no guest-authentication handler or Guest Sandbox control. It exposes a development-only `Continue as Local Developer` button instead. No speculative guest login path was added.
- **Verification:** GitHub returned no commit statuses and no workflow runs for source head `e1fe1b3bb177d9b34e3c5b4d1f36e06990e18eb8`. The connected desktop terminal endpoint returned HTTP 404, so `npm test`, `npm run typecheck`, and `npm run build` could not be executed here. Browser QA and Lighthouse were not run. Do not mark these checks as passing.
- **Next verification:** Run `npm test`, `npm run typecheck`, and `npm run build` from the repository root, then perform desktop/mobile browser QA. Preserve the owner-reported mobile Lighthouse 97 baseline; do not initiate further performance tuning unless requested.

**Updated:** 2026-11-17 (V12 baseline retained at mobile Lighthouse 97; server placeholders merged into main)  
**Repository:** https://github.com/no-peace/Hoho_manager  
**Production URL:** https://hoho-manager.onrender.com  
**Authoritative branch:** `main`  
**Latest implementation head:** `97d38f0e7da375c656b29b7fcf4a99bebbcc9cfe`  
**Latest related PRs:** [#45 — server guild placeholders](https://github.com/no-peace/Hoho_manager/pull/45) (merged); V12 UX baseline: [#44](https://github.com/no-peace/Hoho_manager/pull/44)  
**Implementation branch:** `feat/v12-ultimate-ux-implementation` (merged into `main`)  
**Current status:** V12 is merged. The owner subsequently reported that all tests passed and the mobile Lighthouse Performance score reached 97. The owner explicitly chose to keep 97 as the baseline and stop further performance tuning. Do not initiate additional Lighthouse-driven optimization or refactoring unless the owner asks. The test result is owner-reported; it was not independently executed in this GitHub editing session. No deployment is claimed.

## Latest continuation — expanded Discord server placeholders (2026-11-17)

**Branch:** `feat/server-guild-variables`  
**Pull request:** [#45 — expose Discord Guild fields as server placeholders](https://github.com/no-peace/Hoho_manager/pull/45) (merged into `main`)  
**Base:** `main` at the V12 merge checkpoint plus the subsequent handoff documentation update.  
**Status:** Merged into `main` as commit `2608ab8f93bde889b9abf4ba0c91b8e409337e9c`. The follow-up TypeScript compatibility fix was committed directly to `main` as `f52f712343cd42aeddee4be820f842c5751ee689`. Deployment is not confirmed.

### Owner request and scope

The owner asked for a `{server.id}`-style autocomplete namespace that exposes as much server data as Discord's API allows. This implementation targets the Discord **Guild resource** returned by `GET /guilds/{guild.id}?with_counts=true`. It does not claim to expose every separate Discord API endpoint. Channels, complete member lists, bans, integrations, audit logs, and similar resources have separate routes and permission/intent requirements and are outside this change.

### Implementation

- Added `server/src/services/discordService.ts:getGuild()` to fetch the full Guild resource with `with_counts=true`.
- Added a 60-second per-guild cache, in-flight request deduplication, and a 500-entry bound to avoid repeatedly requesting unchanged guild data for each action.
- Added `server/src/services/guildVariables.ts` to flatten the returned Guild object into string placeholders:
  - Scalar values become `{server.<field>}`.
  - Nested object values are JSON-serialized and their nested properties are also exposed with dot notation (for example `{server.incidents_data.invites_disabled_until}`).
  - Arrays are JSON-serialized when they contain objects; their entries are addressable by numeric index (for example `{server.roles.0.name}`). Primitive arrays such as `features` become comma-separated strings.
  - Null optional fields resolve to an empty string.
  - Existing `{server.icon}` behavior is preserved as a CDN URL. The raw hash is available as `{server.icon_hash}`; URL aliases are provided for icon, banner, splash, and discovery splash. Animated hashes use GIF URLs.
- Updated `server/src/services/actionExecutor.ts` to enrich the action variable dictionary from the current Guild resource. If the full Guild lookup fails, the previous lightweight bot-guild lookup remains as a fallback for `{server.name}` and `{server.icon}`; `{server.id}` always comes from the interaction payload. The action is not failed solely because Guild enrichment fails.
- Expanded the shared variable suggestions in `client/src/components/ui/Field.tsx` and the Studio `MentionInput` so typing `{server.` shows the new fields. Increased the result cap to 50 so the expanded server list is not silently truncated.
- Expanded the `/docs` variable reference with the Guild fields and examples.
- Added `server/tests/guildVariables.test.ts` for scalar fields, animated CDN URLs, JSON arrays, indexed nested fields, nested object fields, and null handling.

### Discord API availability caveats

- `approximate_member_count` and `approximate_presence_count` are requested with `with_counts=true`; they are approximate counts, not exact member/presence totals.
- Some Guild fields are optional, null, feature-dependent, or omitted by Discord. An absent/null value resolves to an empty string.
- The bot must be in the server and Discord must authorize the bot's Guild request. If the lookup fails, the additional `{server.*}` values will remain unresolved; existing `{server.id}` remains available from the interaction payload.
- This does not bypass privileged intents or permissions. Full member lists and other separate resources are not implicitly included by the Guild endpoint.
- `{server.icon}` remains a URL for backwards compatibility rather than changing to Discord's raw icon hash. Use `{server.icon_hash}` for the raw hash.

### Files changed

- `server/src/services/discordService.ts`
- `server/src/services/actionExecutor.ts`
- `server/src/services/guildVariables.ts` (new)
- `server/tests/guildVariables.test.ts` (new)
- `client/src/components/ui/Field.tsx`
- `client/src/components/editor/MentionInput/index.tsx`
- `client/src/pages/DocsPage.tsx`

### Verification status

- GitHub source re-fetch checks confirmed the Guild fetch, action-executor enrichment, expanded Field and editor suggestion limits, documentation entries, and helper test file are present on the feature branch.
- The new Vitest file has been authored but **has not been executed** in this GitHub editing session.
- TypeScript typecheck, full test suite, production build, and browser autocomplete/runtime checks have **not** been executed. Do not describe this change as tested or verified at runtime until those checks run.
- No merge or deployment has been performed.
- The owner's previously stated mobile Lighthouse 97 baseline remains unchanged; do not reopen Lighthouse optimization as part of this feature.

---

## Latest continuation — V12 finalization and verified owner feedback (2026-11-17)

### Merge record

- Pull request: [#44 — v12: atmospheric login, preview interactions, and UX fixes](https://github.com/no-peace/Hoho_manager/pull/44)
- Source branch: `feat/v12-ultimate-ux-implementation`
- Target branch: `main`
- PR state: closed and merged.
- Merge commit on `main`: `97e3a6f8806687f17d252587dee1af38c99e3c43`
- PR head immediately before merge: `5711cb837c612d845b2d08feb3a39340709b4f26`
- Merge strategy: squash merge.
- The owner explicitly requested the merge and stated they would run the tests afterward.

### Owner-reported verification

- The owner reported: **“all test passed mobile lighthouse went to 97 but lets just keep it there”**.
- Record this as owner-reported successful test execution; do not imply that the assistant independently ran the test suite.
- Mobile Lighthouse Performance: **97** (owner-reported).
- The owner decided to retain this result as the stable baseline. No further score chasing, speculative optimization, or performance refactoring is authorized by that instruction.
- The earlier pre-merge environment limitation remains historically accurate: the assistant did not run Vitest, typecheck, production build, browser QA, or Lighthouse itself during the GitHub-only implementation session. The later owner report supersedes the pending-verification status for the owner's own test run, but it does not establish which individual commands or browser checks were run.
- No deployment action or production verification is recorded here.

### V12 scope merged

- Login atmosphere: constellation/wave canvas, CSS aurora/grid backdrop, glass surfaces, and flush public header.
- Preview interaction routing: bubble-phase component routing, Select Menu interaction handling, and removal of duplicate selection handlers.
- Mobile quick edit: selected-message index synchronization, Components V2 TextDisplay editing/creation, and an Open Full Editor action.
- FlowBuilder palette and Server Bot wording updates.
- Surface cleanup across thread inputs, helper callouts, component add controls, Header/Sidebar, and HTML theme.
- Responsive typography migration: shared theme and V12-touched typography converted from px arbitrary classes to rem; `DESIGN.md` documents the unit policy. This was not a repository-wide typography migration.
- Mobile rendering safeguards: decorative canvas and automatic showcase rotation are skipped on narrow/reduced-motion sessions; mobile blur was reduced.
- Auth bootstrap: removed the redundant `/api/health` request; initial session resolution uses `/api/auth/me`.
- Vite chunking: removed the forced global Lucide icon chunk to allow route-specific icon splitting.
- Regression tests were added for the login atmosphere/layout, Select Menu preview interaction, and selected-message V2 TextDisplay editing.

### Operating decision / next-session instructions

1. Treat `97e3a6f8806687f17d252587dee1af38c99e3c43` as the V12 merge checkpoint on `main`.
2. Do not reopen V12 performance work merely to improve Lighthouse beyond 97. The owner explicitly said to keep it there.
3. Do not claim assistant-run test/build/browser verification. The all-tests-passed statement is attributed to the owner.
4. For any new task, inspect the current `main` head and relevant source before editing; do not assume the repository has remained unchanged since this checkpoint.
5. Continue making requested code changes directly through the GitHub integration. The owner does not want instructions that require manually writing code.
6. Do not merge or deploy future changes without explicit authorization.

---

## Latest continuation — November 16 Lighthouse review and branded loading screen

**Repository:** `no-peace/Hoho_manager`  
**Branch:** `main`  
**Implementation commits (in order):**
- `2f72614daaf5919a415aaec2fc36f30a2c2bd599` — branded React loading fallback
- `fb31dd7e7a7db325d895075e55870d3212d7c0b9` — loading-screen styling
- `4df9a57a7a6c5bbaea2297a11057a074d2025b71` — static first-paint loading splash in HTML
- `f0f464976acfa6e3e15dbde9939c985b93e6ed32` — semantic main landmark on Privacy page

### Lighthouse reports reviewed

The user supplied five PDF reports in the conversation: desktop Navigation, desktop Snapshot, desktop Timespan, mobile Navigation, and mobile Snapshot. The mobile Timespan PDF was not present, so no conclusions are recorded for it. These captures are local Lighthouse runs against `http://127.0.0.1:4173/`, dated 2026-11-16; they are not production-site measurements.

**Navigation mode — homepage**
| Metric | Earlier mobile baseline | New mobile | New desktop |
|---|---:|---:|---:|
| Performance | 94 | 97 | 100 |
| Accessibility | 96 | 100 | 100 |
| Best Practices | 100 | 100 | 100 |
| SEO | 100 | 100 | 100 |
| FCP | 2.0 s | 2.0 s | 0.5 s |
| LCP | 2.8 s | 2.3 s | 0.6 s |
| TBT | 32 ms | 30 ms | 0 ms |
| CLS | 0.0035 | 0.007 | 0.002 |

Interpretation: mobile Performance improved by 3 points and LCP by 0.5 s; Accessibility reached 100 on both Navigation runs. CLS remains very low; mobile CLS increased slightly versus the earlier capture. The earlier four lavender/white contrast failures are no longer reported as Navigation accessibility failures.

**Snapshot mode — separate audit state**
- Desktop Snapshot: Accessibility 24/24.
- Mobile Snapshot: Accessibility 17/18; report is a separate `/privacy` page snapshot, not the homepage Navigation run. The report also called out the lack of a main landmark as a manual accessibility check. The Privacy page was updated to wrap its page content in `<main id="main-content">`, after its public header.
- Do not conflate Snapshot audit counts with Navigation Lighthouse category scores. Re-run the mobile Snapshot to verify the landmark improvement and identify the remaining 17/18 issue from a fresh report.

**Desktop Timespan mode**
- Report recorded 22/23 Performance checks, 90 ms TBT, 50 ms INP, and 0.036 CLS.
- It also recorded approximately 2.2 s main-thread work, one 135 ms long task, and a non-composited animation involving a button color/border-color transition.
- Lighthouse warned that a page navigation occurred during the Timespan run and that this mode is not recommended for auditing page navigations. Do not compare this score/CLS directly with Navigation mode. The mobile Timespan report was not supplied.
- The trace did not provide sufficient reliable evidence to identify a specific button transition safely. Do not remove transitions globally based on this one navigation-contaminated run; repeat a clean interaction-only Timespan trace and inspect the exact affected element first.

### Remaining performance observation

The Navigation reports show a smaller remaining render-blocking request from the app's local CSS (roughly 50 ms desktop / 160 ms mobile in the reviewed captures; Lighthouse estimated about 150 ms potential mobile savings). The app imports its global Tailwind stylesheet from `client/src/main.tsx`, and Vite emits/loads the production CSS asset. Do not blindly make this stylesheet asynchronous: it contains the initial layout and theme rules, and deferring it can cause a flash of unstyled content and layout shift. Reassess with the generated production asset and a fresh Navigation trace before changing CSS delivery.
### Branded loading-screen implementation

The user reported that the app initially displayed a blank screen and requested the existing HoHo logo centered in the loading state.

Implemented:
- `client/index.html`: the initially empty `#root` now contains a small static first-paint splash using `/hoho_logo.svg`, centered on the existing dark background. Inline critical styles keep the splash visible before the React bundle executes. React's `createRoot` render replaces this static markup when the app mounts.
- `client/src/App.tsx`: introduced a reusable `AppLoadingScreen` and used it for all React Suspense fallbacks that previously rendered `null`. The auth-loading state uses the same branded screen with the status text “Verifying Discord session…”.
- `client/src/styles/globals.css`: added a centered logo treatment, subtle indigo halo, restrained breathing animation, animated three-dot indicator, and `prefers-reduced-motion` handling. No external image or new dependency was added.
- `client/src/pages/PrivacyPage.tsx`: added the semantic main landmark identified in the mobile Snapshot review.

### Validation status and next actions

Source-level checks were performed while editing: each target file was re-fetched from GitHub before update; expected loading component, Suspense fallback replacement, static logo path, reduced-motion styles, and Privacy main landmark were checked in the authored content. GitHub accepted and committed the four changes listed above.

**Not performed:** `npm test`, `npm run typecheck`, `npm run build`, Playwright/browser interaction, visual screenshot comparison, or fresh Lighthouse Navigation/Snapshot/Timespan runs. Do not state that compilation, tests, visual behavior, or Lighthouse scores are verified for these latest commits.

Recommended next verification:
1. Run `npm run typecheck`, `npm test`, and `npm run build` from the repository root; fix any failures before release.
2. Check first paint on a cold load, auth verification, and lazy route/chunk loading on desktop and mobile. Confirm React cleanly replaces the static HTML splash.
3. Re-run desktop and mobile Navigation and the mobile Privacy Snapshot against the same production preview build.
4. Capture a clean interaction-only Timespan trace without navigation; identify the exact non-composited button animation before making a targeted transition change.
5. Reassess the generated CSS render-blocking request from the production build. Avoid async stylesheet delivery unless it preserves first paint and CLS.


## Lighthouse follow-up — contrast and font loading (2026-11-16)

Implemented on `main`:

- `client/src/components/layout/LoginScreen.tsx`: changed foreground text on the `#818CF8` lavender controls to dark `#10131A` for the Discord login CTA, active Components V2 showcase tab, APP badge, and purple showcase action buttons. The CTA hover state now uses `#5B5FEA` with white text (4.9:1 contrast); pressed state uses `#4F46E5` with white text (6.28:1). This preserves the primary lavender brand color while meeting WCAG AA for normal text.
- `client/src/styles/globals.css`: removed the Google Fonts CSS `@import`, which placed font stylesheet discovery behind the main stylesheet.
- `client/index.html`: added preconnects for Google Fonts and gstatic, and changed the same Inter/JetBrains Mono stylesheet to a non-blocking preload-to-stylesheet pattern with a no-JavaScript fallback. The font families and requested weights are unchanged; `display=swap` remains enabled.

Validation: source-level checks confirmed the old Google Fonts `@import` is absent, the HTML contains the preconnects/non-blocking font stylesheet/fallback, and the four reported lavender/white UI elements now use accessible foreground colors. WCAG ratios were calculated from the authored hex values: #10131A on #818CF8 = 6.23:1; white on #5B5FEA = 4.92:1; white on #4F46E5 = 6.29:1. No test suite, typecheck, production build, or new Lighthouse run has been executed in this environment. Re-run Lighthouse against a production `vite preview` build to measure the actual performance impact and confirm the accessibility score.




## Latest continuation — blank message-card navigation and local Lighthouse investigation (2026-11-16)

This section is the newest authoritative update. It supplements the prior preview/inspector interaction contract and records the performance evidence reviewed from Lighthouse workflow run **43547638587**.

### Blank/non-component message-card click behavior

Owner clarified that clicking a specific message's blank/non-component area in Preview should navigate to that message's editor, but ordinary scrolling/swiping through Preview must never trigger navigation.
Implemented:
- `client/src/components/layout/StudioLayout.tsx` — `handlePreviewMessageSelect(index)` now:
  - clears any selected component inspector;
  - on desktop, scrolls the left editor to the selected message and focuses the first editable field;
  - on mobile/tablet, switches from Preview to Editor only after a deliberate message selection, then waits for the pane to become visible before scrolling/focusing.
- `client/src/components/preview/MessagePreview.tsx` — message-card navigation is now an explicit `onClick` handler (not a scroll/wheel/touch-move handler). It ignores native interactive elements, component targets, and spoiler reveal controls. Component click capture continues to stop propagation and use the existing component-inspector behavior.
- Message number controls (`#1`, `#2`, etc.) continue to use the same message-selection path.
- A scroll/swipe alone does not dispatch the card click handler; do not add scroll-based navigation.
- Preview component clicks remain separate: on mobile they open the quick inspector while leaving Preview active; on desktop ordinary components navigate to the left editor, while button targets open the floating inspector.

Commits:
- `1f6d6f878b41443210d5e695b72383fda011d123` — switch to selected message editor when a preview message is clicked.
- `8749ad034b5216b979f3451f5036d78851b20d85` — guard message-card navigation from native/component/spoiler interactions.

Validation so far: changed files were re-fetched and targeted source checks confirmed the handler, click binding, interactive guard, and two spoiler ignore markers. No typecheck, test suite, or browser gesture test has yet been run for these commits.

### Lighthouse evidence reviewed

Inspected artifacts from GitHub Actions Lighthouse run:
- Run: `43547638587`
- Workflow branch: `perf/mobile-lighthouse-optimizations`
- Workflow head: `d0dfe37fd0b033ba4244db04ea2626cb335da751`
- The run used a production build and Vite preview, not the Vite development server.
- Three runs per form factor.

Observed artifact results:
- Desktop Performance: 80, 78, 81 (median 80).
- Desktop LCP: approximately 2.18–2.21 seconds.
- Desktop TBT: 20–136.5 ms; median approximately 22 ms.
- Mobile Performance: 98, 97, 97 (median 97).
- Mobile LCP: approximately 2.20–2.26 seconds.
- Mobile TBT: 0 ms in all three runs.
- CLS: 0 in all six reports.
- Unused JavaScript audit estimated about 29 KiB potential transfer savings.

Important evidence limits:
- These artifacts came from the named performance PR branch, not the current main head; treat them as a prior controlled baseline, not proof of current-main scores.
- Lighthouse's exported `largest-contentful-paint-element` audit had `details: null` in the inspected JSON, so the exact LCP DOM node cannot be identified from this artifact.
- The reports do not contain an INP measurement. TBT is a lab diagnostic/proxy for main-thread blocking, not INP.
- The desktop test configuration simulated a 4x CPU slowdown and throttled network. It is not a direct benchmark of the owner's i7 laptop.
- The 20–30 local Lighthouse score has not yet been reproduced or diagnosed.

### Current code observations relevant to performance

Inspected current `client/src/App.tsx`:
- `NotFoundPage`, `DocsPage`, `PrivacyPage`, `StudioLayout`, and `StudioModals` are dynamically imported with `React.lazy`.
- The Studio-only route components are not eagerly imported by the main App module.
- `authLoading` initially activates only when a stored session hint or OAuth callback is present. `fetchCurrentUser()` requests auth and health concurrently, then resolves loading state.
- No bundle-splitting, Vite chunking, or proxy changes were made during this interaction update.

The root `npm run dev` command starts shared build + server + Vite client + bot. The client Vite dev server is not a production-equivalent Lighthouse target. The CI workflow instead runs locked dependency installation, builds shared/client/server, starts the API, and runs Lighthouse against `vite preview` on port 4173.

### Interpretation for the owner's local score

- INP 280 ms is in the "needs improvement" range (good is <=200 ms; poor is >500 ms). Attribute the slow interaction before optimizing; inspect the DevTools Performance interaction track / INP attribution to identify the actual event and target.
- LCP 2.60 s is just over the 2.5 s "good" threshold and in the "needs improvement" range, not a severe/poor LCP.- A local Lighthouse Performance score of 20–30 is not explained by the CI artifacts. First verify whether Lighthouse was run against the Vite development server (commonly port 5173) rather than a production build served by `vite preview` (the CI target is port 4173). Development transforms, HMR and module loading can distort the score substantially.
- Laptop hardware, background CPU/memory pressure, thermal/power mode, browser extensions, and concurrent development processes can affect local lab runs. Integrated graphics is unlikely to be the primary cause of JavaScript/INP latency.
- Do not make speculative bundle or Vite chunking/proxy edits based only on a local 20–30 score. The next performance step is to reproduce against production preview under controlled conditions and capture the full Lighthouse JSON/trace, especially the actual LCP element and the interaction attribution for the 280 ms INP.
- The existing Lighthouse artifacts' LCP element detail is missing; a new report/trace with element attribution is needed before targeting a specific image or DOM node.

### Exact next actions

1. Owner reruns `npm run typecheck` after the earlier `UI_THEME_CONFIG` import repair and after the two new message-click commits; capture complete output.
2. Run `npm test` and `npm run build` separately and record actual results.
3. Browser-test desktop and mobile: click blank card area -> editor navigation; click/drag-scroll the preview -> no tab switch; click a V2 component -> expected inspector/editor behavior; click native links/spoiler controls -> their native action only.
4. Re-run Lighthouse against the production preview, not `npm run dev`, using the existing CI workflow/config as reference. Compare same route, viewport, browser, storage/auth state, and run count.
5. Capture the actual LCP element and INP interaction attribution before changing loading strategy or JavaScript bundles.
6. Preserve the existing lazy-loaded NotFoundPage and current authLoading behavior unless new trace evidence shows either is contributing. Do not touch Vite chunking/proxy without a measured cause.
7. Update this handoff with exact current-main commit, raw output, and visual/performance artifacts after each verification batch.

---


## Mobile plain-message quick editing update (2026-11-16)

The owner clarified that on mobile/tablet, clicking a Classic/plain-text message must also open a quick editor over the Preview tab, rather than switching to the full Editor tab. This is now implemented as a distinct message selection state.

- `client/src/store/messageStore.ts`: Selection now supports `{ kind: "message"; index: number }`.
- `client/src/components/layout/StudioLayout.tsx`: `handlePreviewMessageSelect` now sets the active message and, on mobile/tablet, selects the message quick-edit state without changing `mobileView`. Desktop retains full-editor navigation, smooth scroll and cursor focus.
- `client/src/components/editor/PropertyPanel.tsx`: renders a mobile bottom-sheet **Message Quick Edit** for message selections, with a controlled content textarea bound to `setContent`. Edits update the preview immediately. The full Editor tab remains the place for embeds, components and advanced settings.
- Component clicks on mobile continue opening the component inspector; this message editor handles blank-space/plain-text/card clicks and message-number selection where the click is not captured as a component.
- Commits: `d4e97a29dc5e5ec018ae887c7bd788144642853a` (message selection type), `3f2b08e1d4695a47e026151d8bba74f0b280b65e` (mobile routing), `23f90455cc70233e027f1929b2afa20ecc718428` (message quick-edit sheet).
- Validation: source changes committed; TypeScript, tests, build and mobile browser QA have not yet been run. In particular, verify `setContent` updates the currently selected message index as intended and that clicking message text/blank space opens the sheet without switching tabs.

## Latest authoritative continuation — preview editing, inspector overlay, conversion safety, and typecheck repair (2026-11-16)

**This section is the newest source-of-truth for the latest work.** It supersedes earlier statements below that describe the preview inspector as opening on desktop for every component, describe the inspector as a docked third pane, or describe the previous logo frame/toast state. The repository's current main source is authoritative.

### Owner's requested interaction contract

#### Desktop (wide workspace)
- Clicking ordinary text/content in the Discord preview selects the corresponding message, smoothly scrolls the **left MessageEditor** to that message, and focuses the first editable field in that message. The cursor is moved to the end of a text input/textarea where supported.
- Ordinary preview content must **not** open the right-side Component Inspector. This avoids duplicate editing surfaces and preserves the editor + preview workspace rather than creating a permanent three-pane layout.
- Clicking an interactive button in the preview opens the Component Inspector as a **floating overlay** on the right. It sits above the existing workspace and must not resize/reflow the editor or preview.
- Preview click capture stops propagation so selecting a nested component does not also trigger the message-card click handler.
- The clicked message is kept active when a component is selected.

#### Mobile / narrow workspace- Clicking any identifiable component/content in the preview selects that component and opens the quick Component Inspector over the **Preview tab**. It must not force a switch to the Editor tab.
- The Editor tab remains available for adding/managing content; preview quick-edit is not intended to replace the full editor.
- The inspector remains an overlay/bottom sheet, not a third persistent pane.

### Latest preview/inspector implementation

- client/src/components/preview/MessagePreview.tsx: delegates component selection through onSelectPreviewComponent; detects whether the clicked preview target is interactive; stops event propagation; updates the active message.
- client/src/components/preview/ComponentPreview.tsx, ActionRowPreview.tsx, and ContainerPreview.tsx: expose component IDs on preview DOM elements so delegated selection can identify the clicked component. Preview buttons are explicitly marked interactive.
- client/src/components/layout/StudioLayout.tsx: desktop ordinary content routes to the left editor scroll/focus behavior; desktop interactive button clicks select the component for the floating inspector; mobile component clicks select the component while leaving the Preview tab active.
- client/src/utils/editorSmoothScroll.ts: provides editor Lenis scrolling and focuses the first editable field in the selected message after navigation.
- client/src/components/editor/PropertyPanel.tsx: inspector is styled as a floating desktop overlay and mobile bottom-sheet overlay. It does not reserve a permanent third column. It should only render when a component is selected.
- Note: desktop currently classifies preview button controls as interactive targets. The user's explicit requirement was “button or action flow” for desktop inspector opening; verify that action-flow entry points still open the inspector/FlowBuilder as intended. Do not broaden the desktop inspector to ordinary text/container content without asking the owner.

### Button Label variable restrictions

- client/src/components/editor/ComponentForms.tsx: the standard Discord button Label field passes variables={false} to Field, disabling variable autocomplete and quick-picker insertion.
- client/src/components/editor/MessageEditor/ComponentsTab.tsx: the V2 section accessory Button Label field also passes variables={false}.
- This restriction is intentional because Discord button labels are literal text and do not support the app's message-variable interpolation.
- Do not disable autocomplete for other fields unless Discord's payload semantics also disallow variable values.

### Classic ↔ Components V2 conversion safety

- client/src/store/messageStore.ts: Classic → V2 moves existing message content into a V2 Text Display and retains existing action rows. V2 → Classic projects Text Display content back into Classic message content and retains Action Rows. Text fragments are joined with actual newline separators.
- client/src/components/editor/MessageEditor/index.tsx: conversion checks component compatibility before changing mode. Conversion is refused with a short warning when the target format cannot represent the source content safely.
- V2 → Classic is blocked for unsupported V2 component types and when projected text exceeds Classic's 2,000-character content limit.
- Classic → V2 is blocked when embeds are present or components are not supported action rows/interactive children. Existing content is not silently discarded.
- Important: this is a conservative subset conversion, not a universal lossless converter for every Discord component type. If a future component type is added, update the compatibility checks and tests before allowing conversion.

### Toast and logo refinements

- Conversion warning copy was shortened to reduce overflow in the warning toast. The original screenshot showed a long warning string; this change shortened the message content. The toast component's global layout/styling has not been independently redesigned or browser-verified.
- Header and logo wrapper styling no longer adds the dark rounded badge background/border around the logo:
  - client/src/components/layout/Header.tsx
  - client/src/components/layout/HoHoLogoMark.tsx
  - client/src/App.tsx loading-logo wrapper
- The underlying client/public/hoho_logo.svg artwork was not edited. Only the surrounding CSS frame/background treatment was removed. If the owner meant removing a shape drawn inside the SVG artwork itself, that remains a separate asset-edit request and must be confirmed visually.

### Latest commits for this continuation

The following commits are on main (newest first). They are grouped here for Gemini's review; fetch the current files before making further changes.

- 38a4fe8a5ba9eceee3e0389cbfe69a6be42fd74d — restore missing UI_THEME_CONFIG import in PropertyPanel after the owner reported two TS2304 errors.
- 15cf0fef87bf909ad9359336a0038ba32dfeab88 — remove session-loading logo badge frame.
- a730cd75099f0abc7029ed833fde779afccb8fd6 — keep clicked preview message active.
- 2b9cc782339d11961f7d262e5b23691f88080a12 — shorten conversion warning toast copy.
- f1f2cf83a079c2be098103c6c1dc1293836003cd — remove unused theme import (the subsequent typecheck exposed that the import was still required by header/body classes; restored in 38a4fe8a).
- 2d6fddb8210b093d61aea5d8848cb6818b087c09 — prevent preview click propagation into message-card click.
- 0a79b3632d1908c71f13d03aa861b1e57af3b746 — remove logo badge styling in HoHoLogoMark.
- d20d0d280fadc64be9195c577b81ae18a1356d46 — remove logo badge styling in Header.
- 3272a5bd7f53f5b9bfae45b6acb17994c7819c0b — make desktop inspector an overlay instead of a third pane.
- fed216eb31e05b208e6d7dbdd5dc2982fbd2db56 — desktop left-editor navigation and mobile preview quick-inspector behavior.
- d5c1af976dcbdee8af498e538713ae68309b33fb — route preview component clicks by viewport and component type.
- b735f688383e1aebd513e5a2c64198850576ab3f — mark preview button targets interactive.
- 2033b6850aa7da4ccf42ccf2586687c320c04aba — add message-editor focus after preview navigation.
- c40ac0b01e143d5dd503bb4c6564b8075b663c02 — enable top-level V2 container preview selection.
- b2a9f318c795cff55398426e588de663428eeb31 — use real newline separators for V2-to-Classic content.
- e0f563c6e4ad34e3197c6f39e4f5e6b9bf65a3f4 — validate conversion component compatibility and limits.
- 07e838db3b565673d115023a9cd4b30bedca42ff — harden inspector focus for non-text controls and repeated selections.- e12ea4316a6950c541fb15e33b0b489218746b87 — guard Classic/V2 conversion.
- e5a4ad023be176c6ed75b63e365e9a62653b3739 — preserve text and action rows during mode conversion.
- 2721d4ac92dc63c3ba4fe1a123012c0a2449dd85 — disable variable insertion for V2 section accessory labels.
- 2867c11f2896d4cc93e5943e66f970292ad3ab43 — disable variable insertion for standard Discord button labels.
- cd0672623e538ddf25207532ccf366e45c6e0cb7 — focus selected component's first editable inspector field.
- 1d9498c13aef0f7e3fa674f82092e056bda514b8 and ae4451af96ddb557ef02fa9a2b797bf9a24d6f18 — expose preview component IDs for selection.

### Latest owner-reported typecheck failure and repair

The owner ran npm run typecheck and reported exactly two errors in client/src/components/editor/PropertyPanel.tsx:

- TS2304 at line 85: UI_THEME_CONFIG not found for inspectorHeader.
- TS2304 at line 146: UI_THEME_CONFIG not found for inspectorBody.

Root cause: a cleanup edit removed the import while the component still referenced UI_THEME_CONFIG.surfaces.inspectorHeader and inspectorBody.

Repair committed:
- Restored import { UI_THEME_CONFIG } from "../../config/uiThemeConfig";.
- Commit: 38a4fe8a5ba9eceee3e0389cbfe69a6be42fd74d.
- Re-fetched the committed file and verified the import is present.
- **The owner has not yet rerun npm run typecheck after this repair.** Do not state that typecheck passes. No other compiler output is known from the reported run; that does not establish that no further errors exist.

### Validation status after latest changes

- GitHub source review and targeted string/source checks were performed for the changed files.
- The owner has tested some prior changes locally and confirmed the earlier syntax fix was working; this does not validate the latest changes as a whole.
- Latest owner-run typecheck: failed with the two missing-import errors above; source fix committed, rerun pending.
- Assistant did not run npm run typecheck, npm test, npm run build, Playwright, or browser visual QA.
- No screenshot-based desktop/mobile verification exists for the latest overlay behavior.
- Do not report zero errors, a clean build, test pass, or release readiness until the owner reruns checks and the relevant visual workflows are actually exercised.

### Exact next actions for Gemini

1. Read this entire handoff. Treat this latest continuation as authoritative over older status paragraphs and historical V11 notes.
2. Fetch current main and inspect the latest versions of PropertyPanel.tsx, StudioLayout.tsx, MessagePreview.tsx, MessageEditor/index.tsx, messageStore.ts, and editorSmoothScroll.ts.
3. Ask the owner to rerun npm run typecheck after commit 38a4fe8a; capture the complete output. If there are additional errors, fix them in source and update this handoff with the actual output and commit.
4. Run/ask owner to run npm test and npm run build separately; record actual results and test counts. Do not infer one from another.
5. Perform desktop and mobile browser QA for the exact interaction contract above:
   - desktop ordinary content click -> active message, smooth left-editor scroll, editable cursor focus, no inspector;
   - desktop button click -> floating right overlay, no column resize;
   - mobile any component click -> inspector overlay while remaining on Preview tab;
   - editor tab remains accessible for adding/managing components;   - no duplicate message click firing or stale selection.
6. Verify the logo against the owner's intended asset: current code removes the CSS badge frame but does not edit the internal SVG artwork.
7. Inspect the toast visually. The message text was shortened, but toast layout itself has not been visually verified.
8. Update this file after every implementation/verification batch with exact commit SHAs, commands actually run, output, screenshots/artifacts, and outstanding defects. Never copy historical test counts into current validation.

---

## Follow-up implementation after the previous checkpoint — 2026-11-16

- Confirmed the V10 UI work is present in the source, not just in the plan: the SaaS Studio palette and Inter/JetBrains Mono typography are defined in `globals.css`; the login/public surfaces, studio shell, editor, embed/component builders, inspector, action-flow builder, and Discord preview have corresponding redesigns.
- Identified and completed a specific missed Batch 8 requirement: `EmbedsTab.tsx` previously returned `null` when no embeds existed. It now always shows an Embeds header with a count, an Add Embed action, and a first-embed empty state with a Create First Embed action. The duplicate Add Embed control was removed from the footer action bar.
- Added a UI regression test for the first-embed empty-state flow and behavior tests that verify `{` / `{explo` trigger standard variable autocomplete.
- Added a server interpolation behavior test proving `{now.time}` resolves to Discord `:T` and `{now.short_time}` resolves to `:t`.
- Removed a test comment that only repeated the immediately following assertion. The broader Batch 14 comment sweep is still open; constraint and architecture comments remain in place.
- Preserved the live server resolver contract for `clantag` and the existing broader author fields. V10's proposed nine-field list and selected-server-membership behavior conflict with the live resolver and existing tests; those incompatible changes were not introduced.
- UI plan nuance: the current sidebar is an `Elements | Templates` drawer with the component palette inline in the editor, rather than the plan's literal `Templates | Tracked | Actions` three-way switcher. This is an architectural deviation to reconcile explicitly, not a claim that the literal three-tab requirement was completed.
- The UI changes are source-reviewed only. No browser screenshot or responsive visual pass has been performed.
- Aligned the CI matrix job display name to the protected branch's required check contexts (`build-and-typecheck (22)` and `build-and-typecheck (26)`). No workflow run or combined status has appeared for the new head yet, so the check-name correction is committed but not verified by Actions.

## Latest implementation checkpoint — 2026-11-16

The work continued from the live `main` head, not from the older audit snapshot. The implementation contains 30 commits ahead of the V9 baseline; the handoff checkpoint is a separate documentation commit.

### Completed source-level work
- Fixed the CI workflow's reference to the deleted Playwright audit script and removed the retired `tunnel` npm workspace entry.
- Consolidated server variable interpolation and timestamp variables; unified duplicated request parsers.
- Fixed the shared field autocomplete regex and extracted shared field autocomplete behavior.
- Unified MentionInput popover rendering, repaired portal layering/positioning, and aligned autocomplete Snowflake validation with the server's 17–20 digit rule.
- Removed the unsupported `avatarurl` suggestion while retaining the server's supported `avatar` field.
- Applied the V10 SaaS Studio design tokens and typography, core UI primitives, public pages, application shell, editor, embed/component builders, inspector, action-flow builder, Discord preview frame, and admin/modal styling.
- Removed the obsolete bot-profile UI/store because its legacy profile endpoints are no longer supported. This is a deliberate deviation from the V10 Batch 13 file list, which still names `ProfilesPanel.tsx`.
- Added parser, autocomplete, interpolation, request parsing, and author-resolution regression coverage.

### Recovery fixes made after the first implementation pass
- Corrected malformed JSON in `package-lock.json` (a trailing comma in the root workspace array). The repaired lockfile was parsed successfully as JSON during source review.
- Removed an extra closing `});` from `client/src/utils/__tests__/userPlaceholderAutocomplete.test.ts`, which otherwise left the test file syntactically invalid.
- Corrected the clan-tag documentation to match the actual resolver semantics.

### Plan/source discrepancies — preserve current behavior unless the contract is deliberately changed
1. The V9/V10 text says the ID-based user placeholder contract is exactly nine fields and names `created_at` / `joined_at`. The current `authorService.ts` does not implement those aliases. It resolves `name`, `displayname`, `globalname`, `username`, `id`, `avatar`, `url`, `profile`, `mention`, `created`, `created.relative`, plus the special `roles`, `clantag`, `joined`, and `joined.date` fields. The client autocomplete currently reflects this broader existing contract. Do not silently replace it with the nine-field list; that would remove supported placeholders and advertise unsupported aliases.
2. V10 says `clantag` should resolve to an empty string when the user is not a member of the selected server. The live resolver instead reads Discord's `primary_guild.tag` when `identity_enabled === true`, independently of selected-server membership; when no enabled tag exists, it preserves the unresolved placeholder. Existing server tests assert these semantics. Documentation now describes the actual behavior. Do not change this contract without an explicit product decision.
3. V10 Batch 13 lists `ProfilesPanel.tsx` for restyling, but the panel depended on retired bot-profile endpoints. It was removed together with its unused store rather than presenting a non-functional profile manager.

### Validation status
- Source review only; no local Terminal, npm, or Playwright command was run.
- `package-lock.json` JSON parsing: passed in the source-review runtime.
- Test-file structural correction: source-reviewed; not executed by Vitest.
- `npm test`: not run; executed test count is 0.
- `npm run build`: not run.
- `npm run typecheck`: not run.
- Playwright/browser checks and screenshots: not run.
- GitHub Actions: no workflow run is associated with the implementation head `1d4c8934` or the handoff checkpoint `f2e833fe`; the latest listed runs target older commits. Combined status checks for the implementation head were empty.

### Next exact step
Continue V10 Batch 14 with a focused comments/test audit and reconcile the sidebar navigation deviation with the intended product structure. Then run `npm test`, `npm run build`, and `npm run typecheck` when the owner explicitly makes the local machine available. Fix every failure before recording actual test counts. Do not claim a visual pass without browser verification.

---

> **Read this document first.** It supersedes the stale branch/PR status and earlier implementation status near the top of `docs/GEMINI_HANDOFF_REPORT.md`. The older report remains below as historical project context. Current source on `main` is authoritative.
## Authoritative repository-wide source-tree and targeted source reconciliation — 2026-11-16

**This section overrides older repository counts, plan-status statements, and file-existence assumptions elsewhere in this document.** It was prepared from the complete tracked-path inventory and targeted source inspection at snapshot commit c35d762b5862046ae95394f17ffafcdd1989917e. Audit scope: all tracked paths were enumerated; high-risk UI, autocomplete, resolver, WEAO, auth/performance, tests, package manifests, and workflows were opened and traced. This was not a line-by-line review of every unrelated source file.

### 1. Exact repository snapshot

- Repository: no-peace/Hoho_manager
- Branches: only main exists at the time of this audit.
- Main snapshot: c35d762b5862046ae95394f17ffafcdd1989917e
- Open pull requests: none at the time of this audit.
- Tracked files: 304.
- Application source files: 210 total — client 114, server 79, bot 13, shared 4.
- Vitest test files: 47.
- Root README currently contains only “Coming soon”; use this handoff plus the source tree as the project orientation.
- Production URL: https://hoho-manager.onrender.com/

### 2. Architecture map — current source, not an inferred design

The root package is a private npm-workspaces monorepo. Node engine range is >=22 <27; .nvmrc is 26.13.1. The retired `tunnel` workspace entry was removed from the root manifest and lockfile in the current implementation; the active workspaces are `shared`, `server`, `client`, and `bot`.

| Area | Current responsibility | Main source locations |
|---|---|---|
| Client | React 19 + Vite + TypeScript + Tailwind + Zustand UI/editor | client/src/App.tsx, client/src/components/, client/src/pages/, client/src/store/, client/src/hooks/, client/src/utils/ |
| Server | Express 5 API, Discord API integration, message dispatch, auth, persistence, permissions | server/src/app.ts, server/src/routes/, server/src/services/, server/src/actions/, server/src/repositories/, server/src/middleware/, server/src/config/ |
| Bot | Sapphire/discord.js gateway worker; slash commands and interaction relay to the API | bot/src/index.ts, bot/src/commands/, bot/src/listeners/, bot/src/lib/ |
| Shared | Shared TypeScript message types, custom IDs, and constants consumed by client/server/bot | shared/src/types.ts, shared/src/constants.ts, shared/src/customId.ts, shared/src/index.ts |
| Tunnel | Only tunnel/config.yml.example is present in the current tree; no tunnel package manifest or source files were found | tunnel/config.yml.example |

Important architectural boundaries:
- The browser client calls the Express API through client/src/api/client.ts; do not move Discord bot credentials or privileged Discord REST calls into the browser.
- The bot is a separate gateway process and uses the server API. Keep slash-command/interaction handling distinct from browser session authentication.
- Shared message types are in shared; update the shared contract and all callers when changing cross-workspace payload shapes.
- Server-side authorization is authoritative. Client-side visibility or autocomplete filtering is not an authorization boundary.
- Persistence is implemented through server repositories and database configuration/migration modules. Inspect repository and migration code before changing data shape or retention.
- Existing staff permission middleware and destination-level checks must remain enforced for all message, thread, webhook, and WEAO operations.

### 3. Commands and CI contract

Root package.json currently defines:
- npm test — invokes each workspace test script; Vitest is the test runner.- npm run typecheck — builds shared first, then runs TypeScript tsc --noEmit checks in workspaces.
- npm run build — builds shared, client, server, and bot.
- npm run verify:acceptance — runs scripts/verify-acceptance.ts.
- npm run benchmark / npm run benchmark:json — server benchmarks.
- npm run dev — builds shared and starts server, client, and bot dev processes.

Do not conflate Vitest, typecheck, production build, acceptance checks, benchmarks, Lighthouse, and Playwright. They are separate checks.

#### Confirmed CI blocker: stale Playwright path

Current .github/workflows/ci.yml contains this step before the build:

    node --check docs/playwright/audit.mjs

But the current main tree has no docs/playwright/ directory and no docs/playwright/audit.mjs. The path is therefore missing at the exact point CI tries to validate it. This is a source-confirmed workflow defect, not a speculative runtime issue.

**Why the path is missing:** commit 00b0544ff7a88f7a9afc3c841101568cf2190379 (“testing something”, 2026-11-15) removed the complete docs/playwright/ folder, including:
- README.md
- TEST-CHECKLIST.md
- audit.mjs
- analyze-lighthouse.mjs
- the standalone Playwright package manifest and lockfile
- saved responsive audit reports/screenshots
- saved desktop/mobile Lighthouse HTML and JSON reports

The parent of that deletion commit is e26da760d96e3f7f491019b93d5e3d78565312d7. The files can be inspected/recovered from that exact parent if the owner wants the tooling restored. Do not blindly restore generated screenshots, browser traces, Lighthouse JSON, or private browser data. Restore only the necessary maintained tooling/documentation, and first determine whether the deletion was intentional.

**Required decision for the next engineer:** either restore the maintained Playwright audit source at the expected path (and any required package setup/docs), or deliberately remove/update the stale CI syntax-check step if the standalone audit has been retired. Do not leave a CI command pointing to a nonexistent file. Do not claim CI passes until the workflow runs successfully on the current main.

The latest combined-status lookup for snapshot commit c35d762... returned no statuses. No green CI result is established for this snapshot. Recent failed CI/Lighthouse runs visible in Actions were from the old feat/hoho-manager-weao-workspace-v8 branch; do not attribute those results to current main, but do not treat them as evidence that current main passes either.

#### Lighthouse workflow is not the deleted Playwright audit

Current .github/workflows/lighthouse.yml:
- Runs on push to main, pull requests, and manual dispatch.
- Uses Node 26.
- Builds shared, client, and server.
- Starts the built API and Vite production preview.
- Runs Lighthouse CI (@lhci/cli@0.14.0) for mobile and desktop.
- Uploads Lighthouse artifacts for 14 days.

Current .lighthouserc.desktop.json and .lighthouserc.mobile.json each collect three runs. Their configured category minimums are warnings: desktop Performance 0.80 and mobile Performance 0.75; accessibility, best practices, and SEO minimums are 0.90. LCP/CLS/TBT limits are also warnings. These are not hard 99+ score gates. The V8 title “Lighthouse 99+” is an aspiration, not a currently enforced threshold.

The deleted standalone Playwright audit and the current Lighthouse CI workflow are separate systems. Lighthouse CI does not replace the responsive functional audit.

### 4. Reconciliation with docs/hoho_v8_lighthouse_99_and_playwright_devtools_plan.md

The V8 plan is based on an older source snapshot (0b5cec5...) and refers to a Playwright audit commit (e534596...). It records a historical result of 38 PASS / 0 FAIL / 1 intentional SKIP across 320, 360, 390, 430, 768, and 1280px. The audit report and raw Lighthouse files described by that plan were subsequently removed by commit 00b0544.... Treat those numbers as historical evidence from the older audit, not as current-main verification. Do not copy the 38/0/1 result into a current validation summary.

| V8 batch | Current source status | Evidence / remaining work |
|---|---|---|
| 1. Parallel health and session checks | Implemented in source | client/src/store/globalStore.ts starts /api/health and api.auth.me() concurrently with Promise.all; health failure is non-fatal and server clock offset is retained when available. No dedicated globalStore regression test was found in the current test tree. |
| 2. Avoid signed-out LCP reset | Implemented in source | HAS_SESSION_HINT_KEY, hasSessionHint(), hasOAuthCallback(), and setSessionHint() are present. Initial authLoading is based on the local session hint or OAuth callback parameters. A cold visitor without a hint renders the login page while the session check runs; a valid session can transition into Studio after verification. Add tests for stale/missing hints, OAuth callbacks, and successful/failed session checks. |
| 3. Reduce initial entry bundle | Implemented in source | NotFoundPage is React.lazy; useActionStore is dynamically imported only after a user is authenticated. The old plan also mentioned removing unused gsap/ReactBits/CultSkiper test mocks. Current LoginScreen.test.tsx contains only a ThreeHeroCanvas mock; those named obsolete mocks are already absent. |
| 4. Pause/defer hero canvas | Implemented in source | ThreeHeroCanvas.tsx skips animation for navigator.webdriver, reduced-motion users, compact mobile, and constrained devices; on eligible desktop it draws a static frame first and delays the animation loop by 1500ms. It also pauses when hidden/offscreen. No dedicated automated test for this behavior was found. |
| 5. Surface Lighthouse gatherer error | Not present in current tree | docs/playwright/analyze-lighthouse.mjs was deleted in commit 00b0544.... The proposed extractLcpNode() errorMessage handling is therefore not part of current main. Recover the prior helper from parent e26da760... and apply/review the error handling if the analyzer is restored. |

Additional interpretation:
- The current ThreeHeroCanvas has more than the original V8 suggestion: it also caps animation at 30fps, reduces particle count/pixel ratio for compact mobile, and pauses on document visibility/intersection changes.
- The V8 root-cause measurements (LCP around 2.2s, desktop TBT 380ms, unused JS around 29.4KB) came from the old uploaded Lighthouse JSON. The raw JSON was deleted from current main; do not state that these exact measurements still reproduce.
- The LoginScreen.test.tsx file is small; inspect its current content rather than assuming the old mocks remain.
- The V8 analyzer fix cannot be considered implemented merely because the source plan contains a code sample.

### 5. Reconciliation with the additional “Read V8 Plan” attachment

That attachment was a proposal and ended by asking the owner for approval of the changelog display default. Do not treat every proposed future change as independently approved. The following is the status found in current source:

#### 5.1 ID-based user avatar aliases

**Implemented in resolver, but autocomplete has a source inconsistency.**
- server/src/services/authorService.ts now resolves only the canonical ID-based field avatar.
- server/tests/authorService.test.ts expects avatarurl, icon, and pfp to remain literal/unresolved.
- However, client/src/utils/userPlaceholderAutocomplete.ts still includes avatarurl in USER_PROFILE_FIELDS.
- client/src/utils/__tests__/userPlaceholderAutocomplate.test.ts explicitly expects {user.<id>.avatarurl} to be suggested. This conflicts with the server resolver and the alias-removal plan.
- **Required follow-up:** remove the unsupported avatarurl suggestion and update the test; verify the UI suggests {user.<id>.avatar} and that unsupported aliases remain unresolved. Do not remove normal {user.avatar}.

The same autocomplete helper accepts IDs of 1–20 digits (\d{1,20}), while the server's USER_PLACEHOLDER_REGEX and DISCORD_USER_ID_REGEX require 17–20 digits. Existing tests deliberately use a short fake ID such as user.133342345. Decide whether the helper should enforce the server's real 17–20 digit contract, and update fixtures/tests consistently. Do not silently assume the current client and server validators match.

#### 5.2 Clan-tag semantics

- discordService.ts preserves Discord primary_guild fields (identity_guild_id, identity_enabled, tag, badge) in the user summary.
- ID-based {user.<id>.clantag} in authorService.ts returns the official primary-guild tag only when identity_enabled === true. It does not use the member nickname fallback.
- The current ID-based test for “without selected-server membership” calls the resolver without a guildId; add a stronger test with a guild context where getGuildMember returns 404/null, proving the primary-guild tag still resolves even when the account is not in the selected server.
- Interaction-user {user.clantag} is a separate path in server/src/services/actionExecutor.ts: it prefers the official primary-guild tag and otherwise parses bracketed/parenthesized/braced tags from nickname or username. Do not accidentally merge these two contracts.
- userPlaceholderAutocomplete.ts currently describes the ID-based clantag as “official Discord clan tag or a tag parsed from the member name”; that description is inaccurate for the ID-based resolver and should be corrected to “official primary-guild tag when enabled”.

#### 5.3 Mobile server selector

- Current Header.tsx uses a 104px-wide wrapper at the narrowest breakpoint (w-[104px] sm:w-32 lg:w-48), not the older 36px w-9 trigger described in the attachment.
- SearchableDiscordSelect.tsx renders its menu through a portal, recalculates its anchor rect on scroll/resize, and has viewport-constrained dropdown geometry with tests for 180px-tall viewports.
- This is a partial repair of the narrow-width issue. The proposed dedicated mobile bottom-sheet/selection panel is not implemented in the current source.
- The earlier 320px/360px zero-overflow evidence belongs to the deleted historical Playwright report. Re-run it before claiming the current selector is visually verified.
- Preserve desktop selector behavior if a mobile-specific surface is introduced.

#### 5.4 WEAO exploit changelogs

**Implemented in current source, with tests.**
- server/src/services/weaoService.ts has getExploitChangelogs(), 15-second cache, in-flight request deduplication, previous-snapshot comparison, and formatted output.
- server/src/routes/weao.ts exposes /changelogs/:exploit.
- interpolateWeaoPlaceholders() supports exploit-name and tracker-ID lookups, changelog selectors such as [n], [start:end], negative slices, and .changelogs.compare.- server/tests/weaoService.test.ts covers formatting, empty results, tracker-ID resolution, and incremental comparison.
- This is source/test coverage only; it is not a current production/browser verification.
- Preserve the explicit cancellation in the attachment: do not reintroduce exploit override behavior.

#### 5.5 Documentation page

- client/src/pages/DocsPage.tsx has a hardcoded DOC_ITEMS inventory, search/category filtering, responsive mobile cards and desktop table, and Copy/Check controls that await clipboard success.
- It documents the distinction between interaction-user and ID-based placeholders, including primary-guild tag behavior.
- The list remains manually maintained rather than generated from resolver metadata. Keep it synchronized with authorService.ts, actionExecutor.ts, weaoService.ts, and tests. The unsupported avatarurl suggestion described above is a concrete example of why cross-checking is needed.
- The original proposal's goal was documentation that reflects actual runtime support; do not advertise aliases or fields solely because autocomplete currently suggests them.

### 6. Current autocomplete regression — precise source trace

The owner reported that {explo did not show WEAO suggestions and {user. did not show user-variable suggestions. The current source has the following expected path:

1. client/src/components/editor/MentionInput/index.tsx has a component-level brace-token state machine in checkAutocomplete(). It finds the last {, requires no closing brace/newline before the cursor, and handles partial brace tokens before calling the pure parser.
2. {explo enters acType === "variable" with query explo. The WEAO chain item is added because "exploit.".startsWith("explo") is true.
3. {user. also enters acType === "variable" with query user.. getUserIdPlaceholderSuggestions("user.") correctly returns null because no numeric ID has been typed; the ordinary VARIABLES array should then provide {user.*} items because their tags contain user..
4. {user.<digits> enters the ID-specific suggestion path in getUserIdPlaceholderSuggestions().
5. The menu is rendered only when acType is set and acItems.length > 0.
6. VariableMenu.tsx forwards its props to AutocompletePopover.tsx. The popover consumes anchor and maxHeight, portals to document.body, uses calculateFloatingPosition(), listens to window and visualViewport resize/scroll, and scrolls the active option into view.

**Important:** this source trace explains what should happen, but it does not prove the user's reported interaction is fixed. There is no dedicated MentionInput component test in the current tree that asserts the visible menu for partial {explo, {user, {user., and bare {. Existing tests cover the pure parser and ID-placeholder helper, not the full component state/render path.

The pure parser (client/src/utils/mentionParser.ts) still has its own brace-token regex logic, but the current MentionInput.checkAutocomplete() handles brace tokens before delegating to that pure parser. Keep the component state machine and pure parser behavior aligned, or clearly document why they intentionally differ. Also test the separate reusable Field/TextArea autocomplete in client/src/components/ui/Field.tsx; fixing MentionInput alone does not prove that path works.

### 7. Source-audit findings Gemini should prioritize

| Priority | Finding | Evidence | Required action |
|---|---|---|---|
| P0 — CI blocker | CI references deleted docs/playwright/audit.mjs | .github/workflows/ci.yml + deletion commit 00b0544... | Restore maintained audit tooling or remove/update the stale CI step intentionally; run CI on current main. |
| P1 — placeholder contract drift | Client suggests ID-based avatarurl, but server intentionally removed that alias | userPlaceholderAutocomplete.ts, its test, authorService.ts, authorService.test.ts | Align suggestions/tests with server support. |
| P1 — ID validation drift | Client autocomplete accepts 1–20 digit IDs; server accepts 17–20 | userPlaceholderAutocomplete.ts vs authorService.ts | Align client validator and fixtures with the real Discord ID contract. |
| P1 — reported autocomplete regression | No component-level regression test for visible partial-token menus | MentionInput/index.tsx, tests tree | Add component tests for {, {user, {user., {user.<valid-id>, {explo, plus keyboard selection and cursor replacement. |
| P2 — clan-tag test gap | Non-membership test omits guild context | server/tests/authorService.test.ts | Add guild-context test where membership lookup fails but enabled primary-guild tag still resolves. |
| P2 — mobile selector scope | No dedicated mobile selection panel | Header.tsx, SearchableDiscordSelect.tsx | Decide whether the existing 104px trigger is sufficient or implement the proposed mobile panel after current viewport verification. |
| P2 — documentation drift risk | Docs and autocomplete inventories are hardcoded separately | DocsPage.tsx, Field.tsx, userPlaceholderAutocomplete.ts | Reconcile every documented/suggested token against resolver behavior and tests. |
| P2 — workspace manifest drift | Root declares tunnel as a workspace but tunnel has no package.json in the current tree | root package.json + tunnel/config.yml.example | Verify npm workspace behavior; decide whether the entry is intentional or needs a manifest/removal. |

### 8. Validation and safety status at this snapshot

- This audit used GitHub source and commit history only.
- No local npm command was run.
- No Terminal or Playwright session was started.
- No browser screenshot, console trace, or live interaction was captured.
- No current-main Vitest, typecheck, build, Lighthouse, or Playwright pass is claimed.
- The historical 38 PASS / 0 FAIL / 1 SKIP result is not current-main evidence because the report was deleted.
- The user previously said their PC was off. Do not use Terminal or Playwright until the owner explicitly says they are available again.
- The owner expects source edits to be made through GitHub integration, not by asking them to hand-edit code. Keep edits focused and preserve unrelated behavior.

### 9. Instructions to Gemini as the senior engineer

1. Read this entire handoff and the V8 plan before proposing or applying changes.
2. Treat the live main source as authoritative. Re-fetch the current file and SHA before every edit; this handoff is a map, not a substitute for opening the implementation.
3. Start with the confirmed CI path mismatch. Inspect deletion commit 00b0544... and parent e26da760...; determine whether the owner intended to retire the standalone audit. Restore maintained tooling only if appropriate; never restore private/generated browser artifacts blindly.
4. Fix the client/server user-placeholder contract drift (avatarurl, ID length, clantag description) with tests before claiming ID-based autocomplete is accurate.
5. Fix the user's autocomplete report with component-level tests that assert visible, populated suggestions—not only pure parser output. Test both MentionInput and Field/TextArea paths.
6. Preserve the distinction between ID-based primary-guild clan tags and interaction-user legacy nickname-tag parsing.
7. Keep existing Thread ID authorization, WEAO security/permissions, OAuth/session behavior, encryption, backups, message payload compatibility, Components V2, and action flows intact.
8. Do not implement the mobile selector redesign or other proposal-only scope without confirming that it remains desired. The attached “Read V8 Plan” ended with an explicit approval question; its proposed work should not be silently treated as blanket authorization.
9. Use the correct checks: npm test, npm run typecheck, and npm run build are separate. Run Lighthouse CI separately. Run Playwright only when the owner enables it.
10. Update this handoff after each implementation batch with actual commit SHAs, tests run, failures, screenshots/artifacts, and the exact source snapshot. Never turn source inspection into a claim of runtime success.

---

## Latest regression report — autocomplete (2026-11-16)

The owner reported that typing partial tokens in the message editor produced no autocomplete menu:
- Typing `{explo` did not show the WEAO/exploit suggestion.
- Typing `{user.` did not show user-variable suggestions; the user-variable autocomplete was described as fully broken.
- The expected interaction is that suggestions become available from the opening `{` while the token is still incomplete.

### Source changes committed to main

These are focused follow-up changes; they are not yet confirmed by Vitest or browser testing.

1. `3004e714f2e0f5cfcf138f1f0882f1a8f33b0e09` — `client/src/components/ui/Field.tsx`
   - Updated reusable variable filtering to normalize a partially typed opening brace.
   - Added the WEAO `{exploit.` suggestion to the reusable Field/TextArea variable list, so this path does not depend on MentionInput's dedicated WEAO menu.
2. `139f9e49749fb2c31f75cb28105e9fa3918bcc98` — `client/src/components/editor/MentionInput/index.tsx`
   - Changed the WEAO prefix check to recognize the typed prefix (for example, `explo`) rather than testing whether the full query is a substring of the prefix.
3. `ac2dfc8f1c11b536f7203e1c0d5aecba6a491b27` — `client/src/components/editor/MentionInput/VariableMenu.tsx`
   - Added optional anchor and max-height props to the specialized variable menu interface.
4. `0e75bfbe43babf410b4cadbddb791848ded7a12f` — `client/src/components/editor/MentionInput/index.tsx`
   - Passed the textarea anchor and calculated dropdown max height into `VariableMenu`, so the shared popover receives positioning information.

### Important unresolved verification

- The owner explicitly reported both exploit and user-variable menus missing. The commits above address the WEAO prefix and the variable-menu anchor path, but **the user-variable symptom is not yet proven fixed**.
- Reopen the current `MentionInput/index.tsx`, `VariableMenu.tsx`, and `AutocompletePopover.tsx` together. Trace the render condition for `acType === "variable"`, verify that `{user.` produces non-empty `acItems`, and verify that the popover receives a valid anchor and renders in the viewport.
- **Current source check completed:** `AutocompletePopover.tsx` does consume both `anchor` and `maxHeight`; it uses `calculateFloatingPosition`, portals to `document.body`, listens to window and `visualViewport` resize/scroll, and scrolls the selected row into view. This resolves the source-inspection question only; it is not proof that the menu renders correctly at runtime.
- Add regression tests for partial `{explo`, `{user`, `{user.`, and bare `{` tokens, including assertions that the menu is visible and populated—not only parser return values.
- Do not change interpolation/resolver semantics, encryption, Discord permissions, or unrelated editor behavior while fixing this.
- Do not claim this regression is resolved until Vitest and browser interaction checks pass.

---

## Implementation progress — 2026-11-16

Implementation is being committed directly to `main` as requested. These changes are source edits only; no local validation has been run.
### Completed source changes (not yet runtime-verified)

- **Wide-screen workspace:** Replaced the Studio's mutually exclusive editor/preview rendering with the existing resizable `SplitPane`; aligned the split and inspector docking breakpoint to 1200px; kept both mobile panes mounted so switching tabs does not discard local component state.
- **Header / preview cleanup:** Removed the Share action and callback plumbing while retaining JSON import/export. Removed the Cozy/Compact preview toggle and compact-only rendering branches.
- **Public pages:** Made the shared public header more compact at phone widths. Rebuilt the Docs variable reference as mobile cards plus a desktop table; changed copy affordances to Lucide Copy/Check icons and only show success after clipboard writes succeed.
- **Autocomplete:** Replaced the fixed 430px placement heuristic with available-space calculation that observes resize, scroll, and the mobile visual viewport. Added max-height control and keyboard-selected row scrolling/accessibility semantics. Updated reusable Field/emoji pickers and custom Select menus to choose the side with more available space, portal outside clipping containers, and scroll the selected option into view. Follow-up commits address partial WEAO prefixes and pass anchor/max-height data to the specialized variable menu; see the latest regression section above.
- **WEAO catalogue:** Removed the route filter that hid live WEAO exploits without a backup template, so the variable autocomplete receives the complete permitted catalogue. Added a manual exploit-name fallback when the catalogue is unavailable and improved dotted/manual-name parsing.
- **Thread destination:** Added an Existing Thread ID editor field, top-level `threadId` request metadata, server-side validation, and effective-destination routing for guild/channel permissions, interpolation context, send/edit dispatch, tracking, logs, and audit events. Kept forum `thread_name` separate. Updated the `send_message` flow field label.
- **UI tokens:** Centralized the public header/nav, Studio header, Inspector surfaces, Docs variable-reference/copy controls, and custom Select listbox surface in `UI_THEME_CONFIG`; migrated those shared surfaces to the tokens. The broader component/page consistency sweep remains in progress.
- **Regression tests added:** Added route tests for direct thread dispatch, malformed thread IDs, and staff allowlist enforcement against the actual thread destination; payload tests proving existing thread IDs do not create forum threads; and parser tests for dotted exploit names/fields. Added floating-position utility tests for above/below selection, viewport clamping, and visual viewport offsets.

### Main commit sequence

All implementation and handoff updates described above have been committed directly to `main` in small, focused GitHub commits. Use the live GitHub commit history for exact SHAs; this handoff intentionally records the change groups rather than duplicating commit identifiers.

1. Restore the desktop split editor/preview workspace, align the 1200px breakpoint, preserve mobile pane state, and remove the Share and Cozy/Compact controls.
2. Repair the public header and responsive Docs variable reference, including icon-only copy feedback.
3. Centralize viewport-aware menu positioning; portal Field, RichPicker, emoji, and exploit autocomplete menus outside clipping scroll containers; preserve keyboard selection and outside-click behavior.
4. Repair WEAO catalogue visibility, dotted exploit parsing, and manual-name fallback.
5. Add existing Thread ID support from editor through typed client request and validated server dispatch, permissions, tracking, logs, and audit.
6. Centralize shared public-header, Studio-header, Inspector, and Docs surfaces in `UI_THEME_CONFIG`; document migration rules in `DESIGN.md`.
7. Add Vitest regression coverage for floating placement, dotted exploit parsing, thread dispatch/permissions, and forum-thread payload separation.

### Still outstanding

1. Verify all Inspector floating menus (variable, emoji, custom Select, RichPicker, and emoji field autocomplete) against the mobile bottom sheet at narrow widths and with the virtual keyboard open; portal/floating-layer implementation is now in place.
2. The shared tokens now cover the Studio/public headers, Inspector, Docs surfaces, buttons, fields, tabs, and modals. Review remaining feature-specific one-off surfaces only where they still visibly diverge; preserve the existing visual identity.
3. Review and add any remaining regression tests for parser state transitions, popover positioning, Docs clipboard failure, and responsive layouts.
4. Run the user's approved checks when they are available: `npm test` (Vitest), `npm run typecheck`, and `npm run build`. No checks have been run for these commits; do not report them as passing.
5. Verify visual behavior at the planned viewport matrix once the user authorizes browser/Playwright use. No Terminal or Playwright has been used.

The 12 reported issues have source-level implementations committed to `main`. The work is **not release-verified** until the user runs the npm checks and responsive visual verification is completed. Continue editing through GitHub only until the user says their PC is available.

---

## 1. Current repository state

- The latest autocomplete application changes recorded in this handoff are committed on `main` through `0e75bfbe43babf410b4cadbddb791848ded7a12f`; use live GitHub history for the current `main` HEAD.
- The repository currently has one remote branch: `main`.
- There are no open pull requests at the time of inspection.
- The latest commit is the current Gemini handoff update; the implementation commits immediately precede it in `main`.
- The old PR #42 / feature-branch references in the historical handoff are stale. Do not treat them as current work.
- The current `main` tree contains the React/Vite client, Express server, Discord bot, shared package, tests, docs, CI workflows, Lighthouse workflow, security workflow, and deployment configuration.

### Tool constraints for this task

The owner explicitly said their PC is off. **Do not use Terminal or Playwright until the owner explicitly says they are available again.** Do not try to start local processes, pull, run npm scripts, open the local browser, or launch browser automation. GitHub source inspection and GitHub file/PR operations remain available.

The owner expects source changes to be made by the GitHub integration, not by asking them to hand-edit code. Keep changes in small, reviewable batches and preserve unrelated work.

## 2. User-reported defects and required outcomes

Treat the following as acceptance requirements, not optional design suggestions:

1. **Wide-screen workspace:** Restore simultaneous editor + live preview on desktop and other sufficiently wide screens. The user must not have to click a Preview button merely to see the preview on a desktop.
2. **`{exploit.` autocomplete:** The WEAO exploit variable autocomplete flow is broken and must work end-to-end.
3. **Keyboard navigation:** While typing `{exploit.` or another variable token, ArrowUp/ArrowDown must move the selected item and the selected row must remain visible by scrolling the menu.
4. **Component Inspector mobile menus:** Menus must not extend past the viewport or be clipped by the phone screen. Placement must use actual available space, not a fixed top-coordinate threshold.
5. **Mobile variable menu placement:** Prefer the space above the editor when it has more room; use below only when that is the better available placement. Clamp menu height to the actual available area.
6. **Login header:** Fix the public/login top-bar layout at narrow widths without causing overflow, overlap, or inaccessible navigation.
7. **Docs mobile layout:** Do not force a three-column desktop table into a narrow viewport where only one column is visible. Use a readable stacked/card layout on mobile and retain a table on wider screens. Remove the literal “Click to copy” label and show a Lucide Copy icon; after copying, temporarily show a Check icon.
8. **Test tooling:** Vitest is the test runner. Do not use TypeScript compiler commands as a substitute for running tests. Preserve the existing npm scripts unless a real defect requires a script change.
9. **Preview density control:** Remove the Cozy/Compact control from the live preview. Keep one consistent preview presentation.
10. **Existing thread support:** Add an explicit Thread ID path so a message can be sent into an already-open Discord thread. Keep forum thread creation/name separate from posting into an existing thread.
11. **Consistent UI:** The whole product must use a coherent design system: same spacing, typography, colors, borders, radii, controls, menu treatment, and responsive behavior across Studio, login, docs, modals, and inspector. Do not do a destructive all-at-once visual rewrite.
12. **Header share action:** Remove the Share button from the studio top bar and remove its now-unused callback plumbing if nothing else uses it.

The user also said there are more bugs not yet listed. Include a regression sweep for related workflows and report newly discovered issues separately; do not silently expand scope into unrelated feature removals.

## 3. Source-confirmed findings

The following are confirmed by the current source on `main` at the inspected commit. They are not browser-verified visual observations because Playwright is unavailable.

### 3.1 Desktop is currently single-pane

**Files:** `client/src/components/layout/StudioLayout.tsx`, `client/src/components/layout/SplitPane.tsx`

- `StudioLayout` owns `mobileView` and conditionally renders either `MessageEditor` or `MessagePreview`.
- The same conditional rendering is used at wide widths; the wide-screen Editor / Live Preview buttons only switch which one is mounted.
- A reusable `SplitPane` component exists but is not imported or used by `StudioLayout`.
- `SplitPane` currently treats widths below 1280px as single-pane. The breakpoint and minimum usable pane widths should be reviewed rather than assuming 1280px is the ideal threshold.

**Repair:** Use a real resizable two-pane layout on wide screens, with editor and preview visible simultaneously. Select the split breakpoint based on available content width and sensible minimum pane widths (target a wide-screen breakpoint around 1100–1200px, then verify at 1024, 1100, 1280, 1440, and 1920px). Retain the mobile/tablet pane switch on narrower screens. Preserve both panes' state when switching views; do not unnecessarily unmount the inactive pane. Keep the inspector as a separate docked panel on desktop and a bottom sheet on smaller screens.

### 3.2 WEAO autocomplete has fragile asynchronous and token parsing paths

**Files:** `client/src/components/editor/MentionInput/index.tsx`, `client/src/utils/mentionParser.ts`, `client/src/store/discordCacheStore.ts`, `server/src/services/weaoService.ts`, `server/src/routes/weao.ts`, `client/src/components/editor/MentionInput/AutocompletePopover.tsx`

- `MentionInput` has custom parsing for `{exploit.<Name>.<Field>}`. It uses the asynchronously populated `weaoExploits` list to distinguish exploit names from field names, including special handling for dotted exploit names.
- The same component pre-warms the WEAO catalogue after entering the exploit autocomplete state.
- `fetchWeaoExploits` stores the catalogue in Zustand and localStorage and records an error when the request fails.
- The WEAO catalogue route is permission-protected. A caller without the required WEAO permission can fail to load the list; the autocomplete must show a useful state and must not look like a silent parser failure.
- The pure parser in `mentionParser.ts` also has a regular-expression path for exploit names/fields. Keep the pure parser and component-level parser behavior aligned.
- The field picker resolves the canonical exploit name from the current catalogue. It must also behave predictably when a user types a valid exploit name manually or the catalogue is unavailable.
- The server service has changelog retrieval and formatting. The current function `getExploitChangelogs` accepts a string and uses it in the WEAO changelog endpoint; tracker-ID support and ordinary exploit-name support must be tested independently. Do not assume the docs guarantee that every tracker-ID form resolves.

**Repair:** Define and test the autocomplete state machine explicitly:
- opening token: `{exploit.` -> exploit-name state;
- partial name -> filtered catalogue;- selected name -> `{exploit.<canonical-name>.` and field state;
- field text -> filtered field list;
- selected field -> complete token with the cursor in the correct position;
- manual name entry when catalogue is unavailable;
- dotted names, mixed case, spaces or punctuation only where WEAO actually allows them;
- closing brace, newline, cursor movement, mid-string edits, and deletion must close or recompute state correctly.
Do not treat a partial dotted exploit name as a field. Do not make a failed catalogue fetch silently remove all autocomplete feedback. Keep authorization errors distinguishable from WEAO upstream outages.

### 3.3 Keyboard-selected autocomplete rows do not auto-scroll

**Files:** `client/src/components/editor/MentionInput/AutocompletePopover.tsx`, `client/src/components/editor/MentionInput/index.tsx`, `client/src/hooks/useAutocompleteMenu.ts`, and the related custom variable popovers in `client/src/components/ui/Field.tsx`.

- The keyboard handler updates `selectedIndex`.
- The popover maps rows and highlights the selected index.
- The popover does not keep a ref to the selected row or call `scrollIntoView` / equivalent when selection changes.
- Similar custom variable/emoji popovers in `Field.tsx` should be checked, not only the one in the message editor.

**Repair:** Add selected-row refs and scroll the active option into the scroll container when keyboard selection changes. Keep mouse hover selection, Enter/Tab selection, Escape dismissal, focus retention, and accessible active-option semantics working. Test wrap-around at the first and last item.

### 3.4 Menu placement uses a fixed threshold and can overflow

**Files:** `client/src/components/editor/MentionInput/index.tsx`, `client/src/components/editor/MentionInput/AutocompletePopover.tsx`, `client/src/components/ui/Field.tsx`, `client/src/components/ui/SearchableDiscordSelect.tsx`, `client/src/components/editor/PropertyPanel.tsx`, and `client/src/components/editor/RichPicker.tsx`.

- Mention input currently chooses above/below with `rect.top < 430 ? "bottom" : "top"`, rather than comparing available space above and below.
- Its popover uses a fixed 260px max height and is positioned absolutely inside the editor.
- `Field.tsx` repeats the same fixed 430px heuristic for inline rich pickers and has absolutely positioned autocomplete popovers.
- The inspector is a fixed bottom sheet with `max-h-[82vh]` on mobile and an internal scrolling body. Menus rendered inside it can be constrained by that scroll/overflow context.
- `SearchableDiscordSelect` has a portal-based placement implementation, but its mobile drawer behavior is distinct from the inline variable/field pickers. Do not assume fixing one picker fixes all menus.

**Repair:** Build or reuse one viewport-aware positioning utility for floating menus. Calculate real available space above and below the anchor, include a viewport margin and safe-area/visual-viewport constraints, choose the side with more usable room (unless the preferred side has enough room), and clamp the menu's max height to that available space. Account for scrollable ancestors, window resize/scroll, and the mobile virtual keyboard where supported. Use a portal/fixed positioning strategy for menus that must escape the inspector's overflow clipping. Keep focus, outside-click, Escape, and touch behavior intact. Avoid fixed magic thresholds such as 430px.

### 3.5 Login header is too rigid for narrow widths

**Files:** `client/src/components/layout/PublicPageHeader.tsx`, `client/src/components/layout/LoginScreen.tsx`, `client/src/pages/DocsPage.tsx`, `client/src/pages/PrivacyPage.tsx`.

- The public header is a single non-wrapping flex row.
- It has a fixed three-link nav with fixed horizontal padding and gap.
- The brand area and nav compete for width at 320px and 360px.
- The tagline hides below `sm`, but the three navigation links remain visible.

**Repair:** Give the public header an explicit compact mobile layout: preserve the logo/brand, keep all navigation destinations reachable, reduce gaps/padding, and use a compact menu or responsive nav treatment only if required by actual width. Avoid clipping the active state. Verify login, docs, and privacy pages because they share this component.

### 3.6 Docs table is not mobile-first and copy affordance is text-heavy

**File:** `client/src/pages/DocsPage.tsx`

- The docs data is held in a hardcoded `DOC_ITEMS` list and filtered in the client.
- The variable list is rendered as a three-column HTML table inside horizontal overflow.
- Each tag button includes a “Click to copy” kbd label and copied text.
- There is already a copied-state timer, but the affordance is not the requested icon-only copy/check treatment.

**Repair:** Keep the searchable/category-filtered data. Render compact stacked cards on narrow screens (tag + description + example, with a separate icon-only copy control); retain a readable three-column table on desktop. Import Lucide `Copy` and `Check`; show Copy normally and Check for a short confirmation interval after a successful clipboard write. Add an accessible label/title and announce the copied state. Handle clipboard rejection without falsely showing success. Remove the “Click to copy” label.

### 3.7 Cozy / Compact preview toggle is still implemented

**File:** `client/src/components/preview/MessagePreview.tsx`

- The component has local `density` state, a Cozy/Compact button, and conditional rendering branches that change avatar/header/grouping behavior.

**Repair:** Remove the density state and toolbar control. Keep one stable Discord-like preview style (the current Cozy-style message layout is the default baseline), including multi-message grouping where appropriate. Remove only the density toggle and compact-only branches; do not remove message selection, attachments, embeds, Components V2, or action-row previews.

### 3.8 Existing Thread ID is not wired through the normal send flow
**Files:** `client/src/utils/discord.ts`, `client/src/components/editor/MessageEditor/ContentTab.tsx`, `client/src/hooks/useSend.ts`, `server/src/routes/send.ts`, `server/src/services/discordService.ts`, `client/src/components/actions/StepList.tsx`, `server/src/actions/sendMessage.ts`.

- `ExtendedMessageData` includes `thread_name` through the shared message type, but has no editor-level `thread_id` field.
- `ContentTab` exposes a “Forum Thread Name” field. That is for creating a new forum post/thread, not posting to an already-open thread.
- `useSend` currently sends `channelId`, payload, files, flows, and edit metadata; it does not send a thread ID.
- `server/src/routes/send.ts` destructures `threadId` from the request body, but the current handler does not use it. The actual send call uses `channelId`.
- `send_message` action config exposes `channelId` but describes it only as a channel ID. A Discord thread is also a messageable channel, so the UI should explicitly explain that an existing thread ID can be used there.

**Repair:** Add an explicit optional existing-thread target in the message editor's Thread section and carry it as top-level `threadId` metadata in the send request (not inside the Discord message JSON). On the server, compute a validated effective destination ID and use it consistently for permission checks, destination-guild lookup, variable context, dispatch, tracking, audit logging, and errors. Preserve forum `thread_name` as a separate create-new-thread option. Ensure staff allowed-channel/guild restrictions apply to the actual destination thread, not only its parent channel. For flow `send_message`, label the target field “Channel or Thread ID” and use the supplied ID as the destination. Add tests proving that an existing thread ID is honored and that unauthorized thread IDs are rejected. Never create a new thread when an existing thread ID was supplied.

### 3.9 Share action remains wired in the studio header

**Files:** `client/src/components/layout/Header.tsx`, `client/src/components/layout/StudioLayout.tsx`

- `Header` accepts `onShare` and renders a Share2 icon button.
- `StudioLayout` builds a JSON payload and passes an `onShare` callback.

**Repair:** Remove the Share button and the now-unused `onShare` prop/callback/imports. Do not remove the JSON import/export action; it is a separate feature.

### 3.10 UI styling is fragmented across components

**Files:** `client/src/config/uiThemeConfig.ts`, `client/src/styles/globals.css`, `client/src/components/ui/Field.tsx`, `client/src/components/ui/Button.tsx`, `client/src/components/layout/*`, `client/src/components/editor/*`, `client/src/components/preview/*`, `client/src/pages/*`.

- A shared `UI_THEME_CONFIG` and CSS semantic tokens exist.
- Many components still hardcode Discord surface/text/border colors, spacing, and transition classes independently.
- The public header, studio header, inspector, docs page, and picker menus do not consistently use the same component primitives or responsive patterns.

**Repair:** First audit the current token and primitive coverage. Define a small shared set of surfaces, borders, text levels, controls, menu elevations, focus states, radii, spacing, and responsive rules. Migrate the high-visibility shared primitives first (buttons, fields, menus, headers, cards, modal surfaces), then page-level components. Do not blindly replace every Tailwind class or introduce a new UI framework. Keep the dark Discord-inspired visual identity and existing interaction behavior. Use screenshot comparison after browser tools are available.

## 4. Additional source-level risks to include in the repair sweep

These are risks discovered while tracing adjacent code; they need verification before being called confirmed runtime bugs:

- **Autocomplete variants:** The product has more than one variable-picker implementation: the message editor's `MentionInput` and the reusable variable autocomplete in `Field.tsx`. Fixing only one will leave inconsistent keyboard and placement behavior.
- **Thread destination metadata:** `threadId` is already destructured but unused in the send route. This is a clear dead path that can make the UI/API contract appear supported when it is not.
- **Responsive breakpoints:** Studio uses `xl` for pane switching, while `SplitPane` has its own 1280px JavaScript breakpoint. Consolidate the breakpoint so CSS and JS do not disagree.
- **Docs truthfulness:** `DocsPage` and `Field.VARIABLES` are separate hardcoded variable inventories. They can drift from actual server interpolation. After the functional fixes, reconcile docs against the real resolver and tests; do not advertise unsupported aliases or fields.- **Public-page consistency:** Login, docs, and privacy share `PublicPageHeader`, so a header fix should be tested on all three pages.
- **Preview component state:** Switching the current conditional desktop/mobile view unmounts the hidden pane. The new layout should avoid resetting editor/preview local state unnecessarily.
- **Existing thread security:** A thread ID is an untrusted user-supplied destination. Staff channel/guild permissions must be checked against the actual destination and failure must be closed.
- **Test coverage:** Several high-risk behaviors need direct tests (split-pane breakpoint/state, exploit parser state transitions, selected-row scrolling, dynamic placement math, clipboard state, thread destination authorization). Add tests at the pure-logic level where possible and component tests for user interactions.

## 5. Implementation order and boundaries

### Phase 0 — Baseline and safety

1. Reconfirm `main` head before edits.
2. Work from a new feature branch from current `main`.
3. Do not touch deployment secrets, production data, or Discord messages.
4. Do not run Terminal or Playwright until explicitly enabled by the owner.
5. Keep this handoff updated with commit and PR links after implementation.

### Phase 1 — Restore desktop workspace and remove explicitly unwanted controls

- Wire `SplitPane` (or a focused equivalent) into `StudioLayout`.
- Keep editor + preview visible together at wide widths.
- Keep narrow-screen Editor/Preview navigation.
- Remove Cozy/Compact control while preserving the default preview output.
- Remove Share from header and callback plumbing.

### Phase 2 — Repair autocomplete and floating-menu behavior

- Stabilize `{exploit.` parser and WEAO loading/error states.
- Align pure token parser with component state machine.
- Implement active-row auto-scroll for keyboard navigation.
- Replace fixed 430px heuristics with viewport-aware above/below placement.
- Ensure mobile variable menu chooses the side with more actual room.
- Fix inspector picker clipping, including portal behavior and safe-area/visual-viewport constraints.
- Apply same behavior to both MentionInput and Field's variable/rich-picker menus.

### Phase 3 — Thread ID end-to-end support

- Add optional existing Thread ID in the editor.
- Pass it separately from the message payload through `useSend`.
- Use the effective target thread/channel in `server/src/routes/send.ts`.
- Apply staff permission checks, destination guild checks, tracking and audit logging to the effective target.
- Clarify flow action field label and support sending to an existing thread ID.
- Preserve forum thread-name creation semantics.

### Phase 4 — Public pages and docs responsive repair

- Fix `PublicPageHeader` for narrow widths.
- Make docs reference cards on mobile and table on desktop.
- Replace copy text with Copy/Check icons and honest success/failure feedback.
- Verify docs content against resolver implementation after exploit/thread behavior is stable.

### Phase 5 — Shared UI system and repository-wide consistency sweep

- Review `UI_THEME_CONFIG` and CSS tokens.
- Standardize reusable buttons, inputs, menus, popovers, panel surfaces, cards, headers, and modal controls.
- Migrate the most visible inconsistent screens in small batches.
- Check every route and key editor surface for drift.
- Do not remove working functionality simply to make styles easier.

### Phase 6 — Regression and release verification

When Terminal and Playwright are available again:
- Run the existing Vitest suite with `npm test`.
- Run `npm run build` for production compilation.
- `npm run typecheck` is a separate TypeScript check; it is not a test runner. Do not substitute `tsc` for Vitest.
- Use Playwright against the app after a local build/startup is available and the owner authorizes it.- Capture screenshots and console/network diagnostics for the viewports listed below.
- Do not claim zero errors or a visual fix without a successful check.

## 6. Required regression matrix

### Responsive viewports

`320, 360, 375, 390, 430, 640, 768, 900, 1024, 1100, 1280, 1440, 1920px`.

### Studio layout

- At wide widths: editor and preview visible simultaneously; resizing divider works; no horizontal overflow; inspector docked independently.
- At tablet/mobile widths: editor and preview switch through bottom navigation; switching preserves typed content, selected component, expanded editor state, and preview state.
- At widths near the breakpoint: no abrupt clipping, collapsed pane, or inaccessible controls.

### Exploit autocomplete

- Type `{exploit.` with warm cache.
- Type `{exploit.` with cold cache.
- WEAO catalogue success, empty response, 403/permission error, 429 cooldown, timeout, and upstream outage.
- Select exploit name then field.
- Manually type exploit name and field.
- Dotted exploit names and case-insensitive input.
- Move cursor into/out of token, delete characters, type closing brace/newline, and continue typing after a completed token.
- Confirm the final inserted token is syntactically valid and the cursor position is correct.
- Verify normal variables, mentions, channels, and emojis are unaffected.

### Keyboard menu navigation and positioning

- Arrow navigation through first, middle, and last items; wrap-around; active row always visible.
- Open near top, middle, and bottom of viewport.
- Test short viewport heights and browser zoom.
- Test mobile portrait/landscape and virtual keyboard visible.
- Test inside Component Inspector at the top and bottom of its scroll region.
- Ensure no menu is cut off by viewport or parent overflow.
### Thread ID

- Send a new message to a normal channel (unchanged behavior).
- Send to an existing public thread.
- Send to an existing private thread only when the bot and caller have permission.
- Use a forum thread name to create a new forum post (unchanged behavior).
- Reject malformed or inaccessible thread IDs.
- Verify staff allowlists and guild restrictions apply to the thread destination.
- Confirm tracking and audit logs use the actual thread ID.

### Public pages and docs

- Login/docs/privacy header at 320px, 360px, 390px, 768px, and desktop.
- No horizontal overflow, overlapping brand/nav, or hidden destinations.
- Docs mobile cards show tag, explanation, example, and icon-only copy.
- Copy icon changes to check temporarily only after successful copy.
- Desktop docs table remains readable and searchable.

### UI consistency

- Compare login, docs, privacy, studio header, editor, preview, inspector, popovers, dialogs, and modals.
- Check typography scale, text colors, surfaces, border contrast, radii, spacing, button sizes, focus rings, hover/disabled/loading states, and responsive behavior.
- Preserve accessibility: labels, keyboard operation, focus visibility, touch target sizes, and reduced-motion preferences.

## 7. npm scripts — correct interpretation

Root `package.json` declares:
- `npm test` -> runs each workspace's test script; client/server/bot/shared use Vitest.
- `npm run typecheck` -> runs each workspace's TypeScript `tsc --noEmit` check.
- `npm run build` -> builds shared, client, server, and bot. Server and bot build scripts use TypeScript compilation.

**Vitest is the test runner.** Never report a TypeScript compile error as a Vitest test failure. If the owner asks for npm tests, run `npm test`. If they separately request typechecking, run `npm run typecheck`. Production build is a distinct check. Do not change scripts merely to hide compiler output.

## 8. Current validation status

- GitHub source review only.
- Source files changed in the autocomplete follow-up commits listed above; no runtime verification has been performed for those changes.
- No npm command was run.
- No Terminal command was run.
- No Playwright/browser test was run.
- No screenshots, console logs, network traces, or visual pass claims exist for this task.
- The previous reported 481-test pass belongs to an earlier local checkout state and is not a verification of the present proposed changes.

## 9. Gemini instructions

You are continuing a live codebase, not starting a new project.

1. Read this file completely before proposing edits.
2. Reopen the current `main` source files named above; do not rely on stale commit IDs or old PR status in historical handoff sections.
3. Follow the implementation phases in order and keep changes focused.
4. Fix the user's reported defects before optional optimization work.
5. Preserve existing Discord payload compatibility, OAuth/session behavior, staff permission enforcement, message editor features, backups, action flows, and WEAO security restrictions.
6. Never trust a supplied thread ID; validate destination access server-side.
7. Keep the WEAO parser state machine, autocomplete menu, and docs consistent.
8. Use shared viewport-aware menu placement rather than another fixed pixel heuristic.
9. Keep mobile single-pane navigation and wide-screen split-pane behavior distinct.
10. Use Vitest for tests. TypeScript typecheck is a separate check.
11. Do not claim Playwright/Lighthouse success until the owner turns their PC back on and those tools are actually run.
12. When the owner asks for code changes, implement them through GitHub; do not ask them to copy code.
13. Update this handoff after every merged implementation batch with actual commits, tests, and screenshots/artifacts.
14. If you discover more defects, record them with evidence and severity. Do not make unrequested removals.

## V10 Batch 14 continuation — comments-only scope — 2026-11-16

The owner explicitly requested that Batch 14's **tests work be left out**. Accordingly:
- No test files were edited, added, or removed as part of this continuation.
- No test commands were run. This is not a test-pass or zero-regression claim.
- The requested work was limited to the Batch 14 comments cleanup.

### Comments cleanup committed
Removed comments that merely repeated the immediately following JSX structure or UI label from:
- `client/src/App.tsx`
- `client/src/components/actions/StepList.tsx`
- `client/src/components/editor/AllowedMentionsModal.tsx`
- `client/src/components/editor/MessageEditor/ContentTab.tsx`
- `client/src/components/editor/PropertyPanel.tsx`
- `client/src/components/layout/Header.tsx`
- `client/src/components/layout/SettingsModal.tsx`
- `client/src/components/layout/Sidebar.tsx`
- `client/src/components/preview/MessagePreview.tsx`
- `client/src/pages/NotFoundPage.tsx`
- `client/src/components/editor/DiscohookComponentsEditor.tsx`
- `client/src/components/editor/EmbedEditor.tsx`
- `client/src/components/editor/FileAttachmentsSection.tsx`
- `client/src/components/editor/MessageEditor/index.tsx`
- `client/src/components/ui/SearchableDiscordSelect.tsx`

Retained comments that document security/authorization boundaries, Discord/API constraints, fallback behavior, state semantics, cache behavior, or non-obvious architecture. The broader sweep is scoped to the source files changed by V9/V10; comments that provide useful context were not removed merely to reduce comment count.

### Validation status
- GitHub source edits committed directly to `main`.
- No npm tests, build, typecheck, Terminal, or Playwright run was performed.
- Browser/responsive visual QA remains unverified.
- Batch 14's tests and final verification checklist remain intentionally open, per owner instruction.

**Latest comments-cleanup commit:** `81111303c2a4991487058108e7afb5d12bd1ec71`
**Branch head before this handoff update:** `81111303c2a4991487058108e7afb5d12bd1ec71`

---
**End of current handoff.**

## V10 Batch 14 continuation — sidebar reconciliation (2026-11-16)

- Replaced the previous `Elements | Templates` drawer switcher with the planned `Templates | Tracked | Actions` segmented navigation.
- Templates remain connected to the existing `useTemplates` workflow and load the selected saved template into the editor.
- Tracked now reads from the existing permission-filtered `GET /api/tracking/messages` endpoint, provides local search and refresh, and displays the channel/message identifiers without inventing a Discord guild URL (the API response does not include a guild ID).
- Actions lists the action flows currently registered in the active editor state, keyed by their component custom IDs, and shows configured step counts. It does not create or mutate flows; editing remains in the existing component inspector/FlowBuilder.
- Preserved the Layers & Hierarchy panel as a collapsible section beneath the three-way navigation so the layer-tree workflow is not lost.
- No API, persistence, permission, or server behavior was changed.

### Remaining validation and known plan alignment

- The user requested that automated tests be left for their own run after implementation. No tests were run or modified as part of this continuation.
- `npm run build` and `npm run typecheck` have not been run in this environment. Do not report compilation as verified.
- Browser-based desktop/mobile visual QA and screenshots have not been performed. The live app was not launched or interacted with during this source-only pass.
- The V10 Batch 7 MessageEditor currently renders Content, Embeds, and Components V2 as stacked sections rather than the plan's four-way Content / Embeds / Components V2 / Actions tab bar. This remains a documented UI-plan discrepancy; do not mark every V10 design detail complete.
- Current main head after this continuation: `03a454cf3d3e102074b64767ed1730be212a5a44`.

### Sidebar markup follow-up

- Corrected the tracked-message list item markup after source inspection; tracked entries are display-only because the tracking-list response contains channel/message IDs but not the guild ID required for a valid Discord deep link.
- Latest source implementation commit: `7c7a5a91619c6ecade7b20b75a9244e291500aa3`.
- This is still source-reviewed only. Build, typecheck, automated tests, and browser visual QA remain unverified.

## V10 Batch 14 — automated test authoring continuation (2026-11-16)

The owner clarified that test files should be prepared for them to run later. Test authoring is now included; **no test command has been executed**.

### Test coverage added/strengthened
- Added `client/src/utils/__tests__/mentionParserAutocomplete.test.ts`:
  - opening `{` activates the variable-token detection path;
  - partial `{explo` remains eligible for variable autocomplete;
  - the completed `{exploit.` prefix routes to exploit-name autocomplete;
  - token replacement preserves surrounding text and calculates the replacement cursor.
- Expanded `client/src/utils/__tests__/userPlaceholderAutocomplete.test.ts` to assert the complete 16-field client/server-supported placeholder contract and explicitly exclude `avatarurl`.
- Existing `server/tests/variableInterpolation.test.ts` already verifies `{now.time}` -> `<t:...:T>` and `{now.short_time}` -> `<t:...:t>`.
- Existing `server/tests/authorService.test.ts` already verifies that an enabled primary-guild clan tag resolves even when lookup for the selected guild member returns 404. No duplicate server tests were added.

### Important plan correction
The V10 plan's proposed nine-field list (`created_at`, `joined_at`) does not match the implemented resolver. The handoff's previously documented actual contract is retained: the client exposes 16 supported fields, and the server has additional special handling for roles/clantag/join timestamps. Tests now assert the live supported contract rather than codifying unsupported aliases.

### Test execution status
- Tests authored/updated: yes.
- Tests executed: no, as requested for the owner to run after implementation.
- Build/typecheck/browser QA: still not run.
- These are utility-level regression tests, not a React DOM test proving the autocomplete popover is visibly rendered; component-level interaction coverage remains a possible further improvement.

**Test-authoring commits:** `ab1162fe6fd0a2a9337a7943b296d0bd51664fbb`, `20dad46162c1cb45cc37d0c4ccfac66620918c97`, `c99443e1ccd24b8a71aa2dec5ebc19503dbe8acb`.


## V10 Batch 7 — Message Editor four-tab modernization (2026-11-16)

Implemented the Batch 7 source changes directly on `main`.

### Implemented
- Replaced the stacked MessageEditor sections with four workspace tabs: **Content**, **Embeds**, **Components V2**, and **Actions**. Embed, component, and action badges reflect the active message's current data.
- Added the compact workspace quick actions: **Import Message Link**, **Clear All**, and a mode badge/button for switching between Classic and Components V2.
- Moved the classic Action Row and Components V2 add controls into the Components tab.
- The Actions tab now derives its list from the current message's component tree (including nested components and accessories), and only displays flows whose custom IDs are present on that message. Selecting a flow selects its component and signals the existing PropertyPanel to open the FlowBuilder tab.
- Reworked ContentTab around a prominent Message Content composer and collapsible target/thread and webhook identity sections. Populated sections auto-expand. Existing thread ID and forum thread-name semantics are retained; no forum-tag field was invented because the current message model/editor does not expose one.
- Kept FileAttachmentsSection as a collapsible advanced section with its existing attachment count and upload/URL workflows; polished the dropzone and filename metadata styling.
- Updated MarkdownToolbar and RichPicker surfaces/controls to use the SaaS studio palette and compact toolbar styling.
- Updated the MessageEditor Vitest file to cover the four tabs, tab state preservation, message-scoped action listing, direct FlowBuilder inspector handoff, Clear All confirmation, and existing message-header behavior.

### Files changed
- `client/src/components/editor/MessageEditor/index.tsx`
- `client/src/components/editor/MessageEditor/ContentTab.tsx`
- `client/src/components/editor/FileAttachmentsSection.tsx`
- `client/src/components/editor/PropertyPanel.tsx`
- `client/src/components/editor/MentionInput/MarkdownToolbar.tsx`
- `client/src/components/editor/RichPicker.tsx`
- `client/src/components/editor/__tests__/MessageEditor.test.tsx`

### Validation and limitations
- Test files were authored/updated, but **no tests were executed**, per the owner's preference to run them after implementation.
- No build or TypeScript typecheck was run. No browser/Playwright visual QA was run.
- This is a source-level implementation, not a claim of zero errors. The RichPicker retains its existing four functional categories (Mentions, Time, Emojis, Variables); its internal picker behavior was not restructured merely to relabel categories.
- Clear All is scoped to the current message's content/settings and the editor's attachment collection; it removes action flows associated with components in that message and leaves unrelated flow registrations untouched.
- Existing global attachment state is shared by the editor store, so Clear All clears that attachment collection as well.

**Batch 7 commits:**
- `b24fe4c91df593e6467d55cb722d2f5a1b837b3c` — four-tab workspace
- `028e5185d24413d6464d4687df4126235e1cdf27` — ContentTab modernization
- `006007df3a44e8180c63a2b030081098b5524d5e` — attachment styling
- `105cf2353bca91b02458f00413f5cbadce73a0ad` — inspector FlowBuilder handoff
- `d2b76f9331ceeab213ccd154209836edd65171f4` — MarkdownToolbar styling
- `0f6ff67b19a3ba015a9ea4e87ac4628d49f350f7` — RichPicker styling
- `2a8b3ccd303eccd4fcef9a88cd7faeb046c56398` — MessageEditor regression tests

**Current main head:** `2a8b3ccd303eccd4fcef9a88cd7faeb046c56398`.


### Batch 7 source-review follow-up
- Removed an unused attachment-store selector from MessageEditor.
- During the post-edit source review, found a literal backslash-n sequence between two declarations in PropertyPanel (not a real line break). Replaced it with a normal newline so the declarations are valid TypeScript source. This defect was present in the fetched file before the Batch 7 handoff change; it was corrected while wiring the new Actions-to-FlowBuilder event.
- Updated the action-flow test assertion to use an explicit call count.
- Current main head before this handoff append: `450ef78c2e791dcf57d19d2440527f1933d66eb0`.
- These are source-level corrections only. No tests, build, or typecheck were run.

---

## V11 — 2b1f77b8 layout restoration and P0 repair — 2026-11-16

**Implementation head before this handoff update:** `e2d5d8e5bb1560f8896b3d655c3e1619e99b3de4`  
**Golden layout reference:** `2b1f77b81e23380202a991276eb71600e81250e6`  
**Status:** Source changes committed to `main`; automated validation is pending. Do not describe this implementation as tested or release-ready.

### Completed source changes

- Restored the stacked, single-scroll MessageEditor structure from the golden commit; restored the golden ContentTab, EmbedsTab, and ComponentsTab implementations with the requested SaaS color-token substitutions.
- Restored the golden PropertyPanel behavior so it returns `null` unless a component is selected; its component list now reads from the active message (falling back to the base data) rather than always reading `data.components`.
- Restored the golden FlowBuilder and StepList structures and the `Channel or Thread ID (defaults to current channel)` field label.
- Restored the golden LoginScreen, Header, StudioLayout, Sidebar, and MessagePreview sources. The preview source was restored without replacing its authentic Discord dark-mode colors.
- Restored the golden MessageEditor test file.
- Fixed the missing `Loader2` import in StudioModals.
- Added the missing `SpotlightCard` imports in DocsPage and PrivacyPage; corrected PrivacyPage's outer background to `#0B0D12`.
- Removed the duplicate `url` key in the DocsPage author JSON example.
- Restored SearchableDiscordSelect's expected `zIndex: 99999` and `text-[#dbdee1]` source assertions.

### Golden-reference discrepancies in the Gemini plan

The implementation follows the actual golden commit source where the plan's prose differs from it:

1. Golden `LoginScreen.tsx` includes a lazy `ThreeHeroCanvas`, but does not contain the plan's named `SpotlightCard`, `MagneticButton`, `ShinyText`, or `SplitTextReveal` composition. The golden source was treated as authoritative.
2. Golden `MessageEditor/index.tsx` footer uses the existing Set Link and Options controls (including mode conversion and Copy Message JSON). It does not have the separately described Message Link / Clear All button arrangement. The exact golden footer was retained rather than adding controls that are not in that reference.
3. The thread-ID input belongs in `ContentTab.tsx`, not in the MessageEditor root component. The restored ContentTab retains the `thread_id` input.

### Preservation and verification

- Backend, send-route, timestamp-interpolation, and autocomplete source files were not modified by this V11 restoration.
- CI workflow source was not changed; the existing removal of the deleted Playwright audit path remains in place.
- Source-level checks after the edits confirmed the expected SpotlightCard/Loader2 imports, corrected Docs JSON example, SearchableDiscordSelect invariants, no MessageEditor tab-bar identifier, retained ContentTab thread-ID field, null-on-empty EmbedsTab behavior, and null-on-no-selection PropertyPanel behavior.
- GitHub Actions has no run/status associated with implementation head `5a6ba37699caad85efd3b9d84314e8eeb492685f` at the time of this update. Older successful CI runs belong to earlier commits and are not evidence for this head.
- `npm test`, `npm run build`, `npm run typecheck`, browser interaction checks, and responsive visual checks have not been executed in this environment. Executed test count: 0.

### Required next step

Run the full test, typecheck, and build commands against the implementation head; inspect and fix every failure before calling this complete. Then perform desktop and mobile visual checks against the golden layout and record actual CI/test results here.


## Gemini V12 implementation — Batch 1 (in progress, 2026-11-16)

- Branch: `feat/v12-ultimate-ux-implementation` (branched from `main`).
- Implemented source changes: atmospheric radial-gradient/grid backdrop utilities; full-viewport constellation nodes/filaments plus lower perspective wave field; immediate static canvas paint with reduced-motion/mobile-safe behavior and idle-started desktop animation capped at approximately 29 FPS; login header flush to viewport edges with page padding moved to content wrapper; upgraded auth/showcase cards to the current studio surface palette while preserving the existing 5/7-column layout and controls.
- Files changed in this batch: `client/src/styles/globals.css`, `client/src/components/reactbits/ThreeHeroCanvas.tsx`, `client/src/components/layout/LoginScreen.tsx`.
- Source-level guard checks passed in the update script: login backdrop class present and both existing grid column spans retained. Automated tests, typecheck, build, visual QA, and Lighthouse have not yet been run.


## Gemini V12 implementation — Batch 2 (2026-11-16)

- Updated the live-preview click path to use a single bubble-phase message-card handler. Component clicks are routed to `onSelectPreviewComponent` without capture-phase propagation cancellation, so child controls can receive their own click handlers first.
- Select preview roots now advertise `data-preview-component-id`, `data-preview-interactive="true"`, and `data-preview-select="true"`; button preview's duplicate selection handler was removed. `AutoComponent` no longer performs its own competing selection routing.
- Preserved the current StudioLayout desktop/mobile routing contract: ordinary components remain routed to the editor on desktop; interactive controls open the inspector; mobile retains its quick inspector behavior. The card handler ignores component descendants for blank-card navigation.
- Files: `MessagePreview.tsx`, `ActionRowPreview.tsx`, `ComponentPreview.tsx`.
- Validation: source transformation guards passed. Automated interaction tests, typecheck, build, and browser QA remain pending.


## Gemini V12 implementation — Batch 3 (2026-11-16)

- `PropertyPanel.tsx`: message quick-edit resolves the selected message using `selection.index`; classic messages edit `content`, while Components V2 messages edit the first `TextDisplay` block. If a V2 message has no text block, the editor creates one, writes the initial text, then restores the message quick-edit selection. The UI identifies the field with a `Components V2 Text Block` badge.
- Added an `Open Full Editor` action to the quick-edit header. `StudioLayout.tsx` switches to the Editor pane and clears the overlay selection.
- `messageStore.ts`: changing the active index preserves the matching message quick-edit selection, preventing the sheet from closing during the first edit when the selected message differs from the active message.
- Files: `PropertyPanel.tsx`, `StudioLayout.tsx`, `messageStore.ts`.
- Validation: source-level guards passed. Runtime state behavior, tests, typecheck, and build remain pending.

## Gemini V12 implementation — Batch 4 (2026-11-16)

- `FlowBuilder.tsx`: replaced legacy semantic utility names with explicit SaaS Studio hex tokens for the heading, custom ID, server-mode note, and unsaved warning. Updated the mode label to `Server Bot mode`.
- `StepList.tsx` was inspected and left unchanged: the V12 plan specifies no concrete StepList code change, and its existing nested-flow/editor behavior is outside the identified token defect.
- Validation: source-level legacy-token and wording guards passed. Tests, typecheck, and production build remain pending.


## Gemini V12 implementation — Batch 5 (2026-11-16)

- Corrected the two inverted thread input surface tokens in `ContentTab.tsx`.
- Recessed the targeted helper callout surfaces in `ComponentForms.tsx` using `#10131A` with `#272D3A` borders and secondary text.
- Updated add-button/add-select dashed borders in `DiscohookComponentsEditor.tsx` to the studio border and hover palette.
- Replaced legacy Discord-gray surfaces in `Header.tsx` and `Sidebar.tsx` with the studio surface hierarchy.
- Updated `client/index.html` theme color to `#0B0D12` and body foreground/background utility classes.
- Validation: all six files matched expected legacy patterns and source-level checks passed. Full test/typecheck/build verification remains pending.


## Gemini V12 implementation — Batch 6 (2026-11-16)

- `uiThemeConfig.ts`: removed `border-color` and `box-shadow` from the shared button base transition list, retaining transform, background, text color, and opacity transitions.
- `editorSmoothScroll.ts`: skips Lenis initialization on coarse-pointer devices and leaves native momentum scrolling in place; desktop wheel smoothing remains enabled.
- Removed the now-unused `useMessageStore` import from `ActionRowPreview.tsx` after centralizing preview component selection in `MessagePreview`.
- Validation: source-level transition and pointer-gating guards passed. Lighthouse and runtime verification remain pending.


## Gemini V12 implementation — Batch 7 test additions (2026-11-16)

- `LoginScreen.test.tsx`: added assertions for the atmospheric backdrop, grid overlay, preserved 5/7 layout, and Discord OAuth CTA.
- `MessageEditor.test.tsx`: added regression coverage for a Select Menu opening in Live Preview while still notifying the inspector-selection callback, and for editing the selected message's V2 `TextDisplay` block when the selected index differs from the active index.
- Source/repository mismatch recorded: the current `LoginScreen.tsx` does not contain a Guest Sandbox CTA; it contains a development-only `Continue as Local Developer` control. The implementation did not invent a new guest-authentication path without an existing handler/contract.
- Test execution, typecheck, production build, browser QA, and Lighthouse remain unverified in the current GitHub-only editing session. Run the repository scripts before merging.

## V12 implementation checkpoint — pre-CI review (2026-11-16)

- Base branch snapshot: `main` at `bb7ab2cd97ad55736b02ef7fe095982a70313a4f` (the commit that added the Gemini V12 plan).
- Working branch: `feat/v12-ultimate-ux-implementation`.
- Completed implementation batches: 1–6 source changes, plus Batch 7 regression-test additions. The V12 changes are isolated to the working branch; `main` has not been modified.
- Batch 1–6 changed files: login screen/canvas/global styles; live preview click routing; mobile V2 quick-edit and message-store selection synchronization; FlowBuilder token cleanup; thread inputs/helper callouts/header/sidebar/index theme; shared button transitions and desktop-only Lenis wheel smoothing.
- Batch 7 test additions cover the login backdrop/layout, Select Menu interaction routing, and selected-message V2 TextDisplay editing.
- The current LoginScreen has no Guest Sandbox control or guest-auth handler. It retains the existing Discord OAuth CTA and development-only local-login action; no speculative guest-login implementation was added.
- `client/index.html` body now uses the explicit `#0B0D12` / `#F1F3F9` studio theme classes. The theme-color meta tag is `#0B0D12`.
- Verification state: no local Node execution was available through the GitHub editing path. Tests, typecheck, production build, browser QA, and Lighthouse are NOT yet verified. CI should be triggered through a draft PR and its exact results recorded before merge.


## V12 pull request and CI status (2026-11-16)

- Draft pull request: [#44 — v12: atmospheric login, preview interactions, and UX fixes](https://github.com/no-peace/Hoho_manager/pull/44).
- Working branch: `feat/v12-ultimate-ux-implementation`; target: `main`.
- GitHub reports the PR as open and mergeable. It is intentionally left as a draft pending verification.
- Post-implementation source guards were re-run against the branch and passed for preview event routing, Select Menu metadata, V2 quick-edit wiring, message-index selection preservation, FlowBuilder tokens, button transition tokens, coarse-pointer scroll gating, and login theme utilities.
- GitHub Actions currently reports zero workflow runs/check-runs for the PR head; therefore CI has not executed or reported a result yet. Do not treat the authored regression tests as passing until the CI workflow runs.
- Required pre-merge verification remains: `npm run build`, `npm run typecheck`, `npm test`, browser QA for desktop/mobile preview interactions and login layout, then Lighthouse Navigation/Snapshot/Timespan measurements.


## V12 continuation — mobile Lighthouse and unit-system optimisation (2026-11-17)

**Branch:** `feat/v12-ultimate-ux-implementation`  
**PR:** [#44](https://github.com/no-peace/Hoho_manager/pull/44)  
**Starting head for this continuation:** `0d186123d0dbec379198e0fa6d1f06d3cdc27973`

### Lighthouse evidence supplied by the owner

The latest local mobile Lighthouse Navigation report shows Performance 96 while Accessibility, Best Practices, and SEO are 100. Diagnostics supplied:
- Critical request tree includes `/api/health` and `/api/auth/me`, each taking approximately 428–429 ms.
- App stylesheet transfer is approximately 13.9 KiB and is reported as render-blocking.
- The initial JS asset is approximately 75.6 KiB, with an estimated 29.9 KiB unused.
- LCP element is a login description paragraph; element render delay is approximately 310 ms.
- A preconnect candidate to `http://localhost:3001` is estimated to save approximately 150 ms.

These are the owner's local Lighthouse measurements, not measurements reproduced by this continuation.

### Changes implemented in this continuation

1. **Auth bootstrap request reduction — `client/src/store/globalStore.ts`**
   - Removed the redundant `/api/health` request from `fetchCurrentUser()`.
   - Session resolution now awaits only `/api/auth/me`; it no longer waits for health/clock data in either success or failure paths.
   - Kept the explicit `syncServerTime()` method separate for callers that genuinely need server-clock synchronization.
   - Expected effect: removes one initial-navigation API request and its 428–429 ms dependency-tree entry. The auth request itself remains; no claim is made that its server latency has been reduced.

2. **Mobile login render work — `client/src/components/layout/LoginScreen.tsx`**
   - The decorative `ThreeHeroCanvas` is now mounted only on fine-pointer screens at 768px and wider, and only when reduced motion is not requested. The lazy module is therefore not requested by the mobile login route.
   - Automatic showcase rotation is disabled on narrow screens and for reduced-motion users; the tabs remain manually interactive.
   - Reduced the large blurred background effects on small screens and lowered card backdrop blur on mobile.
   - Migrated the login screen's custom 10px/11px typography utilities to equivalent rem values.

3. **Initial JavaScript chunking — `client/vite.config.ts`**
   - Removed the forced `vendor-icons` manual chunk. The previous rule merged every Lucide icon imported by the lazy Studio route into one shared chunk that could be pulled into the public login route.
   - Rollup is now allowed to split icon modules according to actual route usage. This is intended to reduce login-route unused JS; only the production bundle and Lighthouse artifact can confirm the result.

4. **Measurement units**
   - `client/src/config/uiThemeConfig.ts`: shared typography utilities now use equivalent rem sizes; the desktop inspector width was converted from 440px to 27.5rem.
   - `client/src/styles/globals.css`: global field font sizes use rem.
   - `client/index.html`: first-paint splash typography uses rem.
   - V12-touched files migrated custom pixel typography utilities to equivalent rem values: `ContentTab.tsx`, `ComponentForms.tsx`, `DiscohookComponentsEditor.tsx`, `Header.tsx`, `Sidebar.tsx`, `StudioLayout.tsx`, `PropertyPanel.tsx`, `FlowBuilder.tsx`, `MessagePreview.tsx`, `ActionRowPreview.tsx`, and `SplitPane.tsx`.
   - `DESIGN.md` now documents the unit policy: rem typography; percentage-based parent-relative sizing; vw only for true viewport-edge width; 100dvh for dynamic full-screen height; px for border thickness; and justified exceptions for breakpoints, canvas/protocol fidelity, and other CSS primitives.

### Decisions / items intentionally not changed

- The global stylesheet remains a normal render-blocking stylesheet. Converting it to asynchronous CSS delivery without a measured critical-CSS extraction could cause FOUC and CLS; the 13.9 KiB file should be reassessed after production build output is available.
- The `localhost:3001` preconnect candidate was not added blindly. The current app uses a same-origin `/api` path behind the Vite preview proxy; preconnecting to a development-only origin would not be correct for production. Revisit only if the production architecture actually serves the API on a distinct origin.
- No backend health or auth endpoint implementation was changed. The report alone does not establish whether the remaining `/api/auth/me` latency is server processing, cold start, or proxy overhead.
- No claim of a 100 Performance score is made. Performance scores are lab measurements and must be re-run on the production preview build.

### Verification status

- GitHub accepted the source updates on the existing V12 branch.
- GitHub Actions currently reports zero workflow runs for the latest branch head despite `.github/workflows/ci.yml` and `.github/workflows/lighthouse.yml` declaring pull-request triggers. Therefore typecheck, tests, production build, and Lighthouse have not yet been executed for these changes.
- The local Desktop Commander connection was unavailable during this continuation (MCP endpoint returned 404), so local Node/Vite/Lighthouse execution could not be started from the connected desktop.
- Required verification: run the PR CI and both mobile/desktop Lighthouse workflows; inspect the production bundle's chunk graph; compare mobile LCP, render delay, unused JS, and performance score against the supplied baseline. Do not merge until CI is green and the mobile Lighthouse regression check is reviewed.


### Post-change source guards (2026-11-17)

- Re-fetched the updated branch files from GitHub and checked the auth bootstrap no longer references `/api/health`, while still calling `/api/auth/me`.
- Confirmed the login canvas is conditionally mounted only for fine-pointer screens at 768px+ with reduced motion disabled; narrow/reduced-motion sessions also skip automatic showcase rotation.
- Confirmed the forced `vendor-icons` manual chunk is absent.
- Confirmed shared theme typography has no remaining `text-[Npx]` arbitrary pixel font utilities and global CSS has no pixel `font-size` declarations.
- Confirmed the V12-touched files `ContentTab.tsx`, `ComponentForms.tsx`, `DiscohookComponentsEditor.tsx`, `Header.tsx`, `Sidebar.tsx`, `StudioLayout.tsx`, `PropertyPanel.tsx`, `FlowBuilder.tsx`, `MessagePreview.tsx`, `ActionRowPreview.tsx`, and `SplitPane.tsx` contain no remaining `text-[Npx]` utilities.
- Confirmed the first-paint HTML splash typography uses rem and the unit policy is present in `DESIGN.md`.
- These are source-content guards only. They are not substitutes for Vitest, TypeScript, production build, browser QA, or Lighthouse execution.
- Latest implementation head before this handoff append: `b8dd14ac20c8bd58ba01e02db4962f1a133c633b`.
- Latest GitHub Actions query still returned zero runs and zero commit statuses for the branch. Desktop Commander and Playwright MCP endpoints both returned HTTP 404 during this session; local test/Lighthouse execution remains blocked by tool availability.

## Explicit server-ID placeholders — 2026-11-17

- Follow-up to PR #45: added explicit target-guild placeholders using `{server.<guild_id>.<field>}`, for example `{server.123456789012345678.icon}` and `{server.123456789012345678.banner}`.
- The existing unqualified `{server.*}` placeholders remain scoped to the server where the interaction occurred; explicit numeric IDs are namespaced and do not overwrite those values.
- The action executor scans its action-step configuration for explicit guild IDs and fetches each referenced Guild resource through Discord's `GET /guilds/{guild.id}?with_counts=true` endpoint, reusing the existing short-lived cache. Up to 10 unique target guild IDs are resolved per action to bound REST fan-out. Explicit target IDs can also resolve when the interaction itself is not in a guild.
- Target-scoped `.icon` and `.banner` return direct CDN URLs; `.icon_url` and `.banner_url` are aliases, while `.icon_hash` and `.banner_hash` expose raw hashes. Missing banner/icon values resolve to empty strings.
- Explicit target lookups first request the full Guild resource via `GET /guilds/{guild.id}?with_counts=true`. If that fails, they fall back to `GET /guilds/{guild.id}/preview`.
- The preview fallback allows access without bot membership only when Discord exposes a public preview (the guild must be discoverable). Private/non-discoverable guilds still require bot membership; inaccessible IDs remain unresolved and do not fail the action.
- Full Guild and Preview responses are cached independently for 60 seconds with in-flight request deduplication and a 500-entry bound.
- Preview-only fields are limited to the data Discord includes in the Guild Preview object; fields absent from that object resolve to empty values. Icon/banner hashes can still be converted into CDN URLs.
- Added autocomplete examples in `Field.tsx`, documentation entries in `DocsPage.tsx`, and unit tests for scoped variables and guild-ID extraction.
- Verification status: tests, typecheck, production build, browser QA, and live Discord API behavior have not been executed in this GitHub editing session. PR #45 was subsequently merged into `main` as `2608ab8f93bde889b9abf4ba0c91b8e409337e9c`; deployment is not confirmed.


### Owner visibility refinement

- The owner theme gallery query includes all saved theme rows, including legacy private themes from earlier Design Lab versions, so the owner can inspect and promote any user's saved theme.
- Non-owner accounts still see only their own themes and themes explicitly shared with the community.
- Owner publish/copy endpoints can promote a legacy private theme; the server theme itself remains owner-only.


## Design Lab usability and private preset persistence — 2026-11-17

- Moved the owner-permission-gated Design Lab link out of the main header row and into the authenticated profile dropdown. The `/design` route continues to enforce the server-side access check.
- Reworked the Puck editor chrome with Puck's supported `--puck-*` design tokens: dark branded surfaces, high-contrast labels, readable inputs, visible focus states, clearer field sizing, and responsive sidebar widths.
- The Design Lab now starts with the HoHo Manager palette and fetches the live server theme before loading the editor. The starter page is branded around HoHo Manager's Message Studio, Live Preview, and Interaction Builder. Its root exposes background, content width, text/accent/surface colors, font family, and global radius; starter blocks inherit the live server palette. Heading/text typography, button colors/radius, and feature-card surface/border/radius/padding/shadow are individually editable.
- Added reusable animation, duration, and delay fields to every visual Puck block. Supported options: fade-in, fade-up, slide-left, slide-right, zoom-in, float, pulse, and none. Duration and delay can be adjusted per block. CSS animations are disabled under `prefers-reduced-motion`.
- Private theme presets are now permanent in the local preset library: the 14-day expiry applies only to the active theme session cache. Legacy preset-library records are migrated without deleting presets, including records whose old expiry timestamp has passed.
- Saving a private preset downloads a portable `.hoho-theme.json` file. Users can import those files and export any saved preset again. This file is independent of localStorage and browser-cache cleanup.
- Files updated: `Header.tsx`, `puckTheme.ts`, `ThemeSettingsModal.tsx`, `DesignLabPage.tsx`, `designConfig.tsx`, `design-lab.css`, `PUCK_DESIGN_LAB.md`, and this handoff.
- Verification: GitHub source updates only. `npm run typecheck`, `npm test`, `npm run build`, browser interaction/responsive checks, and Lighthouse have NOT been run in this session. Do not report them as passing until executed against this commit.


## Security remediation — picomatch ReDoS (2026-11-18)

- Confirmed the lockfile contained one deduplicated `picomatch@4.0.7` package entry, marked development-only. Its consumers are the Vite/Vitest/tinyglobby build and test toolchain; no production dependency path was present in the lockfile.
- The npm registry still published 4.0.7 as latest when checked. Upstream PR #262 remains open, so there is no official patched npm release to consume yet.
- Added a temporary, private vendored fork at `vendor/picomatch`, based on upstream 4.0.7 and applying the parser mitigation from upstream PR #262 at commit `3222059ac27492d9c0147fee5c65f751bbd851ab`.
- The local package version is `4.0.8+hoho.0` to identify this patched downstream build while satisfying the existing `^4.0.7` transitive dependency ranges. The root manifest uses it as a local development dependency so npm hoists the patched implementation for transitive consumers. The MIT license and upstream patch provenance are retained in the vendor directory.
- Added a standalone ReDoS/compatibility regression script and wired it into `npm test`.
- This is a temporary downstream mitigation, not an official upstream release or maintainer-approved security release. It must be replaced with the official patched npm version when published. The upstream PR's independent reviewer reported 1,329,660 bounded matching comparisons with no differences and 35 adversarial subprocess checks under a two-second deadline; those are finite tests, not a formal proof.
- Verification: source/lockfile edits only in this session. The repository's `npm test`, `npm run typecheck`, `npm run build`, and `npm audit` have not been executed. GitHub Actions are disabled per owner instruction.


## Root and infrastructure audit — Batch F1 (2026-11-18)

- Reconciled the tracked tree to 367 files across 66 directories; the older 356-file count was stale.
- Added `docs/REPOSITORY_AUDIT_LEDGER.md` with a per-file inventory and explicit review states. Root/infrastructure source review covers 25 files; the 10 vendored picomatch files have provenance/metadata review only; application files remain pending.
- Removed the CI test job's fallback to repository Discord secrets/variables. CI now uses synthetic bot token, public key and application ID values only.
- Updated `.github/WORKFLOWS.md` to state that Actions are currently disabled by owner instruction; workflow definitions remain configured but are not executing.
- Updated local setup instructions to use `npm ci` against the committed lockfile.
- Remaining source-review findings: local Docker Compose still uses the documented development-only `dev-admin-key` fallback; the optional Cloudflare Tunnel overlay uses a mutable `latest` image; Semgrep is installed without a version pin. These are recorded for a later controlled decision, not silently changed.
- No commands were executed. Automated checks, Docker validation, workflow validation, browser QA and deployment remain unverified.


## Shared package audit — Batch F2 (2026-11-18)

- Inspected all 10 files under `shared/`: package manifest, constants, custom-ID codec, exports, domain types, both test files, and TypeScript/Vitest configuration.
- Confirmed `WEBHOOK_URL_REGEX` is still used by `server/src/utils/validation.ts` and `discordService.getWebhookInfo`; it is not an orphaned constant.
- Confirmed `send_webhook_message` remains in the shared persisted action type for compatibility while runtime dispatch is disabled. Do not restore execution merely by retaining the type.
- Found a duplicate identical `LoggingConfig` interface declaration in `shared/src/types.ts`. It is harmless interface merging and was left unchanged rather than making an unrelated cleanup.
- No functional defect was confirmed. Tests/build/typecheck were not executed.


## Server core audit — Batch F3 (2026-11-18)

- Reviewed 25 server files covering startup, app middleware, environment, database/Turso pipeline, session/authentication, Discord signature verification, staff access routes, core API routes, crypto, URL attachments, and representative tests.
- Fixed migration atomicity: pending migrations now run under one transaction, and the migration ledger is read after acquiring the transaction lock to prevent partial application and stale concurrent startup reads.
- Confirmed the production session-signing key still falls back to `ADMIN_API_KEY`, and verification continues accepting that key for legacy sessions even when `SESSION_SECRET` is configured. This is an open security-hardening item; coordinate a separate production secret and the 24-hour session transition before removing compatibility.
- Source review found strong controls in Discord signature verification, interaction relay validation, staff authorization and URL-attachment SSRF protections. No live security test was performed.
- Updated both client/server Dockerfiles to copy `vendor/picomatch` and use `npm ci`; Docker builds remain unverified.


## Server routes/templates audit — Batch F4 (2026-11-18)

- Inspected template routes/service/repositories, action repository and registry, interaction handler, branch execution helpers, variable interpolation, author resolution, Discord/design/executor/WEAO routes and validation tests.
- Fixed template partial-update semantics: omitted descriptions no longer clear stored descriptions; explicit null/empty values clear them.
- Wrapped template creation and updates in one database transaction so template rows/documents and action definitions cannot be left partially updated.
- Added runtime validation for template action definitions (25 flows, 20 steps per flow, 500 total steps, 128 KiB config, custom-ID and execution-order checks) and regression tests.
- Remaining planned items: structured action-failure metadata; reconcile the still-registered `send_webhook_message` handler with persisted-flow compatibility; verify whether optional profile IDs are truly disabled in `resolveBotToken`.
- No tests, typecheck, build, browser QA or live Discord calls were executed.


## Structured action-failure follow-up — 2026-11-18

- Replaced string-prefix failure detection in `actionExecutor.ts` with an internal `failed: true` marker returned by `actionFailed()`.
- The executor now records failed status from structured metadata and strips the internal marker before returning the Discord interaction response. The public response payload remains only `type` and `data`.
- Added regression coverage that a disabled legacy webhook action is logged as failed while the internal marker is not exposed in the Discord response.
- Verified that `send_webhook_message` is retained only as a disabled compatibility handler (no webhook delivery call), and that `resolveBotToken` ignores legacy profile IDs and always selects the configured server bot token.
- No tests were executed.


## Client audit — Batch F5 (2026-11-18)

- Reviewed client session/API state, stores, published-layout refresh, Puck preview/runtime boundary, StudioLayout, SplitPane, PropertyPanel, mobile quick-edit, message preview, dispatch modal, mention checks and related helpers.
- Fixed multi-channel edit target mapping: every selected channel now requires its own distinct Discord message snowflake; the previous fallback that reused the first ID has been removed. Added parser regression tests.
- Corrected no-access UI copy from `Custom Bot Mode` to `Access Required` / `Server Bot Access Required`; the only active dispatch path uses the configured server bot.
- Corrected stale direct-webhook and custom-profile comments. Direct webhook sending remains a disabled stub; custom profile IDs are ignored by the server token resolver.
- Confirmed Puck `MobileBottomNavigation.activeTab` is deliberately preview-only; production pane default comes from `MobileWorkspace.defaultPane`.
- Preview link construction reviewed: Markdown and embed links are restricted to HTTP/HTTPS. The full Markdown renderer and remaining preview components still need review.
- No browser QA, tests, typecheck or build were executed.


## Bot security audit — Batch F6 (2026-11-18)

- Found a critical authorization gap: `/send`, `/exploit` and `/sync` invoked admin-key-protected API operations without checking the invoking Discord user. Since the server treats the admin key as an administrator, these commands bypassed normal staff authorization.
- Fixed by requiring the invoking Discord user ID to be configured in `BOT_COMMAND_ADMIN_IDS` (fallback: `OWNER_DISCORD_IDS`). Unauthorized `/exploit` autocomplete returns no choices. Empty allowlist disables all three commands.
- Fixed fail-open startup: the gateway worker now exits on any environment validation error, including an insecure production API URL or weak/default admin key.
- Added tests for command denial, operator-ID parsing and unsafe production configuration. No tests/typecheck/build/live Discord QA were run.
- Deployment action required: set `BOT_COMMAND_ADMIN_IDS` or `OWNER_DISCORD_IDS` in the bot service environment before using the privileged slash commands.


## Sender identity audit — Batch F7 (2026-11-18)

- Removed the send route's request-body `authorUserId` fallback. Sender identity now comes from the verified staff/session context only; legacy request-body values are ignored.
- The manual tracking route previously accepted an arbitrary `authorUserId` from a staff caller. Because tracked-message sync later uses that ID for author and `{user.name}` placeholders, this enabled content to be personalized as a different user. The route now rejects supplied overrides and stores the authenticated actor ID.
- Added `actorIdentity.ts` and regression tests for authenticated actor resolution and override rejection.
- Reviewed tracking allowlists, configured-bot message ownership checks, template visibility checks and mention scrubbing.
- No tests, typecheck, build or live Discord calls were executed.


## Private-template dispatch audit — Batch F8 (2026-11-18)

- Found that the send route accepted a caller-provided `templateId` and persisted it on tracked messages without checking template visibility/ownership. A staff caller could bind a message to another user's private template and cause background sync to use that private template.
- Fixed by validating the template ID, confirming the record exists, and allowing only public templates, templates owned by the authenticated user, or Head Admin access.
- Extracted the access policy into `templateAccess.ts` and reused it in the manual tracking route. Added focused access-policy tests.
- No tests, typecheck, build or live Discord calls were executed.



## Server persistence and request-boundary audit — Batch F9 (2026-11-18)

- Source-reviewed eight additional files: migration catalog, error middleware, multipart parser, active-session repository, persistent session-revocation repository, API error primitives, logger and request parsing helpers.
- Confirmed multipart limits (10 files, 25 MiB per file, 50 MiB aggregate file data, 2 MiB per field, 100 fields, 120 parts), parameterized session repository queries, guild-scoped session revocation, persistent per-user/global JWT revocation floors, and fail-closed parsing of malformed allowlists.
- Confirmed the synthetic default active-session behavior is reached through Head Admin-protected Discord session routes; it remains existing compatibility behavior.
- No new confirmed defect or code change resulted from this batch.
- The production `SESSION_SECRET` / `ADMIN_API_KEY` compatibility fallback remains an open security-hardening item. Do not remove it until a dedicated production secret is configured and the 24-hour session transition is planned.
- Verification: source review only. No tests, typecheck, build, database migration, browser QA, Lighthouse or live service calls were executed.


## Components V2 validation audit — Batch F10 (2026-11-18)

- Reviewed the complete 642-line `server/src/utils/validation.ts` and its existing `server/tests/validation.test.ts`.
- Found that the recursive component walker silently stopped at depth greater than 25 and ignored null, primitive and array entries. Malformed component trees could therefore pass local validation and be rejected only by Discord.
- Fixed the walker to report malformed component entries and excessive nesting as validation errors.
- Added focused regression tests for null component entries and a component tree exceeding the 25-level limit.
- Preserved the existing Discord component count, action-row, select, text and action-flow bounds.
- Verification: source changes and test additions only. Tests, typecheck, build, browser QA and live Discord requests were not executed.


## Custom-executor enablement audit — Batch F10 (2026-11-18)

- Found that custom-executor lookups by title/ID could return disabled records, and resolve/send/tracking/sync did not consistently enforce the enabled flag.
- Added shared enablement validation across the WEAO resolve route, send route, manual tracking route and background synchronization.
- Adjusted `/resolve-exploit` to support the authenticated machine-admin context used by the bot without requiring a browser session; non-admin requests still require an authenticated staff user and template access checks.
- Added focused tests for enabled/disabled values. No tests, typecheck, build or live Discord calls were run.


## Discord REST boundary audit — Batch F12 (2026-11-18)

- Reviewed the complete `server/src/services/discordService.ts` and `server/tests/discordService.timeout.test.ts`.
- Confirmed all bot REST helpers use the configured server token; legacy profile IDs are ignored. The arbitrary webhook-send export remains a forbidden stub, while webhook inspection is read-only.
- Confirmed bounded REST/multipart/interaction timeouts and bounded retry counts. Interaction callback timeout errors omit the interaction token and URL; existing regression coverage asserts this.
- Confirmed TTL/entry bounds and in-flight request coalescing on guild, user and member lookup caches.
- No new credential disclosure, token-selection bypass or confirmed functional defect was found.
- Verification: source inspection only. The existing timeout tests and live Discord API behavior were not executed.


## WEAO upstream cache audit — Batch F13 (2026-11-18)

- Reviewed the complete `server/src/services/weaoService.ts` and `server/tests/weaoService.test.ts`.
- Found that changelog comparison baselines/comparison maps were bounded indirectly through the response-cache size. Expired cache entries removed after failed refreshes could leave successful baselines resident while the cache shrank, allowing later unique keys to push the baseline/comparison maps beyond the intended 250-entry bound.
- Fixed eviction to use the baseline map's own size, deleting the corresponding baseline, comparison and response-cache entries together. Successful refreshes now move their baseline to the newest position.
- Added a regression test for failed expired-cache refreshes followed by new-key insertion and baseline eviction.
- Verification: source changes and test additions only. Tests, typecheck, build and live WEAO API calls were not executed.


## Action execution audit — Batch F11 (2026-11-18)

- Fixed the self-assignable role permission mask: `MUTE_MEMBERS` and `DEAFEN_MEMBERS` were checked against the wrong bits and could pass. Correct bits 22/23 are now blocked, alongside other moderation/administration permissions and `CREATE_EVENTS`.
- Removed direct webhook delivery, profile-aware `sendChannelMessage(profileId)` and webhook-profile repository access from the action handler context. The legacy `send_webhook_message` handler remains a disabled failure stub for old persisted flows and is hidden from the action picker.
- Reviewed action execution, stored-flow binding, modal/component routing, duplicate interaction receipts and acknowledgement timing.
- Added role-safety regression tests. No tests, typecheck, build or live Discord interactions were run.


## Server performance audit — Batch F14 (2026-11-18)

- Reviewed all server benchmark harness files and the guild-variable, maintenance, settings, audit-log and settings-repository paths.
- Found that the settings cache had no entry limit and did not cache missing-guild defaults. Requests spanning many distinct guild IDs could retain an unbounded number of cache entries; repeated lookups for unconfigured guilds repeatedly hit SQLite/Turso.
- Implemented a 500-entry LRU cache, recency refresh on hits, and 30-second negative caching for missing guild settings. Settings updates write through to the same cache.
- Added `server/tests/settingsService.test.ts` for cache hits, negative caching, TTL expiry, LRU eviction and update write-through.
- Reviewed benchmark methodology, recursive Guild variable expansion, chunked retention sweeps and fire-and-forget audit logging. No further optimization was applied without baseline measurements or evidence of a production bottleneck.
- Verification: tests added but not executed; no typecheck, build, benchmark, database query plan, browser QA or live Discord request was run.


## Owner-reported dependency audit result (2026-11-18)

- The user ran `npm audit --omit=dev` locally and reported: `found 0 vulnerabilities`.
- This establishes a clean npm audit result for the production dependency tree as checked by the user's local environment. The full development-inclusive `npm audit` output was not provided.
- No dependency files were changed in Batch F14.

## Server performance audit — Batch F14 (2026-11-18)

- Reviewed all server benchmark harness files and the guild-variable, maintenance, settings, audit-log and settings-repository paths.
- Found that the settings cache had no entry limit and did not cache missing-guild defaults. Requests spanning many distinct guild IDs could retain an unbounded number of cache entries; repeated lookups for unconfigured guilds repeatedly hit SQLite/Turso.
- Implemented a 500-entry LRU cache, recency refresh on hits, and 30-second negative caching for missing guild settings. Settings updates write through to the same cache.
- Added `server/tests/settingsService.test.ts` for cache hits, negative caching, TTL expiry, LRU eviction and update write-through.
- Reviewed benchmark methodology, recursive Guild variable expansion, chunked retention sweeps and fire-and-forget audit logging. No further optimization was applied without baseline measurements or evidence of a production bottleneck.
- Verification: tests added but not executed; no typecheck, build, benchmark, database query plan, browser QA or live Discord request was run.


## Client performance audit — Batch F15 (2026-11-18)

- Reviewed `SearchableDiscordSelect.tsx`, `discordCacheStore.ts` and the selector's existing tests.
- Found a broad Zustand subscription: every SearchableDiscordSelect instance rerendered for any Discord cache state update, including unrelated WEAO metadata or another guild's channel/role data.
- Replaced it with narrow field-level subscriptions, selecting only the active guild's channel/role arrays and stable fetch actions.
- Memoized option projection and search filtering to avoid repeating list mapping/filtering on dropdown-only state changes.
- Added a regression test that updates unrelated `weaoMeta` state and asserts the selector does not rerender.
- Confirmed that guild/channel/role/emoji fetches already coalesce concurrent requests. Member search is debounced and stale writes are suppressed, but the API helper currently lacks AbortSignal support; this remains a possible follow-up for cancellation.
- Verification: regression test added but not executed. No browser profiling, React Profiler capture, tests, typecheck or build was run.


## Client preview performance audit — Batch F16 (2026-11-18)

- Reviewed Markdown, EmbedPreview, user-placeholder resolution and ReactBits canvas/primitive components with their existing tests.
- Found that resolving any one Markdown user mention notified every mounted UserMention component through a global listener set, producing unnecessary rerenders as mention count grew.
- Replaced the global listener set with per-guild/user subscriptions using `useSyncExternalStore`.
- The resolved-member cache was unbounded and had no expiry. Added a 500-entry LRU limit and five-minute TTL, including short-lived cached misses.
- Added a focused test for guild-scoped mention resolution.
- Confirmed EmbedPreview is memoized and its field grouping is linear; user-placeholder lookup already batches, debounces and aborts stale work; the hero canvas bounds scene complexity/DPR and cleans up animation resources; GSAP primitives clean up animations and respect reduced-motion. No further optimizations were made without profiling evidence.
- Verification: test added but not executed. No React Profiler, browser performance trace, tests, typecheck or build was run.


## Client action-editor performance audit — Batch F17 (2026-11-18)

- Reviewed `FlowBuilder.tsx` and the complete recursive `StepList.tsx`.
- Found that each static `member_has_role` RoleSelect fetched guild roles directly and held a separate local copy. Multiple role checks in one flow could issue duplicate requests despite the shared Discord cache already implementing per-guild caching and in-flight request coalescing.
- Updated RoleSelect to subscribe to the selected guild's cached roles and use the shared `fetchRoles` action.
- Added a test that mounts two RoleSelect controls for the same guild and asserts that only one API request is made.
- Confirmed FlowBuilder memoizes decoded steps and StepList memoizes action type options. Deep branch recursion and large-flow render cost remain candidates for profiling; no arbitrary UI limit or broad memoization was added.
- Verification: test added but not executed. No React Profiler, browser trace, tests, typecheck or build was run.


## Server repository and polling performance audit — Batch F18 (2026-11-18)

- Reviewed nine repository implementations, three repository test files and the migration/index catalog. Cross-checked the tracked-message sync service.
- Found repeated `customExecutorRepository.findByTitle` calls for tracked messages sharing the same exploit name, and repeated template reads for shared template IDs. Added per-sweep promise memoization by normalized executor title and template ID.
- Found that the 30-second interval could launch overlapping async sync sweeps. Added a single-flight guard so concurrent callers share one in-progress sweep.
- Added `server/tests/messageTrackerService.performance.test.ts` for repeated lookup reuse and overlapping sweep suppression.
- Query/index review: a `LOWER(title)` expression index may help custom executor title lookups, but it is deferred until query-plan and workload evidence are available. The existing migrations already index flow/interaction receipt expiry and staff cooldown keys; staff cooldown updates use atomic upsert.
- Found `profileRepository` still targets the `webhook_profiles` table dropped by migration 011. Current references are legacy exports; action execution no longer injects this repository into action context. Do not re-enable it without restoring its storage contract.
- Verification: tests added but not executed. No SQLite query plan, benchmark, tests, typecheck, build or production database access was run.


## Client editor performance audit — Batch F19 (2026-11-18)

- Inspected `client/src/components/editor/MessageEditor/index.tsx` and its existing regression suite.
- Replaced whole-array and whole-selection Zustand subscriptions with selectors scoped to each message card. Editing one message should no longer rerender unrelated MessageEditor instances; selected-target reveal behavior remains scoped to the owning card.
- Added a React Profiler regression test for unrelated-card render isolation.
- No tests, typecheck, build, browser profiling or benchmark was executed.


## Client editor/preview and remaining server source review — Batch F20 (2026-11-18)

- **Implementation commits:** `ccf4a0a` scopes `PropertyPanel` to the message currently represented by the inspector; `ac1da01` adds a React Profiler regression test. `82a5b67` scopes `SelectPreview` channel/role cache subscriptions to the selected guild; `acaad60` adds a React Profiler regression test; `10cdd7e` adds the missing `act` import required by that test.
- `PropertyPanel` no longer subscribes to the whole messages array. A change to a different message leaves the pinned inspector's selected message object unchanged, so the panel should not commit a render for that update.
- `SelectPreview` no longer subscribes to whole `channels` and `roles` cache maps. Updates for another guild leave the selected guild's arrays unchanged and should not rerender the menu.
- Reviewed remaining editor tabs and preview components. No broad memoization, component-tree caching or other preview/editor optimization was applied without profiling evidence. MessagePreview intentionally renders all messages, and its clock refresh is once per minute; Discord cached channel/role option lists are capped at ten.
- Reviewed remaining server runtime files `server/src/routes/health.ts`, `server/src/types/express.d.ts`, and `server/src/utils/appLayoutValidation.ts`. No performance fix was justified by source evidence alone. The health query and 64 KiB layout payload validation remain unchanged pending measurements.
- Reviewed `server/tests/variableInterpolation.test.ts` and `server/tests/interactionMemory.test.ts`. Other server test inventory items remain pending in `docs/REPOSITORY_AUDIT_LEDGER.md`.
- Audit ledger updated in `449134f`. Client source/test review count is 46/162; server source/test review count is 120/142. These are source-inspection counts, not execution/verification results.
- **Verification not performed:** no tests, typecheck, build, browser profiler capture, benchmark, Lighthouse, database query plan, deployment or live service verification. GitHub Actions remain disabled by owner instruction.


## Additional editor cache-subscription audit — Batch F21 (2026-11-18)

- **Implementation commits:** `e3ce40f` scopes DiscohookComponentsEditor to `componentsOverride` when supplied; `5a7a5a0` scopes LayersPanel to `data.components`; `acd7edf`, `b329db7`, and `a5140e3` scope MentionInput channel/role/emoji subscriptions to the active guild; `58a7676` does the same for RichPicker. Follow-up commits `543bea0`, `5630935`, and `65a1288` keep empty fallback arrays stable.
- **Regression tests added:** `client/src/components/editor/__tests__/DiscohookComponentsEditor.test.tsx`, `LayersPanel.test.tsx`, and `RichPicker.test.tsx`; `DiscordMentionInput.test.tsx` now also checks that unrelated-guild cache updates do not rerender the mention input.
- Important missed edge found after F20: `DiscohookComponentsEditor` was still subscribing to `state.data` even when its parent supplied a message-specific `componentsOverride`. This meant an inactive message's nested component editor could rerender on edits to the active message. The selector now returns the supplied override and only reads active message components when no override is passed.
- LayersPanel now avoids rerenders for content-only edits when its component tree is unchanged. MentionInput and RichPicker now avoid rerenders when another guild's channel, role or emoji cache changes.
- No request cancellation, list virtualization, broad memoization, or algorithm rewrites were made; no profiling evidence justified them. Existing debounce and bounded suggestion rendering remain intact.
- Audit ledger updated in `1b4aed2`. Client source/test review count is 57/165 (source inspection; tests not executed). Server count remains 120/142.
- **Verification not performed:** no tests, typecheck, build, React Profiler browser capture, benchmark, browser QA, Lighthouse, or live API profiling. GitHub Actions remain disabled by owner instruction.
