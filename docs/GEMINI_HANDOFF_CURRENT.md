# HoHo Manager — Current Gemini Handoff & Repair Plan

**Updated:** 2026-11-16  
**Repository:** https://github.com/no-peace/Hoho_manager  
**Production URL:** https://hoho-manager.onrender.com  
**Authoritative branch:** `main`  
**Current main head:** `1d4c8934c70a855f6ffaa456d6c2f809ea789314`  
**Implementation baseline:** `7f35b433ecff73c20fdfa323263b6eccf40bfb88`  
**Plan sources:** `docs/hoho_v9_untangle_and_bug_fix_master_plan.md` and `docs/hoho_v10_master_ui_redesign_and_untangle_plan.md`  
**Status:** V9 batches 1–6 and V10 batches 1–13 have source-level changes committed to `main`. V10 batch 14 and full runtime/release verification remain open. Do not describe this branch as tested or release-ready.

## Latest implementation checkpoint — 2026-11-16

The work continued from the live `main` head, not from the older audit snapshot. The current implementation contains 30 commits ahead of the V9 baseline.

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
1. The V9/V10 text says the ID-based user placeholder contract is exactly nine fields and names `created_at` / `joined_at`. The current `authorService.ts` does not implement those aliases. It resolves `name`, `displayname`, `globalname`, `username`, `tag`, `id`, `avatar`, `url`, `profile`, `mention`, `created`, `created.relative`, plus the special `roles`, `clantag`, `joined`, and `joined.date` fields. The client autocomplete currently reflects this broader existing contract. Do not silently replace it with the nine-field list; that would remove supported placeholders and advertise unsupported aliases.
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
- GitHub Actions: no workflow run is associated with current head `1d4c8934`; the latest listed runs target older commits. Combined status checks for the implementation head were empty.

### Next exact step
Continue V10 Batch 14 with a focused comments/test audit, then run `npm test`, `npm run build`, and `npm run typecheck` when the owner explicitly makes the local machine available. Fix every failure before recording actual test counts. Do not claim a visual pass without browser verification.

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
- npm test — invokes each workspace test script; Vitest is the test runner.
- npm run typecheck — builds shared first, then runs TypeScript tsc --noEmit checks in workspaces.
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
- interpolateWeaoPlaceholders() supports exploit-name and tracker-ID lookups, changelog selectors such as [n], [start:end], negative slices, and .changelogs.compare.
- server/tests/weaoService.test.ts covers formatting, empty results, tracker-ID resolution, and incremental comparison.
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
- partial name -> filtered catalogue;
- selected name -> `{exploit.<canonical-name>.` and field state;
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
- **Docs truthfulness:** `DocsPage` and `Field.VARIABLES` are separate hardcoded variable inventories. They can drift from actual server interpolation. After the functional fixes, reconcile docs against the real resolver and tests; do not advertise unsupported aliases or fields.
- **Public-page consistency:** Login, docs, and privacy share `PublicPageHeader`, so a header fix should be tested on all three pages.
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
- Use Playwright against the app after a local build/startup is available and the owner authorizes it.
- Capture screenshots and console/network diagnostics for the viewports listed below.
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

---

**End of current handoff.**
