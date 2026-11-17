# HoHo Manager — Full-stack repair and Design Lab implementation plan

Baseline branch: `main`
Baseline commit inspected: `c3cd6ad78ab7275bf786431b64db76ffe3c72903`
Baseline repository tree: 321 tracked files (125 client source, 82 server source, 10 shared source, 54 test/spec files, 4 docs files; remaining files are root/config/assets/tooling).
This is a staged execution plan. A batch is complete only after code review, appropriate tests/checks, a direct commit to main, and a handoff update.

## Confirmed baseline findings

- The current `/design` route lazy-loads `DesignLabPage.tsx`, which imports Puck 0.24.0 and a marketing/page-builder configuration (`designConfig.tsx`). Its starter content is a generic HoHo-branded promotional page, not the current Studio application.
- Puck design drafts are stored in localStorage by `puckDesignStorage.ts`. Existing server design routes and migrations persist theme records and theme tokens, but there is no database-backed desktop/mobile application-layout document or API.
- The real application layout lives in `StudioLayout.tsx`, `Header.tsx`, `SplitPane.tsx`, `MessageEditor.tsx`, `MessagePreview.tsx`, and `PropertyPanel.tsx`. Desktop split behavior and mobile pane navigation are currently implemented directly in React/CSS.
- The Theme button in `Header.tsx` calls `setThemeSettingsOpen(true)` and the modal is lazy-loaded. The modal's theme controls call `applyUiTheme`, but the real Studio uses many fixed classes; trace the full control-to-render path and repair any mismatch rather than assuming the click handler is absent.
- The latest main commit is `c3cd6ad78ab7275bf786431b64db76ffe3c72903`, titled `fix theme scope and general settings selection`. The current handoff's top status still names the older `97d38f0...` commit and must be reconciled.
- General Settings currently renders a single General tab; its tab button has a no-op click handler. The event selection rows now have a stable row background and a separate checkbox indicator. Confirm the final focus/keyboard behavior and remove dead interaction code.
- Docs has desktop table and mobile-card variants, plus SpotlightCard wrappers. The reported broken state needs a route/browser reproduction and responsive checks; do not replace working responsive variants speculatively.
- Puck 0.24.0 is installed. Its supported APIs include `renderFields`, `FieldGroup`, `FieldTab`, custom fields, slot-field `allow` rules, component/global permissions, viewports, and `dnd` configuration. Use the installed version's actual API, not guessed props.

## Batch A — Baseline and architecture (in progress at plan creation)

1. Read the current main ref and latest commit; enumerate the tracked tree.
2. Inspect app routing/auth, Header, StudioLayout, SplitPane, editor/preview/inspector, theme modal/utilities/API/server routes/migrations, Design Lab/Puck config/storage/CSS, Docs, Settings, package scripts, and current tests.
3. Read the official Puck docs for the installed 0.24 API and changelog.
4. Produce an implementation map, acceptance tests, and risk list. Record any discrepancy between handoff and main.
5. Do not claim a full repository line-by-line audit is complete from a focused-file inspection.

**Exit criteria:** baseline commit/tree are pinned; actual rendering/persistence boundaries are understood; no prepared-but-uncommitted blob is mistaken for a live code change; handoff is reconciled.

## Batch B — Existing UI regressions

1. Trace Theme button click -> modal mount -> theme data load -> field change -> CSS token application -> Studio DOM consumption -> persisted active theme. Test with an authenticated account and owner/non-owner paths.
2. Fix theme controls that appear to do nothing. Ensure every advertised control changes the intended real Studio surfaces; preserve the server theme and local personal override precedence.
3. Reproduce the Docs issue at desktop and mobile widths. Inspect route shell, overflow/scroll containers, SpotlightCard clipping, table/card switching, and CSS cascade. Fix only confirmed causes.
4. Verify Settings event checkboxes: row surface remains stable, only the checkbox indicator changes, label click toggles exactly once, and keyboard focus is visible. Remove the dead single-tab click handler or implement real tab state if multiple tabs exist.
5. Add focused regression tests.

**Exit criteria:** all three reported UI issues have a clear reproduction and a tested fix; no unrelated layout regressions.

## Batch C — Design Lab redesign around the real application

1. Keep `/design` owner-only and keep its entry in the profile dropdown; remove any duplicate top-bar Design Lab entry.
2. Replace the unrelated marketing-page starter with a representation of the current HoHo Manager Studio shell.
3. Provide explicit Desktop and Mobile editing modes, each initialized from the current actual app layout. They are separate responsive configurations, not one viewport scaling the same settings.
4. Design a readable Puck inspector using 0.24's supported `renderFields`, `FieldTab`, and card `FieldGroup` APIs; group controls by Structure, Sizing & spacing, Appearance, Navigation, and Motion.
5. Expose meaningful controls for the real shell: header, editor/preview split, inspector, mobile tabs/navigation, dimensions, spacing, colors, borders, radii, typography, and safe visibility toggles.
6. Add a curated motion system (none/fade/fade-up/slide/zoom/float/pulse), bounded duration/delay, and reduced-motion handling. Do not allow arbitrary CSS or JS.
7. Protect critical controls and structural regions. Users must not be able to remove Send/Dispatch, authentication/profile, server selection, editor, preview, or required mobile navigation.
8. Make live preview representative of the real Studio components, not just decorative sample cards. Ensure editor changes are visible in the actual preview and can be understood before publishing.
9. Keep the Puck editor and its CSS lazy-loaded; avoid expensive full-tree transformations on every field change.

**Exit criteria:** desktop and mobile start with faithful HoHo Manager layouts; inspector is readable; safe customization and animation work; critical UI cannot be deleted.

## Batch D — Database publication and live application runtime

1. Add a forward-only idempotent migration for one atomic desktop/mobile layout record, publisher, schema version, and update timestamp.
2. Add public read and owner-only write endpoints. Validate both documents completely before any write; save them in one transaction/upsert.
3. Use strict allowlists for component types, props, CSS values, dimensions, order, motion names, and timing. Reject malformed, oversized, duplicate-ID, or unsafe payloads.
4. Load the published layout with the existing server theme on startup; use safe built-in defaults if no valid published layout exists.
5. Apply Desktop values only to desktop shell and Mobile values only to mobile shell. Reconcile resize/orientation changes without losing user/editor state.
6. Refresh published layout at controlled points (initial authenticated/anonymous load and focus/visibility refresh); avoid tight polling.
7. Add API, migration, validation, and runtime tests. Ensure no redeploy is required for subsequent published layout changes.

**Exit criteria:** owner publish updates the live website from the database; all visitors receive the correct responsive layout; malformed content falls back safely; desktop/mobile documents publish atomically.

## Batch E — Durable private presets

1. Keep active personal theme selection separate from the preset library and its expiry policy.
2. Treat portable `.hoho-theme.json` files as the durable backup/export format; support export of each preset, import, schema validation, and duplicate-safe IDs.
3. Never silently delete a preset because an active session expires or a cleanup/error-recovery routine runs.
4. Clearly distinguish private local presets from explicitly shared community theme definitions.
5. Add tests for storage unavailable/full, corrupt records, old records, import/export round trips, and cleanup preservation.

**Exit criteria:** users can recover presets from files after browser storage is cleared; private presets never expire automatically; active theme cache can expire independently.

## Batch F — Performance, accessibility, and safety

1. Profile Puck editor and Studio runtime for unnecessary renders, effects, expensive selectors, repeated API calls, and large object serialization.
2. Debounce local draft persistence; never write to the server for each field keystroke. Publish only on explicit save.
3. Avoid mounting the full production Studio twice if a lightweight faithful preview can reuse shared shell components.
4. Use static DnD only where it improves the actual editor; preserve usable selection/reordering where permitted.
5. Respect reduced motion, keyboard navigation, focus visibility, labels, contrast, and responsive touch targets.
6. Keep CSS scoped to the intended surface. No global selector should break Docs, login, or other public pages.
7. Add targeted performance and accessibility regression tests.

**Exit criteria:** editor interactions remain responsive; no uncontrolled animation/DOM work; keyboard and reduced-motion paths work; no theme/layout style leakage.

## Batch G — Systematic repository audit

Review the complete tracked tree in deterministic batches rather than claiming an unverified one-pass review:

1. Root manifests, lockfiles, build/test/lint/TypeScript configuration, deployment config, environment templates, CI.
2. Shared package types, validators, schemas, constants, and utilities.
3. Client app entry, routing, stores, API clients, auth, layouts, editor, preview, actions, components, pages, utilities, hooks, styles, assets.
4. Server app entry, middleware, routes, services, repositories, auth/session/security, database, migrations, external integrations, logging, jobs.
5. Tests and fixtures; compare test coverage with critical user flows and add missing regression cases.
6. Documentation and deployment instructions; remove stale claims and keep handoff synchronized.
7. For each file, inspect imports/exports, callers/callees, error paths, state lifecycle, async cleanup, accessibility, responsive behavior, and security boundaries. Change only confirmed defects or justified improvements.
8. Keep a per-batch audit ledger in the handoff with reviewed paths, findings, changes, and intentionally unchanged areas.

**Exit criteria:** all 321 baseline files and any newly added files are accounted for in the audit ledger; confirmed defects are fixed or explicitly listed with rationale; no claim of "every line audited" without a completed ledger.

## Batch H — Verification and delivery

1. Run `npm run typecheck`, `npm test`, and `npm run build` at the repository root, plus package-specific checks where scripts require it.
2. Add/run server migration/API tests and client Puck/layout/storage tests.
3. Validate owner and non-owner permissions, anonymous/default layout fetch, theme apply/reset, desktop/mobile publish, import/export, Docs, Settings, and the critical message send flow.
4. Use browser tests at representative desktop/tablet/mobile sizes and check console/network errors.
5. Run mobile and desktop Lighthouse; compare against the user's prior mobile baseline (97) and investigate material regressions.
6. Review final Git diff and database migration compatibility. Confirm no secrets, local files, or generated artifacts are committed.
7. Update `GEMINI_HANDOFF_CURRENT.md` with final commit SHA, architecture, decisions, tests actually run, results, deployment/migration notes, and remaining limitations.

**Exit criteria:** clean checks, functional browser paths, updated handoff, direct commit(s) to main, and a precise delivery report. Never report a check as passing unless it was run.
