# HoHo Manager — Phase 3: Author Profile Auto-Fetch & User Variables

**Repository:** `no-peace/Hoho_manager`  
**Branch reviewed:** `main`  
**Scope:** Read-only source review and local implementation guide  
**Status:** User reports Phase 2 tests and build pass locally. This guide does not modify GitHub; proposed changes have not been run.

---

## 1. Project memory and status

The repository's `docs/` directory was used as the project memory source. The GitHub `main` directory currently contains:

- `docs/HoHo_Manager_Phase_2_Staff_Security_Guide.md`
- `docs/Phased_implementation_plan.md`
- `docs/phases_plan.md`
- `docs/task0_repository_audit.md`

The exact filename `docs/Phase 2 staff security guide.md` was not present in the GitHub `main` directory during this read-only inspection. The canonical Phase 2 guide above is present. If the differently named file exists only in the local working tree, keep it there and avoid maintaining two conflicting copies.

**Status distinction:** The user reports Phase 2 is applied locally and tests/build pass. GitHub `main` is the snapshot inspected here, not proof that every local Phase 2 change has been pushed. No GitHub writes, commits, pushes, or deployments were performed.

### Corrections to older docs

1. The old plan says `GET /users/{user.id}` requires the user to share a guild with the bot. The current Discord User Resource documentation describes this endpoint as returning a user object for a given ID; it does not state guild membership is a prerequisite. Do not repeat the old guild-sharing claim.
2. A global user object does **not** provide a guild nickname, guild roles, or guild join timestamp. Those require guild-member context and must not be claimed as available from this global lookup.
3. The current code already has an author resolver, a Discord user cache, and send-time integration. Phase 3 is a repair/completion phase, not a greenfield implementation.
4. Do not add browser-side Discord API calls or expose the bot token to the client.
5. Do not persist fetched profile data in the database for this feature. The existing short-lived in-memory cache is sufficient for rendering an embed author.

---

## 2. Existing implementation found on `main`

### Backend

- `server/src/services/authorService.ts`
  - Recognizes 17–20 digit Discord IDs.
  - Recognizes a URL containing `discord.com/users/<ID>`.
  - Resolves `{user.<ID>.<field>}` placeholders.
  - Fills `author.name`, `author.url`, and `author.icon_url`.
  - Uses `getDiscordUser()` from the Discord service.
- `server/src/services/discordService.ts`
  - Implements `getDiscordUser(userId, profileId)`.
  - Uses the configured server bot token.
  - Caches up to 1,000 user summaries for 10 minutes.
  - Uses the shared REST request helper, which retries Discord 429 responses.
- `server/src/routes/send.ts`
  - Calls `resolveAuthorPlaceholders()` during message processing before the message is sent.
  - The author resolver runs after ordinary send-variable and WEAO interpolation.

### Frontend

- `client/src/components/editor/EmbedEditor.tsx`: provides Author Name, Author URL, and Author Icon URL fields.
- `client/src/components/preview/EmbedPreview.tsx`: resolves ordinary preview variables from a local map; it does not fetch Discord profiles, so unknown user-ID variables remain unresolved.
- `client/src/pages/DocsPage.tsx`: documents dynamic author resolution, but some descriptions overstate real-time updating and preview behavior.

### Canonical variable syntax

The existing backend supports:

```text
{user.123456789012345678.name}
{user.123456789012345678.username}
{user.123456789012345678.avatar}
{user.123456789012345678.url}
{user.123456789012345678.mention}
```

Use this syntax. Do not introduce `{user<id>.name}` as a second format; the current resolver does not parse that form.

---

## 3. Problems to fix

### P0 — Incorrect author fallback across embeds

`authorService.ts` remembers one global `detectedUserId`. During the later object walk, an author object without its own ID can inherit that global ID. This can cause one embed's user to be applied to another embed's author.

**Required behavior:**
- Resolve each author object only from its own `user_id`, `author_id`, or valid Discord profile URL.
- Do not copy an ID from another embed's author.
- If `fallbackAuthorId` is retained for compatibility, apply it only under a clearly defined single-author condition; never use it as a global fallback for every author object.
- Keep text placeholders independent: `{user.ID.FIELD}` resolves from the ID in that token.

### P0 — Validate profile URLs strictly

The current regex searches for a matching substring. Replace this with URL parsing and exact host/path validation.

Accept only HTTPS URLs on the official Discord domain with the exact `/users/<17–20 digit ID>` path. Reject lookalike hosts, unrelated paths, malformed URLs, non-HTTPS URLs, and invalid ID lengths.

Examples:

- `https://discord.com/users/123456789012345678` → accepted
- `https://www.discord.com/users/123456789012345678` → optionally accepted if explicitly supported
- `https://discord.com.evil.example/users/123456789012345678` → rejected
- `https://evil.example/discord.com/users/123456789012345678` → rejected
- `http://discord.com/users/123456789012345678` → rejected
- `https://discord.com/channels/...` → rejected

Invalid URLs must not trigger a Discord lookup.

### P1 — Coalesce concurrent user lookups

`getDiscordUser()` checks the TTL cache and then performs a REST request, but it does not coalesce concurrent cache misses. Several simultaneous sends can request the same user before the first request fills the cache.

In `server/src/services/discordService.ts`:
- Add an in-flight promise map keyed by user ID.
- Return the existing promise when a lookup for that ID is already running.
- Remove the in-flight entry in `finally`, including after errors.
- Cache only successful, validated user summaries.
- Do not cache 404s or transient failures as successful records.
- Keep the existing bounded cache and TTL unless tests show a concrete reason to change them.
- Expose a narrowly scoped cache-clear helper for deterministic tests if needed; do not add a public cache-control route.

### P1 — Bound lookups per outgoing payload

A payload can contain many different user placeholders. Add a conservative maximum number of unique profile lookups per message payload (suggested initial limit: 10). Deduplicate IDs before fetching.

If the limit is exceeded, do not start unbounded requests. Leave excess placeholders unresolved and emit a useful server-side warning without logging tokens or full message contents. Avoid unbounded parallel lookups; bounded concurrency or sequential lookup is acceptable.

### P1 — Preserve safe fallback behavior

If Discord returns 404, 403, 429 after retry budget, 5xx, timeout, or network failure:
- Do not crash the entire send request solely because optional author enrichment failed.
- Keep original author fields/placeholders unchanged when lookup fails.
- Log a concise diagnostic with the user ID and error category; do not log credentials or payload contents.
- Do not invent usernames or avatars.

The message may still be sent with unresolved placeholders. The UI documentation must explain this fallback.

### P1 — Correct preview expectations

Do not call Discord from `EmbedPreview.tsx` and do not put the bot token in the browser.

For Phase 3, use a truthful preview:
- If the author URL is a valid Discord profile URL and the author name is empty, show a preview-only label such as `Discord user (resolved on send)`.
- Do not claim the preview fetched the current username or avatar.
- Do not mutate the embed or outgoing payload to add the preview label.
- If `{user.ID.FIELD}` appears in ordinary text, leave it visibly unresolved or show a subtle note that it resolves when sending.
- Do not make a network request on every keystroke.

An explicit “Fetch preview” action could be considered later behind a staff-authorized, rate-limited backend endpoint. It is not required for Phase 3.

---

## 4. Exact files to edit

### A. `server/src/services/authorService.ts`

Refactor the resolver around per-author identity:

1. Add a helper that extracts a valid user ID from `author.user_id`, `author.author_id`, `author.url` after strict URL parsing, or `author.name` only when it is exactly a valid Snowflake.
2. Collect unique IDs from author objects and `{user.ID.FIELD}` tokens.
3. Enforce the unique lookup cap.
4. Fetch each unique ID once.
5. During the recursive walk, interpolate only recognized placeholders. For each `author` object, use only that object's extracted ID. Fill name, profile URL, and icon URL only after that user's lookup succeeds. Preserve existing values on failure.
6. Keep the result shape compatible unless repository-wide search confirms `authorUserId` and `authorUser` are unused and safe to remove.

Supported fields should remain intentionally small:

| Field | Output |
|---|---|
| `name`, `displayname`, `globalname` | `global_name` if present, otherwise `username` |
| `username`, `tag` | `username` |
| `id` | Discord user ID |
| `avatar`, `icon`, `pfp` | Discord CDN avatar URL, including default avatar when no custom avatar exists |
| `url`, `profile` | `https://discord.com/users/<ID>` |
| `mention` | `<@ID>` |

Unknown fields remain unchanged. Do not add `roles`, `nickname`, `joined`, email, or other unsupported/private fields to this global user resolver.

### B. `server/src/services/discordService.ts`

Update `getDiscordUser()` to coalesce in-flight requests while preserving server-side bot-token resolution, the existing REST helper, the bounded TTL cache (currently 1,000 entries / 10 minutes), and successful-response-only caching.

Review 429 handling in the shared `apiRequest()` helper. The current code caps the sleep at 10 seconds. Discord's rate-limit documentation says to use `Retry-After` or JSON `retry_after`. Do not retry earlier than Discord's requested delay. If that delay exceeds the request's acceptable wait budget, surface a retryable error instead of retrying too early. This helper is shared by many endpoints, so add focused tests and avoid accidental unrelated changes.

### C. `server/src/routes/send.ts`

Keep the current `resolveAuthorPlaceholders()` call before sending.

Improve observability:
- Remove the empty broad `catch` around the resolver if the resolver guarantees optional lookup failures are handled safely.
- If a defensive catch remains, log a concise warning before falling back to the original interpolated payload.
- Do not return raw Discord API errors, tokens, or stack traces to the client.
- Do not accept a Discord bot token from request body or query parameters.

The current send flow processes up to 10 messages with `Promise.all`. Ensure per-payload lookup limits and in-flight coalescing prevent an uncontrolled request burst.

### D. `client/src/components/editor/EmbedEditor.tsx`

In the Author section, add concise helper text under Author URL: a valid `https://discord.com/users/USER_ID` URL triggers profile enrichment when the message is sent. Explain that Author Name and Author Icon URL can be left blank for automatic fill. Do not imply the live preview performs a Discord API lookup. Preserve manual name/icon fields for ordinary URLs and non-user authors.

### E. `client/src/components/preview/EmbedPreview.tsx`

Add preview-only handling for a valid Discord profile URL. When author name is blank but the URL is a valid profile URL, display `Discord user (resolved on send)` as a visual placeholder. Do not mutate `embed`, store state, or outgoing payload. Do not generate a fake avatar or pretend it has been fetched. Keep ordinary author URL behavior unchanged.

If this is too invasive, add the note in the editor and leave the preview unchanged. Truthfulness is more important than simulating live data.

### F. `client/src/pages/DocsPage.tsx`

Correct the dynamic author section:
- Keep `{user.<id>.name}`, `{user.<id>.username}`, `{user.<id>.avatar}`, `{user.<id>.url}`, and `{user.<id>.mention}` examples.
- Replace `<id>` in copyable examples with a realistic 17–20 digit sample ID.
- Explain that profile resolution happens at send time, not in the live preview.
- Remove claims that data is refreshed “in real time.” The cache is 10 minutes and there is no subscription to Discord user updates.
- State that the feature fetches a Discord user object, not guild-specific nickname/roles/join date.
- State that failed lookups leave original text/author values unchanged.

---

## 5. Regression tests

Suggested new file: `server/tests/authorService.test.ts`. Mock `getDiscordUser()` and `getDiscordUserAvatarUrl()`; tests must not call Discord live.

Required cases:

1. Valid profile URL fills author name, URL, and icon URL.
2. `user_id` resolves without an author URL.
3. `author_id` resolves.
4. Numeric author name resolves only when it is a valid 17–20 digit ID.
5. `{user.ID.name}` resolves to global name, falling back to username.
6. `{user.ID.username}` resolves username.
7. `{user.ID.avatar}` resolves the CDN avatar URL.
8. `{user.ID.url}` resolves the official profile URL.
9. `{user.ID.mention}` resolves the mention string.
10. Unknown fields remain unchanged.
11. Invalid Snowflake lengths do not trigger Discord requests.
12. Lookalike URL hosts and malformed URLs do not trigger Discord requests.
13. A 404/missing user leaves original values unchanged.
14. A Discord API failure leaves original values unchanged.
15. Two author objects with different IDs resolve to their own users.
16. An author object without an ID does not inherit another embed's ID.
17. Duplicate placeholders for one ID cause one lookup per payload.
18. More than the configured unique-ID cap does not trigger unbounded requests.
19. Concurrent calls for one user share one in-flight Discord request.
20. A failed in-flight request is removed so a later request can retry.
21. Cache expiry permits a fresh lookup.
22. Avatar URL generation supports animated avatar hashes and default avatars.

Frontend tests should cover:
- A profile URL with no author name shows the preview-only unresolved label.
- An ordinary author URL is not mistaken for a Discord profile URL.
- The preview does not mutate the source embed.
- Unknown `{user.ID.FIELD}` text is not falsely displayed as resolved.

Add an `EmbedEditor` helper-text test if existing component test patterns support it.

---

## 6. Discord API and policy guidance

Use only the configured bot token on the server. Never automate a normal user account or use a user token.

Discord's User Resource documents `GET /users/{user.id}` and user fields such as `id`, `username`, `global_name`, and `avatar`.

Discord's rate-limit guidance says limits vary by route and global bot, should not be hard-coded, and clients should use rate-limit headers plus `Retry-After` / `retry_after` after a 429. Avoid repeated invalid requests.

Discord's Developer Policy says API data must only be used as necessary for the application's stated functionality and must not be used to profile Discord users or their relationships. For this feature, use only the minimum user fields needed to render the requested embed author. Do not build user profiles, relationship histories, analytics, or long-term tracking from this lookup.

No database migration is needed if fetched user data remains in the existing short-lived in-memory cache.

---

## 7. Test and build commands

Run from the repository root in PowerShell:

```powershell
npm test
npm run build
```

If the root does not expose the build command, inspect scripts with:

```powershell
Get-Content package.json
```

For focused backend tests:

```powershell
cd server
npx vitest run tests/authorService.test.ts
```

After focused tests pass, return to the repository root and run the complete test suite and build. Do not treat `npm run typecheck` as a substitute for tests; the project has separate TypeScript/test configuration.

---

## 8. Acceptance criteria

Phase 3 is complete only when:

- A valid Discord profile URL in an embed author triggers send-time profile resolution.
- Blank author name/icon fields are populated only after a successful lookup.
- The profile URL is normalized to `https://discord.com/users/<ID>`.
- `{user.ID.FIELD}` works for the supported field list.
- One embed's user ID can never leak into another embed's author.
- Invalid URLs/IDs cause no Discord lookup.
- Duplicate/concurrent lookups are coalesced and bounded.
- Discord API errors do not crash an otherwise valid send.
- Preview wording is truthful and does not claim to fetch live Discord data.
- Documentation matches actual behavior.
- All tests and build pass locally.

---

## 9. Phase 4 preview — Tracked Messages & Backups

Keep this separate from Phase 3. Phase 4 should inspect and implement the tracked-message backup experience:

- Saved backup cards should have a clear edit action.
- Users should be able to enable/disable tracking.
- Unscheduled tracked backups should have a defined 14-day retention policy.
- Scheduled backups should have a user-selected retention date/time.
- A date picker should be used for the retention date.
- Backend validation and database constraints must enforce retention; frontend-only restrictions are insufficient.
- Audit existing backup tables, message tracker service, scheduled jobs, and migrations before adding columns or tables.
- Ensure Discord message edits are rate-limit aware and only edit messages the configured bot is authorized to edit.

---

## 10. Files reviewed

- `docs/HoHo_Manager_Phase_2_Staff_Security_Guide.md`
- `docs/Phased_implementation_plan.md`
- `docs/phases_plan.md`
- `docs/task0_repository_audit.md`
- `server/src/services/authorService.ts`
- `server/src/services/discordService.ts`
- `server/src/routes/send.ts`
- `client/src/components/editor/EmbedEditor.tsx`
- `client/src/components/preview/EmbedPreview.tsx`
- `client/src/pages/DocsPage.tsx`
- `server/tests/actions.test.ts`

**No repository files were changed by this review.**
