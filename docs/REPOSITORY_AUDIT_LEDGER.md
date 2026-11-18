# Repository Audit Ledger

**Repository:** `no-peace/Hoho_manager`
**Audit baseline:** `99414d89dfef65b8bc4054771788150ac88f072d` (main, after temporary picomatch mitigation)
**Tree:** 367 tracked files across 66 directories
**Purpose:** Track source review by file. A checked file means inspected, not necessarily runtime-verified. Tests/build/browser checks are recorded separately.

## Status definitions

- `[ ]` Not reviewed.
- `[~]` Provenance/metadata checked; implementation not fully audited.
- `[x]` Source inspected in this audit batch; no runtime verification implied.

## Progress summary

| Area | Files | Status |
|---|---:|---|
| Root / infrastructure | 25 | Source review complete |
| Client | 159 | In progress (1/159) |
| Server | 133 | In progress (40/133) |
| Bot | 23 | Not started |
| Shared | 10 | Source review complete |
| Documentation | 7 | Not started |
| Vendored security patch | 10 | Provenance only |
| **Total** | **367** | **367 accounted for** |

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
5. **Open product gap:** `actionExecutor.ts` still classifies failed actions by checking whether response content starts with a warning emoji. Replace this with structured failure metadata; this remains a known planned item.
6. **Open compatibility question:** `actions/index.ts` still registers `send_webhook_message`, while the public action picker hides it and the send route rejects direct `webhookUrl` sending. Trace existing persisted flows and the current handler before removing or restoring anything.
7. **Open compatibility question:** Discord routes still parse and pass optional profile IDs. Confirm the current `resolveBotToken` behavior before declaring custom bot-profile dispatch disabled.
8. Template ownership checks remain in the service/repository path. Action lookups for template-backed messages are constrained by the tracked message's template ID.

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

### Client (159)
- [ ] `client/.env.example`
- [x] `client/Dockerfile` — inspected; runtime verification not performed
- [ ] `client/index.html`
- [ ] `client/package.json`
- [ ] `client/public/hoho_logo.svg`
- [ ] `client/public/hoho_og_banner.svg`
- [ ] `client/public/robots.txt`
- [ ] `client/public/sitemap.xml`
- [ ] `client/src/App.tsx`
- [ ] `client/src/__tests__/m4_challenger2_layout_stress.test.ts`
- [ ] `client/src/api/__tests__/design.test.ts`
- [ ] `client/src/api/client.ts`
- [ ] `client/src/api/design.ts`
- [ ] `client/src/api/discord.ts`
- [ ] `client/src/components/actions/FlowBuilder.tsx`
- [ ] `client/src/components/actions/StepList.tsx`
- [ ] `client/src/components/design/PublishAppLayoutControl.tsx`
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
- [ ] `client/src/components/editor/PropertyPanel.tsx`
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
- [ ] `client/src/components/layout/ServerBotAccessModal.tsx`
- [ ] `client/src/components/layout/SessionsModal.tsx`
- [ ] `client/src/components/layout/SettingsModal.tsx`
- [ ] `client/src/components/layout/Sidebar.tsx`
- [ ] `client/src/components/layout/SplitPane.tsx`
- [ ] `client/src/components/layout/StudioLayout.tsx`
- [ ] `client/src/components/layout/StudioModals.tsx`
- [ ] `client/src/components/layout/StudioRouter.tsx`
- [ ] `client/src/components/layout/ThemeSettingsModal.tsx`
- [ ] `client/src/components/layout/__tests__/LoginScreen.test.tsx`
- [ ] `client/src/components/preview/ActionRowPreview.tsx`
- [ ] `client/src/components/preview/ComponentPreview.tsx`
- [ ] `client/src/components/preview/ContainerPreview.tsx`
- [ ] `client/src/components/preview/EmbedPreview.tsx`
- [ ] `client/src/components/preview/Markdown.tsx`
- [ ] `client/src/components/preview/MessagePreview.tsx`
- [ ] `client/src/components/preview/UserPlaceholderPreviewContent.tsx`
- [ ] `client/src/components/preview/__tests__/ActionRowPreview.test.tsx`
- [ ] `client/src/components/preview/__tests__/EmbedPreview.test.tsx`
- [ ] `client/src/components/preview/__tests__/Markdown.test.tsx`
- [ ] `client/src/components/preview/__tests__/MessagePreview.test.tsx`
- [ ] `client/src/components/preview/__tests__/UserPlaceholderPreviewContext.test.tsx`
- [ ] `client/src/components/reactbits/ReactBitsPrimitives.tsx`
- [ ] `client/src/components/reactbits/ThreeHeroCanvas.tsx`
- [ ] `client/src/components/reactbits/__tests__/ThreeHeroCanvas.test.tsx`
- [ ] `client/src/components/send/BotDispatchModal.tsx`
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
- [ ] `client/src/hooks/usePublishedAppLayout.ts`
- [ ] `client/src/hooks/useSend.ts`
- [ ] `client/src/hooks/useStaffAccess.ts`
- [ ] `client/src/hooks/useTemplates.ts`
- [ ] `client/src/main.tsx`
- [ ] `client/src/pages/DesignLabPage.tsx`
- [ ] `client/src/pages/DocsPage.tsx`
- [ ] `client/src/pages/NotFoundPage.tsx`
- [ ] `client/src/pages/PrivacyPage.tsx`
- [ ] `client/src/pages/app-layout-preview.css`
- [ ] `client/src/pages/design-lab.css`
- [ ] `client/src/pages/docs-page.css`
- [ ] `client/src/pages/layout-lab.css`
- [ ] `client/src/store/__tests__/exportImport.test.ts`
- [ ] `client/src/store/actionStore.ts`
- [ ] `client/src/store/discordCacheStore.ts`
- [ ] `client/src/store/globalStore.ts`
- [ ] `client/src/store/messageStore.ts`
- [ ] `client/src/store/settingsStore.ts`
- [ ] `client/src/store/templateStore.ts`
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
- [ ] `client/src/utils/componentsV2.ts`
- [ ] `client/src/utils/constants.ts`
- [ ] `client/src/utils/discord.ts`
- [ ] `client/src/utils/editorSmoothScroll.ts`
- [ ] `client/src/utils/exportImport.ts`
- [ ] `client/src/utils/floatingPosition.ts`
- [ ] `client/src/utils/mentionParser.ts`
- [ ] `client/src/utils/mentionValidation.ts`
- [ ] `client/src/utils/previewSelection.ts`
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

### Server (133)
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
- [ ] `server/src/actions/responses.ts`
- [ ] `server/src/actions/roleSafety.ts`
- [ ] `server/src/actions/sendDm.ts`
- [ ] `server/src/actions/sendEphemeralReply.ts`
- [ ] `server/src/actions/sendMessage.ts`
- [ ] `server/src/actions/sendWebhookMessage.ts`
- [ ] `server/src/actions/setVariable.ts`
- [ ] `server/src/actions/stop.ts`
- [ ] `server/src/actions/toggleRole.ts`
- [ ] `server/src/actions/types.ts`
- [ ] `server/src/actions/wait.ts`
- [x] `server/src/app.ts` — inspected; runtime verification not performed
- [x] `server/src/config/database.ts` — inspected; runtime verification not performed
- [x] `server/src/config/env.ts` — inspected; runtime verification not performed
- [x] `server/src/config/migrate.ts` — inspected; runtime verification not performed
- [ ] `server/src/config/migrations.ts`
- [x] `server/src/config/tursoPipeline.ts` — inspected; runtime verification not performed
- [x] `server/src/index.ts` — inspected; runtime verification not performed
- [x] `server/src/middleware/auth.ts` — inspected; runtime verification not performed
- [ ] `server/src/middleware/errorHandler.ts`
- [ ] `server/src/middleware/multipart.ts`
- [x] `server/src/middleware/rateLimit.ts` — inspected; runtime verification not performed
- [ ] `server/src/middleware/staffPermissions.ts`
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
- [ ] `server/src/repositories/sessionRepository.ts`
- [ ] `server/src/repositories/sessionRevocationRepository.ts`
- [ ] `server/src/repositories/settingsRepository.ts`
- [ ] `server/src/repositories/staffRepository.ts`
- [x] `server/src/repositories/templateRepository.ts` — inspected; runtime verification not performed
- [ ] `server/src/repositories/trackedMessageRepository.ts`
- [ ] `server/src/repositories/userRepository.ts`
- [x] `server/src/routes/access.ts` — inspected; runtime verification not performed
- [x] `server/src/routes/auth.ts` — inspected; runtime verification not performed
- [x] `server/src/routes/config.ts` — inspected; runtime verification not performed
- [x] `server/src/routes/design.ts` — inspected; runtime verification not performed
- [x] `server/src/routes/discord.ts` — inspected; runtime verification not performed
- [x] `server/src/routes/executors.ts` — inspected; runtime verification not performed
- [ ] `server/src/routes/health.ts`
- [x] `server/src/routes/interactions.ts` — inspected; runtime verification not performed
- [ ] `server/src/routes/send.ts`
- [x] `server/src/routes/settings.ts` — inspected; runtime verification not performed
- [x] `server/src/routes/templates.ts` — inspected; runtime verification not performed
- [ ] `server/src/routes/tracking.ts`
- [x] `server/src/routes/weao.ts` — inspected; runtime verification not performed
- [ ] `server/src/services/actionExecutor.ts`
- [ ] `server/src/services/auditLog.ts`
- [x] `server/src/services/authorService.ts` — inspected; runtime verification not performed
- [x] `server/src/services/branches.ts` — inspected; runtime verification not performed
- [ ] `server/src/services/discordService.ts`
- [ ] `server/src/services/guildVariables.ts`
- [x] `server/src/services/interactionHandler.ts` — inspected; runtime verification not performed
- [ ] `server/src/services/maintenanceService.ts`
- [ ] `server/src/services/messageTrackerService.ts`
- [ ] `server/src/services/settingsService.ts`
- [x] `server/src/services/templateService.ts` — inspected; runtime verification not performed
- [x] `server/src/services/variableInterpolation.ts` — inspected; runtime verification not performed
- [ ] `server/src/services/weaoService.ts`
- [ ] `server/src/types/express.d.ts`
- [ ] `server/src/utils/appLayoutValidation.ts`
- [x] `server/src/utils/crypto.ts` — inspected; runtime verification not performed
- [ ] `server/src/utils/errors.ts`
- [ ] `server/src/utils/logger.ts`
- [ ] `server/src/utils/mentionScrubber.ts`
- [ ] `server/src/utils/requestParsing.ts`
- [x] `server/src/utils/session.ts` — inspected; runtime verification not performed
- [x] `server/src/utils/urlAttachments.ts` — inspected; runtime verification not performed
- [ ] `server/src/utils/validation.ts`
- [x] `server/tests/accessSecurity.test.ts` — inspected; runtime verification not performed
- [ ] `server/tests/actions.test.ts`
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
- [ ] `server/tests/discordService.timeout.test.ts`
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
- [ ] `server/tests/weaoService.test.ts`
- [ ] `server/tsconfig.build.json`
- [ ] `server/tsconfig.json`
- [ ] `server/vitest.config.ts`

### Bot (23)
- [ ] `bot/.env.example`
- [ ] `bot/README.md`
- [ ] `bot/package.json`
- [ ] `bot/src/commands/exploit.ts`
- [ ] `bot/src/commands/ping.ts`
- [ ] `bot/src/commands/send.ts`
- [ ] `bot/src/commands/server.ts`
- [ ] `bot/src/commands/status.ts`
- [ ] `bot/src/commands/sync.ts`
- [ ] `bot/src/index.ts`
- [ ] `bot/src/lib/api.ts`
- [ ] `bot/src/lib/commandCooldown.ts`
- [ ] `bot/src/lib/env.ts`
- [ ] `bot/src/lib/registration.ts`
- [ ] `bot/src/listeners/interactionRelay.ts`
- [ ] `bot/src/listeners/ready.ts`
- [ ] `bot/tests/api.test.ts`
- [ ] `bot/tests/commands.test.ts`
- [ ] `bot/tests/env.test.ts`
- [ ] `bot/tests/relay.test.ts`
- [ ] `bot/tsconfig.build.json`
- [ ] `bot/tsconfig.json`
- [ ] `bot/vitest.config.ts`

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

### Documentation (7)
- [ ] `docs/AGENTS.md`
- [ ] `docs/GEMINI_HANDOFF_CURRENT.md`
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
