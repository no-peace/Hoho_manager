# HoHo Manager — Current Gemini Handoff & Repair Plan

**Prepared:** 2026-11-16  
**Repository:** https://github.com/no-peace/Hoho_manager  
**Production URL:** https://hoho-manager.onrender.com  
**Authoritative branch:** `main`  
**Latest autocomplete-fix application commit:** `0e75bfbe43babf410b4cadbddb791848ded7a12f`  
**Current branch:** `main` (use the live GitHub commit history as the authoritative head)  
**Repository tree:** 303 tracked files after adding the shared floating-position utility and its Vitest suite  
**Status:** Source-level implementation and follow-up autocomplete fixes are committed on `main`; npm checks and browser validation are still pending. The latest autocomplete changes have not yet been runtime-verified.

> **Read this document first.** It supersedes the stale branch/PR status and earlier implementation status near the top of `docs/GEMINI_HANDOFF_REPORT.md`. The older report remains below as historical project context. Current source on `main` is authoritative.

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
- Check whether the anchor/max-height props are actually consumed by `AutocompletePopover`; merely passing props is not sufficient if the popover does not use them.
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
