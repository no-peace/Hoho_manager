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
| Client | 159 | Not started |
| Server | 133 | Not started |
| Bot | 23 | Not started |
| Shared | 10 | Not started |
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
- [ ] `client/Dockerfile`
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
- [ ] `server/.env.example`
- [ ] `server/Dockerfile`
- [ ] `server/benchmarks/runner.ts`
- [ ] `server/benchmarks/suites/suite1_flow_latency.ts`
- [ ] `server/benchmarks/suites/suite2_mention_scrubber.ts`
- [ ] `server/benchmarks/suites/suite3_interpolation.ts`
- [ ] `server/benchmarks/suites/suite4_memory_retention.ts`
- [ ] `server/benchmarks/types.ts`
- [ ] `server/benchmarks/utils/reporter.ts`
- [ ] `server/benchmarks/utils/stats.ts`
- [ ] `server/package.json`
- [ ] `server/src/actions/addRole.ts`
- [ ] `server/src/actions/check.ts`
- [ ] `server/src/actions/createThread.ts`
- [ ] `server/src/actions/deleteMessage.ts`
- [ ] `server/src/actions/dud.ts`
- [ ] `server/src/actions/index.ts`
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
- [ ] `server/src/app.ts`
- [ ] `server/src/config/database.ts`
- [ ] `server/src/config/env.ts`
- [ ] `server/src/config/migrate.ts`
- [ ] `server/src/config/migrations.ts`
- [ ] `server/src/config/tursoPipeline.ts`
- [ ] `server/src/index.ts`
- [ ] `server/src/middleware/auth.ts`
- [ ] `server/src/middleware/errorHandler.ts`
- [ ] `server/src/middleware/multipart.ts`
- [ ] `server/src/middleware/rateLimit.ts`
- [ ] `server/src/middleware/staffPermissions.ts`
- [ ] `server/src/middleware/verifyDiscordSignature.ts`
- [ ] `server/src/repositories/actionRepository.ts`
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
- [ ] `server/src/repositories/templateRepository.ts`
- [ ] `server/src/repositories/trackedMessageRepository.ts`
- [ ] `server/src/repositories/userRepository.ts`
- [ ] `server/src/routes/access.ts`
- [ ] `server/src/routes/auth.ts`
- [ ] `server/src/routes/config.ts`
- [ ] `server/src/routes/design.ts`
- [ ] `server/src/routes/discord.ts`
- [ ] `server/src/routes/executors.ts`
- [ ] `server/src/routes/health.ts`
- [ ] `server/src/routes/interactions.ts`
- [ ] `server/src/routes/send.ts`
- [ ] `server/src/routes/settings.ts`
- [ ] `server/src/routes/templates.ts`
- [ ] `server/src/routes/tracking.ts`
- [ ] `server/src/routes/weao.ts`
- [ ] `server/src/services/actionExecutor.ts`
- [ ] `server/src/services/auditLog.ts`
- [ ] `server/src/services/authorService.ts`
- [ ] `server/src/services/branches.ts`
- [ ] `server/src/services/discordService.ts`
- [ ] `server/src/services/guildVariables.ts`
- [ ] `server/src/services/interactionHandler.ts`
- [ ] `server/src/services/maintenanceService.ts`
- [ ] `server/src/services/messageTrackerService.ts`
- [ ] `server/src/services/settingsService.ts`
- [ ] `server/src/services/templateService.ts`
- [ ] `server/src/services/variableInterpolation.ts`
- [ ] `server/src/services/weaoService.ts`
- [ ] `server/src/types/express.d.ts`
- [ ] `server/src/utils/appLayoutValidation.ts`
- [ ] `server/src/utils/crypto.ts`
- [ ] `server/src/utils/errors.ts`
- [ ] `server/src/utils/logger.ts`
- [ ] `server/src/utils/mentionScrubber.ts`
- [ ] `server/src/utils/requestParsing.ts`
- [ ] `server/src/utils/session.ts`
- [ ] `server/src/utils/urlAttachments.ts`
- [ ] `server/src/utils/validation.ts`
- [ ] `server/tests/accessSecurity.test.ts`
- [ ] `server/tests/actions.test.ts`
- [ ] `server/tests/adversarial_streaming_memory.test.ts`
- [ ] `server/tests/appLayoutPublishing.test.ts`
- [ ] `server/tests/authorService.test.ts`
- [ ] `server/tests/challenger_bot_relay.test.ts`
- [ ] `server/tests/challenger_flowRepository.test.ts`
- [ ] `server/tests/challenger_member_cache.test.ts`
- [ ] `server/tests/challenger_multipart.test.ts`
- [ ] `server/tests/challenger_perf_indexes.test.ts`
- [ ] `server/tests/challenger_retention_maintenance.test.ts`
- [ ] `server/tests/challenger_staffRepository.test.ts`
- [ ] `server/tests/crypto.test.ts`
- [ ] `server/tests/discordService.timeout.test.ts`
- [ ] `server/tests/environmentMode.test.ts`
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
- [ ] `server/tests/session.test.ts`
- [ ] `server/tests/sqlSplitter.stress.test.ts`
- [ ] `server/tests/staff_logging_enhancements.test.ts`
- [ ] `server/tests/staff_security_regression.test.ts`
- [ ] `server/tests/tursoPipeline.test.ts`
- [ ] `server/tests/urlAttachments.security.test.ts`
- [ ] `server/tests/validation.test.ts`
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
- [ ] `shared/package.json`
- [ ] `shared/src/constants.ts`
- [ ] `shared/src/customId.ts`
- [ ] `shared/src/index.ts`
- [ ] `shared/src/types.ts`
- [ ] `shared/tests/constants.test.ts`
- [ ] `shared/tests/customId.test.ts`
- [ ] `shared/tsconfig.build.json`
- [ ] `shared/tsconfig.json`
- [ ] `shared/vitest.config.ts`

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
