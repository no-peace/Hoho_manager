# HoHo Manager — Playwright UI Audit

This is a standalone browser-audit package. It does **not** modify application source code and does not send Discord messages.

## Requirements

- Windows 10/11
- Node.js 22 or newer (Node.js 24 is compatible)
- Internet access
- A HoHo Manager account with access to the live site

## One-time setup (Windows PowerShell)

1. Download the repository ZIP from GitHub and extract it.
2. Open the extracted `Hoho_manager` folder.
3. Open `docs\playwright`.
4. Click the File Explorer address bar, type `powershell`, and press Enter.
5. Run:

```powershell
npm install
npx playwright install chromium
```

## Run the responsive browser audit

From `docs\playwright`:

```powershell
npm run audit
```

The audit opens a clean browser context first to capture the unauthenticated LoginScreen, then opens a separate persistent Chromium profile at `.browser-profile` for your authenticated Studio session.

1. The first temporary Chromium window captures the unauthenticated LoginScreen at **320, 360, 390, 430, 768, and 1280px**, then closes.
2. The second Chromium window is the **authenticated Studio audit window**. Sign in with Discord manually if requested. Do all preparation in this second window.
3. To create the exact component needed for the inspector test in **Classic** mode:
   - If you want to start clean, click **Clear all** in the top toolbar and confirm **Clear All**. This deletes the currently saved editor message, so do this only if you are comfortable clearing it.
   - In the Message 1 card, scroll to its bottom action bar and click **Add Action Row**.
   - In the new Action Row card, click **Add Button**.
   - The app's store automatically selects the new button. You should see a right-side panel titled **Component Inspector**, with the button's properties underneath.
   - If it does not open automatically, click the actual button pill inside the Action Row (not the **Add Button** control).
4. Do not press Escape or close the inspector. Return to PowerShell and press Enter. Keep the second Chromium window open until the audit finishes.
5. After Enter, the script waits up to **30 seconds** for the visible **Component Inspector** in that same browser window. If it cannot find it, the audit records a **FAIL** instead of silently marking the PropertyPanel screenshots as skipped.
6. The script checks whole-page overflow and internal horizontal overflow in the Header and PropertyPanel, then captures screenshots at all six widths.

**Components V2 alternative:** click the message's **Add** menu, choose **Action Row**, then click **Add Button** inside that row. The same **Component Inspector** should appear.

The audit never clicks the Discord login button automatically, never presses Dispatch/Send, and never accepts destructive confirmations.

### Output files

All output is written to `reports\`:

- `login-<width>.png` — top of LoginScreen at each width
- `login-bottom-<width>.png` — bottom of LoginScreen when its content is taller than the viewport
- `header-<width>.png` — Header at each width
- `studio-<width>.png` — full Studio page at each width
- `property-panel-<width>.png` — required Component Inspector screenshot at each width; the audit fails if the panel is missing
- `audit-report.md` and `audit-report.json` — results, overflow measurements, skips, and browser diagnostics

A successful full responsive audit must include `Button Component Inspector detected before responsive audit — PASS` and `PropertyPanel responsive screenshots — PASS`. A missing inspector is now a failure, not a skip. The script snapshots the already-prepared `dmb:message` value after you press Enter and verifies it is unchanged during the audit. It does not restore the state from before you manually clicked Clear all; that clear action is your own deliberate setup step. Do not edit or send the message while the audit is running.

## Analyze the GitHub Actions Lighthouse artifacts

This helper reads the raw Lighthouse Result (LHR) JSON files produced by the repository's Lighthouse workflow. It reports category scores, LCP/FCP/CLS/TBT, the LCP element when Lighthouse exposes it, and the largest `unused-javascript` entries.

1. Open the GitHub Actions run you want to inspect (for example run **43547638587**).
2. Download both artifacts: `lighthouse-mobile` and `lighthouse-desktop`.
3. Extract the ZIP contents into `docs\playwright\lighthouse-input\`. Keep the JSON files and their original filenames; subfolders are fine.
4. In PowerShell, still inside `docs\playwright`, run:

```powershell
npm run analyze:lighthouse
```

5. Read `reports\lighthouse-analysis.md` and `reports\lighthouse-analysis.json`.

**Important interpretation:** Lighthouse's `unused-javascript` audit estimates unused JavaScript bytes for the tested page load. It is not complete runtime code coverage. The LCP element is reported only if the downloaded LHR JSON contains the `largest-contentful-paint-element` audit details. If it says the node was not included, share the JSON output and we can inspect the available audit data instead.

## Stop / cleanup

Press `Ctrl+C` in PowerShell to stop. If you stop before the safety cleanup completes, reopen the app normally and check your message list. To run again, use `npm run audit`.

To remove generated browser data and reports, close Chromium and delete `.browser-profile`, `reports`, and `lighthouse-input`. These paths are ignored by Git.

## Safety and limitations

- This is a repeatable UI smoke/responsive audit, not proof that every feature works.
- It does not import test messages, send Discord messages, confirm destructive actions, delete backups, or test Discord-side delivery.
- The audit snapshots `dmb:message` and verifies it remains unchanged; if the value changes unexpectedly, it restores the exact original value.
- Screenshots show the currently rendered live app and account state. Keep reports/screenshots private if they expose account names, guilds, message content, or other personal data.
- For the full application test plan, see [TEST-CHECKLIST.md](./TEST-CHECKLIST.md). Run its repository commands from the repository root, not this folder.
