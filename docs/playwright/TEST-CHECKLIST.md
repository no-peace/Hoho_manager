# HoHo Manager — Full Repository Test Checklist

**Purpose:** a beginner-friendly, repeatable test plan for the repository. Work from top to bottom. Tick a box only after you actually perform the test and confirm the expected result.

- Application: https://hoho-manager.onrender.com/
- Repository: https://github.com/no-peace/Hoho_manager
- Test environment: use a local clone for automated tests; use a Discord test server for live Discord actions.
- Safety: never test sending, role changes, message deletion, or flow actions in a real production server/channel. Use a private test guild and test bot.

## 0. How to use this checklist

1. Download the repository ZIP or clone the repository, then extract/open the **repository root** (the folder containing the root `package.json`).
2. Open PowerShell in that root folder.
3. Install dependencies once with `npm ci`.
4. Run the automated commands in section 1. Do not skip directly to browser testing.
5. Work through the manual sections. Each item has an action and an expected result.
6. If something fails, do not keep testing dependent features. Record the section/item ID, what you did, expected result, actual result, browser/terminal error, and screenshot if relevant.
7. At the end, run the automated commands again. This catches regressions caused during testing.

**Checklist status:** [ ] Not started  [ ] In progress  [ ] Complete  
**Build/commit tested:** ____________________  
**Date:** ____________________  
**Tester:** ____________________

## 1. Automated repository checks (run from repository root)

Run each command separately in PowerShell. A successful command returns to the prompt without a non-zero exit code.

| ID | Command | What it checks | Pass condition |
|---|---|---|---|
| A01 | `node --version` | Node runtime | Version is 22 or newer and below 27 |
| A02 | `npm --version` | npm available | Prints a version |
| A03 | `npm ci` | Exact lockfile dependency install | Completes without npm errors |
| A04 | `npm run typecheck` | TypeScript checks in workspaces | Exit code 0; no diagnostics |
| A05 | `npm test` | Shared, client, server, and bot Vitest suites | Exit code 0; no failed tests |
| A06 | `npm run build` | Builds shared, client, server, and bot | Exit code 0 |
| A07 | `npm run verify:acceptance` | Existing production-readiness assertions | All listed acceptance checks pass |
| A08 | `npm run benchmark:json` | Server performance benchmark gates | Completes and emits valid JSON/report |
| A09 | `npm run dev` | Starts local server/client/bot dev processes | No startup crash; check browser and terminal logs |
| A10 | Follow section **1A — Browser audit for beginners** | Responsive browser audit | All six viewport widths are captured; review every FAIL and SKIP in the report |

Notes:
- `npm run dev` starts the API, web client, and bot together. It may require valid local environment configuration. Do not paste secrets into issue reports.
- `npm run verify:acceptance` runs build/type/test/benchmark-related checks and source invariants; it is not a replacement for the manual checks below.
- If the benchmark command is unavailable or fails because the machine is resource-constrained, record the full output rather than silently marking it passed.
- For CI parity, the repository workflow builds, typechecks, tests, and runs server benchmarks on Node 22 and Node 26. A local pass on one Node version does not prove both matrix versions pass.

## 1A. Browser audit for beginners (Windows 10/11)

This section is written for someone who has never used a terminal. Follow it in order. You do not need to write or edit code. The Playwright audit opens the website, takes screenshots, checks layout, and writes reports. It does not send Discord messages.

### What you need
- A Windows 10/11 PC with internet access.
- Your GitHub account access to download the repository and Lighthouse artifacts.
- A HoHo Manager account that can sign in to the live website.
- About 10–20 minutes for the browser audit.

### Step 1 — Install Node.js (one time only)
1. Open https://nodejs.org/.
2. Download the current **LTS** version for Windows (64-bit Windows Installer `.msi`).
3. Open the downloaded installer, keep the default options, and click **Next** until **Install** appears.
4. Click **Install**, approve the Windows permission prompt if shown, and finish the installer.
5. Close any PowerShell windows that were already open.
6. Press the Windows key, type **PowerShell**, and open **Windows PowerShell**.
7. Copy this command, paste it into PowerShell, and press Enter:

```powershell
node --version
```

8. It must print Node version 22 or newer and below 27 (for example, v22.x or v24.x). If `node` is not recognized, restart Windows and try again. If it still fails, stop and report the exact message.

### Step 2 — Download the latest repository files
1. Open https://github.com/no-peace/Hoho_manager.
2. Confirm the branch selector says **main**.
3. Click the green **Code** button, then click **Download ZIP**.
4. Open your Windows **Downloads** folder.
5. Right-click `Hoho_manager-main.zip` and choose **Extract All...**, then click **Extract**.
6. Open the extracted `Hoho_manager-main` folder, then open `docs`, then `playwright`.
7. You should be inside a folder whose path ends with `Hoho_manager-main\docs\playwright`.

### Step 3 — Open PowerShell in the correct folder
1. Keep the `docs\playwright` folder open in File Explorer.
2. Click the address bar at the top of File Explorer.
3. Type `powershell` and press Enter.
4. A PowerShell window opens. Its current folder path must end with `docs\playwright`.
5. If it does not, close that window and repeat these steps from the correct folder.

### Step 4 — Install the audit tools (one time for this downloaded copy)
Copy each command below, paste it into PowerShell, and press Enter. Wait for each command to finish before running the next one.

```powershell
npm install
```

Then run:

```powershell
npx playwright install chromium
```

These commands may take a few minutes. Warnings are not automatically failures. If you see `npm ERR!` or the command ends unsuccessfully, stop and save the complete error text.

### Step 5 — Run the responsive browser audit
Run:

```powershell
npm run audit
```

Two Chromium browser sessions open in sequence.

**First browser — LoginScreen**
1. A clean browser opens the live website while signed out.
2. Wait for the LoginScreen. The script captures widths **320, 360, 390, 430, 768, and 1280 pixels**.
3. Do not click **Login with Discord** in this first browser.
4. It closes automatically when the screenshots are finished.
5. If the LoginScreen does not appear, the report will say SKIP. Do not mark this check as passed.

**Second browser — Studio, Header, and PropertyPanel**
1. A second browser opens with its own saved browser profile.
2. If signed out, sign in using the normal Discord login. The script does not enter your password or perform the login for you.
3. Wait for the Studio to finish loading.
4. Make sure the **Component Inspector** (PropertyPanel) is visible. Open or create a message, add a component if there is none (for example, a button), then click that component in the editor/preview or Layers list. Look for the panel titled **Component Inspector**.
5. Do not click Dispatch/Send. Do not confirm Clear All, Delete, or any other destructive action.
6. Return to PowerShell. It will be waiting for you. Press Enter once.
7. Leave the browser open and do not interact with the app until PowerShell says **Audit finished**.

The audit captures the Studio at all six widths, takes separate Header and PropertyPanel screenshots when visible, and checks whole-page overflow plus internal horizontal overflow in the Header and PropertyPanel. It may open safe dialogs to inspect them, but it does not confirm an action or send a message.

If PropertyPanel screenshots are marked **SKIP**, close the browser, run `npm run audit` again, and select a component before pressing Enter. SKIP is not a pass.

### Step 6 — Review the screenshots and audit report
1. In File Explorer, open `docs\playwright\reports`.
2. Look for these files:

| File | Contents |
|---|---|
| `login-320.png` through `login-1280.png` | LoginScreen at six widths (top of page) |
| `login-bottom-<width>.png` | Bottom of LoginScreen when its content is taller than the viewport |
| `header-320.png` through `header-1280.png` | Header at six widths |
| `property-panel-320.png` through `property-panel-1280.png` | PropertyPanel at six widths, if it was open |
| `studio-320.png` through `studio-1280.png` | Full Studio screenshots |
| `audit-report.md` | Readable test results |
| `audit-report.json` | Detailed results and browser/network diagnostics |

3. Double-click PNG files to open them. Check that text and buttons are visible, do not overlap, and are not cut off at narrow widths.
4. Right-click `audit-report.md`, choose **Open with**, then **Notepad**.
5. Read the totals and Status column: **PASS** means the check passed; **FAIL** means a problem was detected; **SKIP** means the check could not be performed. SKIP is never a pass.
6. Pay particular attention to Header at 320px and 360px, LoginScreen overflow entries, and PropertyPanel screenshots at the same widths.
7. Do not change source code based only on screenshots. Share the report and screenshots for review.

### Step 7 — Download Lighthouse artifacts from GitHub
1. Open https://github.com/no-peace/Hoho_manager/actions.
2. Click **Lighthouse** in the workflow list.
3. Open the run you want to inspect. The earlier requested run is https://github.com/no-peace/Hoho_manager/actions/runs/43547638587.
4. Find the **Artifacts** section on the run page.
5. Download both `lighthouse-mobile` and `lighthouse-desktop`.
6. In your extracted repository copy, open `docs\playwright`.
7. Create a folder named `lighthouse-input` if it does not exist. Inside it, create two folders: `mobile` and `desktop`.
8. In Downloads, right-click the mobile ZIP, choose **Extract All...**, and extract it into `docs\playwright\lighthouse-input\mobile`.
9. Extract the desktop ZIP into `docs\playwright\lighthouse-input\desktop`.
10. Keep the original JSON filenames and folder structure. Do not rename the JSON files.

**Run provenance warning:** run 43547638587 was previously identified as belonging to branch `perf/mobile-lighthouse-optimizations`, not the current `main` branch. Its results describe that run, not the latest main commit.

### Step 8 — Analyze the Lighthouse JSON
Make sure the PowerShell window is still open in `docs\playwright`. If not, reopen it using Step 3. Run:

```powershell
npm run analyze:lighthouse
```

Open `docs\playwright\reports`. The analyzer creates `lighthouse-analysis.md` and `lighthouse-analysis.json`. They include performance scores, LCP, FCP, CLS, TBT, the LCP element if the JSON contains it, and the largest estimated unused-JavaScript entries.

**Coverage clarification:** standard Lighthouse JSON does not normally include full Chrome DevTools runtime JavaScript coverage (the exact code executed during the test). The `unused-javascript` audit estimates unused bytes for that page load; it is not full code coverage. If the LCP node is absent, the analyzer reports that instead of guessing.

### Step 9 — Send the results for review
1. In File Explorer, open `docs\playwright`.
2. Right-click the `reports` folder.
3. Choose **Compress to ZIP file** (or **Send to → Compressed (zipped) folder**, depending on your Windows version).
4. Attach the ZIP to your ChatGPT conversation.
5. If PropertyPanel was skipped, explain whether you could open the Component Inspector.
6. Before sharing, inspect screenshots for Discord usernames, server names, message contents, or other private information. Blur or remove anything you do not want to share.
7. Never share passwords, OAuth tokens, bot tokens, cookies, or the `.browser-profile` folder.

### Step 10 — Common problems
- **`node` or `npm` is not recognized:** restart Windows, open a new PowerShell window, and retry Step 1. Reinstall Node.js LTS if necessary.
- **`npm ERR!` during install:** save the full error text. Do not delete random files or change package versions.
- **Playwright says Chromium is missing:** run `npx playwright install chromium` again.
- **Website does not open:** check internet access and try the site manually in Chrome. Do not mark the audit passed.
- **Discord login fails:** stop and report the visible error. Never send passwords or tokens.
- **PropertyPanel is SKIP:** rerun the audit and select a component before pressing Enter.
- **PowerShell appears stuck:** wait two minutes. If there is no activity, press Ctrl+C, record the last message, and report it. Do not start multiple audit copies.
- **A FAIL appears:** keep the report and screenshots. Do not attempt code fixes yourself.

### Step 11 — Keep these files private
- Keep `reports` until the results have been reviewed and shared.
- Keep `lighthouse-input` until Lighthouse analysis is complete.
- Do not share `.browser-profile`; it can contain signed-in browser session data.
- Do not commit screenshots, generated reports, browser profiles, or Lighthouse JSON to GitHub. These local folders are ignored by the Playwright `.gitignore`.


## 2. Frontend routes, startup, and global layout

**Relevant source:** `client/src/App.tsx`, `client/src/main.tsx`, `client/src/components/layout/StudioRouter.tsx`, `StudioLayout.tsx`, `StudioModals.tsx`, `SplitPane.tsx`, `Header.tsx`, `Sidebar.tsx`, `PublicPageHeader.tsx`, `ErrorBoundary.tsx`, `client/src/pages/*`.

- [ ] F01 — Open `/`. Expected: Studio loads; no blank screen, uncaught error, or broken asset.
- [ ] F02 — Open `/studio` directly in a new tab. Expected: Studio loads.
- [ ] F03 — Open `/bots/webhook` directly. Expected: Studio route loads (route alias).
- [ ] F04 — Open `/docs` directly. Expected: documentation page loads and page title/description are appropriate.
- [ ] F05 — Open `/privacy` directly. Expected: privacy page loads and page title/description are appropriate.
- [ ] F06 — Open an unknown route such as `/this-route-does-not-exist`. Expected: Not Found page; no crash.
- [ ] F07 — Use browser Back and Forward after navigating between routes. Expected: route content follows browser history.
- [ ] F08 — Refresh each valid route. Expected: server returns the app page and the correct route renders.
- [ ] F09 — Inspect header at desktop width. Expected: controls are visible, labelled, clickable, and not overlapping.
- [ ] F10 — Inspect sidebar and split-pane layout. Expected: panels fit; resize/collapse interactions work where provided.
- [ ] F11 — Resize browser from wide desktop to 1024px, 768px, 390px, and 320px. Expected: no unintended horizontal page scroll; controls remain usable.
- [ ] F12 — Check browser console on initial load and route changes. Expected: no uncaught errors or repeated React warnings.
- [ ] F13 — Trigger a recoverable component error only in a test build if a test mechanism exists. Expected: error boundary displays fallback rather than a blank page.
- [ ] F14 — Verify logo, favicon, Open Graph assets, robots.txt, and sitemap load without 404s.

## 3. Authentication, account, sessions, and access control

**Relevant source:** `LoginScreen.tsx`, `AccessPanel.tsx`, `ProfilesPanel.tsx`, `ServerBotAccessModal.tsx`, `SessionsModal.tsx`, `SettingsModal.tsx`, `AuditLogsModal.tsx`; client hooks `useStaffAccess.ts`; server routes `auth.ts`, `access.ts`, `settings.ts`; middleware `auth.ts`, `staffPermissions.ts`; session/user/staff repositories.

Use a test account and do not revoke your only administrator session.

- [ ] AUTH01 — Open the app while signed out. Expected: login screen or unauthenticated state; protected controls do not become usable.
- [ ] AUTH02 — Start Discord OAuth login. Expected: Discord authorization page opens with the configured callback; no redirect loop.
- [ ] AUTH03 — Cancel OAuth. Expected: app returns to a safe signed-out state with a useful message.
- [ ] AUTH04 — Complete OAuth using a test account. Expected: app returns signed in and shows the correct account identity.
- [ ] AUTH05 — Refresh while signed in. Expected: session is restored if still valid.
- [ ] AUTH06 — Sign out. Expected: protected UI is no longer accessible.
- [ ] AUTH07 — Revisit a protected API endpoint after sign-out. Expected: unauthorized response; no private data leak.
- [ ] AUTH08 — Open Sessions modal. Expected: current session is listed accurately.
- [ ] AUTH09 — Revoke a second test session only. Expected: that session stops working; current session remains usable.
- [ ] AUTH10 — Inspect access/staff panel as an administrator. Expected: staff records and permissions load.
- [ ] AUTH11 — Attempt staff-only access as a normal user. Expected: forbidden/hidden state; no privilege escalation.
- [ ] AUTH12 — Test a staff member with an allowed channel and allowed guild in the test server. Expected: permitted action is available.
- [ ] AUTH13 — Test a staff member with a disallowed channel. Expected: action is blocked with a clear permission error.
- [ ] AUTH14 — Test a staff member with a disallowed guild. Expected: action is blocked even if the channel is otherwise listed.
- [ ] AUTH15 — Change a test staff permission, refresh, and inspect audit logs. Expected: saved permission persists and audit event is recorded.
- [ ] AUTH16 — Inspect settings and profile panels. Expected: current values load, valid edits persist, invalid values are rejected.
- [ ] AUTH17 — Test expired/invalid session behavior in a test environment. Expected: API returns an auth error and client returns to a safe state.

## 4. Message editor, content, embeds, and preview

**Relevant source:** `MessageEditor.tsx`, `ContentTab.tsx`, `EmbedsTab.tsx`, `EmbedEditor.tsx`, `PropertyPanel.tsx`, `LayersPanel.tsx`, `MessagePreview.tsx`, `EmbedPreview.tsx`, `Markdown.tsx`, `useMessage.ts`, `messageStore.ts`.

- [ ] MSG01 — Create a new blank message. Expected: editor and preview render without errors.
- [ ] MSG02 — Enter ordinary text. Expected: preview updates to match.
- [ ] MSG03 — Enter multi-line text, whitespace, Unicode, and emoji. Expected: content is preserved and preview renders correctly.
- [ ] MSG04 — Edit existing content, undo/redo if supported, and switch tabs. Expected: edits remain consistent.
- [ ] MSG05 — Add an embed. Expected: embed appears in editor, layers, and preview.
- [ ] MSG06 — Edit embed title, description, URL, color, author, footer, timestamp, and fields. Expected: each change appears in preview.
- [ ] MSG07 — Add, edit, reorder, and remove embed fields. Expected: order and values remain correct.
- [ ] MSG08 — Add image and thumbnail URLs. Expected: valid URLs preview; invalid URLs show safe behavior without breaking editor.
- [ ] MSG09 — Add multiple embeds up to Discord's supported limit. Expected: valid count accepted; excess count blocked/validated.
- [ ] MSG10 — Select an item in Layers panel. Expected: correct editor section/property panel is selected.
- [ ] MSG11 — Reorder layers/items. Expected: preview order follows editor order.
- [ ] MSG12 — Delete a selected item. Expected: only selected item is removed; other content remains.
- [ ] MSG13 — Test empty content and empty embed. Expected: app validation and Discord constraints are communicated clearly.
- [ ] MSG14 — Test long content and boundary-length inputs. Expected: limits are enforced before sending.
- [ ] MSG15 — Switch between Content, Embeds, and Components tabs. Expected: state is retained.
- [ ] MSG16 — Reload the page. Expected: persistence behavior matches the product design; no corrupted message state.
- [ ] MSG17 — Compare preview with actual Discord rendering using a harmless test message in a private test channel.

## 5. Mentions, markdown, emojis, flags, files, and JSON

**Relevant source:** `MentionInput/*`, `DiscordMentionInput.tsx`, `AllowedMentionsModal.tsx`, `FlagsModal.tsx`, `FileAttachmentsSection.tsx`, `JsonModal.tsx`, `RichPicker.tsx`; utilities `mentionParser.ts`, `mentionValidation.ts`, `unicodeEmojis.ts`, `exportImport.ts`, `clipboard.ts`.

- [ ] EDIT01 — Type `@` and search for a user/role/channel mention in a configured test guild. Expected: autocomplete results are relevant.
- [ ] EDIT02 — Select a mention suggestion. Expected: correct Discord mention syntax/identity is inserted.
- [ ] EDIT03 — Use keyboard arrows, Enter, and Escape in autocomplete. Expected: selection, acceptance, and dismissal work.
- [ ] EDIT04 — Type partial/invalid mention syntax. Expected: no crash; validation handles malformed input.
- [ ] EDIT05 — Test markdown toolbar formatting (bold, italic, underline, strike, code, quote, link if available). Expected: correct markup inserted at cursor/selection.
- [ ] EDIT06 — Open emoji picker, search, and select an emoji. Expected: emoji is inserted and picker closes correctly.
- [ ] EDIT07 — Test custom emoji syntax and Unicode emoji. Expected: values remain intact.
- [ ] EDIT08 — Open Allowed Mentions modal. Expected: user/role/everyone parsing controls reflect the message settings.
- [ ] EDIT09 — Disable parsing for a mention category and inspect JSON/preview. Expected: allowed-mentions payload matches the selection.
- [ ] EDIT10 — Open Flags modal and toggle supported flags. Expected: bitfield/payload changes correctly; unsupported combinations are rejected.
- [ ] EDIT11 — Attach an allowed image/file in a test environment. Expected: filename/type/size are displayed and payload is valid.
- [ ] EDIT12 — Try a disallowed file type and an over-limit file. Expected: rejected with clear validation; app remains usable.
- [ ] EDIT13 — Remove an attachment. Expected: attachment disappears and payload updates.
- [ ] EDIT14 — Open JSON modal and export current message. Expected: valid JSON is shown/copied.
- [ ] EDIT15 — Import a valid sample JSON into a disposable test message. Expected: fields populate and preview updates.
- [ ] EDIT16 — Import malformed JSON. Expected: readable validation error; current message is not silently corrupted.
- [ ] EDIT17 — Import JSON with unknown/legacy fields. Expected: safe handling; unsupported fields are not accidentally sent.
- [ ] EDIT18 — Cancel JSON modal. Expected: no changes are applied.
- [ ] EDIT19 — Test copy/paste actions. Expected: clipboard operations work where browser permissions allow and graceful fallback appears otherwise.

## 6. Components V2, buttons, selects, and action flows

**Relevant source:** `DiscohookComponentsEditor.tsx`, `ComponentForms.tsx`, `FlowBuilder.tsx`, `StepList.tsx`, `ComponentPreview.tsx`, `ActionRowPreview.tsx`, `ContainerPreview.tsx`, `useAutocompleteMenu.ts`; server action executor and action modules.

Only use a private test guild and test bot for live interactions. Never use a public/production channel for this section.

- [ ] COMP01 — Add a Components V2 container. Expected: container appears in editor and preview.
- [ ] COMP02 — Add text display, separator, section, thumbnail, media gallery, and file components where supported. Expected: correct component type and preview.
- [ ] COMP03 — Add an action row with a button. Expected: button label/style/disabled state render correctly.
- [ ] COMP04 — Configure a link button. Expected: valid URL accepted; invalid URL rejected.
- [ ] COMP05 — Configure a custom-ID button. Expected: custom ID is generated/validated within Discord's 100-character limit.
- [ ] COMP06 — Add string select, user select, role select, channel select, and mentionable select where supported. Expected: correct option/configuration form.
- [ ] COMP07 — Test select min/max values and option limits. Expected: invalid boundaries are rejected.
- [ ] COMP08 — Reorder and delete components. Expected: component tree and preview remain synchronized.
- [ ] COMP09 — Create a simple flow with one action. Expected: flow is saved and represented correctly.
- [ ] COMP10 — Add multiple flow steps and reorder them. Expected: execution order matches the displayed order.
- [ ] COMP11 — Configure branch/condition steps with true and false test inputs. Expected: only the correct branch executes.
- [ ] COMP12 — Test variable assignment and interpolation. Expected: later steps receive the correct variable value.
- [ ] COMP13 — Test wait/delay using a short safe delay. Expected: flow resumes once and does not duplicate actions.
- [ ] COMP14 — Test stop/terminal step. Expected: later steps do not run.
- [ ] COMP15 — Test maximum branch depth boundary. Expected: depth 10 is accepted only as designed and deeper recursion is stopped safely.
- [ ] COMP16 — Test malformed action parameters. Expected: validation rejects them; no unintended Discord request occurs.
- [ ] COMP17 — Test a button interaction end-to-end in the test guild. Expected: acknowledgement is timely and configured flow runs.
- [ ] COMP18 — Test a modal-submit interaction end-to-end in the test guild. Expected: submitted values reach the intended flow.
- [ ] COMP19 — Test duplicate interaction delivery. Expected: interaction receipt/idempotency logic prevents duplicate side effects.
- [ ] COMP20 — Test an interaction whose flow exceeds the acknowledgement window. Expected: deferred acknowledgement/cleanup behaves safely; no “interaction failed” response.

## 7. Backups, templates, profiles, and local persistence

**Relevant source:** `BackupsModal.tsx`, `ProfilesPanel.tsx`, `useTemplates.ts`, `templateStore.ts`, `profileStore.ts`, `settingsStore.ts`, `globalStore.ts`, `messageStore.ts`; server template/profile/settings repositories and routes.

Use disposable test content. Export a backup before testing restore/delete.

- [ ] DATA01 — Save a backup of a disposable message. Expected: backup appears with correct name/content.
- [ ] DATA02 — Load/restore that backup. Expected: editor restores the saved message accurately.
- [ ] DATA03 — Rename a backup if supported. Expected: new name persists after refresh.
- [ ] DATA04 — Delete only the disposable backup. Expected: it is removed; other backups remain.
- [ ] DATA05 — Export a backup file. Expected: file downloads and parses as valid JSON.
- [ ] DATA06 — Import a valid backup. Expected: supported data restores without corrupting existing items.
- [ ] DATA07 — Import an invalid backup. Expected: clear error; existing data remains intact.
- [ ] DATA08 — Create a template from a disposable message. Expected: template appears in template list.
- [ ] DATA09 — Apply a template. Expected: intended fields are inserted; unrelated data behavior matches design.
- [ ] DATA10 — Edit and delete a disposable template. Expected: changes persist and only selected template is removed.
- [ ] DATA11 — Create/switch profiles if enabled for the account. Expected: correct profile settings/messages load.
- [ ] DATA12 — Refresh and reopen app. Expected: local settings and saved content follow documented persistence rules.
- [ ] DATA13 — Test empty storage and malformed local storage in a disposable browser profile. Expected: app initializes safely and does not enter a crash loop.
- [ ] DATA14 — Use Clear All only with disposable content after exporting a backup. Expected: confirmation clearly explains the action; cancel leaves data unchanged; confirm clears only the intended data.

## 8. Preview, placeholders, dynamic variables, and tracking

**Relevant source:** `UserPlaceholderPreviewContent.tsx`, `MessagePreview.tsx`, `variableInterpolation.ts`, `authorService.ts`, `messageTrackerService.ts`, `tracking.ts`, `weaoService.ts`, `mentionScrubber.ts`, `userPlaceholderAutocomplete.ts`.

- [ ] VAR01 — Open placeholder autocomplete and search for a supported placeholder. Expected: relevant suggestions appear.
- [ ] VAR02 — Insert a user/server/channel placeholder. Expected: token is inserted exactly once.
- [ ] VAR03 — Preview placeholders with representative test context. Expected: preview resolves known values and leaves unknown values safely represented.
- [ ] VAR04 — Test nested/adjacent placeholders. Expected: no accidental double interpolation or malformed output.
- [ ] VAR05 — Test unknown placeholder and malformed syntax. Expected: safe fallback; no crash.
- [ ] VAR06 — Test escaping/scrubbing of mention-like text. Expected: unintended pings are neutralized where required.
- [ ] VAR07 — Test date/time variables around a known timestamp. Expected: format matches documented behavior.
- [ ] VAR08 — Test tracked-message update in a test channel. Expected: tracked record maps to the correct Discord message.
- [ ] VAR09 — Edit/delete a tracked test message. Expected: tracker state updates and no unrelated message is changed.
- [ ] VAR10 — Test retention/cleanup with test records only. Expected: expired records are pruned without deleting active records.
- [ ] VAR11 — Test WEAO/exploit data with service available. Expected: data is parsed and cached as intended.
- [ ] VAR12 — Simulate WEAO unavailable/timeout. Expected: message operation follows documented fallback and does not crash.

## 9. Server API, middleware, validation, and database

**Relevant source:** `server/src/app.ts`, `routes/*`, `middleware/*`, `config/*`, `repositories/*`, `services/*`, `utils/*`. Automated route and repository tests use mocks/in-memory database; live checks require local test configuration.

- [ ] API01 — GET `/api/health`. Expected: HTTP 200 and healthy database status.
- [ ] API02 — Stop/disable the test database and check health. Expected: degraded response/HTTP 503, not a false healthy response.
- [ ] API03 — GET `/api/config`. Expected: public action types and feature configuration are returned.
- [ ] API04 — GET `/api/auth/me` signed out. Expected: user is null; no private account data.
- [ ] API05 — Test every route family: auth, access, config, Discord, executors, health, interactions, send, settings, templates, tracking, and WEAO. Expected: valid requests follow contract; invalid requests return structured errors.
- [ ] API06 — Send malformed JSON. Expected: 4xx response; server remains running.
- [ ] API07 — Send a request above the JSON body limit. Expected: request is rejected safely.
- [ ] API08 — Send invalid IDs, invalid profile IDs, invalid message payloads, and too many messages. Expected: validation error; no Discord side effect.
- [ ] API09 — Send request without required auth/admin/staff credentials. Expected: 401/403 as appropriate.
- [ ] API10 — Send request with valid test admin credential. Expected: only authorized endpoint operations proceed.
- [ ] API11 — Test rate limits with repeated test requests. Expected: rate-limited response after configured threshold.
- [ ] API12 — Test CORS from an allowed origin and a disallowed origin. Expected: allowed origin receives CORS headers; disallowed origin is not granted access.
- [ ] API13 — Test multipart upload with valid and invalid files. Expected: parser enforces type/size limits and handles stream errors.
- [ ] API14 — Test URL attachment retrieval with valid, invalid, and private/internal-network URLs in a safe test. Expected: SSRF protections reject unsafe targets.
- [ ] API15 — Test Discord interaction request with missing/invalid signature. Expected: 401/403; unsigned request is not executed.
- [ ] API16 — Test relay endpoint without admin key, with wrong key, and with correct test key. Expected: only correct key is accepted.
- [ ] API17 — Test database migration on a disposable database copy. Expected: migration completes and is safe to rerun if designed to be idempotent.
- [ ] API18 — Restart server and verify persisted records remain available.
- [ ] API19 — Test error handler and not-found handler. Expected: structured response; no stack trace/secrets exposed in production.
- [ ] API20 — Inspect security headers in production mode. Expected: Helmet headers, frame denial, CSP/HSTS where configured, and HTTPS redirect behavior.
- [ ] API21 — Inspect logs for auth failures, sends, staff changes, and errors. Expected: useful audit trail without tokens, OAuth secrets, or message credentials.
- [ ] API22 — Test SQLite/Turso pipeline only with disposable credentials/database. Expected: writes/reads and failure handling match configuration.

## 10. Discord bot, slash commands, and gateway relay

**Relevant source:** `bot/src/index.ts`, `commands/*`, `listeners/*`, `lib/*`; bot tests in `bot/tests/*`.

- [ ] BOT01 — Start API with test config, then start bot with matching test config. Expected: both processes start without crash.
- [ ] BOT02 — Check bot login/ready log. Expected: bot connects and registers/loads commands.
- [ ] BOT03 — Run `/ping` in test guild. Expected: response includes a valid latency result.
- [ ] BOT04 — Run `/status`. Expected: API/integration health is reported accurately.
- [ ] BOT05 — Run `/server` in a test guild. Expected: guild summary fields match test server.
- [ ] BOT06 — Run `/send` only in a private test channel with harmless text. Expected: message is sent once through the builder API.
- [ ] BOT07 — Run `/send` with missing/invalid arguments. Expected: command responds with validation; no message is sent.
- [ ] BOT08 — Trigger a button interaction in relay mode with endpoint URL configured as documented. Expected: exactly one delivery path handles the interaction.
- [ ] BOT09 — Trigger a modal interaction in relay mode. Expected: payload reaches API and flow responds.
- [ ] BOT10 — Stop API while bot remains online, then trigger a test interaction. Expected: user receives a clear fallback error rather than indefinite failure.
- [ ] BOT11 — Stop bot gracefully. Expected: gateway disconnects and process exits without orphaned process.
- [ ] BOT12 — Test cooldown behavior by invoking a rate-limited command repeatedly. Expected: cooldown message and no duplicate action.
- [ ] BOT13 — Test registration in a development guild. Expected: commands appear in the configured guild without unintended global registration.
- [ ] BOT14 — Confirm bot has only required Discord intents and permissions. Expected: no privileged intents are requested unless explicitly enabled in Developer Portal.

## 11. Deployment, CI, security, and operational readiness

**Relevant source:** `.github/workflows/*`, `Dockerfile` files, `docker-compose*.yml`, `ecosystem.config.cjs`, `docs/*`, `.env.example`, `SECURITY.md`, `tunnel/config.yml.example`.

- [ ] OPS01 — Review GitHub Actions CI on the latest commit. Expected: build, typecheck, tests, and benchmark jobs pass for configured Node versions.
- [ ] OPS02 — Review Lighthouse workflow results for desktop and mobile. Expected: no unexpected regression; investigate failed budgets.
- [ ] OPS03 — Review security workflow output. Expected: no untriaged critical/high findings; false positives documented.
- [ ] OPS04 — Build Docker images using documented commands. Expected: images build without missing-file errors.
- [ ] OPS05 — Start Docker Compose in a disposable environment. Expected: services become healthy and communicate on intended ports.
- [ ] OPS06 — Test reverse proxy/tunnel only with test credentials. Expected: HTTPS routing reaches the correct service; no secrets committed.
- [ ] OPS07 — Inspect PM2 ecosystem config. Expected: API and bot processes have intended restart/memory limits and separate logs.
- [ ] OPS08 — Restart a test process after a simulated crash. Expected: supervisor restarts it and logs the restart.
- [ ] OPS09 — Verify environment variables against each `.env.example`. Expected: required values documented; no real secrets in Git.
- [ ] OPS10 — Run secret scanning on the branch. Expected: no real credentials; review allowlisted findings rather than blindly ignoring them.
- [ ] OPS11 — Verify production frontend and API use HTTPS and expected origin configuration.
- [ ] OPS12 — Verify backups and database recovery procedure on a disposable copy before relying on it in production.
- [ ] OPS13 — Check deployment logs after a release. Expected: migration/startup errors are absent and health endpoint is healthy.
- [ ] OPS14 — Verify rollback procedure is documented and can restore the previous known-good release.

## 12. Accessibility and usability pass

- [ ] UX01 — Navigate main controls using only Tab, Shift+Tab, Enter, Space, and Escape. Expected: logical focus order and usable controls.
- [ ] UX02 — Open and close every modal with keyboard. Expected: focus enters modal, Escape/cancel closes where appropriate, focus returns to trigger.
- [ ] UX03 — Inspect visible focus indicators. Expected: focused controls are visually identifiable.
- [ ] UX04 — Check icon-only buttons for accessible names/tooltips. Expected: screen readers can identify their purpose.
- [ ] UX05 — Zoom browser to 200%. Expected: primary tasks remain usable without clipped critical controls.
- [ ] UX06 — Check text contrast in light/dark themes if both are available. Expected: text and controls remain readable.
- [ ] UX07 — Check empty, loading, success, and error states. Expected: each state communicates what happened and what the user can do next.

## 13. Bug report template

Copy this template whenever an item fails:

```text
Checklist ID:
Commit/branch:
Date/time:
Browser + version:
Screen size:
Account role (admin/staff/normal; do not include account IDs):
Test environment (local/test guild/production read-only):
Steps performed:
Expected result:
Actual result:
Error text (remove tokens, IDs, and private data):
Screenshot or report filename:
Can it be reproduced? (yes/no)
```

## 14. Completion criteria

Do not call the repository fully tested merely because the app opens.

- [ ] All automated checks A01–A10 are either passed or have a documented reason for being blocked.
- [ ] All applicable manual checks in F/AUTH/MSG/EDIT/COMP/DATA/VAR/API/BOT/OPS/UX are completed.
- [ ] Every failure has a reproducible bug report.
- [ ] All destructive/live Discord tests were performed only with disposable data in a private test guild.
- [ ] Automated checks pass again after fixes.
- [ ] GitHub CI is green for the final commit.

**Important scope note:** this checklist is a broad feature-and-module acceptance plan based on the current repository structure and existing scripts/tests. It does not claim line-by-line code coverage or that every edge case is automated. Some checks require Discord credentials, a test guild, OAuth configuration, a disposable database, or deployment access. Mark those as blocked—not passed—when those resources are unavailable.
