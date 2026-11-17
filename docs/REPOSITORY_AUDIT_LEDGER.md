# HoHo Manager — Repository Audit Ledger

**Branch:** `feat/remove-legacy-dispatch-and-hardening`  
**Inventory commit:** `45a44a94c1d6e610606d316ff532061583ed67d2`  
**Tracked files:** 356  
**Status:** Audit started; not complete.  

## Rules

- Every tracked file must be marked `REVIEWED`, `IN PROGRESS`, `NOT APPLICABLE`, or `PENDING`.
- `REVIEWED` means the full file and its relevant callers/dependencies were inspected; a search excerpt is not enough.
- Record defects and fixes in the findings section below. Do not infer runtime correctness from source presence.
- Rebuild this inventory when the tracked tree changes and record the new commit SHA.
- No npm/typecheck/build/browser/Lighthouse verification is claimed here; the owner will run local npm checks.

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

- [PENDING] `bot/.env.example`
- [PENDING] `bot/README.md`
- [PENDING] `bot/package.json`
- [PENDING] `bot/src/commands/exploit.ts`
- [PENDING] `bot/src/commands/ping.ts`
- [PENDING] `bot/src/commands/send.ts`
- [PENDING] `bot/src/commands/server.ts`
- [PENDING] `bot/src/commands/status.ts`
- [PENDING] `bot/src/commands/sync.ts`
- [PENDING] `bot/src/index.ts`
- [PENDING] `bot/src/lib/api.ts`
- [PENDING] `bot/src/lib/commandCooldown.ts`
- [PENDING] `bot/src/lib/env.ts`
- [PENDING] `bot/src/lib/registration.ts`
- [PENDING] `bot/src/listeners/interactionRelay.ts`
- [PENDING] `bot/src/listeners/ready.ts`
- [PENDING] `bot/tests/api.test.ts`
- [PENDING] `bot/tests/commands.test.ts`
- [PENDING] `bot/tests/env.test.ts`
- [PENDING] `bot/tests/relay.test.ts`
- [PENDING] `bot/tsconfig.build.json`
- [PENDING] `bot/tsconfig.json`
- [PENDING] `bot/vitest.config.ts`

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
- [PENDING] `client/src/api/client.ts`
- [PENDING] `client/src/api/design.ts`
- [PENDING] `client/src/api/discord.ts`
- [PENDING] `client/src/components/actions/FlowBuilder.tsx`
- [PENDING] `client/src/components/actions/StepList.tsx`
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
- [REVIEWED] `client/src/components/layout/StudioLayout.tsx`
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
- [PENDING] `client/src/config/puck/appLayoutConfig.tsx`
- [PENDING] `client/src/config/puck/defaultAppLayouts.ts`
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
- [PENDING] `client/src/pages/app-layout-preview.css`
- [PENDING] `client/src/pages/design-lab.css`
- [PENDING] `client/src/pages/docs-page.css`
- [PENDING] `client/src/pages/layout-lab.css`
- [PENDING] `client/src/store/__tests__/exportImport.test.ts`
- [PENDING] `client/src/store/actionStore.ts`
- [PENDING] `client/src/store/discordCacheStore.ts`
- [PENDING] `client/src/store/globalStore.ts`
- [PENDING] `client/src/store/messageStore.ts`
- [PENDING] `client/src/store/settingsStore.ts`
- [PENDING] `client/src/store/templateStore.ts`
- [PENDING] `client/src/styles/appLayoutRuntime.css`
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
- [PENDING] `client/src/utils/__tests__/puckAppLayout.test.ts`
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
- [REVIEWED] `client/src/utils/mentionValidation.ts`
- [PENDING] `client/src/utils/previewSelection.ts`
- [PENDING] `client/src/utils/puckAppLayout.ts`
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

- [PENDING] `docs/AGENTS.md`
- [PENDING] `docs/GEMINI_HANDOFF_CURRENT.md`
- [PENDING] `docs/HOHO_MASTER_IMPLEMENTATION_PLAN.md`
- [PENDING] `docs/PREVIEW_EDITOR_NAVIGATION_REPAIR_PLAN.md`
- [PENDING] `docs/PUCK_DESIGN_LAB.md`
- [PENDING] `docs/REPOSITORY_AUDIT_EXECUTION_PLAN.md`
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
- [REVIEWED] `server/src/actions/responses.ts`
- [PENDING] `server/src/actions/roleSafety.ts`
- [PENDING] `server/src/actions/sendDm.ts`
- [PENDING] `server/src/actions/sendEphemeralReply.ts`
- [PENDING] `server/src/actions/sendMessage.ts`
- [PENDING] `server/src/actions/sendWebhookMessage.ts`
- [PENDING] `server/src/actions/setVariable.ts`
- [PENDING] `server/src/actions/stop.ts`
- [PENDING] `server/src/actions/toggleRole.ts`
- [REVIEWED] `server/src/actions/types.ts`
- [PENDING] `server/src/actions/wait.ts`
- [PENDING] `server/src/app.ts`
- [PENDING] `server/src/config/database.ts`
- [PENDING] `server/src/config/env.ts`
- [PENDING] `server/src/config/migrate.ts`
- [PENDING] `server/src/config/migrations.ts`
- [PENDING] `server/src/config/tursoPipeline.ts`
- [PENDING] `server/src/index.ts`
- [PENDING] `server/src/middleware/auth.ts`
- [PENDING] `server/src/middleware/errorHandler.ts`
- [PENDING] `server/src/middleware/multipart.ts`
- [PENDING] `server/src/middleware/rateLimit.ts`
- [PENDING] `server/src/middleware/staffPermissions.ts`
- [PENDING] `server/src/middleware/verifyDiscordSignature.ts`
- [PENDING] `server/src/repositories/actionRepository.ts`
- [PENDING] `server/src/repositories/appLayoutRepository.ts`
- [PENDING] `server/src/repositories/auditLogRepository.ts`
- [PENDING] `server/src/repositories/baseRepository.ts`
- [PENDING] `server/src/repositories/customExecutorRepository.ts`
- [PENDING] `server/src/repositories/flowRepository.ts`
- [PENDING] `server/src/repositories/index.ts`
- [REVIEWED] `server/src/repositories/interactionReceiptRepository.ts`
- [PENDING] `server/src/repositories/profileRepository.ts`
- [PENDING] `server/src/repositories/sessionRepository.ts`
- [PENDING] `server/src/repositories/sessionRevocationRepository.ts`
- [PENDING] `server/src/repositories/settingsRepository.ts`
- [PENDING] `server/src/repositories/staffRepository.ts`
- [PENDING] `server/src/repositories/templateRepository.ts`
- [PENDING] `server/src/repositories/trackedMessageRepository.ts`
- [PENDING] `server/src/repositories/userRepository.ts`
- [PENDING] `server/src/routes/access.ts`
- [PENDING] `server/src/routes/auth.ts`
- [PENDING] `server/src/routes/config.ts`
- [PENDING] `server/src/routes/design.ts`
- [PENDING] `server/src/routes/discord.ts`
- [PENDING] `server/src/routes/executors.ts`
- [PENDING] `server/src/routes/health.ts`
- [REVIEWED] `server/src/routes/interactions.ts`
- [IN PROGRESS] `server/src/routes/send.ts`
- [PENDING] `server/src/routes/settings.ts`
- [PENDING] `server/src/routes/templates.ts`
- [PENDING] `server/src/routes/tracking.ts`
- [PENDING] `server/src/routes/weao.ts`
- [REVIEWED] `server/src/services/actionExecutor.ts`
- [PENDING] `server/src/services/auditLog.ts`
- [PENDING] `server/src/services/authorService.ts`
- [PENDING] `server/src/services/branches.ts`
- [IN PROGRESS] `server/src/services/discordService.ts`
- [PENDING] `server/src/services/guildVariables.ts`
- [REVIEWED] `server/src/services/interactionHandler.ts`
- [PENDING] `server/src/services/maintenanceService.ts`
- [PENDING] `server/src/services/messageTrackerService.ts`
- [PENDING] `server/src/services/settingsService.ts`
- [PENDING] `server/src/services/templateService.ts`
- [PENDING] `server/src/services/variableInterpolation.ts`
- [PENDING] `server/src/services/weaoService.ts`
- [PENDING] `server/src/types/express.d.ts`
- [PENDING] `server/src/utils/appLayoutValidation.ts`
- [PENDING] `server/src/utils/crypto.ts`
- [PENDING] `server/src/utils/errors.ts`
- [PENDING] `server/src/utils/logger.ts`
- [PENDING] `server/src/utils/mentionScrubber.ts`
- [PENDING] `server/src/utils/requestParsing.ts`
- [PENDING] `server/src/utils/session.ts`
- [PENDING] `server/src/utils/urlAttachments.ts`
- [PENDING] `server/src/utils/validation.ts`
- [PENDING] `server/tests/accessSecurity.test.ts`
- [PENDING] `server/tests/actions.test.ts`
- [PENDING] `server/tests/adversarial_streaming_memory.test.ts`
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
- [PENDING] `server/tests/discordService.timeout.test.ts`
- [PENDING] `server/tests/environmentMode.test.ts`
- [PENDING] `server/tests/errorHandler.security.test.ts`
- [PENDING] `server/tests/flowRepository.test.ts`
- [PENDING] `server/tests/guildVariables.test.ts`
- [PENDING] `server/tests/interactionMemory.test.ts`
- [PENDING] `server/tests/m3_challenger2_retention_cache.test.ts`
- [PENDING] `server/tests/middleware.test.ts`
- [PENDING] `server/tests/repositories.test.ts`
- [PENDING] `server/tests/requestParsing.test.ts`
- [PENDING] `server/tests/routes.test.ts`
- [PENDING] `server/tests/serverThemePublishing.test.ts`
- [PENDING] `server/tests/session.test.ts`
- [PENDING] `server/tests/sqlSplitter.stress.test.ts`
- [PENDING] `server/tests/staff_logging_enhancements.test.ts`
- [PENDING] `server/tests/staff_security_regression.test.ts`
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
- [PENDING] `shared/src/constants.ts`
- [PENDING] `shared/src/customId.ts`
- [PENDING] `shared/src/index.ts`
- [PENDING] `shared/src/types.ts`
- [PENDING] `shared/tests/constants.test.ts`
- [PENDING] `shared/tests/customId.test.ts`
- [PENDING] `shared/tsconfig.build.json`
- [PENDING] `shared/tsconfig.json`
- [PENDING] `shared/vitest.config.ts`

### tunnel

- [PENDING] `tunnel/config.yml.example`

## Findings and decisions

### Confirmed in this audit batch

- `server/src/services/actionExecutor.ts`: action failure classification previously depended on the user-facing warning prefix. Replaced with internal `ActionResponse.outcome = "failure"`; executor strips this metadata before returning a Discord callback body.
- `server/src/actions/responses.ts`: `actionFailed()` now marks failure structurally.
- `server/src/services/interactionHandler.ts`, `server/src/routes/interactions.ts`, and `server/src/repositories/interactionReceiptRepository.ts`: reviewed as the core ACK/defer/deduplication path; race and duplicate-delivery behavior still requires targeted test expansion and runtime verification.
- `client/src/components/layout/StudioLayout.tsx`: removed the stale banner claiming users can dispatch through their own custom bot profile.
- `client/src/utils/mentionValidation.ts`: removed the stale comment implying a custom bot profile bypasses mention permissions.
- `server/src/actions/types.ts`: removed webhook-send API and webhook-profile repository dependencies from action contexts.

### In progress

- Full removal of webhook URL sending and custom bot-profile dispatch, including obsolete parsing, service methods, client controls, legacy types, settings fields, and tests.
- Puck runtime contract audit: verify every exposed setting has an intentional runtime or preview-only consumer.
- Discord interaction ACK/defer/duplicate/timeout tests.
- Remaining file-by-file audit across root, client, server, bot, shared, tests and docs.

### Not verified

- No local npm commands, integration tests, live Discord calls, browser QA, Lighthouse, migration execution, or deployment checks were run by this audit batch.
