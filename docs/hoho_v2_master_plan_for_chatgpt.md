# HoHo Manager — Master Bugfix, Database Cleanup & Motion/shadcn UI Redesign Plan (For ChatGPT Execution)

> **HOW TO USE THIS PLAN WITH CHATGPT (FREE ACCOUNT / CONTEXT LIMIT SAFE)**
> 1. Save this file into your ChatGPT Project folder (or upload it at the start of a chat).
> 2. Because ChatGPT Free has a strict message/context window limit, this plan is divided into **6 independent, self-contained Prompt Batches (`BATCH 1` to `BATCH 6`)**.
> 3. In each new ChatGPT chat, copy and paste the **"Session Starter Prompt"** at the top of that Batch along with the Batch section itself.
> 4. **Strict Rule for ChatGPT:** ChatGPT must ONLY output exact `File` / `Search` / `Replace` blocks and `Verification` commands—never partial pseudo-code, never `// ... existing code ...` placeholders, and never unrequested refactors.

---

## Global Guardrails for ChatGPT (Read Before Every Batch)

1. **Format Rule:** Every code change MUST be delivered as:
   - **File:** `exact/path/from/repo/root.ts`
   - **Search:** Exact verbatim lines from the current repository (commit `ad2f9eb`).
   - **Replace:** Complete replacement code with **zero** `// ...rest of code` or `TODO` placeholders.
   - **Verification:** Exact shell command (`npm run typecheck`, `npm test`, `npm run build`).
2. **Design & Component Standards ([shadcn/ui](https://ui.shadcn.com/) + `@minimalist-ui` + `@web-design-guidelines`):**
   - **BANNED Native OS Elements:** Never use browser-native `<input type="date">`, `<input type="datetime-local">`, `<select>`, or unstyled `<input type="checkbox">`. Always use custom React primitives (`DateTimePickerPopover`, custom `Checkbox`, custom `SelectPopover`).
   - **Surface & Border Discipline (`@minimalist-ui`):** Use crisp `1px solid` structural borders (`border-[#26282d]` / `border-[#1e1f22]`), flat bento surfaces (`bg-[#18191c]`, `bg-[#1e1f22]`, `bg-[#232428]`), `rounded-lg` (`8px`) or `rounded-xl` (`12px`) corners, `tabular-nums` on all counters/timestamps/calendars, and monospace (`font-mono`) on IDs, tags, and keyboard shortcuts (`<kbd>`). Do not use heavy neon gradients, `shadow-2xl` glow slop, or AI marketing copy.
3. **Animation & Motion Standards ([Motion](https://motion.dev/) + `@review-animations`):**
   - Use the `motion` package (`import { motion, AnimatePresence } from "motion/react"`).
   - **Sub-300ms UI:** All popovers, modals, tabs, and dropdowns must complete in `140ms–220ms` using strong ease-out curves (`cubic-bezier(0.16, 1, 0.3, 1)` or `[0.22, 1, 0.36, 1]`). **Never** use `ease-in` on UI entrances.
   - **Physical Origin & Scale:** Popovers, calendar pickers, and autocomplete menus must scale from their trigger (`transformOrigin: "top left"` / `"bottom right"`), starting at ` opacity: 0, scale: 0.96, y: -4 ` (NEVER `scale(0)`).
   - **GPU-Only Properties:** Animate `transform` (`x`, `y`, `scale`) and `opacity` only. Never animate `height`, `width`, `top`, `left`, `margin`, or `padding` (`transition: all` is strictly banned).
   - **Frequency & Accessibility:** High-frequency keyboard actions (typing in editor, arrow-key navigation in autocomplete) get **0ms** animation. Respect `prefers-reduced-motion` and gate hover transforms behind `@media (hover: hover) and (pointer: fine)`.

---

## BATCH 1 — Fix Dynamic Tracking in Turso DB (`{user.<ID>.*}`), Unified Tracking Model & Drop Legacy DB Tables

### Copy-Paste Session Starter Prompt for ChatGPT (Batch 1)
> "You are implementing **BATCH 1** of the HoHo Manager Master Plan. Follow the exact `File` / `Search` / `Replace` specifications below with zero placeholders. Output only the exact `Search` and `Replace` blocks for each file in Batch 1 and the verification commands."

### Root Causes Diagnosed (Why Tracking Didn't Save to Turso DB)
1. **Premature Interpolation in `server/src/routes/send.ts`**:
   - Inside `POST /api/send`, `const finalMessages = await Promise.all(messagesToProcess.map(processMessage));` runs `interpolateWeaoPlaceholders` and `resolveAuthorPlaceholders` **before** sending to Discord.
   - When `send.ts` later checks `const rawStr = JSON.stringify(msg);` on `msg = finalMessages[i]`, `{user.1347945399238918195.name}` has **already been replaced** by the resolved username (e.g. `"Hellkiller1008"`), so `rawStr.includes("{user.")` evaluates to `false`!
   - Even if triggered via `templateId` or `exploitName`, passing `rawPayload: msg` saved the *already-interpolated* static payload instead of the raw uninterpolated template (`messagesToProcess[i]`), so future profile changes could never re-interpolate `{user.<ID>.*}`.
2. **Hash Mismatch in `server/src/services/messageTrackerService.ts`**:
   - `trackMessage` hashed `rawPayload` (uninterpolated) instead of `resolvedPayload` (what was actually sent to Discord), causing either false edits or broken comparisons.
3. **Explicit "Track Message" Support Without Requiring a Saved Template**:
   - Users must be able to check **`[x] Track Message`** when sending/editing a message (or saving a backup) and optionally set an `expiresAt` retention date, storing everything cleanly without forcing a separate template if they only want to track an ad-hoc message.
4. **Useless Legacy Tables in Turso DB**:
   - `webhook_profiles` and `bot_profiles` are legacy tables from before Single-Bot-Only mode. (All other 13 tables—`users`, `templates`, `tracked_messages`, `custom_executors`, `staff_access`, `staff_cooldowns`, `settings`, `action_definitions`, `action_logs`, `flow_states`, `interaction_receipts`, `active_sessions`, `schema_migrations`—are active runtime tables).

### Step 1.1 — Add Migration `011_unified_tracking_and_drop_legacy_profiles`
- **File:** `server/src/config/migrations.ts`
- **Search:**
```ts
  {
    id: "010_template_retention",
    sql: `
      ALTER TABLE templates ADD COLUMN expires_at TEXT;
      CREATE INDEX IF NOT EXISTS idx_templates_expires_at
        ON templates(expires_at);
    `,
  },
];
```
- **Replace Specification:**
  Append migration `011_unified_tracking_and_drop_legacy_profiles`:
  ```ts
  {
    id: "011_unified_tracking_and_drop_legacy_profiles",
    sql: `
      ALTER TABLE templates ADD COLUMN is_tracked INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE tracked_messages ADD COLUMN name TEXT;
      ALTER TABLE tracked_messages ADD COLUMN expires_at TEXT;
      CREATE INDEX IF NOT EXISTS idx_tracked_messages_expires_at
        ON tracked_messages(expires_at);

      DROP INDEX IF EXISTS idx_webhooks_user;
      DROP INDEX IF EXISTS idx_bot_profiles_user;
      DROP TABLE IF EXISTS webhook_profiles;
      DROP TABLE IF EXISTS bot_profiles;
    `,
  },
  ```

### Step 1.2 — Update `trackedMessageRepository.ts` & `messageTrackerService.ts`
- **File:** `server/src/repositories/trackedMessageRepository.ts`
- **Search:**
```ts
export interface TrackedMessageRecord {
  id: number;
  channel_id: string;
  message_id: string;
  template_id: number | null;
  exploit_name: string | null;
  author_user_id: string | null;
  raw_payload: string | null;
  last_payload_hash: string;
  created_at: number;
  updated_at: number;
  last_checked_at: number;
}

export interface UpsertTrackedMessageInput {
  channel_id: string;
  message_id: string;
  template_id?: number | null;
  exploit_name?: string | null;
  author_user_id?: string | null;
  raw_payload?: string | null;
  last_payload_hash: string;
}
```
- **Replace Specification:**
  Add `name?: string | null;` and `expires_at?: string | null;` to `TrackedMessageRecord` and `UpsertTrackedMessageInput`, and include `name` and `expires_at` in `upsert()` (`UPDATE` and `INSERT`) plus add a `updateConfig(id: number, data: { name?: string | null; expires_at?: string | null })` method on `trackedMessageRepository`.

- **File:** `server/src/services/messageTrackerService.ts`
- **Search:**
```ts
export interface TrackMessageParams {
  channelId: string;
  messageId: string;
  templateId?: number | null;
  exploitName?: string | null;
  authorUserId?: string | null;
  rawPayload?: DiscordMessagePayload | null;
}

export const trackMessage = async (
  params: TrackMessageParams,
): Promise<TrackedMessageRecord | null> => {
  try {
    const rawToStore = params.templateId ? null : params.rawPayload ? JSON.stringify(params.rawPayload) : null;
    const hash = params.rawPayload ? computePayloadHash(params.rawPayload) : "pending";
```
- **Replace Specification:**
  1. Add `name?: string | null;`, `expiresAt?: string | null;`, and `resolvedPayload?: DiscordMessagePayload | null;` to `TrackMessageParams`.
  2. Always store `rawToStore = params.rawPayload ? JSON.stringify(params.rawPayload) : null;` (even when `templateId` is set, as a safe fallback).
  3. Compute `const hash = params.resolvedPayload ? computePayloadHash(params.resolvedPayload) : params.rawPayload ? computePayloadHash(params.rawPayload) : "pending";`.
  4. In `syncTrackedMessages()`, check if `record.expires_at && new Date(record.expires_at).getTime() <= Date.now()`—if expired, call `await trackedMessageRepository.deleteById(record.id); result.removed++; continue;`.

### Step 1.3 — Fix Auto-Tracking & Explicit `track` Flag in `server/src/routes/send.ts`
- **File:** `server/src/routes/send.ts`
- **Search:**
```ts
        // Auto-tracking for dynamic messages ({exploit.*}, {user.*}, author pfp, templates)
        const sentId = (sent as any)?.id;
        if (sentId) {
          const rawStr = JSON.stringify(msg);
          const hasDynamic =
            rawStr.includes("{exploit.") ||
            rawStr.includes("{user.") ||
            rawStr.includes("discord.com/users/");
          if (hasDynamic || req.body?.templateId || req.body?.exploitName) {
            try {
              const { trackMessage } = await import("../services/messageTrackerService.js");
              await trackMessage({
                channelId,
                messageId: sentId,
                templateId: req.body?.templateId ? Number(req.body.templateId) : null,
                exploitName: typeof req.body?.exploitName === "string" ? req.body.exploitName : null,
                rawPayload: msg,
              });
            } catch (trackErr) {
              log.warn("Failed to auto-track message:", trackErr);
            }
          }
        }
```
- **Replace Specification:**
  1. Inspect the **uninterpolated** input message `const rawInputMsg = messagesToProcess[i];` (NOT the post-interpolation `msg`!).
  2. Cleanse `_id`, `username`, and `avatar_url` from `rawInputMsg` without resolving `{user.<ID>.*}` or `{exploit.*}` so the placeholders remain intact in `raw_payload`.
  3. Check `const rawStr = JSON.stringify(rawInputMsg);` for `/{user\.\d{17,20}\./i.test(rawStr) || rawStr.includes("{exploit.") || rawStr.includes("discord.com/users/")` OR `req.body?.track === true` OR `Boolean(req.body?.templateId)` OR `Boolean(req.body?.exploitName)`.
  4. Also run the exact same tracking registration inside the `if (typeof editMessageId === "string" && editMessageId.trim() !== "")` branch when editing an existing message!
  5. Pass `rawPayload: uninterpolatedCleanMsg`, `resolvedPayload: msg`, `name: typeof req.body?.trackName === "string" ? req.body.trackName : null`, and `expiresAt: typeof req.body?.expiresAt === "string" ? req.body.expiresAt : null` to `trackMessage()`.

### Step 1.4 — Update Tests for Dropped `bot_profiles` & `webhook_profiles` Tables
- **File:** `server/tests/challenger_perf_indexes.test.ts`
- **Search:**
```ts
    expect(indexNames.has("idx_action_logs_executed_at")).toBe(true);
    expect(indexNames.has("idx_bot_profiles_user")).toBe(true);
    expect(indexNames.has("idx_sessions_expires")).toBe(true);
```
- **Replace Specification:**
  Remove `expect(indexNames.has("idx_bot_profiles_user")).toBe(true);` and assert `expect(indexNames.has("idx_templates_expires_at")).toBe(true);` and `expect(indexNames.has("idx_tracked_messages_expires_at")).toBe(true);`.

- **File:** `server/tests/repositories.test.ts`
- **Search:**
```ts
  describe("WebhookProfileRepository & BotProfileRepository", () => {
```
- **Replace Specification:**
  Remove the obsolete `WebhookProfileRepository & BotProfileRepository` describe block (and unused `botProfileRepo` / `webhookProfileRepo` setup in `beforeEach`) since `webhook_profiles` and `bot_profiles` are dropped in migration `011`.

### Batch 1 Verification
```bash
npm run typecheck
npm test
```

---

## BATCH 2 — Fix `{user.<ID>.<field>}` Autocomplete Display (`{user.name}` Instead of Long ID)

### Copy-Paste Session Starter Prompt for ChatGPT (Batch 2)
> "You are implementing **BATCH 2** of the HoHo Manager Master Plan. Update `userPlaceholderAutocomplete.ts`, `DiscordMentionInput.tsx`, `Field.tsx`, and their unit tests so typing `{user.<17-20 digit ID>` displays clean `{user.name}`, `{user.avatar}`, etc. labels in the dropdown while inserting `{user.<ID>.<field>}` on selection. Output exact `Search` and `Replace` blocks."

### Root Cause
When typing `{user.1347945399238918195`, the dropdown previously set the visible title to `{user.1347945399238918195.name}`, which overflowed the narrow popover with the 19-digit number and hid the field name.

### Step 2.1 — Add `displayTag` & Strict Snowflake Validation in `client/src/utils/userPlaceholderAutocomplete.ts`
- **File:** `client/src/utils/userPlaceholderAutocomplete.ts`
- **Search:**
```ts
export interface UserIdPlaceholderSuggestion {
  tag: string;
  label: string;
  desc: string;
}
```
- **Replace Specification:**
  Update `client/src/utils/userPlaceholderAutocomplete.ts` so:
  1. `UserIdPlaceholderSuggestion` has:
     ```ts
     export interface UserIdPlaceholderSuggestion {
       /** Full token inserted into the editor: `{user.1347945399238918195.name}` */
       tag: string;
       /** Clean short tag shown in the dropdown UI: `{user.name}` */
       displayTag: string;
       /** Extracted Discord user ID */
       userId: string;
       label: string;
       desc: string;
     }
     ```
  2. Match `/^user\.(\d{1,20})(?:\.([a-z0-9_]*))?$/` so autocomplete stays open while typing digits, and return `displayTag: \`{user.${field.key}}\``, `tag: \`{user.${userId}.${field.key}}\``, `userId`.

### Step 2.2 — Show `displayTag` (`{user.name}`) in `DiscordMentionInput.tsx` & `Field.tsx`
- **File:** `client/src/components/editor/DiscordMentionInput.tsx`
- **Search:**
```tsx
      if (idSuggestions !== null) {
        return idSuggestions.slice(0, 20).map((suggestion) => ({
          id: `var_${suggestion.tag}`,
          title: suggestion.tag,
          subtitle: `${suggestion.label}  ${suggestion.desc}`,
          icon: <Code size={13} className="text-[#5865f2] shrink-0" />,
          replacement: suggestion.tag,
          keepOpen: false,
        }));
      }
```
- **Replace Specification:**
  Use `title: suggestion.displayTag` (so the menu cleanly shows `{user.name}`, `{user.avatar}`, `{user.url}`, `{user.mention}`) and `subtitle: \`${suggestion.label} • ID …${suggestion.userId.slice(-4)}\``, while keeping `replacement: suggestion.tag` (`{user.&lt;ID&gt;.&lt;field&gt;}`)!

- **File:** `client/src/components/ui/Field.tsx`
- **Search:**
```tsx
          <button
            key={item.tag}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item.tag);
            }}
            className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between gap-2 transition-colors ${
              idx === selectedIndex
                ? "bg-[#5865f2] text-white"
                : "text-[#dbdee1] hover:bg-[#2b2d31]"
            }`}
          >
            <span className="font-mono font-semibold truncate">{item.tag}</span>
            <span
              className={`text-[10px] truncate ${
                idx === selectedIndex ? "text-white/80" : "text-[#949ba4]"
              }`}
            >
              {item.desc}
            </span>
          </button>
```
- **Replace Specification:**
  Render `(item as any).displayTag ?? item.tag` in the left `<span className="font-mono font-semibold truncate">` while passing `item.tag` to `onSelect(item.tag)`!

### Batch 2 Verification
```bash
npm run typecheck
npm test
```

---

## BATCH 3 — Server-Time Sync + Custom shadcn-Style Calendar & UI Primitives (`DateTimePickerPopover`, `Checkbox`, `SelectPopover`)

### Copy-Paste Session Starter Prompt for ChatGPT (Batch 3)
> "You are implementing **BATCH 3** of the HoHo Manager Master Plan. Install `motion`, add server-time synchronization in `globalStore.ts` (from `/api/health`), and create `client/src/components/ui/DateTimePickerPopover.tsx` matching the dark calendar grid design with past dates disabled against server time, plus custom `Checkbox` and `SelectPopover` primitives. Output exact commands and full file/patch blocks."

### Step 3.1 — Install `motion` in `client` Workspace
Run:
```bash
npm install motion --workspace client
```

### Step 3.2 — Server-Side Clock Offset in `client/src/store/globalStore.ts`
- **Why:** Users can change their PC/phone system clock to bypass client-side date validation or skew default timestamps.
- **File:** `client/src/store/globalStore.ts`
- **Specification:**
  1. Add `serverTimeOffsetMs: number` (default `0`) and `syncServerTime: () => Promise<void>` to `GlobalState`.
  2. In `syncServerTime` (and inside `fetchCurrentUser`), call `fetch("/api/health")`, parse `json.time` (ISO string from server), and set `serverTimeOffsetMs: new Date(json.time).getTime() - Date.now()`.
  3. Export a helper `export const getServerNow = (): Date => new Date(Date.now() + useGlobalStore.getState().serverTimeOffsetMs);`.

### Step 3.3 — Create Custom Calendar & Time Picker (`client/src/components/ui/DateTimePickerPopover.tsx`)
- **File:** `client/src/components/ui/DateTimePickerPopover.tsx` (New File)
- **Visual & Behavioral Specification (Matching Uploaded Screenshot `image_29affd.png` & [shadcn/ui Calendar](https://ui.shadcn.com/docs/components/calendar)):**
  1. **Zero Native Inputs:** Do NOT render `<input type="date">` or `<input type="datetime-local">`.
  2. **Trigger Button:** Compact dark surface button (`bg-[#1e1f22] border border-[#2b2d31] hover:border-[#3f4147] rounded-lg px-3 py-1.5 text-xs font-medium text-[#dbdee1] tabular-nums flex items-center justify-between gap-2`) showing formatted date & time (e.g. `Nov 12, 2026, 9:30 PM`) or placeholder.
  3. **Popover Animation (`@review-animations` compliant):**
     - Uses `AnimatePresence` + `motion.div` from `"motion/react"`.
     - `initial={{ opacity: 0, scale: 0.96, y: -4 }}`, `animate={{ opacity: 1, scale: 1, y: 0 }}`, `exit={{ opacity: 0, scale: 0.96, y: -4 }}`, `transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}`.
     - `style={{ transformOrigin: "top left" }}`.
  4. **Calendar Header & 7×6 Day Grid:**
     - Top readout: Bold selected date (`Nov 12, 2026`) + Month/Year bar (`NOVEMBER 2026`) with previous/next month buttons (previous month button disabled when viewing current server month).
     - Weekday header row: `SU MO TU WE TH FR SA` in `text-[11px] font-semibold uppercase tracking-wider text-[#787c87]`.
     - Day cells: `grid-cols-7 gap-px bg-[#232428] border border-[#232428] rounded-lg overflow-hidden`.
     - **Past Date Blocking (Server-Synced):** Compare each day against `startOfDay(getServerNow())`. Any day strictly before server today gets `disabled` + `bg-[#1a1b1e] text-[#4e5058] cursor-not-allowed pointer-events-none` (matching days `1..11` in `image_29affd.png`).
     - Selectable days (`>= serverToday`): `bg-[#2b2d31] hover:bg-[#35373c] text-[#f2f3f5] font-medium tabular-nums`. Selected day gets `bg-[#5865f2] text-white font-bold`.
  5. **Server-Synced Time Selector Bar (Bottom of Popover):**
     - Initializes to `getServerNow()` when opened if no value is set.
     - Custom Hour (`01–12`), Minute (`00–59`), and `AM/PM` pill buttons (or custom scrollable list). If the selected date is server `today`, any hour/minute earlier than `getServerNow()` is automatically clamped to `getServerNow() + 5 minutes`.

### Batch 3 Verification
```bash
npm run typecheck
npm test
```

---

## BATCH 4 — Unified Backups & Tracked Messages Modal + Configurable "Track Message" Checkbox

### Copy-Paste Session Starter Prompt for ChatGPT (Batch 4)
> "You are implementing **BATCH 4** of the HoHo Manager Master Plan. Unify Saved Backups and Tracked Messages into a single configurable view in `client/src/App.tsx` and add a `[x] Track Message` checkbox + `DateTimePickerPopover` retention selector to both `BackupsModal` and `BotDispatchModal.tsx`. Output exact `Search` and `Replace` blocks."

### Step 4.1 — Add Unified Endpoint `PATCH /api/tracking/messages/:id` in `server/src/routes/tracking.ts`
- **File:** `server/src/routes/tracking.ts`
- **Specification:**
  1. In `GET /api/tracking/messages`, include `name: m.name`, `expiresAt: m.expires_at`, and `createdAt: m.created_at` in the returned JSON objects.
  2. Add `PATCH /api/tracking/messages/:id` (guarded by `attachUser`, `requireStaffPermission("edit")`) allowing staff to update `name` and `expiresAt` (validated against server `Date.now()` so past dates are rejected with HTTP 400) or toggle tracking on/off.
  3. Add `api.tracking.update(id: number, body: { name?: string | null; expiresAt?: string | null })` in `client/src/api/client.ts`.

### Step 4.2 — Unify `BackupsModal` in `client/src/App.tsx` (Single Unified List + Track Checkbox + Custom Calendar)
- **File:** `client/src/App.tsx`
- **Specification:**
  1. **Remove the separate "Saved Backups" vs "Tracked Messages" tab split.** Show **one unified list** of items (saved templates merged with ad-hoc tracked messages from `/api/tracking/messages`), with compact filter pills (`All`, `Tracked Only`, `Saved Templates`).
  2. **Top Save/Configure Bar:**
     - Backup Name input (`Template / Tracked Backup name...`).
     - Custom **`[x] Track Message`** Checkbox (`isTracked`): when checked, any sent/linked Discord message is auto-updated when `{user.<ID>.*}` or `{exploit.*}` changes.
     - Custom **`[x] Custom Expiry Date`** toggle + `<DateTimePickerPopover />` (defaults to server `getServerNow()` / +14 days when unscheduled; never allows past dates).
  3. **Per-Item Inline Edit Drawer (`AnimatePresence`):**
     - Clicking the Edit button on any item opens its configuration row with:
       - Name input
       - `[x] Track Message` checkbox (toggles tracking on/off)
       - `<DateTimePickerPopover />` to change or clear the retention expiry date (`Save` / `Cancel`).

### Step 4.3 — Add `[x] Track Message` Checkbox & Retention Picker in `client/src/components/send/BotDispatchModal.tsx`
- **File:** `client/src/components/send/BotDispatchModal.tsx`
- **Specification:**
  1. Inside `BotDispatchModalComponent`, add state:
     - `const [trackAfterSend, setTrackAfterSend] = useState(false);` (auto-checked if the current message contains `{user.<ID>.*}`, `{exploit.*}`, or `discord.com/users/`).
     - `const [customExpiry, setCustomExpiry] = useState<string | null>(null);`
  2. Render a clean configuration card before the Dispatch footer:
     - Custom **`[x] Track this message (Auto-update dynamic variables)`** checkbox — allows tracking a sent message in `tracked_messages` **even without saving it as a template**!
     - Optional `<DateTimePickerPopover />` for scheduled retention expiry.
  3. Pass `track: trackAfterSend`, `expiresAt: customExpiry` in the `POST /api/send` body.

### Batch 4 Verification
```bash
npm run typecheck
npm test
```

---

## BATCH 5 — Custom Select/Dropdown Primitives & Editor Polish (Zero Native OS Select/Date Controls)

### Copy-Paste Session Starter Prompt for ChatGPT (Batch 5)
> "You are implementing **BATCH 5** of the HoHo Manager Master Plan. Replace native `<select>` and native date/time inputs in `Field.tsx` and `RichPicker.tsx` with custom animated shadcn-style popover primitives using `motion/react` and `getServerNow()`. Output exact `Search` and `Replace` blocks."

### Step 5.1 — Upgrade `Select` and `Checkbox` in `client/src/components/ui/Field.tsx`
- **File:** `client/src/components/ui/Field.tsx`
- **Specification:**
  1. Replace the native `<select>` in `export const Select` with a custom keyboard-accessible popover listbox (styled after [shadcn/ui Select](https://ui.shadcn.com/docs/components/select)) that renders a crisp dark trigger button (`bg-[#18191c] border border-[#26282d] hover:border-[#3f4147] rounded-lg px-3 py-2 text-xs text-[#f2f3f5] flex items-center justify-between`) and a floating `motion.div` menu (`duration: 0.14`, `ease: [0.16, 1, 0.3, 1]`, `scale: 0.97 -> 1`, `transformOrigin: "top"`), while maintaining backward compatibility with `onChange={(e) => ...}` by synthesizing `{ target: { value } } as any`.
  2. Upgrade `export const Checkbox` to render a custom SVG check box (`w-4 h-4 rounded-[4px] border border-[#3f4147] bg-[#18191c] data-[checked=true]:bg-[#5865f2] data-[checked=true]:border-[#5865f2] transition-transform active:scale-95`) instead of a browser-default `<input type="checkbox">`.

### Step 5.2 — Replace Native Date/Time Inputs in `client/src/components/editor/RichPicker.tsx`
- **File:** `client/src/components/editor/RichPicker.tsx`
- **Specification:**
  In the Timestamp tab of `RichPicker.tsx`, replace the native `<input type="date">` and `<input type="time">` with `<DateTimePickerPopover allowPastDates={true} />` initialized to `getServerNow()`.

### Batch 5 Verification
```bash
npm run typecheck
npm test
```

---

## BATCH 6 — Full Desktop & Mobile Studio Layout Remake with Motion (`@minimalist-ui` + `@review-animations` + `@web-design-guidelines`)

### Copy-Paste Session Starter Prompt for ChatGPT (Batch 6)
> "You are implementing **BATCH 6** of the HoHo Manager Master Plan. Upgrade `Modal.tsx`, `Header.tsx`, `SplitPane.tsx`, and `App.tsx` for both PC and Mobile layouts using `motion/react` and the strict `@minimalist-ui`, `@review-animations`, and `@web-design-guidelines` rules. Output exact `Search` and `Replace` blocks."

### Step 6.1 — Motion-Powered `Modal.tsx` with Asymmetric Enter/Exit & Reduced-Motion Support
- **File:** `client/src/components/ui/Modal.tsx`
- **Specification (`@review-animations` compliant):**
  - Wrap portal content in `<AnimatePresence>`.
  - Backdrop: `motion.div` with `initial={{ opacity: 0 }}`, `animate={{ opacity: 1 }}`, `exit={{ opacity: 0 }}`, `transition={{ duration: 0.15 }}`.
  - Dialog surface: `motion.div` with `initial={{ opacity: 0, scale: 0.96, y: 6 }}`, `animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }}`, `exit={{ opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } }}`.
  - Close on `Escape` keydown; trap focus cleanly; support mobile bottom-sheet presentation (`sm:rounded-xl rounded-t-2xl sm:my-auto mt-auto max-h-[90dvh]`).

### Step 6.2 — PC & Mobile Workspace Layout Polish in `client/src/App.tsx`, `Header.tsx` & `globals.css`
- **Files:** `client/src/styles/globals.css`, `client/src/components/layout/Header.tsx`, `client/src/App.tsx`
- **Specification (`@minimalist-ui` & `@web-design-guidelines` compliant):**
  1. **Typography & Tokens (`globals.css`):**
     - Set `--font-sans: "Geist Sans", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif` and `--font-mono: "Geist Mono", "JetBrains Mono", "SF Mono", monospace`.
     - Add `@media (prefers-reduced-motion: reduce)` rule that softens transform distances while keeping opacity transitions intact.
     - Gate hover lift/border transitions behind `@media (hover: hover) and (pointer: fine)`.
  2. **Top Action Bar & Header (`Header.tsx` & `App.tsx`):**
     - Replace cluttered button wraps with a crisp editorial command bar (`bg-[#18191c] border-b border-[#26282d] px-3 py-2`) grouping workspace actions (`Backups & Tracking`, `JSON`, `Share`, `Clear`) on the left and primary server-bot dispatch actions (`Bot Send` / `Edit`) on the right with subtle `active:scale-[0.98]` feedback.
  3. **Responsive Mobile Workspace (`< 1280px` in `App.tsx`):**
     - Use `100dvh` (`h-dvh`) to prevent mobile browser address-bar viewport jumps.
     - Animate mobile view switching (`Editor` <-> `Preview`) with `motion.div` opacity/transform crossfade (`150ms ease-out`) and a sliding active-tab pill indicator (`layoutId="mobileWorkspaceTab"` with spring `{ stiffness: 500, damping: 38 }`).

### Final Verification Commands (Run After Batch 6)
```bash
npm run migrate --workspace server
npm run typecheck
npm test
npm run build
```
