# HoHo Manager — Full Codebase Audit & ChatGPT Fix Prompts

**Audit Target:** `no-peace/Hoho_manager` (`main` branch, post-V16 snapshot from NotebookLM `2026-11-19T15:28:46Z`)  
**Production Environment:** Render Free (`0.1 CPU`, `512 MB RAM`) + Turso Free Plan  
**Scope:** Complete line-by-line review of `shared/`, `bot/`, `server/`, `client/`, and root/infra configuration (`package.json`, `ecosystem.config.cjs`, `scripts/`).

---

## Executive Summary

| Severity | Count | Primary Impact |
| :--- | :---: | :--- |
| **CRITICAL** | **8** | Dead runtime features, production boot/OOM failures, cross-guild IDOR, permanent DB scheduler stalls, Turso redirect 404s, destructive UI state deletion, permission bypasses |
| **HIGH** | **26** | Security/auth gaps, 3s Discord ACK overruns, double-post retries, schedule drift, multi-message validation bypass, state leaks, DnD key corruption, modal state staleness |
| **MEDIUM** | **25** | Residual IDOR, unbounded caches (512MB RAM risk), Turso Free row-read burn, async race conditions, broken Discord OG banner, linter/simulator/parser edge cases |
| **LOW** | **9** | Type duplication, graceful shutdown race, CSS token conflicts, redundant work while modals are closed, minor timer/style leaks |
| **TOTAL** | **68** | **100% source-verified across all 4 layers** |

---

## Standing Rules for ChatGPT (Paste Once at the Start of Any Fix Session)

> **Copy-paste this block at the start of your ChatGPT conversation before pasting any fix prompt below:**
>
> ```text
> You are fixing bugs in `no-peace/Hoho_manager` (Node/TypeScript monorepo: `shared`, `bot`, `server`, `client`).
> Follow these hard constraints on EVERY change:
> 1. Do NOT run `npm` commands, tests, or builds, and do NOT add or rely on GitHub Actions workflows (I run `npm install`, `npm run typecheck`, `npm test`, and `npm run build` locally after `git pull`).
> 2. Target hosting is Render Free (0.1 CPU, 512 MB RAM) and Turso Free Plan — keep CPU, memory, and Turso row reads/writes minimal.
> 3. Preserve `lenis` smooth scrolling (`client/src/utils/editorSmoothScroll.ts`) and keep the existing Studio dark theme, colors, typography, and layout intact unless a fix explicitly addresses a broken UI bug.
> 4. Make surgical, clean, TypeScript-strict edits. Never introduce `any` shortcuts, placeholder comments, or dead code.
> ```

---

## Recommended Execution Order

1. **Batch 1 — CRITICAL (`C-01` to `C-08`):** Fix first. These cover dead features, prod boot crashes, cross-guild IDOR, permanent scheduler stalls, Turso 404s, and destructive UI bugs.
2. **Batch 2 — HIGH Bot & Server (`H-01` to `H-12`):** Security hardening, Discord 3s ACK reliability, retry safety, and scheduler accuracy.
3. **Batch 3 — HIGH Client Core & UI (`H-13` to `H-26`):** Multi-message safety, undo/redo/mode switching, DnD keys, flow `custom_id` uniqueness, and modal freshness.
4. **Batch 4 — MEDIUM (`M-01` to `M-25`):** Render RAM caps, Turso Free query optimization, async race cancellation, OG preview image fix, and edge-case correctness.
5. **Batch 5 — LOW (`L-01` to `L-09`):** Cleanups, shutdown ordering, CSS hygiene, and micro-optimizations.

---

# BATCH 1 — CRITICAL ISSUES (8)

### C-01: `StickyMessageListener` Is Completely Dead at Runtime (Missing `GuildMessages` Intent)
- **File & Symbol:** `bot/src/index.ts` (`intents` array in `SapphireClient`)
- **Root Cause & Impact:** The bot only requests `GatewayIntentBits.Guilds` and omits `GatewayIntentBits.GuildMessages`. Discord Gateway v10 never dispatches `MESSAGE_CREATE` without `GuildMessages`, so `StickyMessageListener` never fires—even while `ReadyListener` still polls `/api/automation/sticky/active` every 60 seconds.
- **Best Fix:** Add `GatewayIntentBits.GuildMessages` to `intents` in `bot/src/index.ts`. (`MessageContent` is privileged and is **not** needed because sticky refresh only inspects `message.channelId`, `message.author.bot`, and `message.id`.)
- **ChatGPT Fix Prompt:**
  ```text
  Fix C-01 in `bot/src/index.ts`:
  `StickyMessageListener` never receives `MESSAGE_CREATE` events because `SapphireClient` only registers `[GatewayIntentBits.Guilds]`.
  Add `GatewayIntentBits.GuildMessages` to the `intents` array in `bot/src/index.ts` (do NOT add privileged `MessageContent` since sticky tracking does not read message text). Keep all other client options unchanged.
  ```

---

### C-02: Production `npm start` Uses a `devDependency` (`concurrently`) & Spawns 5 Node Processes on 512MB RAM
- **File & Symbol:** `package.json` (`scripts.start`)
- **Root Cause & Impact:** `scripts.start` invokes `concurrently`, which lives in `devDependencies` (fails in `npm ci --omit=dev`), spawns 5 resident Node processes (`npm` + `concurrently` + 2 `npm --workspace` wrappers + `server` + `bot`, wasting ~120–150MB of Render's 512MB RAM), and omits `--kill-others` so a crashed bot or server silently leaves the container "healthy".
- **Best Fix:** Replace `scripts.start` with a zero-dependency Node launcher `scripts/start-prod.mjs` that spawns `node server/dist/index.js` and `node bot/dist/index.js` directly with `stdio: "inherit"`, forwards `SIGTERM`/`SIGINT` to both children, and kills the sibling + exits non-zero if either child exits unexpectedly.
- **ChatGPT Fix Prompt:**
  ```text
  Fix C-02 in `package.json` and create `scripts/start-prod.mjs`:
  `npm start` currently calls `concurrently` (a `devDependency`) and spawns 5 Node processes on Render Free's 512MB RAM without killing the sibling if one crashes.
  1. Create a zero-dependency ESM script `scripts/start-prod.mjs` that spawns `process.execPath` directly for `server/dist/index.js` and `bot/dist/index.js` with `stdio: "inherit"`.
  2. Forward `SIGINT` and `SIGTERM` cleanly to both children.
  3. If either child exits or errors, immediately terminate the other child and exit with a non-zero status code (unless shutting down cleanly from a signal).
  4. Update root `package.json` `"start"` script to `"node scripts/start-prod.mjs"`.
  ```

---

### C-03: Cross-Guild IDOR & Mention/V2 Filter Bypass in `POST /api/automation/sticky`
- **File & Symbol:** `server/src/routes/automation.ts` (`POST /sticky`)
- **Root Cause & Impact:** The route trusts client-supplied `req.body.guildId` instead of resolving the real guild of `channelId` via `getChannelGuildId(channelId)`. A staff member with `allowed_channel_ids: ["*"]` in Guild A can pass `guildId = Guild A` with `channelId = <Guild B channel>` and hijack sticky messages in an unauthorized guild. Additionally, it never runs `validateMessagePayload`, `can_use_components_v2`, `scrubMentions`, or `sanitizeAllowedMentions`, allowing `@everyone`/`@here` and Components V2 bypasses.
- **Best Fix:** Resolve `resolvedGuildId = await getChannelGuildId(channelId)` first, reject if missing or mismatched with `req.body.guildId`, verify staff guild + channel + `can_manage_automation` permissions against `resolvedGuildId`, and run `validateMessagePayload`, `can_use_components_v2`, `scrubMentions`, and `sanitizeAllowedMentions` before saving.
- **ChatGPT Fix Prompt:**
  ```text
  Fix C-03 in `server/src/routes/automation.ts` (`POST /sticky`):
  Currently `POST /sticky` trusts `req.body.guildId` and skips payload validation, V2 permission checks, and mention scrubbing.
  1. Resolve the authoritative guild via `getChannelGuildId(channelId)` (same pattern as `/api/send`). Return 400/403 if the channel cannot be resolved or if `req.body.guildId` was supplied and does not match the resolved guild.
  2. Enforce guild access, channel allowlist, and `can_manage_automation` using the resolved guild ID.
  3. Run `validateMessagePayload`, enforce `can_use_components_v2` if V2 flags/components are present, and apply `scrubMentions` + `sanitizeAllowedMentions` to the sticky payload before persisting it.
  ```

---

### C-04: `runDueExpirations` Permanently Stalls All Future Expiring Messages on Empty Due Batch
- **File & Symbol:** `server/src/services/automationService.ts` (`runDueExpirations`)
- **Root Cause & Impact:** When `runDueExpirations` wakes up and finds 0 due rows (e.g., clock skew or already deleted), the `else` branch sets `nextDeleteAt = Infinity` while leaving `hasExpiringMessages = true`. On every subsequent tick, `now < nextDeleteAt` (`now < Infinity`) short-circuits forever, so **no future expiring message is ever deleted** until the server restarts.
- **Best Fix:** Replace the `else` branch with a lightweight indexed query `SELECT MIN(delete_at) AS next_delete_at FROM expiring_messages` (hits `idx_expiring_messages_due` in 1 row read). If `NULL`, set `hasExpiringMessages = false` and `nextDeleteAt = Infinity`; otherwise set `hasExpiringMessages = true` and `nextDeleteAt = Number(row.next_delete_at)`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix C-04 in `server/src/services/automationService.ts` (`runDueExpirations`):
  When `due.length === 0`, the current `else` branch sets `nextDeleteAt = Infinity` while keeping `hasExpiringMessages = true`, permanently stalling all future message expirations.
  Fix this so that after processing due rows (or when `due.length === 0`), `runDueExpirations` refreshes `nextDeleteAt` via a single indexed query `SELECT MIN(delete_at) AS next_delete_at FROM expiring_messages`. If the result is `null`/`undefined`, set `hasExpiringMessages = false; nextDeleteAt = Infinity`; otherwise set `hasExpiringMessages = true; nextDeleteAt = Number(next)` (guarding against `NaN`).
  ```

---

### C-05: Turso Pipeline `base_url` Redirect Strips `/v2/pipeline` Path
- **File & Symbol:** `server/src/config/tursoPipeline.ts` (response handling of `payload.base_url`)
- **Root Cause & Impact:** Turso's Hrana HTTP v2 protocol returns `base_url` as an origin (e.g. `https://db-xyz.turso.io`) without `/v2/pipeline`. Assigning `context.baseUrl = payload.base_url` directly causes all follow-up baton requests (including transaction `COMMIT`/`ROLLBACK`) to `POST /` and fail with HTTP 404.
- **Best Fix:** Normalize `payload.base_url` to always end with `/v2/pipeline` (e.g., `const clean = payload.base_url.replace(/\/+$/, ""); context.baseUrl = clean.endsWith("/v2/pipeline") ? clean : `${clean}/v2/pipeline`;`).
- **ChatGPT Fix Prompt:**
  ```text
  Fix C-05 in `server/src/config/tursoPipeline.ts`:
  When Turso returns `payload.base_url` for baton stickiness, it returns the origin without `/v2/pipeline`. Assigning `context.baseUrl = payload.base_url` causes subsequent pipelined/transaction statements to POST `/` and 404.
  Add a helper `normalizePipelineUrl(rawUrl: string): string` that strips trailing slashes and appends `/v2/pipeline` if not already present, and use it whenever setting or updating `context.baseUrl` from `payload.base_url`.
  ```

---

### C-06: `StringSelectForm` & `MediaGalleryForm` Delete ALL Items Without `_id` When Removing One
- **File & Symbol:** `client/src/components/editor/ComponentForms.tsx` (`StringSelectForm`, `MediaGalleryForm`)
- **Root Cause & Impact:** Both forms filter removed items by `o._id !== option._id` / `i._id !== item._id`. Imported, templated, or blueprint options/gallery items that lack `_id` evaluate `undefined !== undefined` (`false`) for **every** item, wiping the entire list when the user deletes a single entry.
- **Best Fix:** Filter by index (`(_, i) => i !== idx`) or ensure every option/item gets a stable `_id` on load/normalize and still fall back to index matching when `_id` is missing.
- **ChatGPT Fix Prompt:**
  ```text
  Fix C-06 in `client/src/components/editor/ComponentForms.tsx`:
  In `StringSelectForm` and `MediaGalleryForm`, deleting an item filters by `o._id !== option._id` / `i._id !== item._id`. When items come from imports, templates, or blueprints without `_id`, `undefined !== undefined` is `false` and wipes every item in the list.
  Update both delete handlers to remove by array index (`(_, i) => i !== index`) — or match by `_id` only when `_id` is a non-empty string, falling back to index otherwise. Keep the UI and styling unchanged.
  ```

---

### C-07: `StepList.tsx` Strips `placeholder` & Entity-Select `min_values`/`max_values` on Every Keystroke (2026 Modal Selects)
- **File & Symbol:** `client/src/components/actions/StepList.tsx` (`formatModalComponents`)
- **Root Cause & Impact:** `formatModalComponents` rebuilds Discord modal select components on every change, but drops `placeholder` for selects and drops `min_values`/`max_values` for User/Role/Mentionable/Channel selects, silently erasing user-configured modal fields as soon as anything in the step is edited.
- **Best Fix:** Preserve `placeholder`, `min_values`, `max_values`, `channel_types`, `options`, and `required` cleanly for all modal select types (`StringSelect`, `UserSelect`, `RoleSelect`, `MentionableSelect`, `ChannelSelect`) inside `formatModalComponents` and `modalFieldFromComponent`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix C-07 in `client/src/components/actions/StepList.tsx`:
  `formatModalComponents` currently strips `placeholder` from modal select components and strips `min_values` / `max_values` from entity selects (User/Role/Mentionable/Channel) on every keystroke.
  Update `formatModalComponents` (and its inverse parser `modalFieldFromComponent`) to preserve `placeholder`, `min_values`, `max_values`, `channel_types`, `options`, and `required` across all supported modal input/select component types.
  ```

---

### C-08: Role-Mention Permission Bypass in `MentionInput` vs `RichPicker`
- **File & Symbol:** `client/src/components/editor/MentionInput/index.tsx`
- **Root Cause & Impact:** When `can_mention_roles` is `true`, `MentionInput` renders and inserts **all** guild roles while ignoring `allowed_role_mention_ids` (which `RichPicker` and the server enforce). Staff restricted to specific roles see and insert unauthorized `<@&roleId>` mentions that later fail or get scrubbed on send.
- **Best Fix:** Share the exact same role-filtering helper between `MentionInput` and `RichPicker`: if `allowed_role_mention_ids` is present and does not contain `"*"`, filter roles to only those in `allowed_role_mention_ids`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix C-08 in `client/src/components/editor/MentionInput/index.tsx`:
  `MentionInput` ignores `allowed_role_mention_ids` whenever `can_mention_roles` is true, unlike `RichPicker` and the backend.
  Extract or reuse the exact role-allowlist check so that if `allowed_role_mention_ids` is set and does not include `"*"`, `MentionInput` only displays and autocompletes roles whose IDs are in `allowed_role_mention_ids` (and shows no roles if `can_mention_roles` is false).
  ```

---

# BATCH 2 — HIGH PRIORITY: BOT, INFRA & SERVER (12)

### H-01: Bot Refuses to Start in Prod on Loopback `API_BASE_URL` or Unset `CLIENT_ORIGIN`
- **File & Symbol:** `bot/src/lib/env.ts` (`validateApiBaseUrl`, `validateEnv`), `bot/.env.example`, `bot/README.md`
- **Root Cause & Impact:** In production (`NODE_ENV=production`), `validateApiBaseUrl` rejects `http://127.0.0.1:${PORT}` (forcing same-container bot→server traffic over public HTTPS and Render's external router), and `validateEnv` throws if the undocumented `CLIENT_ORIGIN` falls back to `http://localhost:5173`.
- **Best Fix:** Allow `http:` for loopback hosts (`127.0.0.1`, `localhost`, `::1`) in production; make `CLIENT_ORIGIN` optional or clearly documented in `bot/.env.example` and `bot/README.md`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-01 in `bot/src/lib/env.ts`, `bot/.env.example`, and `bot/README.md`:
  1. In `validateApiBaseUrl`, allow `http:` in production when the URL hostname is loopback (`127.0.0.1`, `localhost`, or `::1`), while still requiring `https:` for non-loopback hosts in production.
  2. Fix `CLIENT_ORIGIN` validation so it does not crash production startup when unset if not strictly required, or clearly document `CLIENT_ORIGIN` in `bot/.env.example` and `bot/README.md`.
  ```

---

### H-02: `/status` Command Is Unauthenticated, Unthrottled, and Leaks Internal `API_BASE_URL`/Config
- **File & Symbol:** `bot/src/commands/status.ts`
- **Root Cause & Impact:** Anyone in any guild can run `/status` with no admin check and no cooldown, spamming `/api/health` (hitting Turso) and viewing `env.apiBaseUrl`, `environment`, and internal credential presence flags.
- **Best Fix:** Gate `/status` behind `isBotCommandAdmin(interaction)` and `checkCommandCooldown(interaction)` (or strip internal URLs/flags for non-admins and still throttle everyone).
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-02 in `bot/src/commands/status.ts`:
  `/status` currently has no admin check or cooldown and prints internal `env.apiBaseUrl`, `environment`, and credential flags to any Discord user while hitting `/api/health`.
  Gate `/status` behind `isBotCommandAdmin` and `checkCommandCooldown` (matching the other admin bot commands) and reply ephemerally. Also avoid printing raw internal URLs if not needed.
  ```

---

### H-03: Broken Relative `script` Paths in `ecosystem.config.cjs`
- **File & Symbol:** `ecosystem.config.cjs`
- **Root Cause & Impact:** `dmb-api` sets `cwd: "./server"` with `script: "server/dist/index.js"` (resolves to `server/server/dist/index.js`), `dmb-gateway` does the same for `bot/bot/dist/index.js`, and `dmb-web` points to `node_modules/vite/bin/vite.js` inside `cwd: "./client"` even though npm workspaces hoist `vite` to root `node_modules`.
- **Best Fix:** Use `script: "dist/index.js"` with `cwd: path.join(__dirname, "server")` / `bot`, and `script: path.join(__dirname, "node_modules", "vite", "bin", "vite.js")` for `dmb-web`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-03 in `ecosystem.config.cjs`:
  All three PM2 app entries have broken relative `script` paths (`server/server/dist/index.js`, `bot/bot/dist/index.js`, and unhoisted `client/node_modules/vite/bin/vite.js`).
  Use `path.resolve(__dirname, ...)` so `dmb-api` runs `dist/index.js` in `server`, `dmb-gateway` runs `dist/index.js` in `bot`, and `dmb-web` runs the hoisted root `node_modules/vite/bin/vite.js` with `cwd` set to `client`.
  ```

---

### H-04: Interaction Relay 2,200ms Timeout Races Server's 2,200ms ACK Deadline & Leaks `fetch` Bodies
- **File & Symbol:** `bot/src/listeners/interactionRelay.ts`, `bot/src/listeners/ready.ts`
- **Root Cause & Impact:** `interactionRelay.ts` aborts its fetch to the server at `2_200ms`—the exact same `2_200ms` deadline the server uses for `Promise.race`—causing false timeouts, double-ACK `40060` errors, and bogus "temporarily unavailable" fallbacks on Render's 0.1 CPU. Additionally, successful responses in `interactionRelay.ts` and `/api/automation/tick` in `ready.ts` never consume or cancel `res.body`, leaking undici sockets/buffers.
- **Best Fix:** Raise the bot relay abort timeout to `2_600ms` (so the server's `2_200ms` race finishes first) and call `await res.body?.cancel().catch(() => {})` on every response whose body is not read in both `interactionRelay.ts` and `ready.ts`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-04 in `bot/src/listeners/interactionRelay.ts` and `bot/src/listeners/ready.ts`:
  1. In `interactionRelay.ts`, increase the relay `AbortController` timeout from `2_200` ms to `2_600` ms so it does not race the server's internal 2,200ms ACK deadline.
  2. In both `interactionRelay.ts` and `ready.ts` (`/api/automation/tick`), ensure every `fetch` response whose body isn't parsed calls `await res.body?.cancel().catch(() => undefined)` so undici connections and buffers are never leaked.
  ```

---

### H-05: `StickyMessageListener` Concurrent `/refresh` Race, Retry Storm, and Stale Object Mutation
- **File & Symbol:** `bot/src/listeners/stickyMessage.ts`
- **Root Cause & Impact:** Multiple rapid messages in a sticky channel trigger overlapping `POST /refresh` calls (no per-channel in-flight lock), creating duplicate sticky posts. `lastCacheRefresh` only updates on success, causing a retry storm on every `MESSAGE_CREATE` during an API outage. Finally, mutating the captured `sticky` object after an async cache rebuild mutates a detached stale object.
- **Best Fix:** Add a `refreshingChannels = new Set<string>()` guard (released in `finally`), update `lastCacheAttempt` in `finally` with a backoff cooldown on failure, and re-fetch `stickyChannels.get(channelId)` after any `await` before updating counters/timestamps.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-05 in `bot/src/listeners/stickyMessage.ts`:
  1. Add a per-channel `refreshingChannels = new Set<string>()` lock so concurrent `MESSAGE_CREATE` events in the same channel cannot fire overlapping `/refresh` requests (release in `finally`).
  2. Track `lastCacheAttempt` (updated in `finally`) with a failure backoff (e.g. 30–60s) so API outages do not trigger a cache-refresh storm on every incoming message.
  3. After any `await` that may rebuild `stickyChannels`, re-read `stickyChannels.get(channelId)` instead of mutating a stale captured `sticky` reference.
  ```

---

### H-06: Non-Timing-Safe `x-admin-key` Comparisons in `server/src/routes/automation.ts`
- **File & Symbol:** `server/src/routes/automation.ts` (`GET /sticky/active`, `POST /sticky/:channelId/refresh`, `POST /tick`)
- **Root Cause & Impact:** These three internal endpoints compare `req.headers["x-admin-key"] !== env.ADMIN_KEY` with plain string inequality instead of `crypto.timingSafeEqual` (which `requireAdminKey` already implements).
- **Best Fix:** Replace manual string checks with the shared `requireAdminKey` middleware/helper everywhere in `routes/automation.ts`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-06 in `server/src/routes/automation.ts`:
  `GET /sticky/active`, `POST /sticky/:channelId/refresh`, and `POST /tick` compare `x-admin-key` using plain `!==` instead of constant-time comparison.
  Replace all three manual header checks with the existing `requireAdminKey` middleware/helper (using `crypto.timingSafeEqual`).
  ```

---

### H-07: `POST /api/send` Bypasses `can_manage_automation` & Validates `expireAfterSeconds` AFTER Posting to Discord
- **File & Symbol:** `server/src/routes/send.ts` (`POST /`)
- **Root Cause & Impact:** `POST /api/send` sends messages to Discord first and only validates `expireAfterSeconds` afterward, never checking `can_manage_automation === 1`. Invalid expiration inputs still post live messages to Discord before returning an error, and staff without automation permission can create expiring messages.
- **Best Fix:** Validate `expireAfterSeconds` (finite positive integer within allowed bounds) and check `can_manage_automation === 1` (for non-owner staff) **before** entering the Discord send loop.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-07 in `server/src/routes/send.ts`:
  Move validation of `expireAfterSeconds` (and any other automation fields) to BEFORE the Discord send loop, and verify that non-owner staff have `can_manage_automation === 1` whenever `expireAfterSeconds` is provided. Return 400/403 before posting anything to Discord if invalid or unauthorized.
  ```

---

### H-08: `runDueExpirations` Deletes DB Row in `finally` on Transient Discord Errors
- **File & Symbol:** `server/src/services/automationService.ts` (`runDueExpirations`)
- **Root Cause & Impact:** The `finally` block unconditionally deletes the `expiring_messages` row even when Discord returned a transient 5xx, 429, or network timeout—so the message stays in Discord forever and is never retried.
- **Best Fix:** Only delete the row on HTTP 2xx success or permanent Discord errors (`404`, `403`, error codes `10008` Unknown Message / `10003` Unknown Channel). On transient errors, push `delete_at` forward by a short retry backoff (e.g., 60s) and increment a retry count (drop after e.g. 5 failed attempts).
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-08 in `server/src/services/automationService.ts` (`runDueExpirations`):
  Do not delete the `expiring_messages` row inside `finally` when Discord deletion fails with a transient error (network timeout, 429, 5xx).
  Delete the row only on success or permanent Discord errors (HTTP 403/404 or Discord codes 10008/10003). On transient errors, reschedule `delete_at` forward by 60 seconds (with a max-retry cap or logging) so it retries cleanly on a later tick.
  ```

---

### H-09: `scheduleNextAt` Ignores `timezone`, Breaks Multi-Weekday Biweekly Schedules, Drifts, and Defaults Unknown Frequencies to Minutes
- **File & Symbol:** `server/src/services/automationService.ts` (`scheduleNextAt`)
- **Root Cause & Impact:** (1) `timezone` stored on scheduled messages is ignored—calculations run in host UTC; (2) biweekly multi-weekday schedules (e.g., Mon & Wed every 2 weeks) add `(interval - 1) * 7` on every weekday step instead of only when wrapping to the next cycle; (3) anchoring to `now` instead of `next_run_at` causes cumulative clock drift; (4) unknown `frequency` values silently fall through to `minutes`.
- **Best Fix:** Compute wall-clock dates in the schedule's IANA `timezone` using `Intl.DateTimeFormat`, anchor recurring runs to `next_run_at` (advancing past `now` in whole intervals if missed), apply `(interval - 1) * 7` only when wrapping past the last selected weekday of the week, and throw/disable on unknown `frequency`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-09 in `server/src/services/automationService.ts` (`scheduleNextAt`):
  1. Respect the schedule's IANA `timezone` (falling back to `"UTC"` if invalid) using `Intl.DateTimeFormat` when computing daily/weekly/monthly next run times.
  2. Fix multi-weekday schedules with `interval > 1` so `(interval - 1) * 7` days are only added when wrapping from the last selected weekday of the week to the first weekday of the next cycle—not between weekdays in the same week.
  3. Anchor recurring calculations to the previous `next_run_at` (stepping forward until `> now`) to prevent drift.
  4. Reject/fail explicitly on unknown `frequency` values instead of falling back to minutes.
  ```

---

### H-10: 3-Second Discord ACK Deadline Overrun on Render Free + Turso
- **File & Symbol:** `server/src/services/interactionHandler.ts`, `server/src/routes/interactions.ts`
- **Root Cause & Impact:** `claim()` (Turso HTTP round-trip), `complete()` (another Turso HTTP round-trip), and the `/relay` Discord callback all run **outside** the `2_200ms` `Promise.race` budget. On Render Free (0.1 CPU) + Turso HTTP latency, total wall time easily exceeds Discord's hard `3_000ms` interaction ACK deadline, causing "This interaction failed".
- **Best Fix:** Capture `const startedAt = Date.now()` at route entry, compute remaining ACK budget `Math.max(400, 2200 - (Date.now() - startedAt))` for `Promise.race`, and fire `complete()` asynchronously (`void complete(...).catch(...)`) after the ACK response has already been sent.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-10 in `server/src/services/interactionHandler.ts` and `server/src/routes/interactions.ts`:
  `claim()`, `complete()`, and `/relay` Discord callbacks currently run outside the 2,200ms ACK race budget, causing 3-second Discord timeouts on Render Free + Turso.
  1. Record `startedAt = Date.now()` as soon as the interaction request enters the route.
  2. Calculate the remaining ACK budget dynamically (`Math.max(400, 2200 - (Date.now() - startedAt))`) for `Promise.race` so `claim()` latency is accounted for.
  3. Do not `await complete(...)` on the critical path before sending the HTTP ACK or Discord callback—run `complete()` fire-and-forget with `.catch(...)` error logging.
  ```

---

### H-11: Rich Modal Validation Gaps, Submit Variable Overwrite, & Missing `messageId` Lookup
- **File & Symbol:** `server/src/actions/openModal.ts`, `server/src/services/actionExecutor.ts` (`saveModalValue`), `server/src/repositories/actionRepository.ts` (`findByCustomId`)
- **Root Cause & Impact:** (1) `openModal.ts` does not clamp `title <= 45`, `custom_id <= 100`, or `components <= 5`, causing Discord HTTP 400 rejections; (2) `saveModalValue` writes `variables[customId]` directly into the root template variable map, allowing a modal field named `user` or `member` to overwrite `{user.id}` / `{member.role_ids}`; (3) `findByCustomId` returns `[]` when `messageId` is absent (which is true on modal submits), breaking modal follow-up flows.
- **Best Fix:** Clamp/validate modal `title`, `custom_id`, and `components.slice(0, 5)` in `openModal.ts`; store modal values under a dedicated namespace (`variables.modal[customId]` while only setting root `variables[customId]` if the key is not a reserved namespace like `user`, `member`, `guild`, `channel`, `interaction`, `weao`); and allow `findByCustomId` to query by `(guildId, customId)` when `messageId` is null/undefined.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-11 across `server/src/actions/openModal.ts`, `server/src/services/actionExecutor.ts`, and `server/src/repositories/actionRepository.ts`:
  1. In `openModal.ts`, enforce Discord limits before returning the modal payload: `title.slice(0, 45)`, `custom_id.slice(0, 100)`, and at most 5 top-level components (`components.slice(0, 5)`).
  2. In `actionExecutor.ts` (`saveModalValue`), prevent modal field IDs from overwriting reserved context keys (`user`, `member`, `guild`, `channel`, `interaction`, `weao`, `role`). Store them safely (e.g., under `modal.<customId>` and only set top-level if not reserved).
  3. In `actionRepository.ts` (`findByCustomId`), handle missing/empty `messageId` (common on modal submit interactions) by querying by `custom_id` (and `guild_id` if provided) instead of returning `[]`.
  ```

---

### H-12: Discord `apiRequest` Retries Non-Idempotent `POST` Sends & Ignores `Retry-After` Header / Clamps 429 at 10s
- **File & Symbol:** `server/src/services/discordService.ts` (`apiRequest`)
- **Root Cause & Impact:** Retrying `POST` message/webhook sends on network timeout or 5xx can **double-post** messages to Discord channels. For HTTP 429, `apiRequest` ignores the `Retry-After` header (breaking on non-JSON Cloudflare 429s) and clamps waits at 10s (hammering Discord during longer rate limits).
- **Best Fix:** Only auto-retry `GET`/`HEAD`/`PUT`/`DELETE` (or explicit `idempotent: true` requests) on network/5xx errors; never retry `POST` sends after the request may have reached Discord (except clean 429 where Discord explicitly rejected before executing). On 429, parse `Retry-After` header as fallback when JSON body is absent, and if wait exceeds a safe threshold (e.g. `> 10s`), fail fast with a clear rate-limit error instead of retrying early.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-12 in `server/src/services/discordService.ts` (`apiRequest`):
  1. Do not automatically retry non-idempotent `POST` requests on timeout or 5xx (to prevent duplicate Discord messages). Keep retries for `GET`/`PUT`/`DELETE` and for HTTP 429 (where Discord did not execute the request).
  2. On HTTP 429, parse `retry_after` from JSON body OR fall back to the `Retry-After` response header (handles Cloudflare HTML 429s). If the required wait exceeds 10 seconds, do NOT clamp and retry early—throw a descriptive rate-limit error immediately.
  ```

---

# BATCH 3 — HIGH PRIORITY: CLIENT CORE & UI (14)

### H-13: Multi-Message Validation Bypass, Broken `isConfigured` Flag, & Premature `markClean()`
- **File & Symbol:** `client/src/hooks/useSend.ts`
- **Root Cause & Impact:** (1) `useSend` only validates `store.data` (active message), silently allowing invalid secondary messages in multi-message sends to hit Discord and fail mid-batch; (2) `isConfigured` derives from `thread_id` only instead of actual target channel/webhook configuration; (3) `markClean()` is called on Discord send even though sending does not save local template changes.
- **Best Fix:** Validate every message in `store.messages` (labeling errors with `Message #N`), compute `isConfigured` from the active dispatch target (channel or webhook URL), and only call `markClean()` on explicit template save—not on send.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-13 in `client/src/hooks/useSend.ts`:
  1. Validate ALL messages in `store.messages` before sending, prefixing errors with `Message #${i + 1}` when `messages.length > 1`.
  2. Fix `isConfigured` so it reflects whether a valid dispatch destination (selected channel or valid webhook URL) is configured, not just `thread_id`.
  3. Remove the premature `markClean()` call on send so unsaved template edits remain dirty until actually saved.
  ```

---

### H-14: `messageStore.load()` Leaks Previous Undo History & Attachments + Unguarded `suppressDirtyTracking`
- **File & Symbol:** `client/src/store/messageStore.ts` (`load`)
- **Root Cause & Impact:** Loading a new template/backup does not clear attached files (`clearFiles()`) or reset undo history—hitting Undo after loading a template reverts back to the *previous* template! Also `suppressDirtyTracking` is toggled without `try/finally`, so an exception leaves dirty tracking permanently disabled.
- **Best Fix:** Call `clearFiles()`, set `resetHistoryOnNextChange = true` (or clear `past`/`future` stacks), and wrap `suppressDirtyTracking` in `try { ... } finally { suppressDirtyTracking = false; }`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-14 in `client/src/store/messageStore.ts`:
  In `load(...)`:
  1. Clear any previously attached files (`clearFiles()`) and reset undo/redo history (`past: []`, `future: []` / `resetHistoryOnNextChange = true`) so undoing cannot jump back to a prior template.
  2. Wrap any `suppressDirtyTracking = true` section in `try { ... } finally { suppressDirtyTracking = false; }` so an error can never permanently disable dirty tracking.
  ```

---

### H-15: `setMessageMode()` Drops Nested V2 Components on Downgrade, Leaves Invalid `poll` on V2 Upgrade, & Mutates on No-Op
- **File & Symbol:** `client/src/store/messageStore.ts` (`setMessageMode`)
- **Root Cause & Impact:** Switching from Components V2 → Classic drops nested ActionRow/Button components inside `Container`/`Section` without preserving or warning; switching Classic → V2 leaves `poll` attached (Discord rejects `poll` + `IsComponentsV2`); calling `setMessageMode` with the already-active mode still mutates state and marks dirty.
- **Best Fix:** Early-return when `nextMode === currentMode`; on Classic → V2, strip `poll` (and clear `content`/`embeds` cleanly per V2 rules); on V2 → Classic, extract any salvageable `ActionRow`s from nested `Container`s (up to 5) instead of silently dropping them.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-15 in `client/src/store/messageStore.ts` (`setMessageMode`):
  1. Early-return without mutating state or marking dirty if the message is already in the requested mode.
  2. When switching to Components V2, clear `poll` (Discord rejects `poll` alongside `IsComponentsV2`).
  3. When downgrading from V2 to Classic, salvage top-level and `Container`-nested `ActionRow` components (capped at 5) instead of silently dropping them.
  ```

---

### H-16: `actionStore.toRegistrations()` Misses Nested `open_modal`, Hardcoded `"modal:form"` Collision, & Unsorted `loadFromList()`
- **File & Symbol:** `client/src/store/actionStore.ts`
- **Root Cause & Impact:** `toRegistrations()` only inspects top-level steps and misses `open_modal` nested inside `check` (`pass`/`fail`/`then`/`else`) branches; modal submit custom IDs fall back to hardcoded `"modal:form"` (colliding when multiple modals exist on one message); `loadFromList()` preserves arbitrary server order instead of sorting by step/registration order.
- **Best Fix:** Recursively traverse `check` branches in `toRegistrations()`, derive unique modal submit IDs from the parent flow/step ID (e.g. `modal:${parentCustomId}:${stepIdx}` clamped to 100 chars), and sort deterministically in `loadFromList()`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-16 in `client/src/store/actionStore.ts`:
  1. Update `toRegistrations()` to recursively walk nested `check` branches (`pass`, `fail`, `then`, `else`) so nested `open_modal` steps are registered.
  2. Replace the hardcoded `"modal:form"` fallback with a deterministic unique custom_id derived from the parent button/select custom_id and step index (clamped to <= 100 chars).
  3. Ensure `loadFromList()` sorts/normalizes loaded registrations deterministically.
  ```

---

### H-17: `fromQueryData()` Silently Drops 7 Message/Dispatch Fields
- **File & Symbol:** `client/src/utils/exportImport.ts` (`fromQueryData`)
- **Root Cause & Impact:** Decoding Discohook/share links or backup query data silently drops `poll`, `allowed_mentions`, `thread_id`, `exploit_name`, `message_reference`, `link_mode`, and `message_link`.
- **Best Fix:** Preserve and validate all 7 fields in `fromQueryData()` (and ensure `toQueryData()` round-trips them cleanly).
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-17 in `client/src/utils/exportImport.ts`:
  `fromQueryData()` silently drops `poll`, `allowed_mentions`, `thread_id`, `exploit_name`, `message_reference`, `link_mode`, and `message_link`.
  Update `fromQueryData()` (and verify `toQueryData()`) so all 7 fields are preserved cleanly on import/round-trip without breaking existing Discohook share links.
  ```

---

### H-18: `discord.ts` Validation & Payload Bugs (V2 5-Row Cap, Ignored `accessory`, Missing V2 Checks, Unmasked Classic Flags)
- **File & Symbol:** `client/src/utils/discord.ts` (`validateMessage`, `toDiscordPayload`)
- **Root Cause & Impact:** `validateMessage` wrongly enforces the Classic 5-ActionRow limit in V2 mode, ignores `component.accessory` during recursive validation, omits V2 4,000-char text total / Link button URL validation / duplicate `custom_id` checks; `toDiscordPayload` fails to mask out the `IsComponentsV2` flag bit (`1 << 15`) when building Classic payloads.
- **Best Fix:** Gate the 5-ActionRow cap strictly to Classic mode, recurse into `component.accessory`, validate V2 4,000-char limit + Link button `http(s)://` URLs + duplicate `custom_id`s across interactive components, and clear `1 << 15` in `toDiscordPayload` for Classic mode.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-18 in `client/src/utils/discord.ts`:
  1. In `validateMessage`: only enforce the 5-ActionRow limit in Classic mode; recurse into `component.accessory` when traversing V2 trees; validate V2 total text <= 4,000 chars, Link button URLs (`https://` or `http://`), and duplicate `custom_id`s across non-link interactive components.
  2. In `toDiscordPayload`: when mode is Classic, explicitly clear the `IsComponentsV2` bit (`flags & ~(1 << 15)`) so stale V2 flags are never sent on Classic messages.
  ```

---

### H-19: Broken Starter Blueprints (`support-launcher` & `live-status-board`)
- **File & Symbol:** `client/src/utils/starterBlueprints.ts`
- **Root Cause & Impact:** `support-launcher` emits a Discord V2 `Section` without an `accessory` (Discord API strictly requires every `Section` to have a `Button` or `Thumbnail` accessory and rejects it with HTTP 400). `live-status-board` uses `{weao.status}` which is not a valid WEAO placeholder key.
- **Best Fix:** Add a valid `Thumbnail` or `Button` accessory to the `Section` in `support-launcher` (or convert it to a `TextDisplay`), and replace `{weao.status}` with the real supported WEAO placeholder (e.g., `{weao.updateStatus}` / matching `weaoService` keys).
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-19 in `client/src/utils/starterBlueprints.ts`:
  1. In `support-launcher`, ensure every V2 `Section` component includes a valid `accessory` (`Thumbnail` or `Button`), or replace accessory-less sections with `TextDisplay` so Discord accepts the payload.
  2. In `live-status-board`, replace the invalid `{weao.status}` placeholder with the actual supported WEAO placeholder key defined in the codebase.
  ```

---

### H-20: Index-as-Key & Index-as-Sortable-ID in `StudioLayout.tsx` & `PollSection.tsx` Corrupts Local State on Drag-Reorder
- **File & Symbol:** `client/src/components/layout/StudioLayout.tsx` (`displayMessages`), `client/src/components/editor/PollSection.tsx` (`poll.answers`)
- **Root Cause & Impact:** Using array index as React `key` and dnd-kit sortable `id` causes React to reuse component instances at the same index after drag-reordering, scrambling local focus/expanded/collapse state and breaking dnd-kit animations.
- **Best Fix:** Attach stable unique client IDs (`_id` / `answer_id` or `crypto.randomUUID()`) to each message wrapper and poll answer, and use those stable IDs for both React `key` and dnd-kit `id`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-20 in `client/src/components/layout/StudioLayout.tsx` and `client/src/components/editor/PollSection.tsx`:
  Stop using array indices as React `key` or dnd-kit sortable `id` for `displayMessages` and `poll.answers`.
  Ensure each message item and each poll answer has a stable unique ID (preserving existing IDs and generating one if missing, stripped before Discord serialization if internal like `_id`), and use that stable ID for both `key` and sortable `id`. Keep existing UI/layout intact.
  ```

---

### H-21: Missing `ensureActive()` with `e.stopPropagation()` Mutates/Selects Wrong Message in Multi-Message Mode
- **File & Symbol:** `client/src/components/editor/DiscohookComponentsEditor.tsx`, `client/src/components/editor/EmbedEditor.tsx`, `client/src/components/editor/PollSection.tsx`
- **Root Cause & Impact:** Clicking controls inside a non-active message card calls `e.stopPropagation()` without first calling `ensureActive()`, so the parent card's `onClick` never switches `activeMessageIndex`—edits and inspector selections then apply to the *wrong* message.
- **Best Fix:** Call `ensureActive()` before `e.stopPropagation()` on interactive handlers in all three editors.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-21 in `client/src/components/editor/DiscohookComponentsEditor.tsx`, `client/src/components/editor/EmbedEditor.tsx`, and `client/src/components/editor/PollSection.tsx`:
  Several interactive handlers call `e.stopPropagation()` without calling `ensureActive()`, preventing the parent message card from becoming active in multi-message mode and causing edits/inspector selections to target the wrong message.
  Call `ensureActive?.()` before `e.stopPropagation()` on those click/select/edit handlers across all three files.
  ```

---

### H-22: Double-Escaped Regex `/^\\d{17,20}$/` in `SearchableDiscordSelect.tsx`
- **File & Symbol:** `client/src/components/shared/SearchableDiscordSelect.tsx`
- **Root Cause & Impact:** The regex literal `/^\\d{17,20}$/` matches a literal backslash followed by 17–20 `d` characters instead of a Discord snowflake, breaking the `"Loading server…"` fallback and displaying raw numeric guild IDs in the UI.
- **Best Fix:** Change `/^\\d{17,20}$/` to `/^\d{17,20}$/`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-22 in `client/src/components/shared/SearchableDiscordSelect.tsx`:
  Replace the double-escaped regex literal `/^\\d{17,20}$/` with `/^\d{17,20}$/` so Discord snowflake IDs are properly detected and the `"Loading server…"` fallback works as intended.
  ```

---

### H-23: `FlowBuilder.tsx` `custom_id` Collisions Overwrite/Delete Sibling Button Flows
- **File & Symbol:** `client/src/components/actions/FlowBuilder.tsx`
- **Root Cause & Impact:** Two buttons on the same message that share the same first step (or truncate identically at 100 chars) generate the exact same `custom_id`, causing edits or deletions on one button's flow to overwrite or wipe the sibling button's flow.
- **Best Fix:** Include a short unique suffix (e.g., component's stable `_id` slice or collision-checked counter) when generating `custom_id`s in `FlowBuilder.tsx`, ensuring total length stays `<= 100` chars and is unique across all components in the message.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-23 in `client/src/components/actions/FlowBuilder.tsx`:
  When two buttons share the same first action step or truncate identically at 100 characters, they collide on `custom_id` and overwrite/delete each other's flows.
  Ensure generated `custom_id`s are unique across all interactive components in the active message (e.g. incorporating a short stable component suffix and checking against existing `custom_id`s while staying <= 100 characters).
  ```

---

### H-24: `ActionRowPreview.tsx` Configure Gear Button Lacks `stopPropagation`
- **File & Symbol:** `client/src/components/preview/ActionRowPreview.tsx`
- **Root Cause & Impact:** Clicking the Configure gear icon on a button in Test Flow mode bubbles to the button preview's click handler, opening **both** the Inspector and `FlowSimulatorDrawer` simultaneously.
- **Best Fix:** Add `e.stopPropagation()` to the Configure gear button's `onClick`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-24 in `client/src/components/preview/ActionRowPreview.tsx`:
  Add `e.stopPropagation()` inside the Configure gear button's `onClick` handler so clicking it opens only the Inspector and does not also trigger the button preview / `FlowSimulatorDrawer`.
  ```

---

### H-25: `BackupsModal.tsx` Loads Tracked Messages Using Current `store.mode` Instead of Payload Mode
- **File & Symbol:** `client/src/components/modals/BackupsModal.tsx` (`handleEditTrackedMessage`)
- **Root Cause & Impact:** Loading a tracked V2 message while the editor is in Classic mode (or vice versa) forces the wrong editor mode and corrupts/hides the message's components.
- **Best Fix:** Detect mode via `getEditorModeForDiscordMessage(payload)` and pass it into `store.load(...)`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-25 in `client/src/components/modals/BackupsModal.tsx` (`handleEditTrackedMessage`):
  Instead of passing the current `store.mode`, detect the payload's actual mode using `getEditorModeForDiscordMessage(payload)` and load the tracked message in that detected mode.
  ```

---

### H-26: Always-Mounted Modals Retain Stale State Across Opens & Guild Switches
- **File & Symbol:** `client/src/components/modals/MessageLinkModal.tsx`, `ScheduledMessageModal.tsx`, `ImportLiveMessageModal.tsx`
- **Root Cause & Impact:** Because these modals stay mounted when closed: `MessageLinkModal` retains old `messageLinkInput`; `ScheduledMessageModal` keeps an initial `runAt` timestamp that becomes in-the-past if the tab stays open >1 hour, and retains a stale `channelId` from the previous guild; `ImportLiveMessageModal` also retains a stale `channelId` after switching guilds.
- **Best Fix:** Reset modal-local transient inputs inside a `useEffect` whenever `isOpen` transitions to `true` (computing fresh default `runAt` on open) and clear/re-sync `channelId` whenever `selectedGuildId` changes.
- **ChatGPT Fix Prompt:**
  ```text
  Fix H-26 in `client/src/components/modals/MessageLinkModal.tsx`, `ScheduledMessageModal.tsx`, and `ImportLiveMessageModal.tsx`:
  1. In `MessageLinkModal`: reset `messageLinkInput` and error state whenever `isOpen` becomes `true`.
  2. In `ScheduledMessageModal`: recompute the default future `runAt` timestamp every time `isOpen` becomes `true` (when creating a new schedule), and clear/reset `channelId` whenever `selectedGuildId` changes and the current `channelId` is not in that guild.
  3. In `ImportLiveMessageModal`: clear/reset `channelId` (and loaded messages/errors) whenever `selectedGuildId` changes.
  ```

---

# BATCH 4 — MEDIUM PRIORITY ISSUES (25)

### M-01: Unhandled Rejection in `/exploit` Autocomplete `catch` & Hardcoded 15s Bot API Timeout
- **File & Symbol:** `bot/src/commands/exploit.ts`, `bot/src/lib/api.ts`
- **Root Cause & Impact:** `exploit.ts` calls `await interaction.respond([])` inside `catch` without `.catch()` (can throw unhandled rejection on expired interaction). `bot/src/lib/api.ts` hardcodes 15s for all calls—too long for 3s autocomplete, too short for `/sync`—and leaves non-JSON error bodies undrained.
- **Best Fix:** Add `.catch(() => undefined)` on `interaction.respond([])`, accept optional `timeoutMs` in `api.ts` (`2_500ms` for autocomplete, `60_000ms` for sync), and cancel/drain non-JSON error bodies.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-01 in `bot/src/commands/exploit.ts` and `bot/src/lib/api.ts`:
  1. In `exploit.ts`, chain `.catch(() => undefined)` onto `interaction.respond([])` inside the autocomplete `catch` block.
  2. In `bot/src/lib/api.ts`, support a per-request `timeoutMs` option (default 15_000ms; use 2_500ms for autocomplete and 60_000ms for `/sync`) and drain/cancel `res.body` when returning non-JSON errors.
  ```

---

### M-02: `/send` and `/exploit` Drop `authorUserId` Attribution
- **File & Symbol:** `bot/src/commands/send.ts`, `bot/src/commands/exploit.ts`
- **Root Cause & Impact:** Both commands call `api.sendMessage` without passing `authorUserId: interaction.user.id`, losing audit/author attribution on sent messages.
- **Best Fix:** Pass `authorUserId: interaction.user.id` in both `api.sendMessage` calls.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-02 in `bot/src/commands/send.ts` and `bot/src/commands/exploit.ts`:
  Include `authorUserId: interaction.user.id` in the payload passed to `api.sendMessage` in both commands.
  ```

---

### M-03: `WEBHOOK_URL_REGEX` Accepts `http://`, Arbitrary Subdomains, and Non-Snowflake IDs
- **File & Symbol:** `shared/src/constants.ts`
- **Root Cause & Impact:** Loose webhook regex accepts insecure `http://`, arbitrary subdomains, and non-snowflake webhook IDs.
- **Best Fix:** Tighten to `^https:\/\/(?:(?:canary|ptb|www)\.)?discord(?:app)?\.com\/api\/(?:v\d+\/)?webhooks\/(\d{17,20})\/([\w-]+)$`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-03 in `shared/src/constants.ts`:
  Tighten `WEBHOOK_URL_REGEX` to:
  `/^https:\/\/(?:(?:canary|ptb|www)\.)?discord(?:app)?\.com\/api\/(?:v\d+\/)?webhooks\/(\d{17,20})\/([\w-]+)$/`
  ```

---

### M-04: `buildCustomId` Doesn't Validate `type` & Wastes Characters on Empty `{}`
- **File & Symbol:** `shared/src/customId.ts`
- **Root Cause & Impact:** Empty `type` or `type` containing `:` corrupts `parseCustomId`, and passing `{ a: undefined }` serializes to `"{}"`, wasting 3 characters of the 100-char Discord limit.
- **Best Fix:** Throw if `!type || type.includes(":")`; omit the JSON segment whenever `JSON.stringify(payload) === "{}"`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-04 in `shared/src/customId.ts`:
  In `buildCustomId`, throw an error if `type` is empty or contains `":"`, and skip appending the payload segment if the serialized JSON is `"{}"`.
  ```

---

### M-05: Custom Bot `profileId` Still Accepted on `GET` Routes Without Ownership Checks (IDOR)
- **File & Symbol:** `server/src/routes/discord.ts`, `server/src/routes/send.ts`
- **Root Cause & Impact:** Several `GET` routes pass `parseProfileId(req.query.profileId)` directly to `resolveBotToken` without verifying ownership, allowing unauthorized access to another bot profile's token/resources.
- **Best Fix:** Force `null` (default server bot) or explicitly reject non-null `profileId` unless verified against the authenticated user/owner.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-05 in `server/src/routes/discord.ts` and `server/src/routes/send.ts`:
  Stop accepting unchecked `req.query.profileId` on GET routes (or enforce strict owner-only / ownership verification before calling `resolveBotToken`). Default to `null` (server bot token) when unauthorized.
  ```

---

### M-06: `POST`/`PUT /api/templates` Skip WEAO Check on `body.data` & `GET` Allows Revoked Staff
- **File & Symbol:** `server/src/routes/templates.ts`
- **Root Cause & Impact:** Creating/updating templates skips WEAO placeholder/permission checks on `body.data`, and `GET /api/templates` does not verify the staff member is still active/non-revoked.
- **Best Fix:** Enforce active staff status on `GET` and apply the same WEAO validation/permission checks on `POST`/`PUT` `body.data`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-06 in `server/src/routes/templates.ts`:
  1. Verify the caller is an active (non-revoked) staff member or owner on `GET /api/templates`.
  2. Apply the WEAO permission/placeholder validation check to `body.data` on `POST` and `PUT /api/templates`.
  ```

---

### M-07: `automationService.ts` `NaN` Cache Poisoning, Thread Edit Target Bug, One-Off Disable on Transient Error, & Full-Table `rebuildCaches()` Scans
- **File & Symbol:** `server/src/services/automationService.ts`
- **Root Cause & Impact:** (1) `Number(null/invalid)` can poison `nextRunAt`/`nextDeleteAt` with `NaN`; (2) editing a scheduled/tracked thread message targets `channel_id` instead of `thread_id || channel_id`; (3) one-off scheduled messages get permanently disabled on a transient Discord 5xx/timeout; (4) `rebuildCaches()` performs full-table scans on Turso Free instead of indexed `MIN(...)` / filtered queries.
- **Best Fix:** Guard numeric cache values with `Number.isFinite(...)`, use `thread_id || channel_id` when editing thread messages, retry one-off schedules on transient errors (disable only on success or permanent 4xx), and replace full-table `rebuildCaches()` scans with indexed `MIN()` queries.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-07 in `server/src/services/automationService.ts`:
  1. Guard all `nextRunAt`/`nextDeleteAt` updates with `Number.isFinite(...)` so `NaN` can never poison cache comparisons.
  2. When editing a scheduled/automated message inside a thread, target `row.thread_id || row.channel_id` instead of only `row.channel_id`.
  3. Do not permanently disable one-off scheduled messages on transient Discord 5xx/timeout errors—reschedule a short retry (with max retries) and only mark completed/disabled on success or permanent 4xx.
  4. Replace full-table scans in `rebuildCaches()` with lightweight indexed `SELECT MIN(...)` queries to save Turso Free row reads.
  ```

---

### M-08: Unbounded In-Memory Caches + 100MB Peak Upload Buffering (Render 512MB RAM OOM Risk)
- **File & Symbol:** `server/src/services/authorService.ts` (`memberCache`), `server/src/services/weaoService.ts` (`changelogComparisons`/`changelogBaselines`), `server/src/services/discordService.ts` (`guildPreviewCache`), `server/src/utils/multipart.ts`, `server/src/utils/urlAttachments.ts`
- **Root Cause & Impact:** Unbounded `Map` caches grow indefinitely over uptime, and multipart/URL attachment buffering can peak near ~100MB per request—risking instant OOM kills on Render Free's 512MB RAM.
- **Best Fix:** Cap all 3 caches with a small LRU/max-size eviction (e.g. 200–500 entries + TTL cleanup) and enforce a strict total-request attachment byte cap (e.g., 25MB total across all files) in `multipart.ts` and `urlAttachments.ts` before buffering more bytes.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-08 for Render Free 512MB RAM safety:
  1. Add a max-entry cap (e.g. 250–500 entries with oldest-entry eviction) + TTL pruning to `memberCache` (`authorService.ts`), `changelogComparisons`/`changelogBaselines` (`weaoService.ts`), and `guildPreviewCache` (`discordService.ts`).
  2. In `server/src/utils/multipart.ts` and `server/src/utils/urlAttachments.ts`, enforce a strict cumulative total-upload size cap (e.g. 25MB per request) during streaming/downloading so a single request cannot buffer 100MB and OOM Render.
  ```

---

### M-09: Excess Turso Free Row Reads in `routes/tracking.ts` & 30s `messageTrackerService` Polling
- **File & Symbol:** `server/src/routes/tracking.ts`, `server/src/services/messageTrackerService.ts`
- **Root Cause & Impact:** `PATCH` in `routes/tracking.ts` calls `listAll()` **twice** per request instead of fetching a single row by ID, and `messageTrackerService` polls Turso every 30s—burning Turso Free row reads continuously even when idle.
- **Best Fix:** Add `findById(id)` to the tracking repository and use it in `routes/tracking.ts`; cache tracked message IDs in memory (invalidated on writes) or raise the background tracker poll interval so idle periods consume ~0 Turso reads.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-09 in `server/src/routes/tracking.ts`, its repository, and `server/src/services/messageTrackerService.ts`:
  1. Add a `findById(id)` query and replace the two `listAll()` calls in `PATCH` in `routes/tracking.ts`.
  2. Reduce Turso Free row reads in `messageTrackerService.ts` by caching the tracked messages list in memory (invalidated on create/update/delete) and/or increasing the polling interval when no active tracked messages exist.
  ```

---

### M-10: Unguarded `JSON.parse` on Staff Allowlists, Missing `mutualGuilds` Check, & Empty-String `timingSafeEqual` Edge Case
- **File & Symbol:** `server/src/middleware/auth.ts`, `server/src/services/access.ts`, `server/src/routes/discord.ts`, `server/src/routes/settings.ts`
- **Root Cause & Impact:** Corrupted JSON in staff allowlist columns crashes requests with an unhandled `SyntaxError`; `discord.ts` omits `mutualGuilds` check in one path; `settings.ts` `timingSafeEqual` on empty strings can misbehave if secret is unset.
- **Best Fix:** Wrap allowlist `JSON.parse` in a safe `parseStringArray()` helper returning `[]` on error; enforce `mutualGuilds` check in `discord.ts`; reject empty expected secrets before calling `timingSafeEqual` in `settings.ts`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-10 across `server/src/middleware/auth.ts`, `server/src/services/access.ts`, `server/src/routes/discord.ts`, and `server/src/routes/settings.ts`:
  1. Replace unguarded `JSON.parse` on staff allowlist columns (`auth.ts`, `access.ts`) with a safe helper that returns `[]` on malformed JSON.
  2. Enforce the `mutualGuilds` check consistently in `routes/discord.ts`.
  3. In `routes/settings.ts`, return `false` immediately before `timingSafeEqual` if either the expected secret or provided value is empty.
  ```

---

### M-11: `messageStore.ts` Undo/Redo Coalescing Skips `reorderMessages`, `undo()` Forces `isDirty: true`, & `persist` Breaks Reference Equality
- **File & Symbol:** `client/src/store/messageStore.ts`
- **Root Cause & Impact:** `reorderMessages` isn't captured cleanly in undo history; `undo()` unconditionally marks `isDirty: true` even when returning to the clean saved state; rehydrating from `persist` leaves `state.data` as a separate object from `state.messages[activeMessageIndex]`.
- **Best Fix:** Push a history snapshot before `reorderMessages`, track `savedSnapshotHash` (or `cleanHistoryIndex`) so `undo()` restores `isDirty: false` when back at saved state, and re-link `state.data = state.messages[state.activeMessageIndex]` in `onRehydrateStorage`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-11 in `client/src/store/messageStore.ts`:
  1. Ensure `reorderMessages` records an undo snapshot cleanly.
  2. Avoid forcing `isDirty: true` when `undo()` returns to the last saved state (track a saved revision/index or compare against clean state).
  3. In Zustand `persist` `onRehydrateStorage`, re-sync `state.data = state.messages[state.activeMessageIndex]` so reference equality is preserved after page reload.
  ```

---

### M-12: `payloadLinter.ts` Accepts Non-`SPOILER_` Refs for Spoiler Files & Allows `NaN`/Float Poll Durations
- **File & Symbol:** `client/src/utils/payloadLinter.ts`
- **Root Cause & Impact:** Spoiler attachments in Discord require `attachment://SPOILER_<name>`, but the linter accepts `attachment://<name>` without flagging it; `poll.duration` passes if `NaN` or fractional (e.g. `1.5`), which Discord rejects.
- **Best Fix:** Flag spoiler attachments whose referenced `attachment://` URL lacks the `SPOILER_` prefix, and require `Number.isInteger(poll.duration) && poll.duration >= 1 && poll.duration <= 768`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-12 in `client/src/utils/payloadLinter.ts`:
  1. Warn/error when a spoiler-marked file is referenced via `attachment://` without the `SPOILER_` filename prefix.
  2. Validate `poll.duration` with `Number.isInteger(duration) && duration >= 1 && duration <= 768` so `NaN` and floats are flagged.
  ```

---

### M-13: `flowSimulator.ts` Empty `pass`/`fail` Shadows `then`/`else`, `Number("") < 1`, Scoped Var Leak, & Unbounded Recursion
- **File & Symbol:** `client/src/utils/flowSimulator.ts`
- **Root Cause & Impact:** `step.pass ?? step.then` treats empty `pass: []` as truthy and ignores `then`; `Number("")` evaluates to `0` (`< 1` passes erroneously); `{user.foo}` falls back to plain variable `foo`; deeply nested flows have no recursion depth cap.
- **Best Fix:** Prefer `step.pass?.length ? step.pass : step.then` (same for `fail`/`else`), require `raw.trim() !== ""` before `Number(raw)`, never fall back to unscoped keys when a dotted namespace is specified, and add a `maxDepth = 20` recursion guard.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-13 in `client/src/utils/flowSimulator.ts`:
  1. Use `step.pass?.length ? step.pass : step.then` (and same for `fail`/`else`) so empty arrays don't shadow legacy branches.
  2. Reject empty/whitespace strings before numeric comparison (`raw.trim() !== "" && Number.isFinite(Number(raw))`).
  3. Do not fall back to top-level variables when resolving dotted paths like `{user.foo}`.
  4. Add a recursion depth guard (e.g. `depth > 20`) to prevent stack overflows.
  ```

---

### M-14: `mentionParser.ts` Whitespace Check Kills Spaced WEAO Names & Cold-Cache Dotted Names
- **File & Symbol:** `client/src/utils/mentionParser.ts`
- **Root Cause & Impact:** Rejecting whitespace inside `{weao...}` breaks exploit names containing spaces; when the WEAO cache hasn't loaded yet, dotted exploit names prematurely flip into `exploit_field` mode.
- **Best Fix:** Allow spaces in exploit name tokens before the field separator (or match known exploit names cleanly), and handle cold-cache states without prematurely switching to `exploit_field`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-14 in `client/src/utils/mentionParser.ts`:
  Allow spaces inside WEAO exploit names when parsing autocomplete triggers, and avoid prematurely switching to `exploit_field` mode when the WEAO exploit list hasn't finished loading yet.
  ```

---

### M-15: `tree.ts` `insertComponent()` Silently Promotes Orphaned Child Buttons/Selects to Root
- **File & Symbol:** `client/src/utils/tree.ts` (`insertComponent`)
- **Root Cause & Impact:** If `parentId` is not found in the tree, `insertComponent` falls back to pushing the child button/select onto the root array—creating an invalid top-level Discord component.
- **Best Fix:** When `parentId` is provided but not found, return the tree unchanged (and log a dev warning) instead of promoting child-only components to root.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-15 in `client/src/utils/tree.ts` (`insertComponent`):
  If `parentId` is specified and cannot be found in the component tree, return the tree unchanged instead of silently appending child-only components (buttons/selects) to the root array.
  ```

---

### M-16: `api/client.ts` Hardcoded `"port 3001"` Error in Prod, Unencoded URL Path Params, & Circular Import with `globalStore.ts`
- **File & Symbol:** `client/src/api/client.ts`
- **Root Cause & Impact:** Network error messages tell production users on Render to "check port 3001"; path parameters aren't wrapped in `encodeURIComponent`; `api/client.ts` and `globalStore.ts` have a circular import.
- **Best Fix:** Use environment-aware error text (only mention `port 3001` in `import.meta.env.DEV`), wrap all dynamic path params in `encodeURIComponent`, and break the circular import via a lightweight registered handler/callback.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-16 in `client/src/api/client.ts` (and `client/src/store/globalStore.ts` if needed):
  1. Only mention "port 3001" in network error messages when `import.meta.env.DEV` is true; show a clean generic server-unreachable message in production.
  2. Wrap all interpolated URL path parameters in `encodeURIComponent(...)`.
  3. Break the circular import between `api/client.ts` and `globalStore.ts` using a small callback setter (e.g. `registerUnauthorizedHandler`).
  ```

---

### M-17: `discordCacheStore.ts` Has No Cache TTL/Invalidation/Logout Clear & Swallows Fetch Errors; `weaoExploits` LocalStorage Lacks Timestamp
- **File & Symbol:** `client/src/store/discordCacheStore.ts`
- **Root Cause & Impact:** Guilds/channels/roles stay cached forever (never refreshing on new channels/roles and leaking across user logout/login), fetch errors are silently swallowed, and `weaoExploits` in `localStorage` has no TTL timestamp.
- **Best Fix:** Store `fetchedAt` timestamps with a reasonable TTL (e.g. 5 min for channels/roles, 15 min for WEAO), expose `clearCache()` called on logout, and surface/store fetch error state instead of swallowing silently.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-17 in `client/src/store/discordCacheStore.ts`:
  1. Add TTL timestamps (e.g. 5 minutes for guild channels/roles/emojis and 15 minutes for `weaoExploits` in `localStorage`) so stale caches refresh automatically.
  2. Add a `clearCache()` action (to be called on logout) and record fetch errors instead of swallowing them silently.
  ```

---

### M-18: `globalStore.ts` `logout()` Leaks `botIdentity`/Caches & `syncServerTime()` Bypasses `BASE_URL` and Can Set `NaN` Offset
- **File & Symbol:** `client/src/store/globalStore.ts`
- **Root Cause & Impact:** `logout()` leaves `botIdentity` and `discordCacheStore` populated; `syncServerTime()` fetches `/api/health` directly without `BASE_URL` and can compute `NaN` if the header/timestamp is missing.
- **Best Fix:** Clear `botIdentity` and call `useDiscordCacheStore.getState().clearCache()` in `logout()`; use `BASE_URL` in `syncServerTime()` and only update `serverTimeOffset` when `Number.isFinite(offset)`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-18 in `client/src/store/globalStore.ts`:
  1. In `logout()`, reset `botIdentity` to `null` and clear `discordCacheStore`.
  2. In `syncServerTime()`, use the shared API `BASE_URL` and guard `serverTimeOffset` with `Number.isFinite(offset)` so missing/malformed timestamps never set `NaN`.
  ```

---

### M-19: `templateStore.ts` & `useTemplates.ts` Leave Stale `currentName`/`dirty` on Delete & Have Unguarded `fetchTemplates` Race
- **File & Symbol:** `client/src/store/templateStore.ts`, `client/src/hooks/useTemplates.ts`
- **Root Cause & Impact:** Deleting the currently open template leaves `currentName` and `isDirty` stale; concurrent `fetchTemplates` calls on mount can resolve out of order.
- **Best Fix:** Clear `currentName`/active template metadata when the deleted template matches the active one, and guard `fetchTemplates` with a monotonic request ID (or `AbortController`).
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-19 in `client/src/store/templateStore.ts` and `client/src/hooks/useTemplates.ts`:
  1. When deleting the currently active template, clear `currentName` / active template ID cleanly.
  2. Guard `fetchTemplates` with a request sequence counter or `AbortController` so out-of-order responses cannot overwrite newer state.
  ```

---

### M-20: `.svg` OG/Twitter Banner Won't Render in Discord/X + `seo.ts` Stale `twitter:*` + `App.tsx` Wipes Query Params & Fetches `/api/auth/me` on Public Routes
- **File & Symbol:** `client/index.html`, `client/src/utils/seo.ts`, `client/src/App.tsx`
- **Root Cause & Impact:** Discord and X **do not render `.svg` Open Graph images** (this is why the embed preview banner is blank on `https://hoho-manager.onrender.com/`!). Additionally, `seo.ts` updates `og:*` tags without updating `twitter:*`, and `App.tsx` strips unrelated query params and calls `/api/auth/me` even on public routes like `/privacy` and `/docs`.
- **Best Fix:** Point `og:image` and `twitter:image` in `index.html` and `seo.ts` to a real raster PNG (`1200x630`, e.g. `/og-banner.png` with `og:image:type="image/png"`, `og:image:width="1200"`, `og:image:height="630"`), update both `og:*` and `twitter:*` in `seo.ts`, preserve unrelated URL query params in `App.tsx`, and skip `/api/auth/me` on public-only routes if not needed.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-20 in `client/index.html`, `client/src/utils/seo.ts`, and `client/src/App.tsx`:
  1. Replace the `.svg` `og:image` / `twitter:image` URLs with a raster PNG path (e.g. `https://hoho-manager.onrender.com/og-banner.png`) and include `og:image:type="image/png"`, `og:image:width="1200"`, `og:image:height="630"` (Discord does not render SVG OG images).
  2. In `seo.ts`, update `twitter:title`, `twitter:description`, and `twitter:image` alongside `og:*` tags.
  3. In `App.tsx`, only delete the specific query params handled by the app (e.g. `data`, `error`) instead of wiping the entire query string, and avoid unnecessary `/api/auth/me` calls on purely static public pages if not required for nav state.
  ```

---

### M-21: Async Race Conditions / Missing Cancellation Across 5 UI Components
- **File & Symbol:** `client/src/components/editor/MentionInput/index.tsx`, `RichPicker.tsx`, `BotDispatchModal.tsx`, `BackupsModal.tsx`, `ScheduledMessageModal.tsx`
- **Root Cause & Impact:** Switching guilds/channels or closing modals while async fetches are in-flight allows stale responses to overwrite newer state or call `setState` on unmounted/closed views.
- **Best Fix:** Add a `let cancelled = false` cleanup flag (or `AbortController`) to every async `useEffect` in these 5 components.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-21 across `MentionInput/index.tsx`, `RichPicker.tsx`, `BotDispatchModal.tsx`, `BackupsModal.tsx`, and `ScheduledMessageModal.tsx`:
  Add cancellation guards (`let cancelled = false; ... return () => { cancelled = true; };` or `AbortController`) to every async `useEffect` fetch so stale guild/channel/message responses can never overwrite newer selections.
  ```

---

### M-22: `BotDispatchModal.tsx` Fetches Messages While Closed & Leaks 2s Auto-Close `setTimeout`
- **File & Symbol:** `client/src/components/modals/BotDispatchModal.tsx`
- **Root Cause & Impact:** Because the modal is always mounted, its effect fetches recent channel messages even when `isOpen === false`, and its 2-second auto-close `setTimeout` isn't cleared on unmount/re-open.
- **Best Fix:** Early-return `if (!isOpen) return;` at the top of the fetch `useEffect`, and store/clear the auto-close timer in a `useRef` on unmount or re-open.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-22 in `client/src/components/modals/BotDispatchModal.tsx`:
  1. Guard the channel-messages fetch `useEffect` with `if (!isOpen) return;` so it never fetches while the modal is closed.
  2. Store the 2-second auto-close `setTimeout` ID in a ref and clear it on unmount or when the modal re-opens.
  ```

---

### M-23: `PropertyPanel.tsx` Global `Escape` Listener Wipes Inspector Selection When Dismissing Popovers/Modals
- **File & Symbol:** `client/src/components/layout/PropertyPanel.tsx`
- **Root Cause & Impact:** Pressing `Escape` to close an emoji picker, dropdown, or modal also triggers `PropertyPanel`'s global `keydown` listener and clears the selected component in the inspector.
- **Best Fix:** Ignore `Escape` in `PropertyPanel` if `e.defaultPrevented` is true, if focus is inside an open `[role="dialog"]` / `[role="listbox"]` / popover, or if any app modal is open.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-23 in `client/src/components/layout/PropertyPanel.tsx`:
  In the global `Escape` keydown listener, bail out if `e.defaultPrevented` is true or if the active element / DOM currently has an open modal, dialog, or popover (`document.querySelector('[role="dialog"], [data-popover-open="true"]')`), so dismissing a popup doesn't wipe the inspector selection.
  ```

---

### M-24: `StepList.tsx` Calls `Date.now()` During Render & Renders Duplicate `Field Label` + `Display Label` Inputs
- **File & Symbol:** `client/src/components/actions/StepList.tsx` (`modalFieldFromComponent`)
- **Root Cause & Impact:** Calling `Date.now()` inside render produces unstable keys/IDs on every re-render (breaking React reconciliation and input focus), and modal fields render two confusingly redundant label inputs (`Field Label` and `Display Label`).
- **Best Fix:** Derive deterministic fallback IDs from index/custom_id (never `Date.now()` during render; generate random IDs only in click/add event handlers), and consolidate the duplicate label input into a single clear `Label` field.
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-24 in `client/src/components/actions/StepList.tsx`:
  1. Remove `Date.now()` from `modalFieldFromComponent` during render—use a deterministic fallback ID (or generate stable IDs only inside event handlers when adding a field).
  2. Remove the duplicate `Field Label` / `Display Label` input so each modal field has one clean, authoritative label input.
  ```

---

### M-25: `AttachmentPreviewItem` (`MessagePreview.tsx`) & `PollSection.tsx` Ignore External Prop Updates
- **File & Symbol:** `client/src/components/preview/MessagePreview.tsx` (`AttachmentPreviewItem`), `client/src/components/editor/PollSection.tsx`
- **Root Cause & Impact:** Local state initialized from `file.spoiler` or `poll` props never syncs when props change externally (e.g., Undo/Redo, template load, or toggling spoiler in the editor).
- **Best Fix:** Sync local reveal/UI state via `useEffect` when `file.spoiler` / `poll` props change (or derive directly from props where local state isn't needed).
- **ChatGPT Fix Prompt:**
  ```text
  Fix M-25 in `client/src/components/preview/MessagePreview.tsx` (`AttachmentPreviewItem`) and `client/src/components/editor/PollSection.tsx`:
  Sync local component state with external prop changes (`file.spoiler`, `poll`) via `useEffect`—or derive directly from props—so Undo/Redo, template loads, and editor toggles immediately reflect in the preview and poll editor.
  ```

---

# BATCH 5 — LOW PRIORITY ISSUES (9)

### L-01: Duplicate `LoggingConfig` & Loose `ComponentNode` Types in `shared/src/types.ts`
- **File & Symbol:** `shared/src/types.ts`
- **Root Cause & Impact:** `LoggingConfig` is declared twice; `ComponentNode.type` is typed as `number` instead of `ComponentTypeValue` and omits valid Discord fields (`spoiler`, `channel_types`, `default_values`, `description`).
- **Best Fix:** Deduplicate `LoggingConfig` and tighten `ComponentNode` with `ComponentTypeValue` and the missing optional fields.
- **ChatGPT Fix Prompt:**
  ```text
  Fix L-01 in `shared/src/types.ts`:
  Remove the duplicate `LoggingConfig` interface declaration, type `ComponentNode.type` as `ComponentTypeValue`, and add optional `spoiler?: boolean`, `channel_types?: number[]`, `default_values?: unknown[]`, and `description?: string` fields.
  ```

---

### L-02: Acceptance Check `8.4.2` Only Checks JSDoc Comments
- **File & Symbol:** `scripts/verify-acceptance.ts`
- **Root Cause & Impact:** Check `8.4.2` tests `.includes("100") && .includes("action:")` on `shared/src/customId.ts`, which passes purely because of JSDoc comments even if the runtime guard is broken.
- **Best Fix:** Import and execute `buildCustomId` / `parseCustomId` directly in `verify-acceptance.ts` to test the 100-char limit and round-trip behavior.
- **ChatGPT Fix Prompt:**
  ```text
  Fix L-02 in `scripts/verify-acceptance.ts`:
  Update check `8.4.2` to actually test `buildCustomId` and `parseCustomId` runtime behavior (100-char enforcement and round-trip parsing) rather than substring-matching JSDoc comments.
  ```

---

### L-03: `gracefulShutdown` Closes DB While Background Ticks May Be In-Flight
- **File & Symbol:** `server/src/index.ts` (`gracefulShutdown`)
- **Root Cause & Impact:** Closing the DB immediately on `SIGTERM` while an automation or tracker tick is mid-query can abort an active transaction.
- **Best Fix:** Stop intervals first, await any in-flight tick promise (with a short 3s cap), close the HTTP server, and close the DB last.
- **ChatGPT Fix Prompt:**
  ```text
  Fix L-03 in `server/src/index.ts`:
  In `gracefulShutdown`, clear background intervals first, wait briefly for any in-flight automation/tracker tick to settle (max ~3s), close the HTTP server, and close the Turso/DB client last.
  ```

---

### L-04: `DocsPage.tsx` Truncated Sentence & Contradictory Custom Executor JSON + Full-Page Reload Links
- **File & Symbol:** `client/src/pages/DocsPage.tsx`, `PrivacyPage.tsx`, `NotFoundPage.tsx`
- **Root Cause & Impact:** `DocsPage` has a truncated sentence and a Custom Executor JSON example that contradicts the documented schema; footer/404 links use raw `<a href>` causing full SPA page reloads.
- **Best Fix:** Fix the copy and JSON example in `DocsPage.tsx` and use React Router `<Link to="...">` for internal routes in `DocsPage`, `PrivacyPage`, and `NotFoundPage`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix L-04 in `client/src/pages/DocsPage.tsx`, `PrivacyPage.tsx`, and `NotFoundPage.tsx`:
  1. Fix the truncated sentence and align the Custom Executor JSON example with the actual schema in `DocsPage.tsx`.
  2. Replace raw `<a href="/...">` internal navigation links in `DocsPage`, `PrivacyPage`, and `NotFoundPage` with React Router `<Link to="...">` to avoid full page reloads.
  ```

---

### L-05: `globals.css` Conflicting `@theme` vs `:root` Tokens, `overflow-x: hidden` vs `clip`, & Dead CSS
- **File & Symbol:** `client/src/styles/globals.css`
- **Root Cause & Impact:** Conflicting token definitions between `@theme` and `:root`, `overflow-x: hidden` (which breaks `position: sticky`—use `overflow-x: clip` instead), and dead `data-base-ui-portal` / unused light-theme rules bloat the stylesheet.
- **Best Fix:** Reconcile `@theme` and `:root` tokens without altering any current dark Studio colors, switch `overflow-x: hidden` to `overflow-x: clip`, and remove dead `data-base-ui-portal` rules.
- **ChatGPT Fix Prompt:**
  ```text
  Fix L-05 in `client/src/styles/globals.css`:
  Reconcile conflicting `@theme` vs `:root` token definitions without changing the current rendered dark Studio palette, replace `overflow-x: hidden` on root containers with `overflow-x: clip` (so `position: sticky` works properly), and remove dead `data-base-ui-portal` / unused light-theme CSS blocks.
  ```

---

### L-06: Redundant Google Fonts `rel="preload"` in `client/index.html`
- **File & Symbol:** `client/index.html`
- **Root Cause & Impact:** Preloading the Google Fonts CSS stylesheet alongside the `<link rel="stylesheet">` triggers duplicate/warning fetches in browsers without improving LCP.
- **Best Fix:** Keep `<link rel="preconnect">` + `<link rel="stylesheet">` and remove the redundant `rel="preload"` tag for the Google Fonts stylesheet.
- **ChatGPT Fix Prompt:**
  ```text
  Fix L-06 in `client/index.html`:
  Remove the redundant `<link rel="preload" as="style">` for Google Fonts while keeping `preconnect` and the standard `<link rel="stylesheet">`.
  ```

---

### L-07: Uncleaned Timers/RAF & Unawaited Clipboard Promise
- **File & Symbol:** `client/src/components/layout/Header.tsx`, `client/src/components/shared/EmojiPickerField.tsx`, `client/src/components/editor/MentionInput/index.tsx`
- **Root Cause & Impact:** Minor timer/RAF leaks on unmount and an unawaited `navigator.clipboard.writeText` that can emit an unhandled rejection if clipboard permissions are denied.
- **Best Fix:** Clean up timers/RAF in `useEffect` cleanups and wrap `navigator.clipboard.writeText` in `try/catch` (or `.catch(...)`).
- **ChatGPT Fix Prompt:**
  ```text
  Fix L-07 in `Header.tsx`, `EmojiPickerField.tsx`, and `MentionInput/index.tsx`:
  Clear any `setTimeout`/`requestAnimationFrame` handles on unmount and wrap `navigator.clipboard.writeText(...)` with `.catch(...)` / `try-catch` error handling.
  ```

---

### L-08: `BackupsModal.tsx` Runs `toQueryData` + `JSON.stringify` on Every Editor Keystroke While Closed
- **File & Symbol:** `client/src/components/modals/BackupsModal.tsx`
- **Root Cause & Impact:** Because `BackupsModal` stays mounted, computing `toQueryData` + `JSON.stringify` unconditionally runs on every single keystroke in the editor even when the modal is closed.
- **Best Fix:** Skip computing the serialized backup preview/size whenever `!isOpen`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix L-08 in `client/src/components/modals/BackupsModal.tsx`:
  Short-circuit the `toQueryData` + `JSON.stringify` computation when `!isOpen` so it does not run on every editor keystroke while the modal is closed.
  ```

---

### L-09: `SortableList.tsx` Injects Duplicate `<style>` per List & Unmemoized Context Value
- **File & Symbol:** `client/src/components/shared/SortableList.tsx`
- **Root Cause & Impact:** Every mounted `SortableList` injects its own identical `<style>` tag into the DOM and passes a fresh inline object to Context on every render, triggering unnecessary child re-renders.
- **Best Fix:** Move the static drag CSS into `globals.css` (once) and wrap the Context `value` in `useMemo`.
- **ChatGPT Fix Prompt:**
  ```text
  Fix L-09 in `client/src/components/shared/SortableList.tsx`:
  Move the static inline `<style>` rules into `client/src/styles/globals.css` (so they aren't duplicated per list instance) and memoize the Context provider `value` with `useMemo`. Keep all drag/minimize animations identical.
  ```
