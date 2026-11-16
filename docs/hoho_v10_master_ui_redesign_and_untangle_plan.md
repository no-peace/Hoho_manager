# HoHo Manager V10 — Complete Codebase Untangle & 3-Pillar UI/UX Remake Master Plan

- **Target Repository**: [no-peace/Hoho\_manager](https://www.google.com/search?q=https://github.com/no-peace/Hoho_manager) (`main` branch)
- **Production Environment**: [`https://hoho-manager.onrender.com`](https://hoho-manager.onrender.com)
- **Baseline Snapshot Audited**: Commit `7f35b433ecff73c20fdfa323263b6eccf40bfb88` (`2026-11-16T04:43:30Z`, following `0e75bfbe43babf410b4cadbddb791848ded7a12f` and `c35d762b5862046ae95394f17ffafcdd1989917e`) in the [`HoHo Manager` NotebookLM knowledge base](https://gemini.google.com/notebook/e8f024b3-7812-4f1f-97cd-afa0966538fd)
- **Role Assignment**:
  - **Lead Architect & Auditor**: Gemini
  - **Execution & GitHub Connector Agent**: ChatGPT

---

## 0. Team Lead Directives for ChatGPT (Read Before Executing)

1. **Sequential Execution Across All 14 Batches**:
   - There is **no 6-batch limit** on this plan. Execute **Batches 1 through 14 sequentially** on `main`, committing after each batch (or logical group of batches) until the entire plan is complete.
   - **Only pause** if a specific change hits an unexpected runtime blocker that cannot be verified statically or via the test suite. Otherwise, proceed all the way through Batch 14 and update `docs/GEMINI_HANDOFF_CURRENT.md` at the end.
2. **Optimize for the Best User Experience (Not Smallest Diff)**:
   - For the **Untangle & Bug Fix passes (Batches 1–2 & 14)**: Remove duplicated parsers/interpolators, fix confirmed functional bugs, strip restating comments, and clean up brittle tests while preserving exact runtime behavior.
   - For the **UI/UX Redesign passes (Batches 3–13)**: Prioritize **maximum visual polish, clarity, hierarchy, and usability** rather than minimizing line diffs. Every screen, panel, input, and modal should look and feel like a cohesive, high-craft developer SaaS studio.
3. **Preserve Functional Architecture & Data Contracts**:
   - **This is a complete UI/UX redesign and codebase untangle — NOT a functional rewrite.**
   - Do **not** remove, break, or simplify existing features, Zustand stores (`useMessageStore`, `useAuthStore`, `useThemeStore`, `useToastStore`), API endpoints (`/api/send`, `/api/templates`, `/api/actions`, `/api/discord`, `/api/weao`, `/api/tracking`, `/api/backups`), or Discord Components V2 payload structures.
4. **Commit Message Style**:
   - Use **natural, casual lowercase human commit messages** (e.g., `fix ci workflow and unify variable interpolation`, `establish saas studio tokens and typography scale`, `redesign header sidebar and workspace split pane`).
   - **Never** use robotic conventional-commit prefixes like `feat:`, `chore:`, `refactor:`, or `fix:`.

---

## 1. The Three-Pillar Visual Architecture (Critical Separation of Concerns)

To make HoHo Manager feel like a top-tier SaaS product while keeping its live Discord preview 100% trustworthy, the frontend MUST enforce a strict **Two-Zone Token Boundary** across three functional pillars:

| Pillar | Scope / Component Directories | Target Visual Identity | Surface & Accent Palette |
| :--- | :--- | :--- | :--- |
| **Pillar 1: Dashboard & Application Shell** | `LoginScreen`, `PublicPageHeader`, `Header`, `Sidebar`, `StudioLayout`, `SplitPane`, `DocsPage`, `PrivacyPage`, `NotFoundPage`, `StudioModals`, `BackupsModal`, `AccessPanel`, `SettingsModal`, `SessionsModal`, `ServerBotAccessModal` | **Premium SaaS Developer Studio** (inspired by Linear, Raycast, Vercel, and modern IDEs) | **SaaS Studio Tokens**: `#0B0D12` main bg, `#10131A` secondary bg, `#161A23` elevated surface, `#1D2230` interactive surface, `#252B3A` hover surface, `#272D3A` default border, `#202531` subtle border, `#818CF8` primary indigo accent, `#6366F1` primary hover, `#A78BFA` secondary accent |
| **Pillar 2: Message Creator, Inspector & Action Flow Studio** | `MessageEditor/*`, `EmbedEditor`, `DiscohookComponentsEditor`, `ComponentForms`, `PropertyPanel`, `LayersPanel`, `FlowBuilder`, `StepList`, `MentionInput/*`, `RichPicker`, `Field`, `Button`, `ColorPicker`, `DateTimePickerPopover` | **Professional Message & Automation Creator Tool** (clean hierarchy, collapsible advanced sections, non-bold secondary labels, distinct step badges) | **SaaS Studio Tokens** (`#10131A` / `#161A23` / `#1D2230` surfaces, `#818CF8` focus ring, semantic status colors `#34D399` / `#FBBF24` / `#F87171` / `#60A5FA`) |
| **Pillar 3: Live Discord Preview Canvas** | `client/src/components/preview/*` (`MessagePreview`, `EmbedPreview`, `ComponentPreview`, `ContainerPreview`, `ActionRowPreview`, `Markdown`, `UserPlaceholderPreviewContent`) | **100% Authentic Discord Dark Theme** (pixel-accurate representation of how the message renders inside the real Discord client) | **Authentic Discord Tokens**: `#313338` chat canvas, `#2b2d31` embed/container surface, `#1e1f22` codeblock/tertiary surface, `#5865f2` Discord blurple buttons & `APP` badge, `#f2f3f5` primary text, `#dbdee1` body text, `#949ba4` muted/timestamp text, `520px` max width |

> **Why Pillar 3 Must Keep Authentic Discord Colors**:
> 1. Users rely on the live preview to verify exact contrast, embed border colors, spoiler pills, and button styles before dispatching to Discord.
> 2. `client/src/__tests__/m4_challenger2_layout_stress.test.ts` explicitly inspects `EmbedPreview.tsx` for Discord dark-theme surface/text classes (`bg-[#2b2d31]`, `text-[#dbdee1]`, `text-[#f2f3f5]`, `text-[#949ba4]`) and `520px` containment rules. Keeping `client/src/components/preview/*` on authentic Discord tokens preserves both user trust and layout regression tests.

---

## 2. Centralized Design System Specifications (Pillars 1 & 2)

### 2.1 Color Token System (`client/src/styles/globals.css` & `client/src/config/uiThemeConfig.ts`)

| Token Category | CSS Variable | Hex / Value | Usage |
| :--- | :--- | :--- | :--- |
| **Main Background** | `--bg-main` / `--bg-primary` | `#0B0D12` | App root background, primary workspace canvas, public page background |
| **Secondary Background** | `--bg-secondary` | `#10131A` | Sidebar, top header bar, editor column background, modal footer |
| **Elevated Surface** | `--bg-elevated` / `--bg-tertiary` | `#161A23` | Cards, collapsible sections, modal body, inspector panels, floating popovers |
| **Interactive Surface** | `--bg-interactive` | `#1D2230` | Form inputs, selects, code/token pills, inactive segmented controls |
| **Hover Surface** | `--bg-hover` / `--bg-modifier-hover` | `#252B3A` | List row hover, sidebar item hover, secondary button hover |
| **Default Border** | `--border-default` / `--border-subtle` | `#272D3A` | Primary panel dividers, card borders, input borders, modal borders |
| **Subtle Border** | `--border-muted` | `#202531` | Internal list dividers, table row hairlines, section separators |
| **Focus Border** | `--border-focus` | `#818CF8` | Input `:focus-visible` border and `2px` focus ring (`rgba(129, 140, 248, 0.25)`) |
| **Primary Accent** | `--accent-primary` / `--brand-primary` | `#818CF8` | Primary CTAs, active tab indicator, selected component outline, focus ring |
| **Primary Accent Hover** | `--accent-primary-hover` / `--brand-hover` | `#6366F1` | Primary CTA hover/active state |
| **Secondary Accent** | `--accent-secondary` | `#A78BFA` | Trigger/flow badges, variable token highlights, subtle secondary accents |
| **Accent Background** | `--accent-subtle-bg` | `rgba(129, 140, 248, 0.12)` | Active sidebar item fill, selected tab pill fill, active chip background |
| **Primary Text** | `--text-primary` | `#F1F3F9` | Page headings, section titles, input values, primary button labels |
| **Secondary Text** | `--text-secondary` | `#A1A8B8` | Field labels, navigation items, descriptions, modal body copy |
| **Muted Text** | `--text-muted` | `#6F788A` | Placeholders, character counters, helper hints, disabled labels |
| **Success Semantic** | `--status-success` | `#34D399` | Connected status dot, pass branch badge, valid payload indicator |
| **Warning Semantic** | `--status-warning` | `#FBBF24` | Rate-limit / unsaved changes notice, caution badge, character limit warning |
| **Error Semantic** | `--status-error` / `--status-danger` | `#F87171` | Validation errors, destructive buttons, fail branch badge, disconnect alert |
| **Info Semantic** | `--status-info` | `#60A5FA` | Informational banners, variable interpolation hints, webhook/bot info |

### 2.2 Typography Hierarchy
- **Font Stacks**:
  - `--font-sans`: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
  - `--font-mono`: `'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, monospace`
- **Scale & Weight Discipline (Stop Making Every Label Bold)**:
  - **Page Title**: `24px–28px` (`1.5rem–1.75rem`), `font-weight: 600`, `letter-spacing: -0.02em`, `color: var(--text-primary)`
  - **Section Title**: `16px–18px` (`1rem–1.125rem`), `font-weight: 600`, `letter-spacing: -0.01em`, `color: var(--text-primary)`
  - **Card / Panel Title**: `14px–15px` (`0.875rem–0.9375rem`), `font-weight: 600`, `color: var(--text-primary)`
  - **Body Copy & Input Text**: `13px–14px` (`0.8125rem–0.875rem`), `font-weight: 400`, `line-height: 1.5`, `color: var(--text-primary)`
  - **Field Labels & Secondary UI Text**: `12px–13px` (`0.75rem–0.8125rem`), `font-weight: 500` (**never `font-bold` or `uppercase tracking-widest`**), `color: var(--text-secondary)`
  - **Technical Labels / IDs / Counters / Monospace Badges**: `11px–12px` (`0.6875rem–0.75rem`), `font-family: var(--font-mono)`, `font-weight: 500`, `color: var(--text-muted)`

### 2.3 Spacing, Radii, & Motion Rules
- **Spacing Scale**: Strictly use `4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`, `40px`, `48px` (`gap-1`, `gap-2`, `gap-3`, `gap-4`, `gap-5`, `gap-6`, `gap-8`, `gap-10`, `gap-12`).
- **Border Radius**:
  - Controls (buttons, inputs, selects, badges): `6px–8px` (`rounded-md` / `rounded-lg`)
  - Larger surfaces (cards, collapsible panels, modals, popovers): `10px–12px` (`rounded-[10px]` / `rounded-xl`)
  - **Ban** `rounded-2xl` / `rounded-3xl` / `rounded-full` on rectangular cards or form controls (keep `rounded-full` only for avatars, status dots, and toggle switches).
- **Anti-Bloat Visual Rules**:
  - Remove multi-stop neon gradients, glowing box-shadows, `ShinyText` shimmer animations, and background WebGL/Three.js particle canvases (`ThreeHeroCanvas`).
  - Keep transitions between `120ms` and `220ms` (`cubic-bezier(0.16, 1, 0.3, 1)` or `ease-out`).
  - **Loading Skeletons**: Never wrap static forms or already-loaded local state in full-panel shimmer skeletons. Use a clean inline spinner (`14px–16px`) inside buttons or header status pills when an async action is in flight, and reserve subtle skeleton rows strictly for initial async list fetches (e.g., first load of templates, channels, or backups).

---

## 3. Evidence-Backed Codebase Audit (Bugs, Duplication & Stale Assumptions)

Every item below was verified directly against commit `7f35b433ecff73c20fdfa323263b6eccf40bfb88` in the [NotebookLM source snapshot](https://gemini.google.com/notebook/e8f024b3-7812-4f1f-97cd-afa0966538fd):

### 3.1 Confirmed Functional Bugs & Regressions

| # | Location | Bug / Evidence | Exact Fix Required |
| :--- | :--- | :--- | :--- |
| **B1** | `.github/workflows/ci.yml` (lines 38–39) | Runs `node --check docs/playwright/audit.mjs`. Commit `00b0544ff7a88f7a9afc3c841101568cf2190379` deleted `docs/playwright/`, causing GitHub Actions CI to fail immediately on every push and PR. | Remove the `Verify Playwright audit script syntax` step from `.github/workflows/ci.yml`. |
| **B2** | `client/src/components/editor/MentionInput/index.tsx` (lines 927–954) & `EmojiMenu.tsx` / `VariableMenu.tsx` | `<EmojiMenu>` is rendered **without** `anchor={textareaRef.current}`, `maxHeight={dropdownMaxHeight}`, or `onClose`. Inside `AutocompletePopover.tsx` (line 28), `if (!anchor) return;` exits early, leaving `floatingStyle = {}` on a portaled `<div className="fixed">`, so the emoji menu renders unpositioned/off-screen. `<VariableMenu>` also omits `onClose`. Furthermore, `EmojiMenu.tsx` and `VariableMenu.tsx` are pure 20-line pass-through wrappers around `AutocompletePopover`. | Delete `EmojiMenu.tsx` and `VariableMenu.tsx` and render `<AutocompletePopover>` directly in `MentionInput/index.tsx` with `headerLabel={getHeaderLabel()}`, `anchor={textareaRef.current}`, `maxHeight={dropdownMaxHeight}`, and `onClose={() => setAcType(null)}` for all autocomplete modes (`user`, `role`, `channel`, `variable`, `user_placeholder`, `emoji`). |
| **B3** | `client/src/components/ui/Field.tsx` (line 116) | `getAutocompleteVariables` runs `const rawToken = query.trim().replace(/^\\{+/, "");`. Because the regex is a regex literal `/^\\{+/`, `\\` matches a **literal backslash** followed by `{`, so leading `{` characters are **never stripped** when `getAutocompleteVariables` is called with a raw `{query` token. | Change line 116 to `.replace(/^\{+/, "")` and route token parsing through the unified helper in `client/src/utils/mentionParser.ts`. |
| **B4** | `client/src/components/editor/MentionInput/AutocompletePopover.tsx` (line 40) & `client/src/components/ui/Field.tsx` (lines 151, 552) | Portaled autocomplete and select popovers use `zIndex: 60` (`z-[60]`). However, `Modal.tsx` uses `z-[9999]`, meaning any `Field`, `MentionInput`, or `Select` rendered inside a modal (such as `FlowBuilder`, `MessageLinkModal`, or `ComponentForms` modals) renders its autocomplete dropdown **behind** the modal backdrop! | Raise portaled popover z-index in `AutocompletePopover.tsx`, `Field.tsx` (`PortalPopover` and `Select`), `SearchableDiscordSelect.tsx`, and `DateTimePickerPopover.tsx` to `zIndex: 10000` (`z-[10000]`). |
| **B5** | `client/src/utils/userPlaceholderAutocomplete.ts` vs `server/src/services/authorService.ts` | 1. Client still suggests `{user.<id>.avatarurl}` (lines 9, 27), which was **removed** from `authorService.ts` (`SUPPORTED_USER_FIELDS = new Set(['name', 'username', 'tag', 'id', 'avatar', 'clantag', 'mention', 'created_at', 'joined_at'])`).<br>2. Client regex `USER_ID_PATTERN = /^\d{1,20}$/` accepts 1-digit IDs in ready-state validation, whereas `authorService.ts` requires `\d{17,20}`.<br>3. Client description for `clantag` says *"Fallback tag style derived from username/global name"*, whereas server now fetches actual Discord primary guild / clan tags and returns `""` for non-members. | 1. Remove `'avatarurl'` from `USER_PLACEHOLDER_FIELDS` in `userPlaceholderAutocomplete.ts`.<br>2. Keep partial typing (`\d{1,20}`) for `stage: "user_id"` suggestions while requiring `/^\d{17,20}$/` for ready/complete field resolution.<br>3. Update `clantag` description to *"User's Discord server/clan tag (empty if not a server member)"*. |
| **B6** | `server/src/routes/send.ts` (line 236) vs `client/src/pages/DocsPage.tsx` & `Field.tsx` | `send.ts` maps `"now.time": `<t:${unixNow}:t>`` (Discord short time `14:30`, identical to `now.short_time`), whereas `DocsPage.tsx` (line 36) and `Field.tsx` (line 33) document `{now.time}` as **Long Time (`14:30:00`, `<t:...:T>`)**. | Change `"now.time"` in `server/src/routes/send.ts` (and unified `variableInterpolation.ts`) to `` `<t:${unixNow}:T>` `` so `{now.time}` outputs `:T` (with seconds) and `{now.short_time}` outputs `:t`. |

### 3.2 Confirmed Duplicated Logic & Dead Assumptions to Untangle

| # | Area | Duplication / Stale Assumption Evidence | Consolidation Plan |
| :--- | :--- | :--- | :--- |
| **U1** | **Server Variable Interpolation (3 Copies)** | 1. `server/src/services/variableInterpolation.ts` (`replaceVariables` + `interpolateObject`)<br>2. `server/src/services/actionExecutor.ts` (lines 21–35: private `replaceVariables` with identical single- & double-brace regexes)<br>3. `server/src/routes/send.ts` (lines 257–270: private `replaceSendVars` + `interpolateSendPayload`) | Enhance `server/src/services/variableInterpolation.ts` with a shared `buildRuntimeTimeVariables(now?: Date)` helper and optional `{ preserveUnknown?: boolean }` support. Delete the duplicate `replaceVariables` in `actionExecutor.ts` and `replaceSendVars` in `send.ts`, importing from `variableInterpolation.ts`. |
| **U2** | **Client Brace-Token & Emoji Autocomplete Detection (4 Copies)** | 1. `client/src/utils/mentionParser.ts` (`detectAutocompleteToken`)<br>2. `client/src/components/editor/MentionInput/index.tsx` (`checkAutocomplete` lines 312–398)<br>3. `client/src/components/ui/Field.tsx` (`TextField` lines 253–347)<br>4. `client/src/components/ui/Field.tsx` (`TextArea` lines 387–481 — ~140 lines of copy-pasted state/keyboard handlers between `TextField` and `TextArea`) | 1. Extract a shared `useInlineFieldAutocomplete` hook (or shared controller inside `Field.tsx` + `mentionParser.ts`) used by both `TextField` and `TextArea`, cutting ~130 lines of duplicate code in `Field.tsx`.<br>2. Ensure `detectAutocompleteToken` in `mentionParser.ts` is the single source of truth for `{`, `{{`, `:emoji`, `@`, `#` trigger detection. |
| **U3** | **Stale Custom Bot Mode Banner & Copy** | Migration `011_drop_legacy_profiles_and_webhooks.sql` permanently removed `bot_profiles` and `webhook_profiles` in favor of unified Server Bot dispatch (`serverBotService.ts`). Yet:<br>1. `client/src/components/layout/StudioLayout.tsx` (lines 77–89) still renders a banner when `activeMode === 'bot'`: *"Custom Bot Mode: Use your own Bot Profile to dispatch messages. [Configure Bot]"* (clicking it opens `SettingsModal` where no Bot Profile config exists!).<br>2. `client/src/components/actions/FlowBuilder.tsx` (line 125) still says *"Attach this action to a message component and send it in bot token mode."* | 1. Remove the obsolete *"Custom Bot Mode: Use your own Bot Profile..."* banner from `StudioLayout.tsx` (or replace with a subtle connection status banner only when the server bot is disconnected).<br>2. Update `FlowBuilder.tsx` copy to *"Attach this action to a Button or Select Menu to execute steps when users interact in Discord."* |
| **U4** | **Root `package.json` Unused Dependency** | Root `package.json` includes `"dependencies": { "lucide-react": "^1.16.0" }` at the workspace root, while `client/package.json` already declares `"lucide-react": "^0.344.0"`. | Remove the unused root `"dependencies"` block from root `package.json` so `lucide-react` is only managed in `client/package.json`. |

---

## 4. Unlimited-Batch Execution Plan for ChatGPT (Batches 1–14)

---

### Batch 1 — CI Blocker Fix, Workspace Cleanup & Server Interpolation Untangle
**Goal**: Make GitHub Actions green immediately, remove root dependency clutter, and eliminate the 3x server variable interpolation duplication.

#### Files to Modify
1. **`.github/workflows/ci.yml`**:
   - Delete lines 38–39 (`- name: Verify Playwright audit script syntax` / `run: node --check docs/playwright/audit.mjs`).
2. **`package.json`** (root):
   - Remove the redundant `"dependencies": { "lucide-react": "^1.16.0" }` block from root `package.json`.
3. **`server/src/services/variableInterpolation.ts`**:
   - Add `export function buildTimestampVariables(date: Date = new Date()): Record<string, string>` producing:
     - `"now.iso"`: `date.toISOString()`
     - `"now.unix"`: `String(Math.floor(date.getTime() / 1000))`
     - `"now.date"`: `` `<t:${unixNow}:D>` ``
     - `"now.time"`: `` `<t:${unixNow}:T>` `` *(fixes `{now.time}` long-time bug B6)*
     - `"now.datetime"`: `` `<t:${unixNow}:F>` ``
     - `"now.relative"`: `` `<t:${unixNow}:R>` ``
     - `"now.short_date"`: `` `<t:${unixNow}:d>` ``
     - `"now.short_time"`: `` `<t:${unixNow}:t>` ``
     - `"now.short_datetime"`: `` `<t:${unixNow}:f>` ``
     - `"timestamp"`: `` `<t:${unixNow}:F>` ``
   - Update `replaceVariables(text, variables)` and `interpolateObject(obj, variables)` so they cleanly handle both `{{var}}` and `{var}` tokens (preserving unmatched tokens when a variable key is not in `variables`, while allowing explicit empty-string `""` values to replace the token).
4. **`server/src/services/actionExecutor.ts`**:
   - Delete the private `replaceVariables` function (lines 21–35) and import `replaceVariables` from `./variableInterpolation`.
5. **`server/src/routes/send.ts`**:
   - Delete `replaceSendVars` and `interpolateSendPayload` (lines 257–290) and use `buildTimestampVariables()` + `interpolateObject()` from `../services/variableInterpolation`.

#### Verification
- Run `npm test --workspace=server` and `npm run build` to verify all server routes and variable interpolation tests pass.
- **Suggested Commit Message**: `fix ci workflow and unify server variable interpolation`

---

### Batch 2 — Client Autocomplete Untangle, Z-Index Fix & User Placeholder Contract Alignment
**Goal**: Fix all client autocomplete bugs (`B2`, `B3`, `B4`, `B5`), delete redundant wrapper components, and unify token detection.

#### Files to Modify / Delete
1. **Delete `client/src/components/editor/MentionInput/EmojiMenu.tsx` and `client/src/components/editor/MentionInput/VariableMenu.tsx`**:
   - Both files are 20-line pass-through wrappers around `AutocompletePopover`.
2. **`client/src/components/editor/MentionInput/index.tsx`**:
   - Remove imports of `VariableMenu` and `EmojiMenu`.
   - Render `<AutocompletePopover>` directly for all active `acType` states (`"user" | "role" | "channel" | "variable" | "user_placeholder" | "emoji"`), passing `items={acItems}`, `selectedIndex={acIndex}`, `onSelect={insertAutocomplete}`, `onClose={() => setAcType(null)}`, `headerLabel={getHeaderLabel()}`, `anchor={textareaRef.current}`, and `maxHeight={dropdownMaxHeight}`.
3. **`client/src/components/editor/MentionInput/AutocompletePopover.tsx`**:
   - Raise portal `zIndex` from `60` to `10000` (`z-[10000]`) so autocomplete menus work inside modals (`Modal.tsx` uses `z-[9999]`).
   - Restyle popover surface to the new SaaS studio elevated surface (`bg-[#161A23] border border-[#272D3A] shadow-xl rounded-[10px]`) with crisp active row highlighting (`bg-[#818CF8]/15 text-[#F1F3F9] border-l-2 border-[#818CF8]`).
4. **`client/src/utils/userPlaceholderAutocomplete.ts`**:
   - Remove `'avatarurl'` from `USER_PLACEHOLDER_FIELDS` (lines 9, 27) to match `server/src/services/authorService.ts`.
   - Update `clantag` description to `"User's Discord server/clan tag (empty if not a server member)"`.
   - Add a helper `isValidDiscordSnowflake(id: string): boolean` (`/^\d{17,20}$/`) so ready-state validation matches the server's 17–20 digit snowflake rule while still offering interactive autocomplete suggestions while the user is typing digits (`\d{1,20}`).
5. **`client/src/utils/mentionParser.ts`**:
   - Ensure `detectAutocompleteToken` handles `{`, `{{`, `:emoji`, `@`, and `#` consistently and exports a clean helper for slicing/replacing the active token around the cursor.

#### Verification
- Run `npm test --workspace=client` and update any unit test in `client/src/__tests__/userPlaceholderAutocomplete.test.ts` that asserted `avatarurl` was present.
- **Suggested Commit Message**: `fix mention input popovers and align user placeholder fields with server`

---

### Batch 3 — Centralized 3-Pillar Design System & Typography Foundation
**Goal**: Establish the centralized SaaS Dark Studio token system (`#0B0D12` / `#10131A` / `#161A23` / `#1D2230` / `#252B3A`, `#818CF8` indigo accent, `Inter` + `JetBrains Mono`) while explicitly isolating the Authentic Discord Preview variables (`--discord-preview-*`).

#### Files to Modify
1. **`client/src/styles/globals.css`**:
   - Load `Inter` (`400;500;600;700`) and `JetBrains Mono` (`400;500;600`) cleanly.
   - Define the centralized CSS custom properties under `:root` and `[data-theme="dark"]`:
     ```css
     :root, [data-theme="dark"] {
       /* Pillar 1 & 2: SaaS Developer Studio Surfaces */
       --bg-main: #0B0D12;
       --bg-primary: #0B0D12;
       --bg-secondary: #10131A;
       --bg-tertiary: #161A23;
       --bg-elevated: #161A23;
       --bg-interactive: #1D2230;
       --bg-floating: #161A23;
       --bg-modifier-hover: #252B3A;
       --bg-modifier-active: #2C3344;
       --bg-modifier-selected: rgba(129, 140, 248, 0.12);
       --bg-glass: rgba(16, 19, 26, 0.88);

       /* Borders */
       --border-subtle: #272D3A;
       --border-default: #272D3A;
       --border-muted: #202531;
       --border-strong: #343C4E;
       --border-focus: #818CF8;

       /* Brand & Accents */
       --brand-primary: #818CF8;
       --brand-hover: #6366F1;
       --brand-active: #4F46E5;
       --accent-secondary: #A78BFA;
       --accent-subtle-bg: rgba(129, 140, 248, 0.12);

       /* Text Hierarchy */
       --text-primary: #F1F3F9;
       --text-secondary: #A1A8B8;
       --text-muted: #6F788A;

       /* Semantic Status Colors */
       --status-success: #34D399;
       --status-warning: #FBBF24;
       --status-danger: #F87171;
       --status-error: #F87171;
       --status-info: #60A5FA;

       /* Pillar 3: Authentic Discord Preview Tokens (Never Overridden by SaaS Theme) */
       --discord-bg-chat: #313338;
       --discord-bg-card: #2b2d31;
       --discord-bg-tertiary: #1e1f22;
       --discord-blurple: #5865f2;
       --discord-blurple-hover: #4752c4;
       --discord-text-primary: #f2f3f5;
       --discord-text-body: #dbdee1;
       --discord-text-muted: #949ba4;
     }
     ```
   - Update `.studio-panel`, `.studio-card`, `.studio-subpanel`, `.studio-pill`, and scrollbar styles to use crisp `1px solid var(--border-default)` borders, subtle shadows (`0 4px 20px rgba(0, 0, 0, 0.35)`), and zero glowing neon gradients.
2. **`client/src/config/uiThemeConfig.ts`**:
   - Update `STUDIO_THEME_PRESETS.dark` to match the exact SaaS palette (`bgPrimary: '#0B0D12'`, `bgSecondary: '#10131A'`, `bgTertiary: '#161A23'`, `bgElevated: '#161A23'`, `bgFloating: '#161A23'`, `textPrimary: '#F1F3F9'`, `textSecondary: '#A1A8B8'`, `textMuted: '#6F788A'`, `borderSubtle: '#272D3A'`, `borderStrong: '#343C4E'`, `brandPrimary: '#818CF8'`, `brandHover: '#6366F1'`, `brandActive: '#4F46E5'`, `statusSuccess: '#34D399'`, `statusWarning: '#FBBF24'`, `statusDanger: '#F87171'`).
   - Bump `THEME_STORAGE_KEY` from `'hoho_ui_theme_v2'` to `'hoho_ui_theme_v3'` so returning browsers automatically pick up the new SaaS studio palette without stale localStorage overrides.
3. **`client/tailwind.config.js`**:
   - Ensure font families (`sans: ['Inter', ...]`, `mono: ['JetBrains Mono', ...]`) and semantic studio colors map cleanly to the CSS variables.

#### Verification
- Run `npm test --workspace=client` and `npm run build --workspace=client`.
- **Suggested Commit Message**: `establish 3-pillar saas design tokens and typography system`

---

### Batch 4 — Core UI Primitives Remake & `Field.tsx` Untangle
**Goal**: Standardize all form controls, buttons, modals, pickers, and selects across the app while untangling the 140-line duplication inside `Field.tsx`.

#### Files to Modify
1. **`client/src/components/ui/Field.tsx`**:
   - **Fix Bug B3**: Change `.replace(/^\\{+/, "")` on line 116 to `.replace(/^\{+/, "")`.
   - **Fix Bug B4**: Change `zIndex: 60` on `PortalPopover` (line 151) and `Select` (line 552) to `zIndex: 10000`.
   - **Untangle Duplication U2**: Extract a shared internal hook `useFieldAutocomplete(value, onChange, inputRef)` used by both `TextField` and `TextArea` so the variable/emoji autocomplete detection, keyboard navigation (`ArrowUp`/`ArrowDown`/`Enter`/`Escape`), and `<PortalPopover>` rendering are written **once** instead of duplicated across both components.
   - **Typography & Styling**:
     - Field labels: `text-[12.5px] font-medium text-[#A1A8B8]` (remove heavy bold/uppercase styling).
     - Character counter & variable hint badge: `font-mono text-[11px] text-[#6F788A]`.
     - Input/Select surface: `h-9 px-3 rounded-[8px] bg-[#1D2230] border border-[#272D3A] text-[13.5px] text-[#F1F3F9] placeholder:text-[#6F788A] focus:border-[#818CF8] focus:ring-2 focus:ring-[#818CF8]/20 transition-colors duration-150`.
2. **`client/src/components/ui/Button.tsx`**:
   - Implement clean, consistent variants with distinct hover/active/disabled/loading states:
     - `primary`: `bg-[#818CF8] hover:bg-[#6366F1] active:bg-[#4F46E5] text-[#0B0D12] font-semibold shadow-sm` (or high-contrast white text `#FFFFFF` on `#6366F1`/`#818CF8` with crisp border)
     - `secondary`: `bg-[#1D2230] hover:bg-[#252B3A] text-[#F1F3F9] border border-[#272D3A]`
     - `ghost`: `bg-transparent hover:bg-[#252B3A]/70 text-[#A1A8B8] hover:text-[#F1F3F9]`
     - `danger`: `bg-[#F87171]/12 hover:bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/30`
     - `outline`: `bg-transparent hover:bg-[#1D2230] text-[#F1F3F9] border border-[#272D3A] hover:border-[#818CF8]/50`
   - Standardize heights: `xs` (`h-7 px-2.5 text-xs rounded-md`), `sm` (`h-8 px-3 text-[13px] rounded-[7px]`), `md` (`h-9 px-4 text-[13.5px] rounded-[8px]`), `lg` (`h-10 px-5 text-sm rounded-[8px]`).
3. **`client/src/components/ui/Modal.tsx`**:
   - Redesign modal container: `bg-[#161A23] border border-[#272D3A] rounded-[12px] shadow-2xl`, header with `border-b border-[#202531] px-5 py-4`, title in `text-[16px] font-semibold text-[#F1F3F9]`, close button with `aria-label="Close modal"`, and backdrop `bg-[#0B0D12]/75 backdrop-blur-[2px]`.
4. **`client/src/components/ui/ColorPicker.tsx`, `DateTimePickerPopover.tsx`, `SearchableDiscordSelect.tsx`**:
   - Ensure all floating popovers use `z-[10000]`, `#161A23` elevated background, `#272D3A` border, `JetBrains Mono` for hex codes/snowflakes, and preserve the viewport clamping math in `SearchableDiscordSelect.tsx` (`Math.min(280, Math.max(120, viewportHeight - rect.bottom - 16))`).
5. **`client/src/components/ui/CultSkiperPrimitives.tsx`**:
   - Simplify `TextureCard` and `Badge` into clean SaaS studio surfaces without noisy gradients or shimmer overlays.

#### Verification
- Run `npm test --workspace=client` (verifying `m4_challenger2_layout_stress.test.ts` and all field/select tests pass).
- **Suggested Commit Message**: `untangle field autocomplete and modernize core ui primitives`

---

### Batch 5 — Public SaaS Surfaces & Login Screen Redesign (Pillar 1)
**Goal**: Transform the login screen, documentation page, privacy page, and 404 screen into a cohesive, fast-loading developer SaaS experience without WebGL particle lag or decorative bloat.

#### Files to Modify
1. **`client/src/components/layout/LoginScreen.tsx`**:
   - Remove the lazy-loaded `ThreeHeroCanvas` WebGL background and `ShinyText` gradient text effects.
   - Build a crisp, modern SaaS split-screen or centered studio authentication card on `#0B0D12`:
     - Subtle radial top spotlight (`radial-gradient(circle at 50% 0%, rgba(129, 140, 248, 0.08), transparent 60%)`) and clean architectural grid hairline.
     - Left/Top brand header: HoHo Manager emblem, version badge (`v2.4 Studio` in `JetBrains Mono`), concise value proposition, and 3 scannable capability rows (**Components V2 Visual Studio**, **Multi-Step Interaction Flows**, **Live WEAO & Tracking Sync**).
     - Right/Card panel (`bg-[#161A23] border border-[#272D3A] rounded-[12px] p-6 sm:p-8`): Clear **Continue with Discord** primary action button (`h-11`), inline loading spinner when redirecting, security/session notice, and clean footer links to `/docs` and `/privacy`.
2. **`client/src/components/layout/PublicPageHeader.tsx`**:
   - Clean `h-14` top bar (`bg-[#10131A]/90 backdrop-blur-md border-b border-[#272D3A]`) with consistent brand identity, active route pills (`Studio`, `Documentation`, `Privacy`), and quick `Back to Studio` CTA.
3. **`client/src/pages/DocsPage.tsx`, `PrivacyPage.tsx`, `NotFoundPage.tsx`**:
   - Replace hardcoded `#1e1f22` / `#2b2d31` / `#313338` Discord backgrounds on `/docs`, `/privacy`, and `404` with the SaaS Studio palette (`#0B0D12` page background, `#10131A` sticky sidebar nav, `#161A23` documentation cards, `#272D3A` borders, `JetBrains Mono` variable tables with one-click copy buttons).
   - In `DocsPage.tsx`, ensure the `{user.<id>.*}` documentation table reflects the exact 9 supported fields (`name`, `username`, `tag`, `id`, `avatar`, `clantag`, `mention`, `created_at`, `joined_at`) and removes `{user.<id>.avatarurl}`.

#### Verification
- Run `npm test --workspace=client` and `npm run build --workspace=client`.
- **Suggested Commit Message**: `redesign login screen and public docs pages with saas studio layout`

---

### Batch 6 — Application Shell, Header, Sidebar & Split-Pane Workspace (Pillar 1)
**Goal**: Redesign the core studio shell (`Header`, `Sidebar`, `StudioLayout`, `SplitPane`) for zero clutter, clear workspace hierarchy, and smooth responsive behavior.

#### Files to Modify
1. **`client/src/components/layout/Header.tsx`**:
   - Redesign into a crisp, fixed-height (`h-14`) 3-zone SaaS top bar (`bg-[#10131A] border-b border-[#272D3A] px-3 sm:px-4`):
     - **Left Zone (Identity & Context)**: Sidebar collapse toggle, HoHo Manager brand mark, subtle breadcrumb divider (`/`), active template or channel badge, and compact **Server Bot Status Pill** (`Connected` with `#34D399` dot or `Offline` with `#F87171` dot).
     - **Center Zone (Target Guild & Channel Selector)**: Compact, scannable Server + Channel target bar using `SearchableDiscordSelect` with clear visual separation and a refresh channels icon button with tooltip.
     - **Right Zone (Primary Actions & Utilities)**:
       - Group secondary studio utilities (**JSON**, **Flags**, **Mentions**, **Backups**, **Docs**, and admin **Access/Logs/Settings** when authorized) into clean icon/label buttons or a tidy overflow menu so the header never wraps or feels crowded.
       - Primary **Send Message** / **Update Message** CTA button (`bg-[#818CF8] hover:bg-[#6366F1]`) with inline spinner when sending.
       - Compact user profile chip with avatar, role badge, and sign-out trigger.
2. **`client/src/components/layout/Sidebar.tsx`**:
   - Redesign into a structured `260px` SaaS navigation & resource drawer (`bg-[#10131A] border-r border-[#272D3A]`):
     - Segmented top switcher (`Templates` | `Tracked` | `Actions`) with `rgba(129, 140, 248, 0.12)` active pill and `#818CF8` text/icon.
     - Search filter input (`h-8 bg-[#1D2230] border-[#272D3A] text-xs`) with instant client filtering.
     - Consistent item row height (`min-h-[40px]`), clear active indicator (`border-l-2 border-[#818CF8] bg-[#818CF8]/10`), subtle hover action icons (`Load`, `Duplicate`, `Delete`), and clean empty state cards when a list has 0 items.
3. **`client/src/components/layout/StudioLayout.tsx`**:
   - **Untangle Stale Banner U3**: Remove the obsolete `activeMode === 'bot'` *"Custom Bot Mode: Use your own Bot Profile to dispatch messages. [Configure Bot]"* banner (lines 77–89).
   - Keep the status bar strictly for actionable alerts (e.g., if `botStatus?.connected === false`, show a concise warning bar with a button to open `ServerBotAccessModal`).
4. **`client/src/components/layout/SplitPane.tsx`**:
   - Refine the desktop resizable split pane divider (`w-1.5 bg-[#202531] hover:bg-[#818CF8]/60 transition-colors cursor-col-resize`) with a subtle central grip handle.
   - On mobile/tablet (`< 1024px`), provide a clean sticky bottom or top segmented bar (`Editor` | `Live Preview` | `Inspector`) with badge counts so switching views on smaller screens is effortless.

#### Verification
- Run `npm test --workspace=client` and verify responsive layout tests pass.
- **Suggested Commit Message**: `redesign application shell header sidebar and split pane workspace`

---

### Batch 7 — Message Editor & Content Tab Modernization (Pillar 2)
**Goal**: Make the primary Message Editor (`MessageEditor/index.tsx`, `ContentTab.tsx`, `MarkdownToolbar.tsx`, `RichPicker.tsx`, `FileAttachmentsSection.tsx`) clean, scannable, and progressive rather than showing every advanced option at equal weight.

#### Files to Modify
1. **`client/src/components/editor/MessageEditor/index.tsx`**:
   - Redesign the top workspace tab bar (`Content`, `Embeds` with count badge, `Components V2` with count badge, `Actions` with count badge) into a crisp SaaS studio header (`bg-[#10131A] border-b border-[#272D3A] px-4`).
   - Add a compact quick-actions strip on the right of the tab bar (`Import Message Link`, `Clear All`, `Components V2 Mode` badge).
2. **`client/src/components/editor/MessageEditor/ContentTab.tsx`**:
   - **Primary Focus**: Make the **Message Content** composer (`MentionInput` + `MarkdownToolbar`) the clear visual centerpiece inside an elevated studio card (`bg-[#161A23] border border-[#272D3A] rounded-[10px] p-4`).
   - **Progressive Disclosure (Collapsible Advanced Sections)**:
     - Organize secondary/advanced options into clean, collapsible accordion cards (`bg-[#161A23] border border-[#272D3A] rounded-[10px]`) that auto-expand when populated:
       1. **Edit Existing Message / Forum Thread Target** (Message ID / Link, Thread Name / Tags — collapsed by default unless editing an existing message or targeting a forum channel).
       2. **File Attachments** (`FileAttachmentsSection.tsx` — shows attachment count badge in header).
       3. **Webhook / Identity Override** (Username & Avatar URL override when applicable — collapsed by default).
3. **`client/src/components/editor/MentionInput/MarkdownToolbar.tsx` & `RichPicker.tsx`**:
   - Style toolbar icon buttons with `h-7 w-7 rounded-[6px] text-[#A1A8B8] hover:text-[#F1F3F9] hover:bg-[#252B3A]` and clear tooltips (`Bold`, `Italic`, `Code`, `Spoiler`, `Insert Variable {}`, `Insert Mention @`, `Emoji Picker`).
   - Ensure `RichPicker.tsx` uses the `#161A23` elevated surface, `JetBrains Mono` for variable tokens, and clear category tabs (`Server Emojis`, `Standard`, `Variables`, `Mentions`, `Timestamps`).
4. **`client/src/components/editor/FileAttachmentsSection.tsx` & `MessageLinkModal.tsx`**:
   - Style dropzone with `border-dashed border-[#272D3A] hover:border-[#818CF8]/60 bg-[#10131A]/60 rounded-[10px]` and crisp file chips showing filename, size in `JetBrains Mono`, spoiler toggle, and remove button.

#### Verification
- Run `npm test --workspace=client`.
- **Suggested Commit Message**: `modernize message editor tabs and collapsible content sections`

---

### Batch 8 — Intuitive Embed Builder Redesign (Pillar 2)
**Goal**: Redesign `EmbedsTab.tsx` and `EmbedEditor.tsx` so building multi-embed messages is structured, scannable, and clutter-free.

#### Files to Modify
1. **`client/src/components/editor/MessageEditor/EmbedsTab.tsx`**:
   - Top bar showing `Embeds (X / 10)` in `JetBrains Mono`, a primary `+ Add Embed` button, and a helpful empty state card (`bg-[#161A23] border border-[#272D3A] rounded-[10px] p-8 text-center`) with a one-click `Create First Embed` button when no embeds exist.
2. **`client/src/components/editor/EmbedEditor.tsx`**:
   - **Embed Card Header**: Display a live color pill matching `embed.color`, the embed title (or `Embed #N`), and compact header actions (`Move Up`, `Move Down`, `Duplicate`, `Delete`, `Collapse/Expand`).
   - **Sub-Section Organization inside an Expanded Embed**:
     - **Core Content (Always Visible)**: Embed Color swatch + hex input (`JetBrains Mono`), Title, Title URL, and Description (`MentionInput` with variable/mention support and character counter `X / 4096`).
     - **Collapsible Sub-Panels** (with green/indigo dot indicator when populated):
       - **Author Block** (`Author Name`, `Author URL`, `Author Icon URL`)
       - **Embed Fields (`X / 25`)** — compact cards for each field with `Name`, `Value`, `Inline` toggle switch, reorder arrows, and `+ Add Field` button
       - **Images & Media** (`Thumbnail URL`, `Main Image URL` with small inline image preview thumbnail when valid)
       - **Footer & Timestamp** (`Footer Text`, `Footer Icon URL`, `Timestamp` picker)

#### Verification
- Run `npm test --workspace=client`.
- **Suggested Commit Message**: `redesign embed builder with progressive disclosure sections`

---

### Batch 9 — Component Builder & V2 Canvas Organization (Pillar 2)
**Goal**: Make `ComponentsTab.tsx`, `DiscohookComponentsEditor.tsx`, and `LayersPanel.tsx` feel like a modern visual interface builder with unmistakable component type badges and drag/reorder clarity.

#### Files to Modify
1. **`client/src/components/editor/MessageEditor/ComponentsTab.tsx`**:
   - Provide a clear header with component count (`X / 10 Top-Level Blocks`), a structured **Add Block Toolbar** categorizing blocks into:
     - **Layout & Content**: `Container`, `Section`, `Text Display`, `Separator`, `Media Gallery`, `File`
     - **Interactive Rows**: `Action Row (Buttons)`, `String Select`, `User Select`, `Role Select`, `Channel Select`, `Mentionable Select`
   - Helpful empty state explaining Discord Components V2 when the canvas is empty.
2. **`client/src/components/editor/DiscohookComponentsEditor.tsx`**:
   - Give every component block card (`bg-[#161A23] border border-[#272D3A] rounded-[10px]`) a distinct left accent bar or color-coded type badge (`Container` in `#818CF8`, `Text Display` in `#60A5FA`, `Button Row` in `#34D399`, `Select Menu` in `#A78BFA`, `Media/Section` in `#FBBF24`), a concise summary preview when collapsed, and a `1px solid #818CF8` outline when selected in the inspector.
   - Ensure nested children inside `Container` blocks are visually indented (`pl-4 border-l-2 border-[#272D3A]`) with their own `+ Add Child Block` menu.
3. **`client/src/components/editor/LayersPanel.tsx`**:
   - Style as a compact IDE tree view (`text-[12.5px]`) with tree connectors, type icons, selection highlight (`bg-[#818CF8]/15 text-[#F1F3F9]`), and quick visibility/delete actions.

#### Verification
- Run `npm test --workspace=client`.
- **Suggested Commit Message**: `redesign components v2 builder and layer tree organization`

---

### Batch 10 — Context-Aware Property Panel (Inspector) Redesign (Pillar 2)
**Goal**: Transform `PropertyPanel.tsx` and `ComponentForms.tsx` into a crisp, context-aware right-hand Inspector.

#### Files to Modify
1. **`client/src/components/editor/PropertyPanel.tsx`**:
   - **Selected Element Header**: Sticky header (`bg-[#10131A] border-b border-[#272D3A] px-4 py-3`) showing the selected component's type badge, index/breadcrumb path (e.g., `Container #1 › Action Row › Button #2`), `Duplicate`, and `Delete` icon buttons.
   - **Helpful Empty State**: When no component or embed is selected, display a calm, structured inspector empty state (`bg-[#161A23]/50 border border-dashed border-[#272D3A] rounded-[10px] p-6`) explaining that clicking any block in the Editor or Live Preview opens its properties here, along with quick summary stats of the current message payload (`Characters`, `Embeds`, `V2 Blocks`, `Attached Actions`).
2. **`client/src/components/editor/ComponentForms.tsx`**:
   - Group component properties logically:
     - **Primary Properties**: Label / Content / Placeholder, Style (`Primary`, `Secondary`, `Success`, `Danger`, `Link`), Emoji, URL.
     - **Interaction & Automation**: Attached Action Flow selector (`Select Action` + quick `Edit Flow` button), Custom ID (`JetBrains Mono`), Disabled toggle.
     - **Validation & Limits**: Inline min/max value counters for Select Menus (`Min Values`, `Max Values`, `Options X / 25`).

#### Verification
- Run `npm test --workspace=client`.
- **Suggested Commit Message**: `redesign context-aware property panel and component inspector forms`

---

### Batch 11 — Visual Action Flow Builder UX Overhaul (Pillar 2)
**Goal**: Upgrade `FlowBuilder.tsx` and `StepList.tsx` into a scannable automation studio where Triggers, Conditions, Modal Inputs, Role/Message Actions, and Variable Outputs are visually unmistakable.

#### Files to Modify
1. **`client/src/components/actions/FlowBuilder.tsx`**:
   - **Fix Stale Copy U3**: Replace *"Attach this action to a message component and send it in bot token mode"* with *"Attach this flow to any Button or Select Menu to run automated steps when a user interacts in Discord."*
   - **Flow Header & Trigger Card**:
     - Display a dedicated **Trigger Card** at the top of the flow canvas (`bg-[#161A23] border border-[#818CF8]/40 rounded-[10px] p-3.5`) with a `#A78BFA` `TRIGGER` badge, Action Name, Trigger Custom ID in `JetBrains Mono`, Cooldown/One-Time execution badges, and a `Save Action Flow` primary button.
   - **Categorized Add-Step Palette**:
     - Group the `+ Add Step` selector into clear categories with semantic color badges:
       - **Responses & Messages** (`#60A5FA` Info Blue): `Send Message / Reply`, `Update Original Message`, `Send DM`
       - **User Input** (`#A78BFA` Purple): `Open Modal Form (open_modal)`
       - **Logic & Conditions** (`#FBBF24` Amber): `Check Condition (check)` with nested **Pass (`#34D399`)** and **Fail (`#F87171`)** step lists, `Delay / Wait`
       - **Roles & Server State** (`#34D399` Emerald): `Add Role`, `Remove Role`, `Toggle Role`, `Set Variable`
2. **`client/src/components/actions/StepList.tsx`**:
   - Give each step card a vertical timeline connector line, step number pill in `JetBrains Mono`, semantic category badge (`ACTION`, `CONDITION`, `INPUT MODAL`, `VARIABLE`), concise 1-line summary of what the step does when collapsed (e.g., `Reply ephemerally: "Verified!"` or `Require Role: @Member`), reorder up/down buttons, and a delete confirmation guard when deleting a `check` step that contains nested child steps.

#### Verification
- Run `npm test --workspace=client` and `npm test --workspace=server`.
- **Suggested Commit Message**: `overhaul action flow builder with categorized step badges and timeline cards`

---

### Batch 12 — Authentic Discord Live Preview Polish (Pillar 3)
**Goal**: Keep the Live Preview 100% faithful to Discord's real dark mode while upgrading the studio frame around it.

#### Files to Modify
1. **`client/src/components/preview/MessagePreview.tsx`**:
   - **Studio Preview Frame Header** (outside the Discord canvas): Clean SaaS toolbar (`bg-[#10131A] border-b border-[#272D3A] px-4 py-2.5`) showing `Live Discord Preview`, multi-message switcher pills (`Message 1`, `Message 2`...) when a template has multiple messages, and a toggle for showing resolved vs raw `{variables}`.
   - **Authentic Discord Canvas** (inside the preview viewport):
     - Strictly preserve `bg-[#313338]` chat background, bot avatar (`40px` rounded-full), bot display name (`#f2f3f5 font-medium`), Discord blurple `APP` badge (`bg-[#5865f2] text-white text-[10px] font-semibold px-1.5 rounded-[4px]`), timestamp (`text-[#949ba4] text-xs`), and realistic empty state placeholder when the message has no content, embeds, or components yet.
2. **`client/src/components/preview/EmbedPreview.tsx`, `ComponentPreview.tsx`, `ContainerPreview.tsx`, `ActionRowPreview.tsx`, `Markdown.tsx`**:
   - **Strict Preservation Guard**: Keep `bg-[#2b2d31]`, `text-[#dbdee1]`, `text-[#f2f3f5]`, `text-[#949ba4]`, and `max-w-[520px]` intact inside `EmbedPreview.tsx` and `ContainerPreview.tsx` so the preview matches real Discord and `m4_challenger2_layout_stress.test.ts` continues to pass 100%.
   - Ensure interactive preview hover states (clicking a preview block to select it in `PropertyPanel`) use a subtle `outline-1 outline-[#818CF8]/60` indicator without distorting Discord's internal padding or box model.

#### Verification
- Run `npm test --workspace=client` (specifically confirming `m4_challenger2_layout_stress.test.ts` passes).
- **Suggested Commit Message**: `polish live discord preview frame while preserving authentic discord canvas tokens`

---

### Batch 13 — Studio & Admin Modals, Empty States & Loading Discipline (Pillar 1)
**Goal**: Bring all secondary modals, admin panels, and loading indicators onto the unified SaaS Studio design system and remove unnecessary skeleton loaders.

#### Files to Modify
1. **`client/src/components/editor/AllowedMentionsModal.tsx`, `FlagsModal.tsx`, `JsonModal.tsx`**:
   - Restyle using the `#161A23` elevated modal surface, `#1D2230` interactive toggle rows, non-bold secondary descriptions (`text-[#A1A8B8]`), and `JetBrains Mono` for JSON payloads and Discord bitfield flags (`EPHEMERAL`, `IS_COMPONENTS_V2`, `SUPPRESS_EMBEDS`, `SUPPRESS_NOTIFICATIONS`).
2. **`client/src/components/layout/StudioModals.tsx`, `BackupsModal.tsx`, `AccessPanel.tsx`, `ProfilesPanel.tsx`, `AuditLogsModal.tsx`, `ServerBotAccessModal.tsx`, `SessionsModal.tsx`, `SettingsModal.tsx`**:
   - Unify all admin/studio modals on `#161A23` surfaces with `#272D3A` borders and semantic badges (`#34D399` active/allowed, `#FBBF24` pending, `#F87171` revoked/error).
   - **Loading State Discipline**: Replace any full-screen or jarring multi-card skeleton blocks with a clean, compact inline spinner (`Loader2 className="w-4 h-4 animate-spin text-[#818CF8]"`) and only show subtle row placeholders during initial list fetches.
   - In `SettingsModal.tsx`, ensure the UI Theme selector defaults cleanly to the new **SaaS Studio Dark** preset while still allowing users to switch presets if desired.

#### Verification
- Run `npm test --workspace=client` and `npm run build`.
- **Suggested Commit Message**: `unify studio and admin modals with saas tokens and clean loading spinners`

---

### Batch 14 — Untangle Comments & Tests Pass + Final QA Verification
**Goal**: Execute the approved `untangle-codebase` **Comments** and **Tests** cleanup pass, verify zero regressions across all workspaces, and update `docs/GEMINI_HANDOFF_CURRENT.md`.

#### 1. Comments Pass (Remove Restating Comments, Keep Constraint Comments)
- Sweep modified files in `client/src/**` and `server/src/**`:
  - **Delete** comments that merely restate the next line of code (e.g., `// Set loading to true`, `// Render header`, `// Loop through embeds`, or leftover phase markers like `// Phase 4 addition`).
  - **Keep** comments that explain non-obvious external constraints (e.g., Discord API's 4000-character Components V2 limit, Discord snowflake 17–20 digit requirement, or viewport clamping math).

#### 2. Tests Pass (Fix Brittle String-Coupled Tests & Add Behavioral Tests)
- Audit `client/src/__tests__/` and `server/src/__tests__/`:
  - Ensure `client/src/__tests__/m4_challenger2_layout_stress.test.ts` passes cleanly.
  - Update `client/src/__tests__/userPlaceholderAutocomplete.test.ts` so it asserts:
    1. Typing `{` or `{explo` triggers standard variable autocomplete (`{exploit.*}`, `{now.*}`).
    2. Typing `{user.` or `{user.123456789012345678.` suggests the exact 9 server-supported fields (`name`, `username`, `tag`, `id`, `avatar`, `clantag`, `mention`, `created_at`, `joined_at`) and **never** suggests the removed `avatarurl` field.
    3. Snowflake validation requires 17–20 digits for final resolution.
  - Add/verify a server unit test in `server/src/__tests__/` confirming:
    1. `{now.time}` resolves to `<t:...:T>` (long time) while `{now.short_time}` resolves to `<t:...:t>` (short time).
    2. `{user.<id>.clantag}` resolves to `""` when the user is not a guild member or has no clan tag.

#### 3. Final Verification Checklist & Handoff Update
Run the full verification suite before the final commit:
```bash
npm test
npm run build
```
Update `docs/GEMINI_HANDOFF_CURRENT.md` with the final commit SHA, test counts, and summary of the V10 3-Pillar UI/UX Redesign and Codebase Untangle.
- **Suggested Final Commit Message**: `clean up redundant comments update behavioral tests and finalize v10 handoff`
