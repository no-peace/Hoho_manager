# HoHo Manager — V16 Master Plan: Auto-Minimizing Drag-and-Drop & Pro Studio Features

**Target Repository:** `no-peace/Hoho_manager` (`main` branch, post-V15)  
**Hosting & Performance Guardrails:** Render Free (`0.1 CPU`, `512 MB RAM`) + Turso Free (minimize row reads/writes with in-memory empty-table caches and zero per-message DB writes).  
**Strict Execution Rules for ChatGPT:**
- **Do NOT alter the existing UI design system, color palette, or layout.** Every new control must strictly reuse the existing Studio tokens (`#0B0D12`, `#10131A`, `#161A23`, `#1D2230`, `#272D3A`, `#5865F2`, `#818CF8`, `#F1F3F9`, `#A1A8B8`) and authentic Discord preview surfaces (`#313338`, `#2b2d31`, `#1e1f22`).
- **Do NOT run `npm` checks or rely on GitHub Actions** (Actions are intentionally disabled; the owner will `git pull` and run `npm install`, `npm run typecheck`, `npm test`, and `npm run build` locally).
- **Keep `lenis` (`client/src/utils/editorSmoothScroll.ts`) untouched.**
- **Zero lag / zero bloat:** Lazy-load heavy panels (`React.lazy`), keep Zustand selectors narrow, avoid unmounting form inputs during drag-and-drop, and bound all in-memory caches/history stacks.

---

## Batch 1 — Fix Drag-and-Drop on Desktop & Mobile (Zero-Squish + Auto-Minimize During Drag)

### Root Causes Fixed
1. **Squished/stretched cards:** `SortableItem` currently uses `CSS.Transform.toString(sortable.transform)` + Tailwind `transition-transform`. When dragging a tall card over a shorter card, `scaleY` squashes text and controls, and `transition-transform` makes the actively dragged card lag behind the pointer.
2. **Tall cards stay expanded while dragging:** On both PC and mobile, dragging a full-height Message, Container, Text, Embed, or Flow Step card makes reordering clumsy and hard to aim.

### Changes
1. **`client/src/components/ui/SortableList.tsx`**
   - **Switch to `CSS.Translate.toString(sortable.transform)`** and pass **`transition: sortable.transition`** directly in `style` (remove Tailwind `transition-transform`, keep `motion-reduce:!transition-none`). Zero stretching, 60fps pointer tracking.
   - **Add a lightweight vertical-axis lock modifier** (inline 3-line function, zero extra npm dependency): when `strategy === "vertical"`, pass `modifiers={[restrictToVerticalAxis]}` where `const restrictToVerticalAxis = ({ transform }) => ({ ...transform, x: 0 });`.
   - **Add list-scoped `isDraggingAny` + `activeDragId` context** (`useSortableListState()`):
     - Track `activeId: string | null` inside `SortableList` via `onDragStart`, `onDragEnd`, and `onDragCancel`.
     - Pass `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}` to `DndContext` so `@dnd-kit` immediately recalculates drop targets when sibling cards collapse.
     - Accept an optional `renderOverlay?: (activeId: string) => React.ReactNode` prop and render `<DragOverlay dropAnimation={null}>` (or crisp 150ms drop animation respecting `prefers-reduced-motion`) showing a sleek **44px compact summary pill** for the dragged card while the original slot renders as a clean dashed drop placeholder (`opacity-35 border-dashed border-[#818CF8]/60`).
   - **Expose `useIsListDragging()` hook:** Returns `boolean` (`activeId !== null`) scoped strictly to that `SortableList` instance.

2. **Auto-Minimize Dragged & Surrounding Cards Without Unmounting State**
   - In every vertical sortable card editor, read `const isListDragging = useIsListDragging();`:
     - **`client/src/components/editor/MessageEditor/index.tsx`**: When `isListDragging` is `true`, hide the message body using CSS (`className={isListDragging ? "hidden" : "..."}`) so **both the dragged message and every sibling message** instantly collapse to their compact header bar (`Message #N`, mode badge, grip handle). The moment you drop or press Escape (`isListDragging` flips back to `false`), every message immediately restores to its exact previous `isOpen` state with zero state loss and zero input remount lag!
     - **`client/src/components/editor/MessageEditor/ComponentsTab.tsx`**: Collapse V2 component card bodies (`TextDisplay`, `Container`, `Section`, `MediaGallery`, `File`, `Separator`, and nested Container children) via `hidden` class whenever their owning `SortableList` has `isListDragging === true`, leaving a crisp 40px header row (type icon + title + 1-line text snippet).
     - **`client/src/components/editor/DiscohookComponentsEditor.tsx`**: Collapse Action Row body when the parent row list is dragging (`isListDragging`), while keeping button pills (`strategy="grid"`) inline since they are already compact.
     - **`client/src/components/editor/EmbedEditor.tsx`**: Collapse Embed body when the Embeds list is dragging, and collapse Embed Field bodies when the Fields list is dragging.
     - **`client/src/components/actions/StepList.tsx`**: Collapse Flow Step field bodies (`renderFields`) when the StepList is dragging so multi-step flows and `Then`/`Else` branches shrink to crisp 1-line `#1 · Add Role` bars while reordering.
     - **`client/src/components/editor/ComponentForms.tsx` (`StringSelectForm`)**: Collapse Select Option input grids while dragging options.
   - Pass compact `renderOverlay` labels on each vertical `SortableList` so the floating dragged pill is crisp, fast, and never covers the whole screen.

---

## Batch 2 — Undo / Redo History & One-Click V2 Starter Blueprints

### 2.1 Fast Bounded Undo / Redo (`client/src/store/messageStore.ts` + `Header.tsx`)
- Add a lightweight, bounded history stack inside `useMessageStore` (non-persisted in `localStorage` so storage stays tiny):
  - `past: Array<{ messages: MessageData[]; activeMessageIndex: number }>` (max **40** entries)
  - `future: Array<{ messages: MessageData[]; activeMessageIndex: number }>`
  - `canUndo: boolean`, `canRedo: boolean`, `undo(): void`, `redo(): void`.
- Coalesce rapid text typing into a single history entry (e.g., if the last snapshot was pushed `< 600ms` ago for the same edit action, replace the tip instead of spamming 50 snapshots per sentence). Always push a clean snapshot before destructive/structural actions (delete, duplicate, reorder, add component/embed/message, mode conversion, blueprint insert).
- Wire global keyboard shortcuts in `StudioLayout.tsx`: `Ctrl+Z` / `Cmd+Z` for Undo and `Ctrl+Shift+Z` / `Cmd+Shift+Z` / `Ctrl+Y` for Redo (skipping when focus is inside an `<input>` or `<textarea>` so native text undo still works naturally inside fields).
- Add compact `Undo2` / `Redo2` icon buttons in `Header.tsx` (disabled when stack is empty, subtle and aligned with existing toolbar icons so the header stays clean on desktop and mobile).

### 2.2 One-Click Components V2 Starter Blueprints
- Create `client/src/utils/starterBlueprints.ts` with 5 clean, Discord-valid Components V2 blueprints (all fresh `_id`s via `uid()`, zero external dependencies):
  1. **Verification Gate** (Container + Title/Rules Text + Separator + Success `Verify` Button with pre-wired `add_role` + `send_ephemeral_reply` flow)
  2. **Self-Role Panel** (Container + Header + String Select Menu with 3 sample role options)
  3. **Support / Application Launcher** (Container + Info Section + Primary `Open Form` Button with pre-wired `open_modal` flow)
  4. **Release Changelog Card** (Container with Blurple accent + Version header + Highlights text + Link button)
  5. **Live Status Board** (Container with Green accent + WEAO / dynamic timestamp placeholders `<t:...:R>`)
- Inside `StudioLayout.tsx`'s existing `CultMorphSurface` ("Add Message" chooser), add a compact **"Start from a V2 Blueprint"** list below Classic / V2 so staff can insert a ready-to-edit message in one click without changing the Studio layout.

---

## Batch 3 — Pre-Flight Discord Payload Linter

### Goal
Catch Discord API rejections **before** clicking Dispatch, with zero network calls and zero lag.

### Changes
1. **Create `client/src/utils/payloadLinter.ts`**
   - Pure, synchronous validator returning `LintIssue[]` (`{ severity: "error" | "warning"; messageIndex: number; componentId?: string; message: string }`) checking:
     - Components V2 total components `> 40` or total text characters `> 4000`.
     - Classic message content `> 2000` chars or embed total `> 6000` chars.
     - Duplicate `custom_id` values across interactive components in the same message (Discord rejects duplicate custom IDs!).
     - Missing `url` on `ButtonStyle.Link` buttons or non-HTTP(S) URLs.
     - Broken `attachment://<filename>` references in embeds, media galleries, thumbnails, or files that don't match any currently attached file.
     - Empty Select Menu (`StringSelect` with `0` options) or `min_values > max_values` / `max_values > options.length`.
     - Empty message (no content, embeds, components, attachments, or poll).
2. **Surface cleanly in `BotDispatchModal.tsx`**
   - Compute `lintIssues` via `useMemo` only when the modal is open.
   - Show a compact, recessed status banner above the Send button: green `Ready to dispatch` when 0 errors, or an expandable list of clickable errors/warnings (clicking an issue jumps directly to that message/component). Block Send on hard Discord API `error`s; allow Send on `warning`s.

---

## Batch 4 — Interactive Flow Simulator ("Test Flow" Sandbox in Live Preview)

### Goal
Let staff test multi-step button/select flows (role checks, modals, ephemeral replies, DMs, variables) directly inside Live Preview without sending a real message to Discord.

### Changes
1. **Create `client/src/utils/flowSimulator.ts`**
   - Pure client-side dry-run engine that walks `FlowStep[]` (including nested `check` `then`/`else` branches and `open_modal` `then` branches) against a lightweight simulated context:
     - Mock clicker username/ID, simulated held role IDs (selectable from the current guild's cached roles!), and mock modal submission inputs.
     - Interpolates `{user.*}`, `{server.*}`, and `{modal.*}` variables locally.
     - Returns a structured trace: `Array<{ stepIndex: number; type: string; status: "executed" | "branch_then" | "branch_else" | "stopped" | "modal"; summary: string; previewMessage?: { kind: "ephemeral" | "dm" | "channel"; content: string } }>`.
2. **Wire a clean "Test Flow" toggle into `client/src/components/preview/MessagePreview.tsx`**
   - Add a single compact toggle pill (`Play` icon + `Test Flow`) in the existing `LIVE PREVIEW` toolbar beside the `#1 #2` message switcher.
   - **When OFF (default):** Existing V15 behavior is 100% preserved (clicking a button opens its config in the Inspector).
   - **When ON:**
     - Clicking any preview Button or selecting an option in a preview Select runs `simulateFlow()` and renders a sleek, authentic Discord-style **Ephemeral Simulation Drawer** at the bottom of the preview (with a quick "Simulated Roles" toggle chip, simulated Modal popup if the flow includes `open_modal`, and the step-by-step execution trace).
     - Lazy-load the simulator overlay component (`React.lazy`) so initial bundle size stays untouched.

---

## Batch 5 — 2026 Rich Discord Modal Components (`open_modal`)

Reference: [Discord Developer Change Log](https://docs.discord.com/developers/change-log) & [Discord Component Reference](https://docs.discord.com/developers/components/reference) (Modals now support `Label` type `18`, `StringSelect` `3`, `UserSelect` `5`, `RoleSelect` `6`, `MentionableSelect` `7`, `ChannelSelect` `8`, `TextDisplay` `10`, `FileUpload` `19`, `RadioGroup` `21`, `CheckboxGroup` `22`, and `Checkbox` `23`, alongside legacy `TextInput` `4`).

### Changes
1. **`shared/src/constants.ts` & `shared/src/types.ts`**
   - Add Discord's official modal component type constants (`Label = 18`, `FileUpload = 19`, `RadioGroup = 21`, `CheckboxGroup = 22`, `Checkbox = 23`) if not already exported by `discord-api-types`.
   - Extend modal field configuration types to support:
     - `text_input` (Short / Paragraph)
     - `string_select`, `user_select`, `role_select`, `channel_select`, `mentionable_select`
     - `radio_group` (options with label/value/description)
     - `checkbox_group` (options with min/max)
     - `checkbox` (single boolean toggle)
     - `file_upload` (`min_values`, `max_values` 0–10, `required`)
     - `text_display` (read-only helper instructions inside the modal)
2. **`client/src/components/actions/StepList.tsx`**
   - Upgrade the `open_modal` step editor and `DiscordModalPreview`:
     - Keep 100% backward compatibility when parsing existing legacy ActionRow-wrapped `TextInput` modals.
     - Add a clean **Field Type** selector per modal field (up to 5 top-level modal components) with type-specific inputs (options list for Select/Radio/CheckboxGroup, min/max files for File Upload, content for Text Display) and wrap non-TextDisplay interactive inputs in Discord's `Label` (`type: 18`) component when serializing.
     - Update `DiscordModalPreview` to accurately preview each new component type.
3. **`server/src/actions/openModal.ts` & `server/src/services/interactionHandler.ts`**
   - Pass through the new `Label` / `TextDisplay` / `FileUpload` / `RadioGroup` / `CheckboxGroup` / `Checkbox` / Select modal components cleanly to Discord's `MODAL` callback (`type: 9`).
   - When handling `MODAL_SUBMIT`, extract submitted values from both legacy `ActionRow -> TextInput` and new `Label -> component` payloads (mapping `custom_id` → string/comma-joined values/uploaded attachment URLs) into `{modal.<custom_id>}` variables for the modal's `then` flow!

---

## Batch 6 — Auto-Crosspost (Publish), Expiring Messages & Sticky Messages

Reference: [Discord API Discussion #7990](https://github.com/discord/discord-api-docs/discussions/7990) & [OmniFire Announcement Guide](https://www.omnifire.app/blog/schedule-discord-messages/).

### Changes
1. **Database Migration (`server/src/config/migrations.ts`)**
   - Add migration `020_automation_features` creating:
     - `scheduled_messages` (`id`, `guild_id`, `channel_id`, `thread_id`, `template_id`, `target_message_id`, `payload_json`, `cron_expr`, `run_at`, `timezone`, `enabled`, `last_run_at`, `next_run_at`, `created_by`, `created_at`)
     - `expiring_messages` (`id`, `guild_id`, `channel_id`, `message_id`, `delete_at`, `created_by`, `created_at`)
     - `sticky_messages` (`id`, `guild_id`, `channel_id`, `current_message_id`, `payload_json`, `interval_messages`, `enabled`, `created_by`, `created_at`)
2. **Auto-Crosspost (Publish) (`server/src/services/discordService.ts` + `server/src/routes/send.ts` + `BotDispatchModal.tsx`)**
   - Add `crosspostMessage(channelId, messageId)` calling `POST /channels/{channelId}/messages/{messageId}/crosspost` (fail-soft: if the channel is not an Announcement channel or lacks permission, return a warning without failing the send).
   - Add an optional `Auto-publish (Announcement channel)` checkbox in `BotDispatchModal.tsx`.
3. **Auto-Delete / Expiring Messages (`server/src/repositories/expiringMessageRepository.ts` + `server/src/services/automationService.ts`)**
   - Add optional `Auto-delete after` selector in `BotDispatchModal.tsx` (`Never`, `1 hour`, `6 hours`, `24 hours`, `3 days`, `7 days`).
   - Persist due deletions in `expiring_messages` with an **in-memory `nextDeleteAt` / empty-table cache** so the background sweep does **0 Turso reads** when no expiring messages exist!
4. **Sticky Messages (`server/src/repositories/stickyMessageRepository.ts` + `server/src/routes/automation.ts` + `bot/src/listeners/stickyMessageListener.ts`)**
   - Add optional `Pin as Sticky Message (re-post every N messages)` toggle + interval (`5`–`50`, default `10`) in `BotDispatchModal.tsx`.
   - **Zero-DB-Spam Bot Design (Turso Free safe):** The bot caches active sticky `channelId -> { interval, count }` in memory (refreshed on startup and via webhook/API notify when created/deleted). On `messageCreate` (ignoring bots), increment the in-memory counter; only when `count >= interval` does it call `POST /api/automation/sticky/:channelId/refresh`, which deletes the previous sticky message and re-posts the payload!

---

## Batch 7 — Scheduled & Recurring Messages + Native Discord Polls

Reference: [Embed Generator Scheduled Messages](https://message.style/features/scheduled-messages), [Recurrr](https://recurrr.com/articles/send-recurring-messages-on-discord), & [Discord Message Resource (Polls)](https://docs.discord.com/developers/resources/message).

### 7.1 Native Discord Polls (Classic Mode)
- **`shared/src/types.ts` & `client/src/utils/discord.ts`**: Add optional `poll?: { question: { text: string }; answers: Array<{ answer_id?: number; poll_media: { text: string; emoji?: { name?: string; id?: string } } }>; duration: number; allow_multiselect: boolean; layout_type?: 1 }` to `MessageData`, serialized into `toDiscordPayload()` for Classic messages and validated (`1–10` answers, duration `1–168` hours).
- **`client/src/components/editor/MessageEditor/PollSection.tsx`**: Compact collapsible "Poll" accordion inside Classic `MessageEditor` (Question, draggable/addable Answers up to 10 with emoji, Duration selector, Allow multi-select checkbox).
- **`client/src/components/preview/PollPreview.tsx`**: Authentic Discord dark-mode Poll card rendered inside `MessagePreview.tsx`.

### 7.2 Scheduled & Recurring Messages
- **`server/src/routes/automation.ts` & `server/src/services/automationService.ts`**:
  - CRUD endpoints (`/api/automation/schedules`) protected by existing staff/guild/channel allowlist middleware.
  - Supports **one-off** (`runAt`), **recurring** (hourly, daily, weekly on chosen weekdays, or custom interval), and **in-place message editing** (if `targetMessageId` is set, edits that message on each run instead of posting a new one).
  - Runs on a single-flight 60s tick with an **in-memory `hasSchedules` / `nextDueAt` cache** (0 Turso reads when idle), plus an authenticated `POST /api/automation/tick` endpoint so the always-on bot process (or an external Render Free keep-alive cron) can trigger due schedules reliably even if Render Free sleeps!
- **`client/src/components/layout/BackupsModal.tsx`**:
  - Add a clean **Schedules** filter/tab inside the existing `BackupsModal` so users can schedule any saved template (or current message) to a channel/thread, pause/resume, or delete schedules without adding clutter to the top bar.

---

## Batch 8 — "Restore to HoHo Studio" Discord Context Menu & Live Message Import

Reference: [Discohook Restore to Studio](https://discohook.org/).

### Changes
1. **Server Live Message Fetch Endpoint (`server/src/routes/discord.ts`)**
   - Add `GET /api/discord/messages/:channelId/:messageId` (protected by existing staff auth + guild/channel permission checks).
   - Fetches the Discord message via `discordService`, converts its `content`, `embeds`, `components` (both Classic Action Rows and Components V2 trees, assigning fresh `_id`s), `flags`, and `poll` into `MessageData`, and returns it cleanly.
2. **Client Live Import (`client/src/components/editor/MessageEditor/MessageLinkModal.tsx` & `StudioLayout.tsx`)**
   - Inside `MessageLinkModal`, add a **"Fetch & Import into Studio"** button next to the Discord message link input that calls the new endpoint and loads the live message directly into the active editor card (with a Sileo toast confirmation).
   - Support `?importChannel=<id>&importMessage=<id>` query params on Studio load so clicking a deep link from Discord automatically fetches and opens that message in the editor (and cleans the URL via `history.replaceState`).
3. **Bot Message Context Menu (`bot/src/commands/restoreToStudio.ts`)**
   - Register a Discord **Message Context Menu** command (`Edit in HoHo Studio`), gated by `BOT_COMMAND_ADMIN_IDS` / `OWNER_DISCORD_IDS`.
   - Replies ephemerally with a button/link pointing to `${CLIENT_ORIGIN}/?importChannel=<channelId>&importMessage=<messageId>`.

---

## Batch 9 — Regression Tests & Handoff Update

1. **Client Tests**:
   - `client/src/components/ui/__tests__/SortableList.test.tsx` (verifies `CSS.Translate` usage, `isListDragging` auto-minimize state toggle, and no `scaleY` distortion).
   - `client/src/store/__tests__/messageStoreHistory.test.ts` (undo/redo stack, 40-entry cap, typing coalescing).
   - `client/src/utils/__tests__/payloadLinter.test.ts` (duplicate `custom_id`, >40 V2 components, broken `attachment://`, empty select).
   - `client/src/utils/__tests__/flowSimulator.test.ts` (role check pass/fail branches, modal variable interpolation, ephemeral/DM trace).
   - `client/src/utils/__tests__/discord.test.ts` (add native Poll payload serialization & validation cases).
2. **Server Tests**:
   - `server/tests/automationService.test.ts` (empty-table zero-read guard, expiring message deletion, sticky refresh, scheduled one-off/recurring & in-place edit).
   - `server/tests/modalV2.test.ts` (2026 `Label` / `FileUpload` / `RadioGroup` / `CheckboxGroup` / Select modal submission extraction into `{modal.*}` variables).
3. **`docs/GEMINI_HANDOFF_CURRENT.md`**:
   - Update the top authoritative snapshot with all V16 commits, new migration `020_automation_features`, and local verification commands.
