# HoHo Manager Design Lab

The Design Lab is a private Puck-powered visual editor. It stores account-owned themes in the server database and supports owner-only publishing of generated theme/design source files into a local checkout.

## Access control

- Production owner Discord IDs must be configured in server/.env using OWNER_DISCORD_IDS=123...,456....
- The owner can grant or revoke additional Discord IDs from Theme config → Allowed Discord accounts.
- Unauthorized or signed-out visitors receive the normal HoHo 404 page at /design; the API also returns 404 for unauthorized editor requests.
- Authorized non-owner users can create, update, and delete only their own themes.
- Only the configured owner can set the global default theme, grant/revoke access, or write generated files into a local project folder.
- In local development, the existing Local Developer admin session is treated as the editor owner.

## Theme workflow

1. Sign in with Discord and open /design.
2. Use Puck to edit the page composition. Use Theme config to edit global palette, radius, and font tokens.
3. Save a named theme. It is stored in the database and scoped to the Discord account.
4. The owner can select one of their own themes and choose Set as default. The public application fetches only this published default token set.
5. Authorized non-owner accounts can save personal themes but cannot set the default or publish local source files.

The default theme currently drives the app-wide palette tokens, font family, and shared corner-radius utility. Puck page composition is stored separately as a Puck document.

## Write generated source files to your local repository

The owner-only Write local files action uses the browser's File System Access API:

1. Open Design Lab in Chrome or Edge on your local development machine.
2. Click Write local files.
3. Select the root folder of your local Hoho_manager checkout (the folder containing client/).
4. The editor writes these files under client/src/config/puck/:
   - publishedDesign.ts — the owner-published Puck document.
   - publishedTheme.ts — typed theme tokens imported by the app.
   - publishedTheme.css — CSS variables and palette overrides imported by App.tsx.
5. Review the Git diff, run your local typecheck/build/tests, then commit and push the changes yourself.

The browser asks you to select the folder and cannot access arbitrary local files without that permission. This action is not available to non-owner accounts. It does not send files to GitHub or deploy the site.

The Puck document is an exported visual page composition; it does not rewrite arbitrary existing React component implementations. The theme token export updates the app-wide palette hooks covered by publishedTheme.css. Expanding Puck to structurally redesign every individual application screen requires mapping those screens to editable Puck components rather than blindly rewriting existing TSX files.

## Secret handling

Design endpoints never return process.env, .env files, OAuth credentials, bot tokens, database credentials, or server configuration. The editor stores only the JSON design and validated theme tokens supplied by the user. Never paste secrets into a design field.

## Puck component library

- Layout: Section, Container, Grid, Spacer, Divider.
- Typography: Heading, Text, Quote.
- Marketing: Hero, Button, Feature Card.
- Media: Image.

## Dependencies and verification

The client uses @puckeditor/core. Database schema migration 013_design_lab_themes_and_access is applied automatically by the existing migration runner on server startup.

Run locally:
- npm run typecheck
- npm test
- npm run build

Do not assume these checks pass until they have been run against the local dependency lockfile and environment.
