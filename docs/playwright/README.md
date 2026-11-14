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

1. The first browser captures LoginScreen at **320, 360, 390, 430, 768, and 1280px**.
2. In the second browser, sign in with Discord manually if requested.
3. In the Studio, select a message component so the **Component Inspector / PropertyPanel is open**.
4. Return to PowerShell and press Enter. Keep Chromium open until the audit finishes.
5. The script performs safe modal-open/cancel checks, checks horizontal overflow, and captures screenshots.

The audit never clicks the Discord login button automatically, never presses Dispatch/Send, and never accepts destructive confirmations.

### Output files

All output is written to `reports\`:

- `login-<width>.png` — LoginScreen at each width
- `header-<width>.png` — Header at each width
- `studio-<width>.png` — full Studio page at each width
- `property-panel-<width>.png` — PropertyPanel at each width, if it was open when you pressed Enter
- `audit-report.md` and `audit-report.json` — results, overflow measurements, skips, and browser diagnostics

If PropertyPanel screenshots are skipped, rerun the audit and select a component before pressing Enter. Do not edit or send the message during the audit.

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
