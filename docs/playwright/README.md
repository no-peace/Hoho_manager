# HoHo Manager — Playwright UI Audit

This is a standalone browser-audit package. It does **not** modify the application source code and does not send Discord messages.

## Requirements

- Windows 10/11
- Node.js 22 or newer (your installed Node.js 24 is compatible)
- Internet access
- A HoHo Manager account with access to the live site

## One-time setup (Windows PowerShell)

1. Download the repository ZIP from GitHub: open the repository, click **Code → Download ZIP**, then extract it.
2. Open the extracted `Hoho_manager` folder in File Explorer.
3. Open the `docs\playwright` folder.
4. Click the File Explorer address bar, type `powershell`, and press Enter.
5. Run these commands one at a time:

```powershell
npm install
npx playwright install chromium
```

## Run the audit

From the same PowerShell window:

```powershell
npm run audit
```

The script opens a separate Chromium profile in `docs/playwright/.browser-profile`. This profile is isolated from your normal Chrome/Brave profile.

1. Sign in to HoHo Manager in the opened browser. Complete Discord login manually if requested.
2. Return to PowerShell and press Enter when the app is fully loaded.
3. Leave the browser open while the checks run.
4. At the end, the script prints a summary and writes:
   - `reports/audit-report.json`
   - `reports/audit-report.md`
   - `reports/desktop.png`
   - `reports/mobile.png`

## What it checks

- App navigation and page load
- Console errors and uncaught page errors
- Failed network requests and HTTP 4xx/5xx responses
- JSON import/export modal opens and closes
- Backups modal opens and closes (when available)
- Dispatch modal opens and is cancelled; **it never presses Send**
- Clear-all confirmation opens and is cancelled; **it never confirms deletion**
- Desktop and mobile viewport overflow
- Desktop and mobile screenshots

The audit does not import test messages or intentionally edit saved content. It snapshots `dmb:message` before testing and verifies the value at cleanup; if it changed unexpectedly, the exact original value is restored and the page is reloaded. Do not close the audit browser while the script is running.

## Stop / cleanup

Press `Ctrl+C` in PowerShell to stop the audit. If you stop it before cleanup finishes, reopen the app normally and check your message list. The browser profile and reports are local to this folder.

To run again, use `npm run audit`. To remove generated browser data and reports, close Chromium first, then delete `.browser-profile` and `reports`.

## Important limitations

This is a repeatable smoke/regression audit, not a guarantee that every feature is correct. It does not dispatch messages, confirm destructive actions, delete saved backups, or test Discord-side delivery. Authentication and Discord OAuth are intentionally completed by you in the visible browser.


## Full repository testing checklist

The browser audit above is only a small UI smoke test. For the full application test plan, open **[TEST-CHECKLIST.md](./TEST-CHECKLIST.md)**. It explains what to test, exactly what to click or run, and what result you should expect across the frontend, authentication, editor, components/actions, backups/templates, API, database, Discord bot/relay, and deployment/security.

**Important:** the full checklist commands must be run from the repository root (the folder containing the main `package.json`), not from this `docs/playwright` folder.

Quick automated test sequence from the repository root:

```powershell
npm ci
npm run typecheck
npm test
npm run build
npm run verify:acceptance
npm run benchmark:json
```

Then return to `docs/playwright` and run `npm run audit` for the browser smoke audit. Follow the manual checklist for behavior that automated tests cannot safely or realistically cover.

Do not test live Discord sends, role actions, deletions, or flow side effects in a production server. Use a private test guild and disposable content.
