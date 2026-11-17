> **Current status update — 2026-11-18:** Parts A (UI/preview regressions), B (responsive Puck Design Lab) and C (database publishing/live Studio runtime) are integrated into `main`; Parts D/E (themes, Docs and Settings) are also integrated. A separate hardening/audit branch, `feat/remove-legacy-dispatch-and-hardening`, now removes active webhook URL sending and custom bot-profile dispatch (including retired staff permission fields via migration 018), replaces warning-text action failure detection with structured outcomes, separates Puck preview-only settings from the production runtime contract, hardens Discord acknowledgement/duplicate handling, and requires gateway slash commands to carry the invoking Discord actor for live staff permission checks. The branch is not merged. Its code snapshot before documentation reconciliation is `b2d0490af16a52f2be7ab343373de2f4ec555117`. The current tracked tree has 355 files; `docs/REPOSITORY_AUDIT_LEDGER.md` tracks the ongoing file-by-file audit. The Bot package (23 files) has been read; the complete repository audit is not finished. Source tests were added/updated but not executed. The owner will run `npm run typecheck`, `npm test` and `npm run build` locally after implementation is ready. Browser QA, Lighthouse, live Discord integration, migration execution and deployment remain unverified. GitHub Actions are intentionally disabled. See `docs/GEMINI_HANDOFF_CURRENT.md` for the current implementation truth and remaining work.

# HoHo Manager — Master Implementation Plan

**Repository:** https://github.com/no-peace/Hoho_manager  
**Branch:** main  
**Baseline commit:** 73b344a7316851211339a55e7f98d54b83a38a2e  
**Status:** Active implementation plan. This document is the source of truth for the coordinated agent program.

## 1. Objective

Complete and verify the existing HoHo Manager repair and improvement work without rebuilding features that already exist or regressing Discord message editing, dispatch, authentication, Studio navigation, themes, or responsive behavior.

The program covers:
- Existing UI regressions and preview/editor interactions.
- Puck-based responsive Design Lab.
- Persistent, owner-authorized, atomic Desktop/Mobile layout publishing.
- Applying published layouts to the real Studio runtime without redeployment.
- Theme permissions, caching and private preset durability.
- Docs, Settings and shared UI consistency.
- Full repository audit.
- Performance, accessibility, security and final verification.

## 2. Non-negotiable rules

1. Inspect current source and history before changing anything. Historical handoff statements are leads, not proof of current correctness.
2. Do not rebuild existing working features. Identify the remaining gap first.
3. Preserve Discord message editing/dispatch, authentication, server selection, profile access and critical editor controls.
4. Keep Desktop and Mobile layout documents independent.
5. Publishing must validate and persist both responsive documents atomically.
6. Only the owner and explicitly authorized Discord IDs may publish server layouts or server themes; enforce this on the server.
7. Never execute arbitrary JavaScript, HTML or unrestricted CSS from Design Lab documents.
8. Preserve private theme presets. The 14-day expiry applies only to the active theme session cache, not the preset library.
9. Do not expose environment secrets.
10. Respect reduced motion and accessibility.
11. Preserve the reported mobile Lighthouse Performance baseline of 97; do not pursue speculative optimization.
12. Never claim tests, builds, browser QA, Lighthouse or deployment passed unless actually performed.
13. Avoid overlapping edits. Coordinate shared files through `docs/AGENTS.md`.
14. Update `docs/GEMINI_HANDOFF_CURRENT.md` after approved implementation batches.
15. Review diffs and commit only authorized, complete batches.

## 3. Existing repository evidence to reconcile

The latest handoff at the baseline records:
- V12 login, preview selection, mobile quick-edit, FlowBuilder and shared UI work.
- Theme application/cache, Docs layout and Settings fixes.
- A Puck-based Responsive Design Lab with separate Desktop and Mobile documents, independent local drafts, versioned import/export, editor controls and representative preview.
- Puck 0.24 integration and client-side document validation.
- No production layout API/database migration or live runtime publishing in the recorded Design Lab batch.
- Test execution, typecheck, production build, browser QA and Lighthouse are not verified for the latest implementation batches.

Verify each item in source. Do not assume it is complete merely because it appears in the handoff.

## 4. Part A — Baseline, UI regressions and interaction integrity

Inspect the actual current implementations and close remaining regressions in:
- Login atmosphere, viewport layout, public header and reduced-motion behavior.
- Live Preview interaction handling, select menus, embed selection and Components V2 nested selection.
- Desktop preview-to-editor/inspector navigation.
- Mobile preview selection, inspector sheet, pane switching and quick-edit.
- Selected-message index correctness and Components V2 TextDisplay editing.
- FlowBuilder labels, colors and helper surfaces.
- Shared Studio surfaces, headers, sidebars and settings controls.

Preserve Discord-native styling inside Discord message mock previews. Do not invent a guest-authentication flow without an existing contract.

**Done when:** confirmed regressions are fixed, focused regression coverage exists, and actual verification status is recorded.

## 5. Part B — Responsive Design Lab

Audit and complete the existing Puck editor; do not replace it with a generic website builder.

Desktop controls should cover supported header sizing/spacing, logo, editor/preview split, panel order, inspector width/side, workspace gap, panel surfaces/padding/radius and safe motion presets.

Mobile controls should cover header sizing, default Editor/Preview pane, workspace spacing, inspector sheet preview, pane/tab order, bottom navigation dimensions/colors/labels and safe motion presets.

Requirements:
- Desktop and Mobile documents remain independent.
- Editing one never overwrites the other.
- Preserve per-user local draft persistence and versioned import/export.
- Use supported Puck APIs and protected shell components.
- Preview accurately represents the supported real Studio layout without mounting a second full Studio instance or mutating message state.
- Define and document the exact document schema, defaults, validation rules and runtime contract for Part C.

**Done when:** the Head Agent has reviewed and approved the responsive document/schema handoff.

## 6. Part C — Database, secure API and live publishing

This part is gated by explicit Head Agent approval of Part B's schema.

Implement:
- An idempotent, forward-only database migration.
- One persisted responsive configuration containing Desktop document, Mobile document, schema version, publisher identity and timestamps.
- Read-published-layout and publish-both-layouts API operations.
- Server-side owner/authorized Discord ID checks.
- Strict component/property allowlists, valid dimensions/colors, bounded animation options, unique IDs, document size limits and schema validation.
- Validate both documents fully before any database write.
- Atomic persistence: no half-published Desktop/Mobile state.
- Safe fallback to built-in defaults if stored configuration is missing or invalid.
- Connect resolved published settings to the actual Studio shell: header, split pane, editor, preview, inspector and mobile navigation.
- Refresh published configuration at controlled points without excessive polling.
- No Render redeployment required for a published layout to take effect.

Publishing UX must distinguish local draft from published state, show unsaved state, validate both documents, require explicit confirmation and report the actual server result.

**Done when:** an authorized owner can publish both documents atomically and the real Studio loads the new layout without redeployment; permissions and validation tests pass.

## 7. Part D — Theme management and private presets

Keep distinct:
1. Server theme.
2. Personal user theme.
3. Community/shared theme.
4. Private preset library.

Requirements:
- Personal themes never overwrite the server theme.
- Server theme publication is owner/authorized-ID only and enforced server-side.
- Personal active-theme cache is isolated per user; guest cache is separate.
- The 14-day login-based expiry applies to active-theme cache only.
- Login/opening the app refreshes the relevant active cache expiry.
- Cache cleanup must never delete private preset records.
- Preserve portable `.hoho-theme.json` import/export.
- Validate required tokens, colors, contrast, font/radius allowlists and scoped CSS.
- Reconcile all behavior with the current theme implementation before changing it.

**Done when:** user, guest, community, server and private preset behaviors are isolated, permission-safe and covered by tests.

## 8. Part E — Docs, Settings and shared UI

- Preserve responsive Docs tables/cards and scoped styling.
- Ensure Settings controls have correct semantics, one toggle per interaction, visible keyboard focus and no no-op navigation.
- Use existing `DESIGN.md` and `UI_THEME_CONFIG` as references.
- Prefer shared primitives; avoid a parallel styling system.
- Preserve Discord-native preview rendering.
- Avoid unrelated global CSS changes.

**Done when:** Docs, Settings and shared Studio surfaces are consistent and regression-free.

## 9. Part F — Full repository audit (Head Agent owned)

Audit every tracked file systematically across:
- Root/build/CI/deployment/environment configuration.
- Shared types, schemas, validators and utilities.
- Client routes, stores, API, editor, preview, inspector, actions, Design Lab, themes, public pages, hooks, components and styles.
- Server middleware, auth/session, routes, services, repositories, migrations, Discord integrations, validation, errors, logging and external requests.
- Bot startup, commands, events, API calls, cooldowns and failure handling.
- Tests, fixtures and documentation.

For every file evaluate correctness, imports/exports, callers, lifecycle, async cleanup, error handling, security, performance, accessibility, responsive behavior and test coverage.

Maintain an audit ledger with reviewed files, findings, fixes and intentionally unchanged areas. Do not rewrite working code for cosmetic reasons.

## 10. Part G — Performance, accessibility and security (Head Agent owned)

- Preserve mobile Lighthouse Performance baseline 97; profile before optimizing.
- Review unnecessary React renders, Puck costs, repeated API calls, event listeners, timers, canvas and scroll work.
- Respect reduced motion.
- Check keyboard navigation, focus, semantics, labels, contrast, touch targets and validation feedback.
- Review auth, sessions, authorization, validation, CSS/document handling, public/private data, secrets, rate limits and database boundaries.
- Do not weaken security to simplify the editor.

## 11. Part H — Verification and delivery (Head Agent owned)

Run the repository's actual available commands, including where applicable:
```bash
npm run typecheck
npm test
npm run build
```

Add/verify coverage for:
- Responsive document validation and independent state.
- Atomic publishing, migration, authorization and invalid-document rejection.
- Live runtime application and fallback behavior.
- Theme cache expiry, user isolation, permissions and import/export.
- Preview selection, mobile quick-edit and login/UI regressions.

Browser QA at 1440, 1200, 768, 390 and 320 px. Verify login, auth, Studio, editor, preview, inspector, dispatch, themes, Design Lab, import/export, publishing, Docs and Settings. Record console/network errors and overflow. Run Lighthouse only when the environment is available and compare with baseline 97.

Final handoff must state latest commit, completed batches, changed files, architecture decisions, actual tests/build/browser/Lighthouse results, migration/deployment status, known limitations and remaining work. Never claim deployment without evidence.

## 12. Execution order and dependencies

1. A — UI regression reconciliation and fixes.
2. B — Responsive Design Lab reconciliation and completion.
3. C — publishing/runtime integration, only after Head Agent approves B's schema.
4. D/E — theme and consistency work, coordinated around shared files.
5. F — complete repository audit.
6. G — performance/accessibility/security review.
7. H — final verification and delivery.

Parts A and B may proceed in parallel only on non-overlapping files. Part D/E may begin with inspection; implementation is gated by the Head Agent's shared-file coordination decision. Part C is blocked until Part B is approved.

## 13. Definition of done

The program is complete only when:
- Existing UI and preview flows work without regression.
- Desktop/Mobile Design Lab documents are independent and validated.
- Owner-only publishing persists both documents atomically.
- Published layouts apply to the real Studio without redeployment.
- Theme and private preset permissions/storage are correct.
- Docs and Settings are verified.
- Every tracked file is accounted for in the audit ledger.
- Automated/browser checks and their actual results are recorded.
- Mobile Lighthouse Performance has not materially regressed from 97.
- Gemini handoff accurately matches the repository.
