# HoHo Manager V6 — Master Implementation Plan

> Project-side structured copy of the supplied V6 master plan. The earlier V4 six-batch plan remains available at [hoho_v4_lighthouse_sileo_skiper_cult_three_plan.md](./hoho_v4_lighthouse_sileo_skiper_cult_three_plan.md). This V6 plan is the newer 14-stage implementation guide.

## Repository and execution rules

- Repository: `no-peace/Hoho_manager`
- Default branch: `main`
- Production URL: https://hoho-manager.onrender.com
- Implement through the GitHub repository; do not ask the project owner to paste code.
- Inspect target files before editing. Preserve existing behavior, test selectors, accessibility attributes, and exact test strings.
- Run the relevant workspace typechecks, full `npm test`, and builds after changes.
- Use natural human commit messages. Avoid generic AI-sounding prefixes and titles.
- Do not claim a test or performance improvement until its workflow/report confirms it.

## Global UI system

### Surfaces
| Level | Color | Use |
|---|---|---|
| 0 | `#111214` | recessed toolbar wells, code blocks, table headers |
| 1 | `#18191c` / `#1e1f22` | app chrome, headers, inputs, modal chrome |
| 2 | `#232428` | accordion headers and secondary cards |
| 3 | `#2b2d31` | primary editor panels and modal bodies |
| 4 | `#313338` | Discord preview canvas |
| 5 | `#35373c` | hover surfaces |

- Structural border: `#26282d`; inner divider: `#1e1f22`; active ring: `#5865f2`.
- Geometry: `rounded-md` for badges/keycaps, `rounded-lg` for controls, `rounded-xl` for top-level cards. Avoid `rounded-2xl` and `rounded-[4px]` on standard cards and controls.
- Sans: Geist/SF Pro/system sans. Mono: Geist Mono/JetBrains Mono/SF Mono; use tabular numerals for IDs, counters, timings, and timestamps.
- Text hierarchy: `#f2f3f5`, `#dbdee1`, `#b5bac1`, `#949ba4`; accessible blurple text: `#949cf7`.
- Never animate layout dimensions or use `transition-all`. Prefer explicit transform/color/opacity/shadow transitions. Keep typing and frequent editor actions animation-free.
- Buttons use a brief press scale; popovers use short anchored enter/exit motion.

## Loading and test-preservation contracts

- Remove `RouteSkeleton`. Show the classic centered HoHo logo + three pulsing dots + “Verifying Discord session…” only during initial `authLoading`.
- Lazy pages and modals use `Suspense fallback={null}`; data-fetching modal bodies use a compact inline spinner and one-line label.
- Preserve all existing `data-testid`, `aria-label`, `title`, `role`, placeholders, and test-required text substrings.
- All existing client, server, bot, and shared tests must pass. Do not weaken tests merely to make a redesign pass.

## Stage-by-stage scope

### Stage 1 — Theme tokens and global styles
Files: `client/src/config/uiThemeConfig.ts`, `client/src/styles/globals.css`.
- Preserve existing config keys and add shared tokens for toolbar groups, section cards, accordion headers, empty states, and keycaps.
- Expose the `loading-dots` animation as a reusable `.loading-dot` utility with staggered delays.

### Stage 2 — Classic auth loader
File: `client/src/App.tsx`.
- Delete `RouteSkeleton`.
- Add the compact centered `SessionAuthLoader` for initial auth loading only.
- Use null Suspense fallbacks for lazy docs/privacy pages and lazy studio/modal boundaries.

### Stage 3 — Public and authentication pages
Files: `LoginScreen.tsx`, `DocsPage.tsx`, `PrivacyPage.tsx`, `NotFoundPage.tsx`, `PublicPageHeader.tsx`.
- Unify public header chrome, card surfaces, navigation controls, and button geometry.
- Keep one Discord login CTA and preserve the scroll-root test selector.
- Make docs variable placeholders copyable monospace pills with a clear copy hint.
- Keep one H1 per page and preserve heading order.

Login test invariants: `data-testid="login-screen-scroll-root"` contains `h-dvh` and `overflow-y-auto`; exactly one “Login with Discord” button; auth errors use `role="alert"`; showcase tab and “Submit Application” action retain “Action triggered:”.

### Stage 4 — Studio shell and navigation
Files: `Header.tsx`, `StudioLayout.tsx`, `SplitPane.tsx`, `Sidebar.tsx`.
- Group Backups, JSON, Copy JSON, Clear all, and Dispatch in a recessed action rail.
- Keep keyboard shortcuts for backups and dispatch.
- Polish the mobile Editor/Preview/Dispatch navigation.
- Preserve header aria labels for Backups, JSON import/export, Copy JSON, Clear all, and Dispatch.

### Stage 5 — Shared UI primitives
Files: `Button.tsx`, `Field.tsx`, `Modal.tsx`, `Tabs.tsx`, `ColorPicker.tsx`, `DateTimePickerPopover.tsx`, `SearchableDiscordSelect.tsx`.
- Keep button dimensions stable while loading and show a compact spinner.
- Add a mobile modal grab handle without breaking dialog role, modal semantics, focus trap, or Escape close.
- Keep searchable select portal positioning, z-index, accessible combobox name, keyboard Snowflake entry, and option selection behavior.

### Stage 6 — Message, embed, and Components V2 editor
Files: `MessageEditor/*`, `DiscohookComponentsEditor.tsx`, `EmbedEditor.tsx`, `FileAttachmentsSection.tsx`, `MessageLinkModal.tsx`, `JsonModal.tsx`.
- Standardize accordion headers, nested embed sections, counters, action rows, and component cards.
- Preserve “Message 1”, “Classic”, rename/duplicate/delete/collapse/expand titles, and message placeholder test strings.

### Stage 7 — Mention input and rich picker
Files: `MentionInput/index.tsx`, `MarkdownToolbar.tsx`, `AutocompletePopover.tsx`, `RichPicker.tsx`.
- Make the toolbar compact and horizontally scroll-safe.
- Make autocomplete options and keyboard hints visually clear.
- Preserve toolbar title attributes, textarea placeholder, and `@`, `#`, and `{` trigger behavior.

### Stage 8 — Flow builder and property inspector
Files: `PropertyPanel.tsx`, `FlowBuilder.tsx`, `StepList.tsx`, `ComponentForms.tsx`, `LayersPanel.tsx`.
- Use a desktop right inspector and a mobile/tablet sheet with backdrop.
- Add numbered step badges and distinct pass/fail branch accents.
- Preserve action semantics and branch structure.

### Stage 9 — Live Discord preview
Files: `MessagePreview.tsx`, `EmbedPreview.tsx`, `ActionRowPreview.tsx`, `ContainerPreview.tsx`.
- Polish the preview toolbar, message switcher, density toggle, and empty state.
- Prevent long URLs/tokens from causing horizontal overflow.
- Preserve preview and user-placeholder rendering tests.

### Stage 10 — Studio and admin modals
Files: `BackupsModal.tsx`, `BotDispatchModal.tsx`, `AccessPanel.tsx`, `SettingsModal.tsx`, `SessionsModal.tsx`, `AuditLogsModal.tsx`, `ServerBotAccessModal.tsx`.
- Unify filters, list rows, card borders, and modal interiors.
- Use compact inline loading rows instead of skeletons.
- Preserve modal behavior and all selectors.

### Stage 11 — Bot slash-command messages
Files: `bot/src/commands/ping.ts`, `status.ts`, `server.ts`, `send.ts`, `exploit.ts`, `sync.ts`.
- Improve message hierarchy and status summaries.
- Preserve exact command reply substrings and expected error/success strings in `bot/tests/commands.test.ts`.
- In particular preserve “Pong!”, the latency format, database connected line, uptime, server/member/boost values, send confirmation/error format, exploit autocomplete labels, and sync counts.

### Stage 12 — Server-dispatched embeds and action replies
Files: `server/src/routes/weao.ts`, `server/src/services/auditLog.ts`, `server/src/actions/*`.
- Improve default executor status cards, audit embeds, jump links, and role/thread/DM action confirmations.
- Preserve all substrings asserted in `server/tests/actions.test.ts` and route tests.

### Stage 13 — Tests and verification
Files include login, bot command, and server action tests.
Run:
```bash
npm run typecheck --workspace client
npm run typecheck --workspace server
npm run typecheck --workspace bot
npm test
npm run build --workspace client
```
Also run the repository CI/security workflows and Lighthouse mobile + desktop jobs when changing performance or public UI.

### Stage 14 — Final self-audit
- Review each stage against the actual source and tests.
- Identify incomplete items instead of marking them complete by assumption.
- Confirm the final branch/commit, workflow run IDs, Lighthouse metrics, and remaining issues.
- Keep the report and handoff documentation current.

## Human commit-message examples

- `tighten theme config tokens and clean up globals.css`
- `remove route skeleton and bring back old session loader in App.tsx`
- `make login, docs, privacy and 404 pages match the same card style`
- `clean up top header toolbar grouping and studio layout spacing`
- `unify buttons, inputs, modals and popovers with theme config`
- `polish message editor, embed editor and v2 component cards`
- `clean up mention input toolbar, autocomplete popup and rich picker`
- `improve flow builder steps, branch badges and property panel`
- `polish live discord preview spacing and embed rendering`
- `clean up backups, dispatch, access, settings and audit modals`
- `redesign slash command replies in bot worker`
- `improve weao exploit status embed, audit log embed and action replies`
- `update tests for old loader and bot message formatting`
