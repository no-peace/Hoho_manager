# Repository Audit Ledger

**Repository:** `no-peace/Hoho_manager`
**Audit baseline:** `36469393669764e9c8e938c2af3dbb8b95fb75f2` (main, before Batch F9 documentation update)
**Tree:** 377 tracked files across 66 directories
**Purpose:** Track source review by file. A checked file means inspected, not necessarily runtime-verified. Tests/build/browser checks are recorded separately.

## Status definitions

- `[ ]` Not reviewed.
- `[~]` Provenance/metadata checked; implementation not fully audited.
- `[x]` Source inspected in this audit batch; no runtime verification implied.

## Progress summary

| Area | Files | Status |
|---|---:|---|
| Root / infrastructure | 25 | Source review complete |
| Client | 161 | In progress (27/161) |
| Server | 139 | In progress (69/139) |
| Bot | 24 | Reviewed (24/24) |
| Shared | 10 | Source review complete |
| Documentation | 8 | In progress (3/8) |
| Vendored security patch | 10 | Provenance only |
| **Total** | **377** | **377 accounted for** |

## Batch F1 — Root and infrastructure source review (2026-11-18)

**Status:** Source inspection complete. No workflow, Docker, build, test, or deployment commands were executed.

Findings:
1. **RESOLVED:** `.github/workflows/ci.yml` now uses synthetic Discord test credentials only; it no longer injects repository secrets or variables into the test process.
2. **RESOLVED:** `.github/WORKFLOWS.md` now states that GitHub Actions are disabled by owner instruction and that workflow definitions are dormant until re-enabled.
3. `docker-compose.yml` supplies `dev-admin-key` as a fallback. This is explicitly a local-development configuration and must not be exposed as a production deployment.
4. `docker-compose.tunnel.yml` uses the mutable `cloudflare/cloudflared:latest` image tag. This reduces deployment reproducibility; pin a reviewed version/digest before production use.
5. `.github/workflows/security.yml` installs the latest Semgrep package without a version pin. Pin a tested version when the workflow is next maintained.
6. **RESOLVED:** `README.md` now recommends `npm ci` for a clean install from the committed lockfile.
7. Root TypeScript configuration is strict and workspace package engines consistently target Node 22–26; `.nvmrc` selects Node 26.13.1.
8. CI actions are pinned to full commit SHAs. Release publishing is gated on verification of the exact tag. Workflow files exist, but execution is disabled by owner instruction.

No finding above has been runtime-tested. The Docker and CI concerns are configuration/source-review findings, not evidence of a current production compromise.

## Batch F2 — Shared package source review (2026-11-18)

**Status:** All 10 shared package files inspected, including types, constants, custom-ID codec, package exports, Vitest and TypeScript configuration, and both test files. No tests or builds were executed.

Findings:
1. `LoggingConfig` is declared twice identically in `shared/src/types.ts`. This is harmless TypeScript interface merging but redundant; left unchanged to avoid an unnecessary type-only cleanup during the audit.
2. `WEBHOOK_URL_REGEX` is not orphaned: `server/src/utils/validation.ts` uses it in `parseWebhookUrl`, and `server/src/services/discordService.ts` calls that parser from `getWebhookInfo`. Keep it unless that API feature is separately removed.
3. `ActionType` still includes `send_webhook_message`. This is a persisted-flow compatibility identifier; runtime dispatch remains disabled and should not be re-enabled by changing the shared union alone.
4. The shared package has no runtime dependencies; it exports protocol constants, custom-ID codec and domain types used across client/server boundaries. Payload boundary validation remains the security control for the deliberately generic `ComponentNode` and `ActionConfig` shapes.

No shared-package functional defect was confirmed in this source-only pass.

## Batch F3 — Server core, authentication and data layer (2026-11-18)

**Status:** Source inspection of 25 server files plus the client Dockerfile. No server tests, database migrations, Docker builds, live Discord calls or Turso integration were executed.

Findings:
1. **Fixed:** `runMigrations` previously executed each multi-statement migration and inserted its ledger row outside a transaction. A mid-migration failure could leave partial schema changes with no migration record; concurrent server starts could also read the same stale migration list. Pending migrations now run as one database transaction, and the migration ledger is read after acquiring the transaction lock.
2. **Open security hardening:** Production may omit `SESSION_SECRET`; sessions then use `ADMIN_API_KEY` as the signing secret. Verification also accepts `ADMIN_API_KEY` as a legacy signature key even when a dedicated session secret exists. This is an intentional key-separation migration fallback, but it means the admin key can still forge sessions. Do not remove the fallback blindly: coordinate a separate secret in deployment and a bounded transition that accounts for the 24-hour session TTL.
3. `verifyDiscordSignature` checks timestamp freshness (five-minute window), key/signature hex lengths, raw request bytes and Ed25519 verification before accepting Discord interactions.
4. The interaction gateway relay requires the admin key and validates interaction IDs, tokens, application ID, type and custom ID before dispatch.
5. Staff permission middleware is designed to fail closed: production rejects raw `x-staff-id`, checks live staff records, channel/guild allowlists, role mentions, cooldowns and hourly limits.
6. URL attachment fetching resolves all DNS answers, rejects private/reserved IPv4/IPv6 ranges, pins the chosen address for the request and does not follow redirects. This is a source inspection, not an SSRF penetration test.
7. The send route explicitly rejects webhook-URL sending and custom bot profiles; its payload and staff-policy checks are present, but the full route remains pending deeper review.
8. Both Dockerfiles now copy the local picomatch fork before `npm ci`, preventing the new local root dependency from breaking image builds. Docker builds remain unverified.

The session-secret migration is the highest-priority unresolved security item from this batch. It is recorded for a coordinated deployment change rather than silently invalidating active sessions.

## Batch F4 — Server routes, templates and action boundaries (2026-11-18)

**Status:** Additional source inspection across routes, repositories, action registry, template services and tests. No test suite or live Discord integration was executed.

Findings and changes:
1. **Fixed:** Template updates previously converted an omitted `description` into `null`, unintentionally clearing existing descriptions during partial updates. The route now distinguishes omitted, explicit null/empty and invalid values.
2. **Fixed:** Template creation and updates previously wrote template documents, metadata and action definitions in separate operations. These writes now share one database transaction; nested action replacement joins the active transaction.
3. **Fixed:** Template action definitions were accepted as an unchecked TypeScript cast. A runtime parser now enforces object shape, valid action custom-ID prefix/length, action type string bounds, object config, 25-flow maximum, 20 steps per flow, execution order 0–19, 500 total steps and 128 KiB aggregate config.
4. Added focused validation tests for valid normalization, malformed records, flow/step limits, configuration size and execution-order bounds. Tests were not run.
5. **Fixed:** `actionExecutor.ts` now uses an internal `failed` response flag instead of matching warning-emoji text. The flag is stripped before the response reaches Discord, and the action log records the structured failure state. Regression coverage was added.
6. **Verified disabled:** `send_webhook_message` remains registered only so legacy persisted flows receive an explicit disabled response. The handler does not call webhook delivery, and the public action picker hides it. Keep the compatibility behavior unless the persisted-flow policy changes.
7. **Verified disabled:** `resolveBotToken` intentionally ignores legacy profile IDs and returns only the configured server bot token. Route parameters are retained for compatibility but cannot select a custom token.
8. Template ownership checks remain in the service/repository path. Action lookups for template-backed messages are constrained by the tracked message's template ID.

## Batch F5 — Client state, preview and dispatch review (2026-11-18)

**Status:** Source inspection across 27 client files covering API/session state, stores, layout runtime, preview selection, mobile quick-edit, dispatch, mention checks and the local dependency build context. No browser tests, UI tests, typecheck or build were executed.

Findings and changes:
1. **Fixed:** Edit mode previously reused the first target message ID for every selected channel when fewer IDs than channels were entered. It now requires exactly one distinct 17–20 digit Discord snowflake per selected channel, in selection order. Added pure parser tests.
2. **Fixed:** Users without server-bot access were labelled `Custom Bot Mode` and shown a banner claiming they could use their own Bot Profile. The active send workflow only supports the configured server bot. The UI now says `Access Required` / `Server Bot Access Required` and links to the accurate access modal.
3. **Fixed:** Updated the legacy direct-webhook client module comment; the exported function is a disabled stub and does not send requests.
4. **Fixed:** Updated the mention-validation comment. The actual bypass is Head Admin only; custom bot profiles are not a supported send path.
5. `MobileBottomNavigation.activeTab` is intentionally preview-only and is documented as such in `docs/PUCK_DESIGN_LAB.md`. The real initial mobile pane is controlled by `MobileWorkspace.defaultPane`; no runtime change is required for this preview-only field.
6. The reviewed Markdown link parser only creates HTTP/HTTPS links; embed author/title links also explicitly restrict protocols to HTTP/HTTPS. No raw-HTML rendering path was observed in the reviewed preview components. This is not a complete security audit of the Markdown renderer.
7. The API client includes `VITE_ADMIN_API_KEY` only in development builds. Production requests rely on the HttpOnly session cookie; the client-supplied staff ID header is not an authorization source in production.
8. Mobile quick-edit and preview selection route through the shared message store; no confirmed state-desynchronization issue was found in the reviewed files.

## Batch F6 — Bot command authorization and startup security (2026-11-18)

**Status:** Source fixes prepared for direct-main commit.

**Status:** All 24 bot files reviewed. No bot tests, typecheck, build, live Discord command or gateway integration were executed.

Findings and changes:
1. **Critical, fixed:** `/send`, `/exploit` and `/sync` called privileged API endpoints using the bot's `x-admin-key`, while their command handlers did not authorize the invoking Discord user. The API treats that key as an administrator, so any user able to invoke those commands could bypass app staff permissions.
2. The three privileged commands now require the invoking user's Discord ID to be in `BOT_COMMAND_ADMIN_IDS`; if that variable is empty, the worker falls back to `OWNER_DISCORD_IDS`. If both are empty, the commands are denied to everyone. `/exploit` autocomplete is also blocked for unauthorized users.
3. **High, fixed:** The bot previously logged environment validation errors but continued starting whenever a Discord token existed. It now exits on any validation error, preventing production startup with an insecure HTTP API origin or weak/default admin key.
4. Added validation and tests for configured Discord ID lists, denied command execution/autocomplete, and unsafe production environment settings.
5. The interaction relay remains machine-authenticated with the admin key and is separate from slash-command authorization; it only forwards component/modal interactions from the authenticated Discord gateway connection.
6. `/status`, `/server` and `/ping` remain public/read-only. No other bot command calling privileged API operations was found in the reviewed command set.

**Deployment requirement:** Set `BOT_COMMAND_ADMIN_IDS` in the bot service to the trusted Discord user IDs, or provide `OWNER_DISCORD_IDS`. Until then, `/send`, `/exploit` and `/sync` will be disabled by design.

## Batch F7 — Sender identity and tracked-message authorization (2026-11-18)

**Status:** Source inspection of the send/tracking routes, staff permission middleware, message tracker, tracking repository and mention scrubber. No route tests, integration tests or Discord calls were executed.

Findings and changes:
1. **Fixed:** The send route had a fallback to request-body `authorUserId` if authenticated actor context was absent. Sender identity now comes only from the verified staff/session context; legacy body values are ignored.
2. **Fixed:** The tracking route accepted arbitrary `authorUserId` values from callers with edit permission. That value is later used as the fallback identity for author and `{user.name}` placeholders during background message synchronization. The route now rejects explicit overrides and derives the stored identity from the authenticated actor.
3. Added `actorIdentity.ts` to centralize trusted actor-ID resolution and regression tests for session/staff identity, machine admin-key calls and rejected overrides.
4. Confirmed the tracking route checks channel/guild allowlists, verifies the existing message was authored by the configured server bot, and enforces template visibility before creating a tracking record.
5. The bot's global `/sync` operation remains machine-authenticated; only configured bot operators can invoke its slash command after Batch F6.

## Batch F8 — Private-template authorization on dispatch (2026-11-18)

**Status:** Source fix and focused tests added; no test suite or build was executed.

Findings and changes:
1. **Fixed:** The send route accepted a caller-supplied `templateId` and attached it to tracked messages without checking whether the caller could access that template. A staff member with send permission could therefore bind a message to another user's private template, which background synchronization could later use to update the message.
2. The send route now validates `templateId` as a positive safe integer, confirms the template exists, and permits use only when it is public, owned by the authenticated user, or the caller is Head Admin.
3. Extracted the owner/public/admin policy into `templateAccess.ts` and reused it in the manual tracking route to keep both entry points consistent.
4. Added tests for owner access, public-template access, Head Admin access and denial for another user.
5. Machine-authenticated bot operations remain authorized through the configured bot operator allowlist from Batch F6.

## Batch F9 — Server persistence, request parsing and error boundaries (2026-11-18)

**Status:** Source inspection of eight additional server files. No tests, typecheck, build, database migration, or live service checks were executed.

Files reviewed:
- `server/src/config/migrations.ts`
- `server/src/middleware/errorHandler.ts`
- `server/src/middleware/multipart.ts`
- `server/src/repositories/sessionRepository.ts`
- `server/src/repositories/sessionRevocationRepository.ts`
- `server/src/utils/errors.ts`
- `server/src/utils/logger.ts`
- `server/src/utils/requestParsing.ts`

Findings:
1. The migration catalog is ordered and append-only by convention. The published responsive layout is represented as one row containing both documents; the earlier F3 review established that pending migrations execute transactionally. No new migration defect was confirmed in this source pass.
2. Multipart uploads enforce limits of 10 files, 25 MiB per file, 50 MiB total file data, 2 MiB per field, 100 fields and 120 parts. File data is streamed and parser failures drain/close the request path. No new bypass was confirmed by source inspection.
3. Session revocation uses persistent per-user and global timestamp floors. Repository queries are parameterized; guild-session revocation is scoped by guild ID.
4. The session repository's synthetic default-session behavior is reachable through the Head Admin-protected Discord session routes. It is retained as existing Discohook/demo compatibility behavior, not treated as an unauthenticated session-creation path.
5. The error handler only returns an ApiError message/details when that error explicitly has `expose` enabled; unexpected errors return a generic 500 response. Upstream callers that opt into exposure must continue to keep their messages/details safe.
6. Request parsing fails closed on malformed allowlist JSON and non-string entries. Non-strict profile parsing returns null for invalid values; strict mode returns a 400.
7. The logger's level is fixed at module load and child loggers preserve scope prefixes. No logging behavior change was warranted in this batch.
8. **Open, unchanged:** production session signing and verification still accept `ADMIN_API_KEY` as a legacy fallback alongside `SESSION_SECRET`. Removing that fallback requires a coordinated production secret configuration and a bounded transition for the 24-hour session lifetime; no deployment secret was changed.

No code changes were needed from this batch. The remaining audit is still source-only until separately verified.

## Batch F10 — Components V2 malformed-tree validation (2026-11-18)

**Status:** One additional server source file reviewed; validation defect fixed and focused regression tests added. Tests/typecheck/build were not executed.

Files reviewed:
- `server/src/utils/validation.ts` (newly reviewed)
- `server/tests/validation.test.ts` (previously reviewed; regression coverage extended)

Finding and fix:
1. **Fixed:** The recursive Components V2 walker silently returned when nesting exceeded 25 levels and silently skipped null, primitive and array entries. Those malformed trees could pass this application's validation and fail only after reaching Discord.
2. The walker now reports an explicit validation error for excessive nesting and malformed component entries. Existing component limits and traversal behavior are otherwise preserved.
3. Added regression tests for a null component entry and a tree deeper than the supported 25-level limit.

Verification:
- Tests were added but not executed, per the current owner instruction.
- No typecheck, build, browser QA or live Discord request was executed.

## Batch F11 — Custom-executor enablement and bot resolution (2026-11-18)

**Status:** Source fixes and focused tests prepared; no tests, typecheck, build or live bot calls were executed.

Findings and changes:
1. **Fixed:** Repository lookups by custom-executor title/ID returned disabled records, and the resolve/send/tracking paths did not consistently enforce the `enabled` flag. A disabled executor could still be resolved and used.
2. Added one shared `isCustomExecutorEnabled` guard and applied it to `/resolve-exploit`, send, manual tracking and background sync.
3. The `/resolve-exploit` endpoint now recognizes authenticated machine-admin context without requiring a browser user session, while still requiring a user session for non-admin staff and enforcing private-template access.
4. Added tests for enabled/disabled custom-executor values.

## Batch F12 — Discord REST boundary and credential handling (2026-11-18)

**Status:** Source inspection of two additional server files. No tests, typecheck, build or live Discord requests were executed.

Files reviewed:
- `server/src/services/discordService.ts`
- `server/tests/discordService.timeout.test.ts`

Findings:
1. The only bot token resolver returns the configured server bot token. Legacy profile IDs are ignored; custom stored bot tokens cannot be selected through these helpers.
2. Arbitrary webhook-URL message sending remains a forbidden compatibility stub. Webhook inspection parses the URL and performs only a read request.
3. Discord REST attempts have bounded timeouts (10 seconds by default, 30 seconds for multipart, and 1 second for interaction callbacks) and bounded retry counts. Interaction callback timeout errors do not include the interaction token or request URL; the existing test asserts this.
4. Guild/user/member caches have TTL and entry bounds, with in-flight request coalescing for the high-volume lookup paths.
5. No new credential disclosure, token-selection bypass or confirmed functional defect was found in this source-only review.

Verification:
- Existing timeout regression tests were inspected but not executed.
- No live Discord API behavior was tested.

## Batch F13 — WEAO upstream cache bounds (2026-11-18)

**Status:** Source defect fixed and focused regression test added. Test suite was not executed.

Files reviewed and changed:
- `server/src/services/weaoService.ts`
- `server/tests/weaoService.test.ts`

Finding and fix:
1. **Fixed:** Changelog comparison baselines and comparison results were intended to be bounded at 250 entries, but eviction was driven by the separate response-cache size. When expired cache entries were removed after failed upstream refreshes, the baseline/comparison maps could retain those entries while the response cache shrank; subsequent new keys could grow the retained maps beyond their limit.
2. Eviction now uses the baseline map's own size and removes the corresponding comparison and response-cache entries together. Successful refreshes move the baseline to the newest position.
3. Added a regression test that fills the baseline cache, forces expired refresh failures, adds new keys and checks that an old comparison baseline was evicted.

Verification:
- Regression test added but not executed.
- No typecheck, build or live WEAO API request was executed.

## File-by-file inventory

### Root / infrastructure (25)
- [x] `.dockerignore` — inspected; runtime verification not performed
- [x] `.github/WORKFLOWS.md` — inspected; runtime verification not performed
- [x] `.github/dependabot.yml` — inspected; runtime verification not performed
- [x] `.github/workflows/ci.yml` — inspected; runtime verification not performed
- [x] `.github/workflows/lighthouse.yml` — inspected; runtime verification not performed
- [x] `.github/workflows/release.yml` — inspected; runtime verification not performed
- [x] `.github/workflows/security.yml` — inspected; runtime verification not performed
- [x] `.github/workflows/workflow-validation.yml` — inspected; runtime verification not performed
- [x] `.gitignore` — inspected; runtime verification not performed
- [x] `.gitleaksignore` — inspected; runtime verification not performed
- [x] `.lighthouserc.desktop.json` — inspected; runtime verification not performed
- [x] `.lighthouserc.mobile.json` — inspected; runtime verification not performed
- [x] `.nvmrc` — inspected; runtime verification not performed
- [x] `DESIGN.md` — inspected; runtime verification not performed
- [x] `README.md` — inspected; runtime verification not performed
- [x] `SECURITY.md` — inspected; runtime verification not performed
- [x] `docker-compose.tunnel.yml` — inspected; runtime verification not performed
- [x] `docker-compose.yml` — inspected; runtime verification not performed
- [x] `ecosystem.config.cjs` — inspected; runtime verification not performed
- [x] `package-lock.json` — inspected; runtime verification not performed
- [x] `package.json` — inspected; runtime verification not performed
- [x] `scripts/security/picomatch-redos.test.mjs` — inspected; runtime verification not performed
- [x] `scripts/verify-acceptance.ts` — inspected; runtime verification not performed
- [x] `tsconfig.base.json` — inspected; runtime verification not performed
- [x] `tunnel/config.yml.example` — inspected; runtime verification not performed

### Client (161)
- [ ] `client/.env.example`
- [x] `client/Dockerfile` — inspected; runtime verification not performed
- [ ] `client/index.html`
- [ ] `client/package.json`
- [ ] `client/public/hoho_logo.svg`
- [ ] `client/public/hoho_og_banner.svg`
- [ ] `client/public/robots.txt`
- [ ] `client/public/sitemap.xml`
- [x] `client/src/App.tsx` — inspected; runtime verification not performed
- [ ] `client/src/__tests__/m4_challenger2_layout_stress.test.ts`
- [ ] `client/src/api/__tests__/design.test.ts`
- [x] `client/src/api/client.ts` — inspected; runtime verification not performed
- [x] `client/src/api/design.ts` — inspected; runtime verification not performed
- [x] `client/src/api/discord.ts` — inspected; runtime verification not performed
- [ ] `client/src/components/actions/FlowBuilder.tsx`
- [ ] `client/src/components/actions/StepList.tsx`
- [x] `client/src/components/design/PublishAppLayoutControl.tsx` — inspected; runtime verification not performed
- [ ] `client/src/components/design/__tests__/PublishAppLayoutControl.test.tsx`
- [ ] `client/src/components/editor/AllowedMentionsModal.tsx`
- [ ] `client/src/components/editor/ComponentForms.tsx`
- [ ] `client/src/components/editor/DiscohookComponentsEditor.tsx`
- [ ] `client/src/components/editor/DiscordMentionInput.tsx`
- [ ] `client/src/components/editor/EmbedEditor.tsx`
- [ ] `client/src/components/editor/FileAttachmentsSection.tsx`
- [ ] `client/src/components/editor/FlagsModal.tsx`
- [ ] `client/src/components/editor/JsonModal.tsx`
- [ ] `client/src/components/editor/LayersPanel.tsx`
- [ ] `client/src/components/editor/MentionInput/AutocompletePopover.tsx`
- [ ] `client/src/components/editor/MentionInput/MarkdownToolbar.tsx`
- [ ] `client/src/components/editor/MentionInput/index.tsx`
- [ ] `client/src/components/editor/MessageEditor.tsx`
- [ ] `client/src/components/editor/MessageEditor/ComponentsTab.tsx`
- [ ] `client/src/components/editor/MessageEditor/ContentTab.tsx`
- [ ] `client/src/components/editor/MessageEditor/EmbedsTab.tsx`
- [ ] `client/src/components/editor/MessageEditor/MessageLinkModal.tsx`
- [ ] `client/src/components/editor/MessageEditor/index.tsx`
- [x] `client/src/components/editor/PropertyPanel.tsx` — inspected; runtime verification not performed
- [ ] `client/src/components/editor/RichPicker.tsx`
- [ ] `client/src/components/editor/__tests__/DiscordMentionInput.test.tsx`
- [ ] `client/src/components/editor/__tests__/MessageEditor.test.tsx`
- [ ] `client/src/components/layout/AccessPanel.tsx`
- [ ] `client/src/components/layout/AuditLogsModal.tsx`
- [ ] `client/src/components/layout/BackupsModal.tsx`
- [ ] `client/src/components/layout/ErrorBoundary.tsx`
- [ ] `client/src/components/layout/Header.tsx`
- [ ] `client/src/components/layout/HoHoLogoMark.tsx`
- [ ] `client/src/components/layout/LoginScreen.tsx`
- [ ] `client/src/components/layout/PublicPageHeader.tsx`
- [x] `client/src/components/layout/ServerBotAccessModal.tsx` — inspected; runtime verification not performed
- [ ] `client/src/components/layout/SessionsModal.tsx`
- [ ] `client/src/components/layout/SettingsModal.tsx`
- [ ] `client/src/components/layout/Sidebar.tsx`
- [x] `client/src/components/layout/SplitPane.tsx` — inspected; runtime verification not performed
- [x] `client/src/components/layout/StudioLayout.tsx` — inspected; runtime verification not performed
- [x] `client/src/components/layout/StudioModals.tsx` — inspected; runtime verification not performed
- [ ] `client/src/components/layout/StudioRouter.tsx`
- [ ] `client/src/components/layout/ThemeSettingsModal.tsx`
- [ ] `client/src/components/layout/__tests__/LoginScreen.test.tsx`
- [ ] `client/src/components/preview/ActionRowPreview.tsx`
- [ ] `client/src/components/preview/ComponentPreview.tsx`
- [x] `client/src/components/preview/ContainerPreview.tsx` — inspected; runtime verification not performed
- [ ] `client/src/components/preview/EmbedPreview.tsx`
- [ ] `client/src/components/preview/Markdown.tsx`
- [x] `client/src/components/preview/MessagePreview.tsx` — inspected; runtime verification not performed
- [ ] `client/src/components/preview/UserPlaceholderPreviewContent.tsx`
- [ ] `client/src/components/preview/__tests__/ActionRowPreview.test.tsx`
- [ ] `client/src/components/preview/__tests__/EmbedPreview.test.tsx`
- [ ] `client/src/components/preview/__tests__/Markdown.test.tsx`
- [ ] `client/src/components/preview/__tests__/MessagePreview.test.tsx`
- [ ] `client/src/components/preview/__tests__/UserPlaceholderPreviewContext.test.tsx`
- [ ] `client/src/components/reactbits/ReactBitsPrimitives.tsx`
- [ ] `client/src/components/reactbits/ThreeHeroCanvas.tsx`
- [ ] `client/src/components/reactbits/__tests__/ThreeHeroCanvas.test.tsx`
- [x] `client/src/components/send/BotDispatchModal.tsx` — inspected; runtime verification not performed
- [ ] `client/src/components/ui/Button.tsx`
- [ ] `client/src/components/ui/ColorPicker.tsx`
- [ ] `client/src/components/ui/CultSkiperPrimitives.tsx`
- [ ] `client/src/components/ui/DateTimePickerPopover.tsx`
- [ ] `client/src/components/ui/EmojiPickerField.tsx`
- [ ] `client/src/components/ui/ErrorBoundary.tsx`
- [ ] `client/src/components/ui/Field.tsx`
- [ ] `client/src/components/ui/Modal.tsx`
- [ ] `client/src/components/ui/SearchableDiscordSelect.tsx`
- [ ] `client/src/components/ui/Tabs.tsx`
- [ ] `client/src/components/ui/__tests__/ColorPicker.test.tsx`
- [ ] `client/src/components/ui/__tests__/FieldAutocomplete.test.tsx`
- [ ] `client/src/components/ui/__tests__/Modal.test.tsx`
- [ ] `client/src/components/ui/__tests__/SearchableDiscordSelect.test.tsx`
- [ ] `client/src/components/ui/icon.ts`
- [ ] `client/src/config/puck/appLayoutConfig.tsx`
- [ ] `client/src/config/puck/defaultAppLayouts.ts`
- [ ] `client/src/config/puck/designConfig.tsx`
- [ ] `client/src/config/puck/publishedDesign.ts`
- [ ] `client/src/config/puck/publishedTheme.css`
- [ ] `client/src/config/puck/publishedTheme.ts`
- [ ] `client/src/config/uiThemeConfig.ts`
- [ ] `client/src/hooks/__tests__/usePublishedAppLayout.test.tsx`
- [ ] `client/src/hooks/useAutocompleteMenu.ts`
- [ ] `client/src/hooks/useMessage.ts`
- [x] `client/src/hooks/usePublishedAppLayout.ts` — inspected; runtime verification not performed
- [ ] `client/src/hooks/useSend.ts`
- [ ] `client/src/hooks/useStaffAccess.ts`
- [ ] `client/src/hooks/useTemplates.ts`
- [x] `client/src/main.tsx` — inspected; runtime verification not performed
- [ ] `client/src/pages/DesignLabPage.tsx`
- [ ] `client/src/pages/DocsPage.tsx`
- [ ] `client/src/pages/NotFoundPage.tsx`
- [ ] `client/src/pages/PrivacyPage.tsx`
- [ ] `client/src/pages/app-layout-preview.css`
- [ ] `client/src/pages/design-lab.css`
- [ ] `client/src/pages/docs-page.css`
- [ ] `client/src/pages/layout-lab.css`
- [ ] `client/src/store/__tests__/exportImport.test.ts`
- [x] `client/src/store/actionStore.ts` — inspected; runtime verification not performed
- [x] `client/src/store/discordCacheStore.ts` — inspected; runtime verification not performed
- [x] `client/src/store/globalStore.ts` — inspected; runtime verification not performed
- [x] `client/src/store/messageStore.ts` — inspected; runtime verification not performed
- [x] `client/src/store/settingsStore.ts` — inspected; runtime verification not performed
- [x] `client/src/store/templateStore.ts` — inspected; runtime verification not performed
- [ ] `client/src/styles/appLayoutRuntime.css`
- [ ] `client/src/styles/globals.css`
- [ ] `client/src/test/setup.ts`
- [ ] `client/src/utils/__tests__/appLayoutApi.test.ts`
- [ ] `client/src/utils/__tests__/discord.test.ts`
- [ ] `client/src/utils/__tests__/editorSmoothScroll.test.ts`
- [ ] `client/src/utils/__tests__/floatingPosition.test.ts`
- [ ] `client/src/utils/__tests__/m4_challenger_adversarial.test.ts`
- [ ] `client/src/utils/__tests__/mentionParser.test.ts`
- [ ] `client/src/utils/__tests__/mentionParserAutocomplete.test.ts`
- [ ] `client/src/utils/__tests__/previewSelection.test.ts`
- [ ] `client/src/utils/__tests__/puckAppLayout.test.ts`
- [ ] `client/src/utils/__tests__/puckTheme.test.ts`
- [ ] `client/src/utils/__tests__/stress_m2.test.ts`
- [ ] `client/src/utils/__tests__/tree.test.ts`
- [ ] `client/src/utils/__tests__/userPlaceholderAutocomplete.test.ts`
- [ ] `client/src/utils/appLayoutApi.ts`
- [ ] `client/src/utils/clipboard.ts`
- [ ] `client/src/utils/cn.ts`
- [x] `client/src/utils/componentsV2.ts` — inspected; runtime verification not performed
- [ ] `client/src/utils/constants.ts`
- [ ] `client/src/utils/discord.ts`
- [ ] `client/src/utils/editorSmoothScroll.ts`
- [ ] `client/src/utils/exportImport.ts`
- [ ] `client/src/utils/floatingPosition.ts`
- [ ] `client/src/utils/mentionParser.ts`
- [x] `client/src/utils/mentionValidation.ts` — inspected; runtime verification not performed
- [x] `client/src/utils/previewSelection.ts` — inspected; runtime verification not performed
- [ ] `client/src/utils/puckAppLayout.ts`
- [ ] `client/src/utils/puckDesignStorage.ts`
- [ ] `client/src/utils/puckSourceExport.ts`
- [ ] `client/src/utils/puckTheme.ts`
- [ ] `client/src/utils/seo.ts`
- [ ] `client/src/utils/tree.ts`
- [ ] `client/src/utils/unicodeEmojis.ts`
- [ ] `client/src/utils/userPlaceholderAutocomplete.ts`
- [ ] `client/src/vite-env.d.ts`
- [ ] `client/tsconfig.json`
- [ ] `client/vite.config.ts`
- [ ] `client/vitest.config.ts`

- [x] `client/src/utils/dispatchValidation.ts` — inspected; runtime verification not performed
- [x] `client/src/utils/__tests__/dispatchValidation.test.ts` — inspected; runtime verification not performed

### Server (139)
- [x] `server/src/utils/customExecutorAccess.ts` — inspected; runtime verification not performed
- [x] `server/tests/customExecutorAccess.test.ts` — inspected; runtime verification not performed
- [x] `server/src/utils/templateAccess.ts` — inspected; runtime verification not performed
- [x] `server/tests/templateAccess.test.ts` — inspected; runtime verification not performed
- [x] `server/src/utils/actorIdentity.ts` — inspected; runtime verification not performed
- [x] `server/tests/actorIdentity.test.ts` — inspected; runtime verification not performed
- [x] `server/.env.example` — inspected; runtime verification not performed
- [x] `server/Dockerfile` — inspected; runtime verification not performed
- [ ] `server/benchmarks/runner.ts`
- [ ] `server/benchmarks/suites/suite1_flow_latency.ts`
- [ ] `server/benchmarks/suites/suite2_mention_scrubber.ts`
- [ ] `server/benchmarks/suites/suite3_interpolation.ts`
- [ ] `server/benchmarks/suites/suite4_memory_retention.ts`
- [ ] `server/benchmarks/types.ts`
- [ ] `server/benchmarks/utils/reporter.ts`
- [ ] `server/benchmarks/utils/stats.ts`
- [x] `server/package.json` — inspected; runtime verification not performed
- [ ] `server/src/actions/addRole.ts`
- [ ] `server/src/actions/check.ts`
- [ ] `server/src/actions/createThread.ts`
- [ ] `server/src/actions/deleteMessage.ts`
- [ ] `server/src/actions/dud.ts`
- [x] `server/src/actions/index.ts` — inspected; runtime verification not performed
- [ ] `server/src/actions/modalSubmit.ts`
- [ ] `server/src/actions/openModal.ts`
- [ ] `server/src/actions/removeRole.ts`
- [x] `server/src/actions/responses.ts` — inspected; runtime verification not performed
- [ ] `server/src/actions/roleSafety.ts`
- [ ] `server/src/actions/sendDm.ts`
- [ ] `server/src/actions/sendEphemeralReply.ts`
- [ ] `server/src/actions/sendMessage.ts`
- [ ] `server/src/actions/sendWebhookMessage.ts`
- [ ] `server/src/actions/setVariable.ts`
- [ ] `server/src/actions/stop.ts`
- [ ] `server/src/actions/toggleRole.ts`
- [x] `server/src/actions/types.ts` — inspected; runtime verification not performed
- [ ] `server/src/actions/wait.ts`
- [x] `server/src/app.ts` — inspected; runtime verification not performed
- [x] `server/src/config/database.ts` — inspected; runtime verification not performed
- [x] `server/src/config/env.ts` — inspected; runtime verification not performed
- [x] `server/src/config/migrate.ts` — inspected; runtime verification not performed
- [x] `server/src/config/migrations.ts` — inspected; runtime verification not performed
- [x] `server/src/config/tursoPipeline.ts` — inspected; runtime verification not performed
- [x] `server/src/index.ts` — inspected; runtime verification not performed
- [x] `server/src/middleware/auth.ts` — inspected; runtime verification not performed
- [x] `server/src/middleware/errorHandler.ts` — inspected; runtime verification not performed
- [x] `server/src/middleware/multipart.ts` — inspected; runtime verification not performed
- [x] `server/src/middleware/rateLimit.ts` — inspected; runtime verification not performed
- [x] `server/src/middleware/staffPermissions.ts` — inspected; runtime verification not performed
- [x] `server/src/middleware/verifyDiscordSignature.ts` — inspected; runtime verification not performed
- [x] `server/src/repositories/actionRepository.ts` — inspected; runtime verification not performed
- [ ] `server/src/repositories/appLayoutRepository.ts`
- [ ] `server/src/repositories/auditLogRepository.ts`
- [ ] `server/src/repositories/baseRepository.ts`
- [ ] `server/src/repositories/customExecutorRepository.ts`
- [ ] `server/src/repositories/flowRepository.ts`
- [ ] `server/src/repositories/index.ts`
- [ ] `server/src/repositories/interactionReceiptRepository.ts`
- [ ] `server/src/repositories/profileRepository.ts`
- [x] `server/src/repositories/sessionRepository.ts` — inspected; runtime verification not performed
- [x] `server/src/repositories/sessionRevocationRepository.ts` — inspected; runtime verification not performed
- [ ] `server/src/repositories/settingsRepository.ts`
- [ ] `server/src/repositories/staffRepository.ts`
- [x] `server/src/repositories/templateRepository.ts` — inspected; runtime verification not performed
- [x] `server/src/repositories/trackedMessageRepository.ts` — inspected; runtime verification not performed
- [ ] `server/src/repositories/userRepository.ts`
- [x] `server/src/routes/access.ts` — inspected; runtime verification not performed
- [x] `server/src/routes/auth.ts` — inspected; runtime verification not performed
- [x] `server/src/routes/config.ts` — inspected; runtime verification not performed
- [x] `server/src/routes/design.ts` — inspected; runtime verification not performed
- [x] `server/src/routes/discord.ts` — inspected; runtime verification not performed
- [x] `server/src/routes/executors.ts` — inspected; runtime verification not performed
- [ ] `server/src/routes/health.ts`
- [x] `server/src/routes/interactions.ts` — inspected; runtime verification not performed
- [x] `server/src/routes/send.ts` — inspected; runtime verification not performed
- [x] `server/src/routes/settings.ts` — inspected; runtime verification not performed
- [x] `server/src/routes/templates.ts` — inspected; runtime verification not performed
- [x] `server/src/routes/tracking.ts` — inspected; runtime verification not performed
- [x] `server/src/routes/weao.ts` — inspected; runtime verification not performed
- [x] `server/src/services/actionExecutor.ts` — inspected; runtime verification not performed
- [ ] `server/src/services/auditLog.ts`
- [x] `server/src/services/authorService.ts` — inspected; runtime verification not performed
- [x] `server/src/services/branches.ts` — inspected; runtime verification not performed
- [x] `server/src/services/discordService.ts` — inspected; runtime verification not performed
- [ ] `server/src/services/guildVariables.ts`
- [x] `server/src/services/interactionHandler.ts` — inspected; runtime verification not performed
- [ ] `server/src/services/maintenanceService.ts`
- [x] `server/src/services/messageTrackerService.ts` — inspected; runtime verification not performed
- [ ] `server/src/services/settingsService.ts`
- [x] `server/src/services/templateService.ts` — inspected; runtime verification not performed
- [x] `server/src/services/variableInterpolation.ts` — inspected; runtime verification not performed
- [x] `server/src/services/weaoService.ts` — inspected and fixed; runtime verification not performed
- [ ] `server/src/types/express.d.ts`
- [ ] `server/src/utils/appLayoutValidation.ts`
- [x] `server/src/utils/crypto.ts` — inspected; runtime verification not performed
- [x] `server/src/utils/errors.ts` — inspected; runtime verification not performed
- [x] `server/src/utils/logger.ts` — inspected; runtime verification not performed
- [x] `server/src/utils/mentionScrubber.ts` — inspected; runtime verification not performed
- [x] `server/src/utils/requestParsing.ts` — inspected; runtime verification not performed
- [x] `server/src/utils/session.ts` — inspected; runtime verification not performed
- [x] `server/src/utils/urlAttachments.ts` — inspected; runtime verification not performed
- [x] `server/src/utils/validation.ts` — inspected and fixed; runtime verification not performed
- [x] `server/tests/accessSecurity.test.ts` — inspected; runtime verification not performed
- [x] `server/tests/actions.test.ts` — inspected; runtime verification not performed
- [ ] `server/tests/adversarial_streaming_memory.test.ts`
- [ ] `server/tests/appLayoutPublishing.test.ts`
- [ ] `server/tests/authorService.test.ts`
- [ ] `server/tests/challenger_bot_relay.test.ts`
- [ ] `server/tests/challenger_flowRepository.test.ts`
- [ ] `server/tests/challenger_member_cache.test.ts`
- [ ] `server/tests/challenger_multipart.test.ts`
- [ ] `server/tests/challenger_perf_indexes.test.ts`
- [x] `server/tests/challenger_retention_maintenance.test.ts` — inspected; runtime verification not performed
- [ ] `server/tests/challenger_staffRepository.test.ts`
- [ ] `server/tests/crypto.test.ts`
- [x] `server/tests/discordService.timeout.test.ts` — inspected; test not executed
- [x] `server/tests/environmentMode.test.ts` — inspected; runtime verification not performed
- [ ] `server/tests/errorHandler.security.test.ts`
- [ ] `server/tests/flowRepository.test.ts`
- [ ] `server/tests/guildVariables.test.ts`
- [ ] `server/tests/interactionMemory.test.ts`
- [ ] `server/tests/m3_challenger2_retention_cache.test.ts`
- [ ] `server/tests/middleware.test.ts`
- [ ] `server/tests/repositories.test.ts`
- [ ] `server/tests/requestParsing.test.ts`
- [ ] `server/tests/routes.test.ts`
- [ ] `server/tests/serverThemePublishing.test.ts`
- [x] `server/tests/session.test.ts` — inspected; runtime verification not performed
- [x] `server/tests/sqlSplitter.stress.test.ts` — inspected; runtime verification not performed
- [ ] `server/tests/staff_logging_enhancements.test.ts`
- [ ] `server/tests/staff_security_regression.test.ts`
- [x] `server/tests/tursoPipeline.test.ts` — inspected; runtime verification not performed
- [ ] `server/tests/urlAttachments.security.test.ts`
- [x] `server/tests/validation.test.ts` — inspected; runtime verification not performed
- [ ] `server/tests/variableInterpolation.test.ts`
- [x] `server/tests/weaoService.test.ts` — inspected and regression coverage added; test not executed
- [ ] `server/tsconfig.build.json`
- [ ] `server/tsconfig.json`
- [ ] `server/vitest.config.ts`

### Bot (24)
- [x] `bot/src/lib/commandPermissions.ts` — inspected; runtime verification not performed
- [x] `bot/.env.example` — inspected; runtime verification not performed
- [x] `bot/README.md` — inspected; runtime verification not performed
- [x] `bot/package.json` — inspected; runtime verification not performed
- [x] `bot/src/commands/exploit.ts` — inspected; runtime verification not performed
- [x] `bot/src/commands/ping.ts` — inspected; runtime verification not performed
- [x] `bot/src/commands/send.ts` — inspected; runtime verification not performed
- [x] `bot/src/commands/server.ts` — inspected; runtime verification not performed
- [x] `bot/src/commands/status.ts` — inspected; runtime verification not performed
- [x] `bot/src/commands/sync.ts` — inspected; runtime verification not performed
- [x] `bot/src/index.ts` — inspected; runtime verification not performed
- [x] `bot/src/lib/api.ts` — inspected; runtime verification not performed
- [x] `bot/src/lib/commandCooldown.ts` — inspected; runtime verification not performed
- [x] `bot/src/lib/env.ts` — inspected; runtime verification not performed
- [x] `bot/src/lib/registration.ts` — inspected; runtime verification not performed
- [x] `bot/src/listeners/interactionRelay.ts` — inspected; runtime verification not performed
- [x] `bot/src/listeners/ready.ts` — inspected; runtime verification not performed
- [x] `bot/tests/api.test.ts` — inspected; runtime verification not performed
- [x] `bot/tests/commands.test.ts` — inspected; runtime verification not performed
- [x] `bot/tests/env.test.ts` — inspected; runtime verification not performed
- [x] `bot/tests/relay.test.ts` — inspected; runtime verification not performed
- [x] `bot/tsconfig.build.json` — inspected; runtime verification not performed
- [x] `bot/tsconfig.json` — inspected; runtime verification not performed
- [x] `bot/vitest.config.ts` — inspected; runtime verification not performed

### Shared (10)
- [x] `shared/package.json` — inspected; runtime verification not performed
- [x] `shared/src/constants.ts` — inspected; runtime verification not performed
- [x] `shared/src/customId.ts` — inspected; runtime verification not performed
- [x] `shared/src/index.ts` — inspected; runtime verification not performed
- [x] `shared/src/types.ts` — inspected; runtime verification not performed
- [x] `shared/tests/constants.test.ts` — inspected; runtime verification not performed
- [x] `shared/tests/customId.test.ts` — inspected; runtime verification not performed
- [x] `shared/tsconfig.build.json` — inspected; runtime verification not performed
- [x] `shared/tsconfig.json` — inspected; runtime verification not performed
- [x] `shared/vitest.config.ts` — inspected; runtime verification not performed

### Documentation (8)
- [x] `docs/REPOSITORY_AUDIT_LEDGER.md` — maintained and reviewed
- [x] `docs/AGENTS.md` — maintained and reviewed
- [x] `docs/GEMINI_HANDOFF_CURRENT.md` — maintained and reviewed
- [ ] `docs/HOHO_MASTER_IMPLEMENTATION_PLAN.md`
- [ ] `docs/PREVIEW_EDITOR_NAVIGATION_REPAIR_PLAN.md`
- [ ] `docs/PUCK_DESIGN_LAB.md`
- [ ] `docs/REPOSITORY_AUDIT_EXECUTION_PLAN.md`
- [ ] `docs/hoho_v12_ultimate_ux_login_and_optimization_master_plan.md`

### Vendored security patch (10)
- [~] `vendor/picomatch/LICENSE` — upstream provenance/metadata checked; implementation not fully audited
- [~] `vendor/picomatch/README.md` — upstream provenance/metadata checked; implementation not fully audited
- [~] `vendor/picomatch/index.js` — upstream provenance/metadata checked; implementation not fully audited
- [~] `vendor/picomatch/lib/constants.js` — upstream provenance/metadata checked; implementation not fully audited
- [~] `vendor/picomatch/lib/parse.js` — upstream provenance/metadata checked; implementation not fully audited
- [~] `vendor/picomatch/lib/picomatch.js` — upstream provenance/metadata checked; implementation not fully audited
- [~] `vendor/picomatch/lib/scan.js` — upstream provenance/metadata checked; implementation not fully audited
- [~] `vendor/picomatch/lib/utils.js` — upstream provenance/metadata checked; implementation not fully audited
- [~] `vendor/picomatch/package.json` — upstream provenance/metadata checked; implementation not fully audited
- [~] `vendor/picomatch/posix.js` — upstream provenance/metadata checked; implementation not fully audited

## Verification record

- `npm audit`: not run in this audit session.
- `npm test`: not run in this audit session.
- `npm run typecheck`: not run in this audit session.
- `npm run build`: not run in this audit session.
- Browser QA / Lighthouse / deployment: not run.

## Next audit batches

1. Shared package: types, validators, schemas, constants, utilities and callers.
2. Server: entrypoint, middleware, auth/session, routes, services, repositories, database/migrations, Discord integration, logging and external requests.
3. Bot: startup, commands, events, interaction relay, API auth and error handling.
4. Client: entry/routing, auth, stores, API clients, editor, preview, inspector, Design Lab, themes, Docs, Settings, styles, responsive behavior and accessibility.
5. Tests/fixtures: map each test to the behavior and identify untested security boundaries.
6. Reconcile remaining plan/handoff claims against current source; update this ledger after each batch.
