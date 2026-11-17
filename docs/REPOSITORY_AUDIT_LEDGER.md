# HoHo Manager — Repository Audit Ledger

**Inventory snapshot:** `95c3de2468b67199f0174f709aeac7bf0b64d364`  
**Branch:** `feat/remove-legacy-dispatch-and-hardening`  
**Tracked files:** 355  
**Status:** Audit in progress; not complete.

## Status definitions

- `REVIEWED`: full file and relevant callers/dependencies inspected.
- `IN PROGRESS`: partial source review or call-site tracing has started; not accepted as complete.
- `PENDING`: not yet reviewed.
- `NOT APPLICABLE`: disposition recorded with a reason.

A search result, excerpt or successful source edit is not enough to mark a file reviewed. Refresh this inventory whenever the tracked tree changes.

## Audit findings

### Confirmed changes in the active branch

- Webhook URL delivery/inspection APIs, direct client sender, URL parser/regex, webhook profile repository wiring and shared profile record types have been removed. The deprecated `send_webhook_message` handler remains only to fail old saved flows. The send route rejects legacy `webhookUrl` input.
- Custom bot-profile selection was removed from client APIs, server routes/services, author enrichment and settings application code. The old profile tables are already dropped by migration 011. The nullable legacy settings column is no longer read or written by application code.
- Action failures now carry internal structured metadata from `actionFailed()`; the executor logs failure state from metadata and strips it before Discord callbacks.
- Puck preview-only `activeTab`, `showInspector` and `inspectorHeight` remain in the editor document but are excluded from the production resolved runtime model. Desktop `editorRatio` is passed directly to `SplitPane`.
- Interaction ACK budget, callback retry behavior, gateway relay timeout and in-process duplicate delivery coordination were updated. Tests were added but not executed.
- Bot slash commands `/send` and `/exploit` forward the invoking Discord actor and now pass through live staff permission checks. `/sync` is Discord-administrator-only. Bot startup fails closed on environment validation errors.

### Audit coverage

- All 23 files in `bot/` have been read, including commands, listeners, API client, environment, tests, package configuration and README.
- Core staff middleware and user/settings repository paths have been read.
- The Puck schema/runtime mapping, interaction handling and action failure paths have been partially inspected.
- Remaining client, server, shared, root/infrastructure, migrations, cross-package call sites and tests are not fully audited.

### Verification limits

- No npm typecheck, test suite or build was run.
- No browser QA, Lighthouse, live Discord callback, multi-instance interaction test, database migration execution or deployment verification was performed.
- GitHub Actions are intentionally disabled by the owner and are not an audit blocker.

## File inventory

### root

- [PENDING] `.dockerignore`
- [PENDING] `.gitignore`
- [PENDING] `.gitleaksignore`
- [PENDING] `.lighthouserc.desktop.json`
- [PENDING] `.lighthouserc.mobile.json`
- [PENDING] `.nvmrc`
- [PENDING] `DESIGN.md`
- [PENDING] `README.md`
- [PENDING] `SECURITY.md`
- [PENDING] `docker-compose.tunnel.yml`
- [PENDING] `docker-compose.yml`
- [PENDING] `ecosystem.config.cjs`
- [PENDING] `package-lock.json`
- [PENDING] `package.json`
- [PENDING] `tsconfig.base.json`

### .github

- [PENDING] `.github/WORKFLOWS.md`
- [PENDING] `.github/dependabot.yml`
- [PENDING] `.github/workflows/ci.yml`
- [PENDING] `.github/workflows/lighthouse.yml`
- [PENDING] `.github/workflows/release.yml`
- [PENDING] `.github/workflows/security.yml`
- [PENDING] `.github/workflows/workflow-validation.yml`

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

- [PENDING] `client/.env.example`
- [PENDING] `client/Dockerfile`
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
- [PENDING] `client/src/hooks/useStaffAccess.ts`
- [PENDING] `client/src/hooks/useTemplates.ts`
- [PENDING] `client/src/main.tsx`
- [PENDING] `client/src/pages/DesignLabPage.tsx`
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
- [PENDING] `client/src/store/globalStore.ts`
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
- [IN PROGRESS] `client/src/utils/mentionValidation.ts`
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

- [PENDING] `server/.env.example`
- [PENDING] `server/Dockerfile`
- [PENDING] `server/benchmarks/runner.ts`
- [PENDING] `server/benchmarks/suites/suite1_flow_latency.ts`
- [PENDING] `server/benchmarks/suites/suite2_mention_scrubber.ts`
- [PENDING] `server/benchmarks/suites/suite3_interpolation.ts`
- [PENDING] `server/benchmarks/suites/suite4_memory_retention.ts`
- [PENDING] `server/benchmarks/types.ts`
- [PENDING] `server/benchmarks/utils/reporter.ts`
- [PENDING] `server/benchmarks/utils/stats.ts`
- [PENDING] `server/package.json`
- [PENDING] `server/src/actions/addRole.ts`
- [PENDING] `server/src/actions/check.ts`
- [PENDING] `server/src/actions/createThread.ts`
- [PENDING] `server/src/actions/deleteMessage.ts`
- [PENDING] `server/src/actions/dud.ts`
- [PENDING] `server/src/actions/index.ts`
- [PENDING] `server/src/actions/modalSubmit.ts`
- [PENDING] `server/src/actions/openModal.ts`
- [PENDING] `server/src/actions/removeRole.ts`
- [IN PROGRESS] `server/src/actions/responses.ts`
- [PENDING] `server/src/actions/roleSafety.ts`
- [PENDING] `server/src/actions/sendDm.ts`
- [PENDING] `server/src/actions/sendEphemeralReply.ts`
- [REVIEWED] `server/src/actions/sendMessage.ts`
- [PENDING] `server/src/actions/sendWebhookMessage.ts`
- [PENDING] `server/src/actions/setVariable.ts`
- [PENDING] `server/src/actions/stop.ts`
- [PENDING] `server/src/actions/toggleRole.ts`
- [IN PROGRESS] `server/src/actions/types.ts`
- [PENDING] `server/src/actions/wait.ts`
- [PENDING] `server/src/app.ts`
- [IN PROGRESS] `server/src/config/database.ts`
- [PENDING] `server/src/config/env.ts`
- [PENDING] `server/src/config/migrate.ts`
- [IN PROGRESS] `server/src/config/migrations.ts`
- [PENDING] `server/src/config/tursoPipeline.ts`
- [PENDING] `server/src/index.ts`
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
- [PENDING] `server/src/repositories/staffRepository.ts`
- [PENDING] `server/src/repositories/templateRepository.ts`
- [PENDING] `server/src/repositories/trackedMessageRepository.ts`
- [REVIEWED] `server/src/repositories/userRepository.ts`
- [PENDING] `server/src/routes/access.ts`
- [PENDING] `server/src/routes/auth.ts`
- [PENDING] `server/src/routes/config.ts`
- [PENDING] `server/src/routes/design.ts`
- [IN PROGRESS] `server/src/routes/discord.ts`
- [PENDING] `server/src/routes/executors.ts`
- [PENDING] `server/src/routes/health.ts`
- [IN PROGRESS] `server/src/routes/interactions.ts`
- [IN PROGRESS] `server/src/routes/send.ts`
- [IN PROGRESS] `server/src/routes/settings.ts`
- [PENDING] `server/src/routes/templates.ts`
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

1. Finish all in-progress server route, middleware, service, repository and migration paths; trace every caller.
2. Audit every server action handler and its error/response semantics.
3. Complete the client Puck/runtime, stores, API, responsive CSS and interaction paths.
4. Audit all shared types and cross-package consumers.
5. Audit root/infrastructure/deployment configuration and security boundaries.
6. Review all tests/fixtures and update them for the removed feature contracts.
7. Rebuild the inventory at the final source commit and record the owner's local verification results separately.

**Overall audit remains incomplete until every tracked file has a final disposition and every confirmed finding is fixed or explicitly deferred.**
