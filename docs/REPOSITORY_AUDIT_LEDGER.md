# HoHo Manager — Repository Audit Ledger

**Code/inventory snapshot:** `326988a865ac12cfca75820822c08c9acff4da34`  
**Branch:** `feat/remove-legacy-dispatch-and-hardening`  
**Tracked files:** 354  
**Status:** Audit in progress; not complete.

## Status definitions

- `REVIEWED`: full file and relevant callers/dependencies inspected.
- `IN PROGRESS`: partial source review or call-site tracing has started; not accepted as complete.
- `PENDING`: not yet reviewed.
- `NOT APPLICABLE`: disposition recorded with a reason.

A search result, excerpt or successful source edit is not enough to mark a file reviewed. Refresh this inventory whenever the tracked tree changes.

## Confirmed findings and fixes in this branch

1. **Webhook URL sender removal:** Removed server webhook URL delivery/inspection APIs, direct client sender, parser/regex (including the final orphaned shared matcher), Action Builder configuration and webhook profile API/repository wiring. The `send_webhook_message` handler and source file are deleted; its identifier remains only in the persisted-flow type so old records can be represented. The executor fails old steps safely, the editor tells users to replace them, and the send route rejects legacy `webhookUrl` input. Discord interaction follow-ups still use Discord's interaction-token endpoints; those are not arbitrary webhook URL dispatch.
2. **Custom bot-profile removal:** Removed `profileId` selection from client/server Discord APIs, routes, services and author enrichment; removed bot profile settings/API/types. Migration 011 drops profile tables; migration 018 drops `settings.bot_profile_id` and retired staff permission columns. Client profile CRUD APIs are removed.
3. **Staff permissions:** Removed `can_use_webhooks` and `can_override_profile` from access responses, repository types and client/shared types. Bot `/send` and `/exploit` now forward the invoking Discord actor and require live staff permission checks; `/sync` is Discord-administrator-only.
4. **Structured action failures:** Failure state is internal `ActionResponse.outcome` metadata from `actionFailed()`; the executor logs the metadata and strips it before Discord delivery. The 19 current action modules received an initial failure-path pass. Additional fail-closed cases cover unavailable saved actions, null Discord message/DM/thread results, empty modal definitions and variable steps missing a target name. Full dependency/caller review remains open.
5. **Puck contract:** Preview-only Mobile `activeTab`, `showInspector` and `inspectorHeight` remain in Puck data but are excluded from the production resolved runtime model. Desktop `editorRatio` is passed directly to `SplitPane`. Every emitted CSS variable was compared against the live runtime stylesheet and is consumed.
6. **Discord interaction reliability:** ACK budget is 900 ms, initial callback is one bounded 1,500 ms attempt with no retry, and gateway relay fallback is 2,700 ms. Migration 019 adds database-backed duplicate delivery state; the original worker atomically switches to deferred ACK and sends the late result as a follow-up. Gateway relay attempts late-result delivery even if the initial callback reports a duplicate ACK.
7. **Startup and infrastructure hardening:** Bot startup fails closed on any environment validation error. Server production startup requires a dedicated 32+ character `SESSION_SECRET` distinct from `ADMIN_API_KEY`. Public health no longer exposes user count. Docker builds use lockfile-exact workspace installs and copy all workspace manifests. CI tests use synthetic Discord credentials, not repository secrets. Mobile Lighthouse threshold now warns below 0.97.
8. **Repository hygiene:** `.gitignore` ignores all local `.env.*` variants, Lighthouse output, and generated security/benchmark reports.

## Audit coverage

- All 23 files in `bot/` have been read, including commands, listeners, API client, environment, tests, package configuration and README.
- Root project configuration, Dockerfiles, environment examples, workflow source and core documentation have been reviewed. Docker builds and workflows were not run. The full lockfile and deployment dashboard configuration remain pending.
- Server access/config/executor/health/template routes and core staff middleware/repositories have been reviewed.
- The 19 current server action modules received an initial failure-path pass.
- Puck schema/runtime mapping, interaction receipt state, send/Discord routes and selected tests have been partially reviewed.
- Remaining client, server, shared, migrations, cross-package callers and test coverage still need systematic review.

## Verification limits

- No npm typecheck, test suite or build was run. The owner intends to run these locally after implementation is ready.
- No browser QA, Lighthouse run, Docker build, live Discord callback test, multi-instance deployment test, database migration execution or deployment verification was performed.
- GitHub Actions are intentionally disabled by the owner and are not an audit blocker.

## File inventory

### root

- [REVIEWED] `.dockerignore`
- [REVIEWED] `.gitignore`
- [REVIEWED] `.gitleaksignore`
- [REVIEWED] `.lighthouserc.desktop.json`
- [REVIEWED] `.lighthouserc.mobile.json`
- [REVIEWED] `.nvmrc`
- [REVIEWED] `DESIGN.md`
- [REVIEWED] `README.md`
- [REVIEWED] `SECURITY.md`
- [REVIEWED] `docker-compose.tunnel.yml`
- [REVIEWED] `docker-compose.yml`
- [REVIEWED] `ecosystem.config.cjs`
- [PENDING] `package-lock.json`
- [REVIEWED] `package.json`
- [REVIEWED] `tsconfig.base.json`

### .github

- [PENDING] `.github/WORKFLOWS.md`
- [REVIEWED] `.github/dependabot.yml`
- [REVIEWED] `.github/workflows/ci.yml`
- [REVIEWED] `.github/workflows/lighthouse.yml`
- [REVIEWED] `.github/workflows/release.yml`
- [REVIEWED] `.github/workflows/security.yml`
- [REVIEWED] `.github/workflows/workflow-validation.yml`

### bot

- [REVIEWED] `bot/.env.example`
- [REVIEWED] `bot/README.md`
- [REVIEWED] `bot/package.json`
- [REVIEWED] `bot/src/commands/exploit.ts`
- [REVIEWED] `bot/src/commands/ping.ts`
- [REVIEWED] `bot/src/commands/send.ts`
- [REVIEWED] `bot/src/commands/server.ts`
- [REVIEWED] `bot/src/commands/status.ts`
- [REVIEWED] `bot/src/commands/sync.ts`
- [REVIEWED] `bot/src/index.ts`
- [REVIEWED] `bot/src/lib/api.ts`
- [REVIEWED] `bot/src/lib/commandCooldown.ts`
- [REVIEWED] `bot/src/lib/env.ts`
- [REVIEWED] `bot/src/lib/registration.ts`
- [REVIEWED] `bot/src/listeners/interactionRelay.ts`
- [REVIEWED] `bot/src/listeners/ready.ts`
- [REVIEWED] `bot/tests/api.test.ts`
- [REVIEWED] `bot/tests/commands.test.ts`
- [REVIEWED] `bot/tests/env.test.ts`
- [REVIEWED] `bot/tests/relay.test.ts`
- [REVIEWED] `bot/tsconfig.build.json`
- [REVIEWED] `bot/tsconfig.json`
- [REVIEWED] `bot/vitest.config.ts`

### client

- [REVIEWED] `client/.env.example`
- [REVIEWED] `client/Dockerfile`
- [PENDING] `client/index.html`
- [PENDING] `client/package.json`
- [PENDING] `client/public/hoho_logo.svg`
- [PENDING] `client/public/hoho_og_banner.svg`
- [PENDING] `client/public/robots.txt`
- [PENDING] `client/public/sitemap.xml`
- [PENDING] `client/src/App.tsx`
- [PENDING] `client/src/__tests__/m4_challenger2_layout_stress.test.ts`
- [PENDING] `client/src/api/__tests__/design.test.ts`
- [IN PROGRESS] `client/src/api/client.ts`
- [PENDING] `client/src/api/design.ts`
- [PENDING] `client/src/components/actions/FlowBuilder.tsx`
- [IN PROGRESS] `client/src/components/actions/StepList.tsx`
- [PENDING] `client/src/components/design/PublishAppLayoutControl.tsx`
- [PENDING] `client/src/components/design/__tests__/PublishAppLayoutControl.test.tsx`
- [PENDING] `client/src/components/editor/AllowedMentionsModal.tsx`
- [PENDING] `client/src/components/editor/ComponentForms.tsx`
- [PENDING] `client/src/components/editor/DiscohookComponentsEditor.tsx`
- [PENDING] `client/src/components/editor/DiscordMentionInput.tsx`
- [PENDING] `client/src/components/editor/EmbedEditor.tsx`
- [PENDING] `client/src/components/editor/FileAttachmentsSection.tsx`
- [PENDING] `client/src/components/editor/FlagsModal.tsx`
- [PENDING] `client/src/components/editor/JsonModal.tsx`
- [PENDING] `client/src/components/editor/LayersPanel.tsx`
- [PENDING] `client/src/components/editor/MentionInput/AutocompletePopover.tsx`
- [PENDING] `client/src/components/editor/MentionInput/MarkdownToolbar.tsx`
- [PENDING] `client/src/components/editor/MentionInput/index.tsx`
- [PENDING] `client/src/components/editor/MessageEditor.tsx`
- [PENDING] `client/src/components/editor/MessageEditor/ComponentsTab.tsx`
- [PENDING] `client/src/components/editor/MessageEditor/ContentTab.tsx`
- [PENDING] `client/src/components/editor/MessageEditor/EmbedsTab.tsx`
- [PENDING] `client/src/components/editor/MessageEditor/MessageLinkModal.tsx`
- [PENDING] `client/src/components/editor/MessageEditor/index.tsx`
- [PENDING] `client/src/components/editor/PropertyPanel.tsx`
- [PENDING] `client/src/components/editor/RichPicker.tsx`
- [PENDING] `client/src/components/editor/__tests__/DiscordMentionInput.test.tsx`
- [PENDING] `client/src/components/editor/__tests__/MessageEditor.test.tsx`
- [PENDING] `client/src/components/layout/AccessPanel.tsx`
- [PENDING] `client/src/components/layout/AuditLogsModal.tsx`
- [PENDING] `client/src/components/layout/BackupsModal.tsx`
- [PENDING] `client/src/components/layout/ErrorBoundary.tsx`
- [PENDING] `client/src/components/layout/Header.tsx`
- [PENDING] `client/src/components/layout/HoHoLogoMark.tsx`
- [PENDING] `client/src/components/layout/LoginScreen.tsx`
- [PENDING] `client/src/components/layout/PublicPageHeader.tsx`
- [PENDING] `client/src/components/layout/ServerBotAccessModal.tsx`
- [PENDING] `client/src/components/layout/SessionsModal.tsx`
- [PENDING] `client/src/components/layout/SettingsModal.tsx`
- [PENDING] `client/src/components/layout/Sidebar.tsx`
- [PENDING] `client/src/components/layout/SplitPane.tsx`
- [IN PROGRESS] `client/src/components/layout/StudioLayout.tsx`
- [PENDING] `client/src/components/layout/StudioModals.tsx`
- [PENDING] `client/src/components/layout/StudioRouter.tsx`
- [PENDING] `client/src/components/layout/ThemeSettingsModal.tsx`
- [PENDING] `client/src/components/layout/__tests__/LoginScreen.test.tsx`
- [PENDING] `client/src/components/preview/ActionRowPreview.tsx`
- [PENDING] `client/src/components/preview/ComponentPreview.tsx`
- [PENDING] `client/src/components/preview/ContainerPreview.tsx`
- [PENDING] `client/src/components/preview/EmbedPreview.tsx`
- [PENDING] `client/src/components/preview/Markdown.tsx`
- [PENDING] `client/src/components/preview/MessagePreview.tsx`
- [PENDING] `client/src/components/preview/UserPlaceholderPreviewContent.tsx`
- [PENDING] `client/src/components/preview/__tests__/ActionRowPreview.test.tsx`
- [PENDING] `client/src/components/preview/__tests__/EmbedPreview.test.tsx`
- [PENDING] `client/src/components/preview/__tests__/Markdown.test.tsx`
- [PENDING] `client/src/components/preview/__tests__/MessagePreview.test.tsx`
- [PENDING] `client/src/components/preview/__tests__/UserPlaceholderPreviewContext.test.tsx`
- [PENDING] `client/src/components/reactbits/ReactBitsPrimitives.tsx`
- [PENDING] `client/src/components/reactbits/ThreeHeroCanvas.tsx`
- [PENDING] `client/src/components/reactbits/__tests__/ThreeHeroCanvas.test.tsx`
- [PENDING] `client/src/components/send/BotDispatchModal.tsx`
- [PENDING] `client/src/components/ui/Button.tsx`
- [PENDING] `client/src/components/ui/ColorPicker.tsx`
- [PENDING] `client/src/components/ui/CultSkiperPrimitives.tsx`
- [PENDING] `client/src/components/ui/DateTimePickerPopover.tsx`
- [PENDING] `client/src/components/ui/EmojiPickerField.tsx`
- [PENDING] `client/src/components/ui/ErrorBoundary.tsx`
- [PENDING] `client/src/components/ui/Field.tsx`
- [PENDING] `client/src/components/ui/Modal.tsx`
- [PENDING] `client/src/components/ui/SearchableDiscordSelect.tsx`
- [PENDING] `client/src/components/ui/Tabs.tsx`
- [PENDING] `client/src/components/ui/__tests__/ColorPicker.test.tsx`
- [PENDING] `client/src/components/ui/__tests__/FieldAutocomplete.test.tsx`
- [PENDING] `client/src/components/ui/__tests__/Modal.test.tsx`
- [PENDING] `client/src/components/ui/__tests__/SearchableDiscordSelect.test.tsx`
- [PENDING] `client/src/components/ui/icon.ts`
- [IN PROGRESS] `client/src/config/puck/appLayoutConfig.tsx`
- [IN PROGRESS] `client/src/config/puck/defaultAppLayouts.ts`
- [PENDING] `client/src/config/puck/designConfig.tsx`
- [PENDING] `client/src/config/puck/publishedDesign.ts`
- [PENDING] `client/src/config/puck/publishedTheme.css`
- [PENDING] `client/src/config/puck/publishedTheme.ts`
- [PENDING] `client/src/config/uiThemeConfig.ts`
- [PENDING] `client/src/hooks/__tests__/usePublishedAppLayout.test.tsx`
- [PENDING] `client/src/hooks/useAutocompleteMenu.ts`
- [PENDING] `client/src/hooks/useMessage.ts`
- [PENDING] `client/src/hooks/usePublishedAppLayout.ts`
- [PENDING] `client/src/hooks/useSend.ts`
- [IN PROGRESS] `client/src/hooks/useStaffAccess.ts`
- [PENDING] `client/src/hooks/useTemplates.ts`
- [PENDING] `client/src/main.tsx`
- [REVIEWED] `client/src/pages/DesignLabPage.tsx`
- [PENDING] `client/src/pages/DocsPage.tsx`
- [PENDING] `client/src/pages/NotFoundPage.tsx`
- [PENDING] `client/src/pages/PrivacyPage.tsx`
- [IN PROGRESS] `client/src/pages/app-layout-preview.css`
- [PENDING] `client/src/pages/design-lab.css`
- [PENDING] `client/src/pages/docs-page.css`
- [PENDING] `client/src/pages/layout-lab.css`
- [PENDING] `client/src/store/__tests__/exportImport.test.ts`
- [IN PROGRESS] `client/src/store/actionStore.ts`
- [PENDING] `client/src/store/discordCacheStore.ts`
- [IN PROGRESS] `client/src/store/globalStore.ts`
- [PENDING] `client/src/store/messageStore.ts`
- [PENDING] `client/src/store/settingsStore.ts`
- [PENDING] `client/src/store/templateStore.ts`
- [IN PROGRESS] `client/src/styles/appLayoutRuntime.css`
- [PENDING] `client/src/styles/globals.css`
- [PENDING] `client/src/test/setup.ts`
- [PENDING] `client/src/utils/__tests__/appLayoutApi.test.ts`
- [PENDING] `client/src/utils/__tests__/discord.test.ts`
- [PENDING] `client/src/utils/__tests__/editorSmoothScroll.test.ts`
- [PENDING] `client/src/utils/__tests__/floatingPosition.test.ts`
- [PENDING] `client/src/utils/__tests__/m4_challenger_adversarial.test.ts`
- [PENDING] `client/src/utils/__tests__/mentionParser.test.ts`
- [PENDING] `client/src/utils/__tests__/mentionParserAutocomplete.test.ts`
- [PENDING] `client/src/utils/__tests__/previewSelection.test.ts`
- [IN PROGRESS] `client/src/utils/__tests__/puckAppLayout.test.ts`
- [PENDING] `client/src/utils/__tests__/puckTheme.test.ts`
- [PENDING] `client/src/utils/__tests__/stress_m2.test.ts`
- [PENDING] `client/src/utils/__tests__/tree.test.ts`
- [PENDING] `client/src/utils/__tests__/userPlaceholderAutocomplete.test.ts`
- [PENDING] `client/src/utils/appLayoutApi.ts`
- [PENDING] `client/src/utils/clipboard.ts`
- [PENDING] `client/src/utils/cn.ts`
- [PENDING] `client/src/utils/componentsV2.ts`
- [PENDING] `client/src/utils/constants.ts`
- [PENDING] `client/src/utils/discord.ts`
- [PENDING] `client/src/utils/editorSmoothScroll.ts`
- [PENDING] `client/src/utils/exportImport.ts`
- [PENDING] `client/src/utils/floatingPosition.ts`
- [PENDING] `client/src/utils/mentionParser.ts`
- [PENDING] `client/src/utils/mentionValidation.ts`
- [PENDING] `client/src/utils/previewSelection.ts`
- [IN PROGRESS] `client/src/utils/puckAppLayout.ts`
- [PENDING] `client/src/utils/puckDesignStorage.ts`
- [PENDING] `client/src/utils/puckSourceExport.ts`
- [PENDING] `client/src/utils/puckTheme.ts`
- [PENDING] `client/src/utils/seo.ts`
- [PENDING] `client/src/utils/tree.ts`
- [PENDING] `client/src/utils/unicodeEmojis.ts`
- [PENDING] `client/src/utils/userPlaceholderAutocomplete.ts`
- [PENDING] `client/src/vite-env.d.ts`
- [PENDING] `client/tsconfig.json`
- [PENDING] `client/vite.config.ts`
- [PENDING] `client/vitest.config.ts`

### docs

- [IN PROGRESS] `docs/AGENTS.md`
- [IN PROGRESS] `docs/GEMINI_HANDOFF_CURRENT.md`
- [IN PROGRESS] `docs/HOHO_MASTER_IMPLEMENTATION_PLAN.md`
- [PENDING] `docs/PREVIEW_EDITOR_NAVIGATION_REPAIR_PLAN.md`
- [REVIEWED] `docs/PUCK_DESIGN_LAB.md`
- [PENDING] `docs/REPOSITORY_AUDIT_EXECUTION_PLAN.md`
- [IN PROGRESS] `docs/REPOSITORY_AUDIT_LEDGER.md`
- [PENDING] `docs/hoho_v12_ultimate_ux_login_and_optimization_master_plan.md`

### scripts

- [PENDING] `scripts/verify-acceptance.ts`

### server

- [REVIEWED] `server/.env.example`
- [REVIEWED] `server/Dockerfile`
- [PENDING] `server/benchmarks/runner.ts`
- [PENDING] `server/benchmarks/suites/suite1_flow_latency.ts`
- [PENDING] `server/benchmarks/suites/suite2_mention_scrubber.ts`
- [PENDING] `server/benchmarks/suites/suite3_interpolation.ts`
- [PENDING] `server/benchmarks/suites/suite4_memory_retention.ts`
- [PENDING] `server/benchmarks/types.ts`
- [PENDING] `server/benchmarks/utils/reporter.ts`
- [PENDING] `server/benchmarks/utils/stats.ts`
- [PENDING] `server/package.json`
- [IN PROGRESS] `server/src/actions/addRole.ts`
- [IN PROGRESS] `server/src/actions/check.ts`
- [IN PROGRESS] `server/src/actions/createThread.ts`
- [IN PROGRESS] `server/src/actions/deleteMessage.ts`
- [IN PROGRESS] `server/src/actions/dud.ts`
- [IN PROGRESS] `server/src/actions/index.ts`
- [IN PROGRESS] `server/src/actions/modalSubmit.ts`
- [IN PROGRESS] `server/src/actions/openModal.ts`
- [IN PROGRESS] `server/src/actions/removeRole.ts`
- [IN PROGRESS] `server/src/actions/responses.ts`
- [IN PROGRESS] `server/src/actions/roleSafety.ts`
- [IN PROGRESS] `server/src/actions/sendDm.ts`
- [IN PROGRESS] `server/src/actions/sendEphemeralReply.ts`
- [REVIEWED] `server/src/actions/sendMessage.ts`
- [IN PROGRESS] `server/src/actions/setVariable.ts`
- [IN PROGRESS] `server/src/actions/stop.ts`
- [IN PROGRESS] `server/src/actions/toggleRole.ts`
- [IN PROGRESS] `server/src/actions/types.ts`
- [IN PROGRESS] `server/src/actions/wait.ts`
- [PENDING] `server/src/app.ts`
- [IN PROGRESS] `server/src/config/database.ts`
- [IN PROGRESS] `server/src/config/env.ts`
- [PENDING] `server/src/config/migrate.ts`
- [IN PROGRESS] `server/src/config/migrations.ts`
- [PENDING] `server/src/config/tursoPipeline.ts`
- [IN PROGRESS] `server/src/index.ts`
- [REVIEWED] `server/src/middleware/auth.ts`
- [PENDING] `server/src/middleware/errorHandler.ts`
- [PENDING] `server/src/middleware/multipart.ts`
- [PENDING] `server/src/middleware/rateLimit.ts`
- [REVIEWED] `server/src/middleware/staffPermissions.ts`
- [PENDING] `server/src/middleware/verifyDiscordSignature.ts`
- [PENDING] `server/src/repositories/actionRepository.ts`
- [PENDING] `server/src/repositories/appLayoutRepository.ts`
- [PENDING] `server/src/repositories/auditLogRepository.ts`
- [PENDING] `server/src/repositories/baseRepository.ts`
- [PENDING] `server/src/repositories/customExecutorRepository.ts`
- [PENDING] `server/src/repositories/flowRepository.ts`
- [REVIEWED] `server/src/repositories/index.ts`
- [IN PROGRESS] `server/src/repositories/interactionReceiptRepository.ts`
- [PENDING] `server/src/repositories/sessionRepository.ts`
- [PENDING] `server/src/repositories/sessionRevocationRepository.ts`
- [REVIEWED] `server/src/repositories/settingsRepository.ts`
- [IN PROGRESS] `server/src/repositories/staffRepository.ts`
- [PENDING] `server/src/repositories/templateRepository.ts`
- [PENDING] `server/src/repositories/trackedMessageRepository.ts`
- [REVIEWED] `server/src/repositories/userRepository.ts`
- [REVIEWED] `server/src/routes/access.ts`
- [IN PROGRESS] `server/src/routes/auth.ts`
- [REVIEWED] `server/src/routes/config.ts`
- [IN PROGRESS] `server/src/routes/design.ts`
- [IN PROGRESS] `server/src/routes/discord.ts`
- [REVIEWED] `server/src/routes/executors.ts`
- [REVIEWED] `server/src/routes/health.ts`
- [IN PROGRESS] `server/src/routes/interactions.ts`
- [IN PROGRESS] `server/src/routes/send.ts`
- [IN PROGRESS] `server/src/routes/settings.ts`
- [REVIEWED] `server/src/routes/templates.ts`
- [IN PROGRESS] `server/src/routes/tracking.ts`
- [IN PROGRESS] `server/src/routes/weao.ts`
- [IN PROGRESS] `server/src/services/actionExecutor.ts`
- [PENDING] `server/src/services/auditLog.ts`
- [IN PROGRESS] `server/src/services/authorService.ts`
- [PENDING] `server/src/services/branches.ts`
- [IN PROGRESS] `server/src/services/discordService.ts`
- [PENDING] `server/src/services/guildVariables.ts`
- [IN PROGRESS] `server/src/services/interactionHandler.ts`
- [PENDING] `server/src/services/maintenanceService.ts`
- [PENDING] `server/src/services/messageTrackerService.ts`
- [IN PROGRESS] `server/src/services/settingsService.ts`
- [PENDING] `server/src/services/templateService.ts`
- [PENDING] `server/src/services/variableInterpolation.ts`
- [PENDING] `server/src/services/weaoService.ts`
- [PENDING] `server/src/types/express.d.ts`
- [PENDING] `server/src/utils/appLayoutValidation.ts`
- [PENDING] `server/src/utils/crypto.ts`
- [PENDING] `server/src/utils/errors.ts`
- [PENDING] `server/src/utils/logger.ts`
- [PENDING] `server/src/utils/mentionScrubber.ts`
- [IN PROGRESS] `server/src/utils/requestParsing.ts`
- [PENDING] `server/src/utils/session.ts`
- [PENDING] `server/src/utils/urlAttachments.ts`
- [IN PROGRESS] `server/src/utils/validation.ts`
- [PENDING] `server/tests/accessSecurity.test.ts`
- [IN PROGRESS] `server/tests/actions.test.ts`
- [IN PROGRESS] `server/tests/adversarial_streaming_memory.test.ts`
- [PENDING] `server/tests/appLayoutPublishing.test.ts`
- [PENDING] `server/tests/authorService.test.ts`
- [PENDING] `server/tests/challenger_bot_relay.test.ts`
- [PENDING] `server/tests/challenger_flowRepository.test.ts`
- [PENDING] `server/tests/challenger_member_cache.test.ts`
- [PENDING] `server/tests/challenger_multipart.test.ts`
- [PENDING] `server/tests/challenger_perf_indexes.test.ts`
- [PENDING] `server/tests/challenger_retention_maintenance.test.ts`
- [PENDING] `server/tests/challenger_staffRepository.test.ts`
- [PENDING] `server/tests/crypto.test.ts`
- [IN PROGRESS] `server/tests/discordService.timeout.test.ts`
- [PENDING] `server/tests/environmentMode.test.ts`
- [PENDING] `server/tests/errorHandler.security.test.ts`
- [PENDING] `server/tests/flowRepository.test.ts`
- [PENDING] `server/tests/guildVariables.test.ts`
- [IN PROGRESS] `server/tests/interactionMemory.test.ts`
- [PENDING] `server/tests/m3_challenger2_retention_cache.test.ts`
- [PENDING] `server/tests/middleware.test.ts`
- [PENDING] `server/tests/repositories.test.ts`
- [IN PROGRESS] `server/tests/requestParsing.test.ts`
- [IN PROGRESS] `server/tests/routes.test.ts`
- [PENDING] `server/tests/serverThemePublishing.test.ts`
- [PENDING] `server/tests/session.test.ts`
- [PENDING] `server/tests/sqlSplitter.stress.test.ts`
- [PENDING] `server/tests/staff_logging_enhancements.test.ts`
- [REVIEWED] `server/tests/staff_security_regression.test.ts`
- [PENDING] `server/tests/tursoPipeline.test.ts`
- [PENDING] `server/tests/urlAttachments.security.test.ts`
- [PENDING] `server/tests/validation.test.ts`
- [PENDING] `server/tests/variableInterpolation.test.ts`
- [PENDING] `server/tests/weaoService.test.ts`
- [PENDING] `server/tsconfig.build.json`
- [PENDING] `server/tsconfig.json`
- [PENDING] `server/vitest.config.ts`

### shared

- [PENDING] `shared/package.json`
- [IN PROGRESS] `shared/src/constants.ts`
- [PENDING] `shared/src/customId.ts`
- [PENDING] `shared/src/index.ts`
- [IN PROGRESS] `shared/src/types.ts`
- [IN PROGRESS] `shared/tests/constants.test.ts`
- [PENDING] `shared/tests/customId.test.ts`
- [PENDING] `shared/tsconfig.build.json`
- [PENDING] `shared/tsconfig.json`
- [PENDING] `shared/vitest.config.ts`

### tunnel

- [PENDING] `tunnel/config.yml.example`

## Next audit sequence

1. Complete remaining server route/service/repository/migration review and trace every caller.
2. Finish action executor and every action handler dependency/permission/data-flow review.
3. Complete client Puck/runtime, stores, API, editor, preview and responsive CSS review.
4. Audit shared types and all cross-package consumers.
5. Finish root/infrastructure review, including the full lockfile and actual deployment configuration.
6. Review every test/fixture for changed contracts and add missing regression coverage.
7. Rebuild the inventory at the final source commit and record owner-run verification separately.

**Overall audit remains incomplete until every tracked file has a final disposition and every confirmed finding is fixed or explicitly deferred.**
