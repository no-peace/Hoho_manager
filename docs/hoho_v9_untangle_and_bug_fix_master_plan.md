# HoHo Manager — V9 Codebase Untangle, Bug Audit & Simplification Master Plan

**Prepared:** 2026-11-16  
**Role:** Team Lead Architectural Specification & Execution Plan for ChatGPT  
**Baseline Audited in NotebookLM:** `main` commit `7f35b433ecff73c20fdfa323263b6eccf40bfb88` (following `0e75bfbe43babf410b4cadbddb791848ded7a12f` and `c35d762b5862046ae95394f17ffafcdd1989917e`)  
**Repository:** `https://github.com/no-peace/Hoho_manager`  
**Operating Constraint:** Do **not** run local Terminal or Playwright while the owner's PC is off. Apply changes through GitHub in small, behavior-preserving commits using natural, casual human commit messages.

---

## 1. Executive Summary & Audit Verdict

A full cross-workspace audit (`client/`, `server/`, `bot/`, `shared/`, `.github/workflows/`, and root configs) at commit `7f35b433` revealed:

1. **5 Confirmed Bugs & Regressions** (including the exact reasons why CI fails before building, why `<EmojiMenu />` and `<VariableMenu />` fail to position/close or render behind modals, why `Field.tsx`'s new regex `/^\\{+/` fails to strip `{`, and why `{now.time}` and `{user.<id>.avatarurl}` drift between client and server).
2. **5 Hidden Links (Duplicated Logic)** where changing one rule requires editing 3 to 5 separate files that do not share a single source of truth.
3. **3 Surplus / Pass-Through Layers** that add indirection without behavior (and directly caused the `<EmojiMenu />` / `<VariableMenu />` prop-omission bug).
4. **4 Obsolete Assumptions (Dead Legacy Systems)** where database tables (`webhook_profiles`, `bot_profiles`, SQLite `audit_logs`) or workspace folders (`tunnel/package.json`, `docs/playwright/audit.mjs`) were dropped, but UI banners, repositories, and workflow steps still assume they exist.

---

## 2. Confirmed Bugs, Errors & Broken Logic (With Code Evidence)

| ID | Severity | Location | Exact Code Evidence & Failure Mechanism | Smallest Behavior-Preserving Fix |
|---|---|---|---|---|
| **BUG-01** | **P0 Blocker** | `.github/workflows/ci.yml` (lines 38–39) | Runs `node --check docs/playwright/audit.mjs` on every push/PR across Node 22, 24, and 26. Commit `00b0544ff7a88f7a9afc3c841101568cf2190379` deleted `docs/playwright/`. Every CI job fails before `npm run build` starts. | Guard the step with `if [ -f docs/playwright/audit.mjs ]; then node --check docs/playwright/audit.mjs; fi` (or remove the step if `docs/playwright` remains retired). |
| **BUG-02** | **P0 UI Bug** | `client/src/components/editor/MentionInput/index.tsx` (lines 927–954) & `EmojiMenu.tsx` / `VariableMenu.tsx` | Commit `0e75bfbe` passed `anchor={textareaRef.current}` and `maxHeight={dropdownMaxHeight}` to `<VariableMenu />`, **but omitted both props on `<EmojiMenu />`** and omitted `onClose={() => setAcType(null)}` on **both** `<VariableMenu />` and `<EmojiMenu />`. In `AutocompletePopover.tsx` line 28, `if (!anchor) return;` exits early when `anchor` is undefined, leaving `floatingStyle = {}` on a portaled `fixed` div (`top`/`left`/`width` unset), and outside clicks cannot close either menu. | Delete the pass-through wrappers `VariableMenu.tsx` and `EmojiMenu.tsx` and render `<AutocompletePopover headerLabel={getHeaderLabel()} ... />` for all `acType` values in `MentionInput/index.tsx`. |
| **BUG-03** | **P1 Bug** | `client/src/components/editor/MentionInput/AutocompletePopover.tsx` (line 40 & 72) & `client/src/components/ui/Field.tsx` (line 151) | `AutocompletePopover` and `Field.tsx`'s `useFloatingMenuStyle` set `zIndex: 60` (and `className="... z-40"`). However, `PropertyPanel.tsx` mobile bottom sheet is `z-50` and `Modal.tsx` uses `z-50` / `z-[9999]`, while `SearchableDiscordSelect.tsx` uses `zIndex: 99999`. Typing `{user.` or `{explo` inside any Modal or elevated sheet renders the portaled autocomplete menu **behind** or colliding with the modal layer. | Raise floating autocomplete/select portal `zIndex` in `AutocompletePopover.tsx` and `Field.tsx` to `10000` (above modals and bottom sheets). |
| **BUG-04** | **P1 Bug** | `client/src/components/ui/Field.tsx` (line 116) | Commit `3004e714` wrote: `const q = query.trim().toLowerCase().replace(/^\\{+/, "");`. In a JS regex literal, `/^\\{+/` matches a **literal backslash `\` followed by `{`**, NOT `{`! (Compare `userPlaceholderAutocomplete.ts` line 38: `.replace(/^\{+/, "")`). If `query` contains a leading `{` (e.g., when `getAutocompleteVariables("{user.")` or `"{explo"` is called directly or with `{{`), `{` is not stripped and filtering returns `[]`. | Change `.replace(/^\\{+/, "")` to `.replace(/^\{+/, "")` in `Field.tsx`. |
| **BUG-05** | **P1 Drift** | `client/src/utils/userPlaceholderAutocomplete.ts` (lines 23, 26, 40) vs `server/src/services/authorService.ts` (lines 13, 73–109) | 1. Client suggests `{user.<id>.avatarurl}`, which `authorService.ts` intentionally does not resolve (leaves literal text).<br>2. Client regex `/^user\.(\d{1,20})/` accepts 1–16 digit numbers (`{user.123.name}`), which `authorService.ts` (`DISCORD_USER_ID_REGEX = /^\d{17,20}$/`) ignores.<br>3. Client describes `{user.<id>.clantag}` as `"Official Discord clan tag or a tag parsed from the member name"`, whereas `authorService.ts` only resolves `primary_guild.tag` when `identity_enabled === true`. | 1. Remove `avatarurl` from `USER_PROFILE_FIELDS`.<br>2. Require 17–20 digits (`\d{17,20}`) when matching a completed ID dot (`^user\.(\d{17,20})\.([a-z0-9_.]*)$`) or clearly label `<17` digits as an incomplete Snowflake.<br>3. Update `clantag` description and `userPlaceholderAutocomplate.test.ts`. |
| **BUG-06** | **P2 Bug** | `server/src/routes/send.ts` (lines 236–237) vs `DocsPage.tsx` (line 62) & `Field.tsx` (line 33) | `DocsPage.tsx` and `Field.tsx` document `{now.time}` as **Long Time with seconds (`<t:unix:T>`)**, and `actionExecutor.ts` matches that, but `send.ts` maps `"now.time": "<t:${unixNow}:t>"` (short time without seconds). | Change `"now.time"` in `server/src/routes/send.ts` to `` `<t:${unixNow}:T>` `` so send-time and interaction-time variables match the docs. |

---

## 3. Untangle Codebase Audit: Complexity, Duplication & Obsolete Assumptions

Following the `untangle-codebase` methodology, every place where the codebase ties unrelated things together or separates things that must change together is cataloged below.

### 3.1 Hidden Links (Duplicated Logic That Must Change Together)

1. **Three Separate Variable Interpolation Implementations on the Server**
   - **Evidence**:
     - `server/src/services/variableInterpolation.ts` (lines 1–27): exports `replaceVariables(value, variables)` using `/\{\{\s*([\w.$]+)\s*\}\}|\{\s*([\w.$]+)\s*\}/g`.
     - `server/src/services/actionExecutor.ts` (lines 21–35): defines its own `export const replaceVariables = (obj: any, vars: Record<string, any>): any => ...` using `/\{{1,2}\s*([^{}]+?)\s*\}{1,2}/g`.
     - `server/src/routes/send.ts` (lines 257–270): defines `const replaceSendVars = (val: any): any => ...` using the exact same `/\{{1,2}\s*([^{}]+?)\s*\}{1,2}/g` walk!
   - **Fix**: Consolidate on `replaceVariables` in `server/src/services/variableInterpolation.ts` (using `/\{{1,2}\s*([^{}]+?)\s*\}{1,2}/g` so keys with spaces or colons work everywhere) and import it in both `actionExecutor.ts` and `send.ts`. Delete the two inline copies.

2. **Duplicated Brace-Token Autocomplete Detection Across `MentionInput`, `mentionParser.ts`, and `Field.tsx`**
   - **Evidence**:
     - `client/src/utils/mentionParser.ts` (`detectAutocompleteToken`, lines 167–207) has regexes for `exploit_field`, `exploit_name`, and `variable`.
     - `client/src/components/editor/MentionInput/index.tsx` (`checkAutocomplete`, lines 155–238) bypasses `detectAutocompleteToken` for `{` tokens and runs its own catalog-aware parser, then calls `detectAutocompleteToken` only for `@user`, `#channel`, and `:emoji`.
     - `client/src/components/ui/Field.tsx` duplicates `checkInlineVariable` twice: once inside `TextField` (lines 223–250) and once inside `TextArea` (lines 361–388).
   - **Fix**:
     - Pass `weaoExploits` (defaulting to `[]`) as an optional parameter into `detectAutocompleteToken(text, cursorPos, weaoExploits = [])` in `client/src/utils/mentionParser.ts` so the pure parser is the single source of truth for `{exploit.<Name>.<Field>}`, `{exploit.<Name>`, `{variable`, `@user`, `#channel`, and `:emoji`.
     - `MentionInput/index.tsx` `checkAutocomplete` shrinks from 95 lines to 15 lines calling `detectAutocompleteToken(text, cursorPos, weaoExploits)`!
     - Extract a shared `useInlineFieldAutocomplete` hook in `Field.tsx` shared by `TextField` and `TextArea`, removing ~120 lines of duplicated state and keyboard handlers.

3. **Duplicated Variable Metadata Across `Field.tsx`, `DocsPage.tsx`, and `userPlaceholderAutocomplete.ts`**
   - **Evidence**:
     - `Field.tsx` defines `VARIABLES`, `DocsPage.tsx` defines `DOC_ITEMS`, and `userPlaceholderAutocomplete.ts` defines `USER_PROFILE_FIELDS`.
     - Because they are maintained separately, `Field.tsx` was missing `{user.tag}`, `{now.t}`, `{now.T}`, `{now.d}`, `{now.D}`, `{now.f}`, `{now.F}`, `{now.R}`, `{now.iso}`, and `{user.<id>.*}` descriptions, while `userPlaceholderAutocomplete.ts` kept the removed `avatarurl` alias.
   - **Fix**: Sync `VARIABLES` in `Field.tsx` and `USER_PROFILE_FIELDS` in `userPlaceholderAutocomplete.ts` with the canonical supported tokens in `DocsPage.tsx` and `authorService.ts`.

4. **Duplicated `snowflakeToUnix` and `parseAllowedIds` / `parseProfileId` Helpers**
   - **Evidence**:
     - `server/src/services/actionExecutor.ts` lines 37–42 computes `snowflakeToUnix` by converting a `BigInt` to a 64-char binary string (`BigInt(id).toString(2).padStart(64, "0")`) and calling `parseInt(binary.substring(0, 42), 2)`, whereas `server/src/services/authorService.ts` line 101 uses fast bitwise shift `Math.floor(Number((BigInt(id) >> 22n) + 1420070400000n) / 1000)`.
     - `parseAllowedIds` is duplicated across `server/src/routes/discord.ts`, `server/src/routes/send.ts`, and `server/src/middleware/staffPermissions.ts`.
   - **Fix**: Replace the binary-string `snowflakeToUnix` in `actionExecutor.ts` with the bitwise shift formula, and reuse a single `parseAllowedIds` helper.

---

### 3.2 Surplus Indirection & Wrappers to Simplify

| Surplus Item | Location | Evidence | Simplification |
|---|---|---|---|
| **Pass-through menu wrappers** | `client/src/components/editor/MentionInput/VariableMenu.tsx` (22 lines)<br>`client/src/components/editor/MentionInput/EmojiMenu.tsx` (20 lines) | Both files only forward props to `<AutocompletePopover />` with a static `headerLabel`, while `MentionInput/index.tsx` already has `getHeaderLabel()` covering `"variable"` and `"emoji"`. This indirection caused `BUG-02`. | Delete `VariableMenu.tsx` and `EmojiMenu.tsx`. Render `<AutocompletePopover headerLabel={getHeaderLabel()} ... />` directly in `MentionInput/index.tsx`. |
| **Duplicate store setter** | `client/src/store/globalStore.ts` (lines 169–192) | `setIsSidebarOpen` and `setSidebarOpen` have identical implementations in `globalStore.ts`. | Have `setSidebarOpen` delegate to `setIsSidebarOpen` (1 line) so callers remain compatible without duplicating storage persistence code. |
| **Duplicate `TextField` / `TextArea` autocomplete logic** | `client/src/components/ui/Field.tsx` (lines 215–494) | `TextField` and `TextArea` duplicate the exact same 140-line inline variable/emoji autocomplete state machine and keyboard handler. | Extract `useInlineFieldAutocomplete` inside `Field.tsx` and share it between `TextField` and `TextArea`. |

---

### 3.3 Obsolete Assumptions (Dead Legacy Systems Still Present)

| Obsolete Assumption | Evidence in Repository | What Breaks or Misleads Users/Agents | Smallest Safe Cleanup |
|---|---|---|---|
| **1. "Users can configure their own Custom Bot Profile in Studio"** | Migration `011_unified_tracking_and_drop_legacy_profiles` (`migrations.ts` lines 353–354) dropped `webhook_profiles` and `bot_profiles`. `send.ts` line 109 throws `400 Custom bot profiles are disabled`. **Yet** `StudioLayout.tsx` lines 77–89 still renders a yellow banner: `"Custom Bot Mode: Use your own Bot Profile to dispatch messages. [Configure Bot]"` which opens `ServerBotAccessModal` (which says only the server bot is used!). | Users without staff bot access see a contradictory banner telling them to use "Custom Bot Mode", and clicking "Configure Bot" opens a modal telling them they need Head Admin staff access. | Update the banner text in `StudioLayout.tsx` (lines 79–87) to match `ServerBotAccessModal`: `"Server Bot Access Required: Ask a Head Admin to grant your Discord account staff access to dispatch messages."` with button label `"View Access Status"`. |
| **2. `webhookProfileRepository` querying a dropped SQLite table** | `server/src/repositories/profileRepository.ts` queries `webhook_profiles` (dropped in migration `011`). `server/src/services/actionExecutor.ts` line 7 imports `webhookProfileRepository` and never uses it. | Any call to `webhookProfileRepository` throws `SQLITE_ERROR: no such table: webhook_profiles`. | Remove the unused `webhookProfileRepository` import from `server/src/services/actionExecutor.ts`. |
| **3. Root `package.json` workspaces includes `"tunnel"`** | `package.json` line 12 lists `"tunnel"` in `"workspaces"`, while `.gitignore` ignores `tunnel/package.json` and only `tunnel/config.yml.example` exists in the repo. | `npm` workspace resolution scans `tunnel/` expecting a `package.json` manifest that does not exist in Git. | Remove `"tunnel"` from the `"workspaces"` array in root `package.json` (keeping `tunnel/config.yml.example` untouched). |
| **4. `.github/workflows/ci.yml` checks deleted `docs/playwright/audit.mjs`** | Commit `00b0544f` deleted `docs/playwright/`, but `ci.yml` line 39 still runs `node --check docs/playwright/audit.mjs`. | Breaks all CI runs immediately after `npm ci`. | Remove or guard the `node --check docs/playwright/audit.mjs` step in `.github/workflows/ci.yml`. |

---

## 4. Step-by-Step Execution Plan for ChatGPT

Execute the following 6 focused batches on `main` via the GitHub integration. Preserve all existing Discord payload contracts, OAuth/session behavior, staff permissions, and tests. Use the natural human commit messages provided for each batch.

### Batch 1 — Fix the CI Blocker & Workspace Manifest Drift
**Commit message:** `remove stale playwright check from ci and clean up workspaces`

1. **`.github/workflows/ci.yml`**:
   - Remove the step `Validate standalone Playwright audit syntax` (`node --check docs/playwright/audit.mjs`) at lines 38–39 (or guard it with `if [ -f docs/playwright/audit.mjs ]; then node --check docs/playwright/audit.mjs; fi`).
2. **`package.json`**:
   - Remove `"tunnel"` from the `"workspaces"` array so `"workspaces"` is `["shared", "server", "client", "bot"]`.

---

### Batch 2 — Unify `MentionInput` Autocomplete & Fix Broken Emoji / Variable Popovers
**Commit message:** `unify mention input autocomplete popovers and fix menu positioning`

1. **`client/src/utils/mentionParser.ts`**:
   - Update `detectAutocompleteToken(text: string, cursorPos: number, weaoExploits: readonly WeaoExploitItem[] = []): DetectedToken | null` so it handles:
     - Open `{` tokens with no closing `}` or newline before `cursorPos`:
       - `{exploit.<Name>.<Field>` (using `weaoExploits` to distinguish dotted exploit names from field names, matching the logic currently in `MentionInput/index.tsx` lines 163–221).
       - `{exploit.<Name>` -> `type: "exploit_name"`.
       - Any other non-whitespace `{...` token -> `type: "variable"`, `query: tokenSinceBrace.slice(1)`.
     - `@user`, `#channel`, and `:emoji` tokens.
2. **`client/src/components/editor/MentionInput/index.tsx`**:
   - Simplify `checkAutocomplete` to delegate directly to `detectAutocompleteToken(text, cursorPos, weaoExploits)`.
   - Replace the 3-way conditional (`acType === "variable" ? <VariableMenu ... /> : acType === "emoji" ? <EmojiMenu ... /> : <AutocompletePopover ... />`) with a **single** `<AutocompletePopover />` call:
     ```tsx
     {acType && acItems.length > 0 && (
       <AutocompletePopover
         headerLabel={getHeaderLabel()}
         items={acItems}
         selectedIndex={selectedIndex}
         onSelectIndex={setSelectedIndex}
         onApply={applyReplacement}
         onClose={() => setAcType(null)}
         maxHeight={dropdownMaxHeight}
         anchor={textareaRef.current}
       />
     )}
     ```
   - Remove the unused imports of `VariableMenu` and `EmojiMenu`, and delete `client/src/components/editor/MentionInput/VariableMenu.tsx` and `client/src/components/editor/MentionInput/EmojiMenu.tsx`.
3. **`client/src/components/editor/MentionInput/AutocompletePopover.tsx`**:
   - Update `zIndex: 60` in `floatingStyle` to `zIndex: 10000` (and `z-40` class to `z-[10000]`) so portaled menus always appear above modals and mobile bottom sheets.

---

### Batch 3 — Fix `Field.tsx` Escaped Regex Bug & Deduplicate `TextField` / `TextArea` Autocomplete
**Commit message:** `fix field variable regex and share inline autocomplete hook`

1. **`client/src/components/ui/Field.tsx`**:
   - On line 116 inside `getAutocompleteVariables`, fix the broken regex escape:
     ```ts
     // Before (broken — matches literal backslash + brace):
     const q = query.trim().toLowerCase().replace(/^\\{+/, "");
     // After (correct — strips leading opening braces):
     const q = query.trim().toLowerCase().replace(/^\{+/, "");
     ```
   - Update `useFloatingMenuStyle` `zIndex: 60` to `zIndex: 10000`.
   - Add missing supported time/user variables (`{user.tag}`, `{now.t}`, `{now.T}`, `{now.d}`, `{now.D}`, `{now.f}`, `{now.F}`, `{now.R}`, `{now.iso}`) to `VARIABLES` so `Field.tsx` and `MentionInput` suggest every token documented in `DocsPage.tsx`.
   - Extract the duplicated `acState`, `emojiAcState`, `selectedIndex`, `checkInlineVariable`, `handleInsertVariable`, `handleInsertEmoji`, and keyboard navigation handlers from `TextField` and `TextArea` into a single internal hook `useInlineFieldAutocomplete(inputRef, showVars, value, onChange)` inside `Field.tsx`.

---

### Batch 4 — Align Client & Server User-Placeholder Contracts (`avatarurl`, Snowflake Length, `clantag`)
**Commit message:** `align user id placeholder suggestions with server resolver`

1. **`client/src/utils/userPlaceholderAutocomplete.ts`**:
   - Remove `{ key: "avatarurl", ... }` from `USER_PROFILE_FIELDS` (since `server/src/services/authorService.ts` only resolves `avatar`).
   - Update the `clantag` description to `"Official primary-guild tag when enabled"`.
   - Update `getUserIdPlaceholderSuggestions`:
     - When a trailing dot/field is present (`user.<id>.<field>`), require a valid 17–20 digit Discord Snowflake (`/^user\.(\d{17,20})(?:\.([a-z0-9_.]*))?$/`) so invalid short IDs are not suggested as resolvable server tokens.
2. **`client/src/utils/__tests__/userPlaceholderAutocomplate.test.ts`**:
   - Update the test fixtures to use valid 17–20 digit Snowflake IDs (e.g., `123456789012345678`), assert `{user.123456789012345678.avatar}` is suggested, assert `{user.123456789012345678.avatarurl}` is **not** suggested, and add a test confirming `<17`-digit IDs with a trailing dot return `null`.

---

### Batch 5 — Deduplicate Server Variable Interpolation, Fix `{now.time}`, and Clean Up Stale Banner/Imports
**Commit message:** `share server variable replacement and fix time alias format`

1. **`server/src/services/variableInterpolation.ts`**:
   - Update `VARIABLE_PATTERN` to `/\{{1,2}\s*([^{}]+?)\s*\}{1,2}/g` (with `.trim()` on the captured key) so it handles all single- and double-brace placeholders consistently.
2. **`server/src/services/actionExecutor.ts`**:
   - Import `replaceVariables` from `./variableInterpolation.js` (and re-export it so existing callers/tests importing `replaceVariables` from `actionExecutor.ts` continue to work) instead of maintaining a duplicate recursive implementation.
   - Remove the unused `webhookProfileRepository` import on line 7.
   - Replace the binary-string `snowflakeToUnix` implementation (lines 37–42) with the bitwise shift `Math.floor(Number((BigInt(id) >> 22n) + 1420070400000n) / 1000)`.
3. **`server/src/routes/send.ts`**:
   - Fix `"now.time"` on line 236 from `` `<t:${unixNow}:t>` `` to `` `<t:${unixNow}:T>` `` so it matches `DocsPage.tsx` and `Field.tsx` ("Long Time with seconds").
   - Replace the inline `replaceSendVars` function (lines 257–270) with `replaceVariables(weaoInterpolated, sendVars)` imported from `../services/variableInterpolation.js`.
4. **`client/src/components/layout/StudioLayout.tsx`**:
   - Update the misleading banner at lines 77–89 from `"Custom Bot Mode: Use your own Bot Profile to dispatch messages. [Configure Bot]"` to `"Server Bot Access Required: Ask a Head Admin to grant your Discord account staff access to dispatch messages."` with button text `"Bot Access"`.
5. **`client/src/store/globalStore.ts`**:
   - Simplify `setSidebarOpen` to call ` get().setIsSidebarOpen(open)` (or share the helper) instead of duplicating the `localStorage` persistence block.

---

### Batch 6 — Add Component-Level Autocomplete & Clan-Tag Regression Tests
**Commit message:** `add component tests for partial variable and exploit autocomplete`

1. **`client/src/components/editor/__tests__/DiscordMentionInput.test.tsx`**:
   - Add component-level Vitest + Testing Library tests that render `<DiscordMentionInput />`, simulate typing into the `<textarea>` with `selectionStart` set, and assert that the portaled listbox (`screen.getByRole("listbox")`) visibly renders options in `document.body` for:
     - Bare `{` -> shows `{exploit.<Name>.<Field>}`, `{user.mention}`, `{user.name}`, `{now}`, etc.
     - Partial `{explo` -> shows `{exploit.<Name>.<Field>}`, and pressing `Enter` transitions to `{exploit.` (`exploit_name` stage) while keeping the popover open.
     - Partial `{user` and `{user.` -> shows `{user.mention}`, `{user.name}`, `{user.displayname}`, `{user.id}`, `{user.avatar}`, `{user.roles}`, `{user.clantag}`, etc.
     - Partial `{user.123456789012345678.ava` -> shows `{user.avatar}` (and does **not** show `{user.avatarurl}`).
     - Pressing `ArrowDown` / `ArrowUp` updates `aria-selected="true"` on the active option and `Enter` inserts the replacement.
2. **`client/src/components/ui/__tests__/FieldAutocomplete.test.tsx`** (or inside existing `Field` tests):
   - Verify `TextField` and `TextArea` render the variable popover when typing `{`, `{explo`, and `{user.` (verifying the `/^\{+/` regex fix in `getAutocompleteVariables`).
3. **`server/tests/authorService.test.ts`**:
   - Add a test passing a non-null `guildId` where `getGuildMember` rejects with HTTP `404` (user is not in the selected server), proving `{user.<id>.clantag}` still resolves the user's enabled `primary_guild.tag`.
4. **Update `docs/GEMINI_HANDOFF_CURRENT.md`**:
   - Record the exact commit SHAs for Batches 1–6 and note which checks were run in GitHub Actions vs awaiting local PC verification.
