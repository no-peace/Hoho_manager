# Hoho_manager: Phased Implementation Plan

This plan addresses the user’s list of issues and feature requests in phases. It is based on the current `main` branch of **Hoho_manager** and external references for best practices. Each phase includes specific tasks, affected components, and acceptance criteria. After review and approval, we will implement the changes locally (not yet pushing to GitHub) along with regression tests. A separate `memory.md` will capture architecture notes and decisions.

## Phase 0 – Review Current State

1. **Inventory code & data flow:** Confirm we understand the existing architecture and data model. The **frontend** is a React/Vite app; the **backend** is Node.js/Express with SQLite (via Better-SQLite3) or Turso (libSQL). The **bot** (Sapphire/Discord.js) runs separately. Confirm which features are implemented or removed (e.g. webhook sending is removed, as noted by failing tests).  
   - The README indicates **bot sending** uses `POST /api/send` (using the bot token on the server) and webhooks are now disabled. The UI still has some references to “Dispatch via Server Bot” and possibly stale “webhook” labels.  
   - Identify all relevant code files: routes in `server/src/routes/`, UI components in `client/src/components` and state stores (`client/src/stores` or `shared/`), and tests. 

2. **Set up environment:** Make sure local dev environment is working (`npm run dev`, migrations passed) and that we can run all existing tests (`npm test`). Confirm the latest `main` commit (`ed3de5d`) is checked out and tests are passing (as user did). Keep local changes uncommitted until plan is reviewed.

## Phase 1 – Hosting and Repository Visibility

**Goal:** Clarify deployment requirements and ensure GitHub repository can be private.  

- **Render Deployment:** Render supports deploying from **private** GitHub repos if the GitHub account has access. The Render docs state: *“You can deploy any public or private repo that your account has access to.”*. For private repos, you must connect your GitHub account and grant the Render GitHub App permission to the repo.  
- **GitHub Actions and Webhooks:** No changes needed in code; just ensure your Render service is linked to the GitHub repository via the Render dashboard. The GitHub repo can remain private for security. (The “Deploy to Render” button flow requires either a public repo or Render’s GitHub App, but this is only for one-click deployments, not your normal setup).  

**Tasks:**  
  - [ ] **Document** in the README or internal docs that the repo can be private and how to connect it to Render (citing Render docs).  
  - [ ] Verify the Render service settings: ensure the GitHub integration has access to this repo (if a colleague loses access, an admin can update it through the Render dashboard). No code changes required.

## Phase 2 – Server Bot Identity UI

**Goal:** Improve the “Server Bot” section of the UI to show the actual bot’s username/avatar and clarify the “View Bot Access” function. Remove stale webhook references.  

- **Current Behavior:** The bot dispatch modal and info card show a generic label “HoHo Server Bot / Configured server bot” with no profile picture. The “View Bot Access” button likely displays OAuth scopes or invite link, but still mentions a “Webhook URL” (according to the user screenshot).  
- **Desired Behavior:** 
  - Show the actual Discord bot’s username and avatar in the UI, for user clarity. 
  - The “View Bot Access” or similar panel should show only relevant bot access instructions (e.g. OAuth2 invite URL or required bot scopes). Remove or rename any “Webhook URL” text, since webhook sending has been disabled (the webhook “profiles” route was already removed). 
  - Possibly change “HoHo Server Bot / Configured server bot” to the bot’s real name (as registered on Discord) and show its profile image.  

**Implementation:**  
  - **Backend:** Add an endpoint `GET /api/bot-info` (secured by `x-admin-key`) that calls Discord API’s **Get Current Bot (User)** endpoint (`GET /users/@me`) using the bot token. This returns `{ username, avatar, discriminator, id }`. (Discord’s docs confirm `/users/@me` works for bots.)  
  - **Frontend:** On loading the dispatch modal or server settings page, fetch `/api/bot-info` and display the returned username and avatar. Update the React component (e.g. `BotDispatchModal.tsx` or wherever the card is) to use those values instead of hardcoded text.  
  - **Access Button:** Ensure “View Bot Access” shows only relevant info. For example, it could show a bot invite link:  
    ```
    https://discord.com/oauth2/authorize?client_id=<BOT_ID>&scope=bot+applications.commands&permissions=<PERMS>
    ```  
    and the list of required **bot** scopes/permissions. Remove any mention of webhooks or “Webhook URL” since those are not used.  
  - **Citations:** No direct code to cite, but can mention Discord’s `/users/@me` endpoint from their API docs (not easily citable via Bing, but it is official). For example: “Discord provides a REST endpoint GET `/users/@me` to retrieve the current application’s user (bot) profile, including username and avatar.”  

**Tasks:**  
  - [ ] Implement `GET /api/bot-info` (Discord service call) on the server.  
  - [ ] Update UI components to call this endpoint and display the real bot identity (name and avatar).  
  - [ ] Revise the “View Bot Access” modal: remove webhook references, display an OAuth invite URL or scope list for the bot. Ensure text is accurate.  
  - [ ] Write a regression test (maybe in client’s layout tests or an integration test) verifying that the bot’s actual name appears (for the new functionality).  

## Phase 3 – User Variables & Author Auto-Fetch

**Goal:** Implement the requested `{user<ID>}` variables to automatically fetch a Discord user’s name and avatar, and ensure the editor preview supports them. Ensure it complies with Discord’s rules on user data.  

- **Current State:** The user tried `{user<USER_ID>.name}` in the editor but got no output. Likely, the variable parsing engine in the action flow does not yet handle `{user<...>}` syntax. The plan is to allow an embed’s author (or message template) to reference a Discord user by ID, automatically resolving to that user’s current username/avatar.  
- **Design Considerations:** 
  - **Access:** To fetch arbitrary user info via the bot, the bot must share a server or direct context with that user (and have the necessary Gateway Intents, e.g. GUILD_MEMBERS or GENERAL). As a bot, you cannot fetch any Discord user by ID unless they are in a guild the bot is in (except you can fetch by DM if the user had DMed the bot).  
  - **Discord Policy:** According to Discord’s Developer Policy, you may only use or store **publicly available** user data for users who have authorized your bot or interacted with it. Using a user ID that the bot has never seen may be disallowed, and storing personal data beyond user ID should be minimized. We should document that `{user<ID>}` only works reliably for users that the bot has seen (joined guild or exchanged a message).  
  - **Implementation:** 
    - Extend the variable parser (in the action executor) to recognize a syntax like `{user<123456789>.name}` and `{user<123456789>.avatar}`. On encountering this variable at send-time, the server can attempt to resolve it.  
    - The backend can use the Discord API endpoint `GET /users/{user.id}` (requires the user to share a server with the bot) or the Discord.js cache if already loaded. It returns the user’s current `username` and `avatar`. 
    - For the preview in the editor (before sending), the React client could try to fetch user info via a new API endpoint (maybe `GET /api/user/:id`) to fill the preview. However, be careful: during editing, we may not want to spam Discord’s API with arbitrary IDs. Possibly restrict this feature: only allow it when the user explicitly turns on an option like “Enable fetching actual user names for {user<ID>}”. Alternatively, for preview we could use dummy values or no-load. The request should not delay the preview. A note in UI can warn that preview may not show resolved values if offline.  
  - **Citations:** We should cite Discord policy regarding user data (though the policy page [41] doesn’t explicitly list "no user data" restrictions except the general privacy rules we saw). We have [41†L100-L111] stating “do not initiate processes on a user’s behalf without permission.” This implies we shouldn’t fetch and store user data without clear context. We may not need a direct quote here, but we can mention using the API responsibly (e.g. “Discord Developer Policy disallows contacting users without permission, so we should only fetch user info as part of an explicit message send flow). 

**Tasks:**  
  - [ ] In the **action executor** (probably in `server/src/utils/discordService.ts` or similar), parse `{user<id>.name}` and `{user<id>.avatar}`. For each, call the Discord API to resolve the user. (Use the bot token; ensure proper error handling if the user cannot be found or bot has no access.)  
  - [ ] In the **frontend editor**, update the template variable syntax help to mention this new variable form. Ensure that entering `{user<...>}` is parsed and shown in the variable list.  
  - [ ] For the live preview, consider either making a background fetch or showing a placeholder until resolved. Document limitations (Discord rate limits, only works if user is known to the bot).  
  - [ ] Add tests: a unit test for the parser to replace `{user<ID>.<field>}` with mock data, and an integration test where the bot’s test user (e.g. in dev guild) is referenced. Verify that `userX.name` is inserted correctly.  
  - [ ] Clearly document in UI/tooltips that this feature uses the Discord API and requires bot access to the user’s server.  

## Phase 4 – Backups, Tracking & Scheduling

**Goal:** Extend the backup system so that saved messages can be *tracked* (automatically edited if the user’s profile changes), and implement retention policies (delete old backups unless scheduled). Refine the “Schedule” UI to include an explicit expire date.  

- **Current State:** The UI screenshot shows a list of backups and an “Edit Backup Details” modal with scheduling options. The user complains:
  - There is no obvious “Track message” toggle. The modal has “Scheduled” and “Repeating”, but no “Tracked.” 
  - They suggest: on a saved backup, allow a toggle (like an edit icon) to mark it as “tracked”. If tracked, the system should watch Discord for username/avatar changes and update the sent message accordingly.  
  - If not scheduled, remove it from DB after 2 weeks. If scheduled, allow specifying an end date via a date-picker.  

- **Design:**  
  - **New DB fields:** In the backups table, add a boolean `tracked` column and a datetime `expires_at`. (We already have fields for scheduled and repeat, presumably; check the schema to confirm.)  
  - **UI changes:** In the Backup list view, for each entry add an “Edit” icon or “Track” toggle. In the “Edit Backup Details” modal, add a checkbox “Track this message” and, if checked, disable or hide the expiration date (or vice versa). Also add a date picker “Expire on” for scheduled messages if desired.  
  - **Logic:** 
    - If a backup is *not* scheduled (`scheduled = false`) and *not* tracked, then it should auto-delete after 2 weeks. We can implement a background job or a simple check: whenever we run scheduled jobs (e.g. hourly), delete any backup where `expires_at < now`.  
    - If scheduled, set `expires_at` based on user input (default could be infinite or e.g. 1 year). The UI date-picker selects this.  
    - If tracked, set `tracked = true` and possibly `expires_at = null` (never auto-delete). The bot should subscribe to Discord’s username/avatar update events and, when a tracked user changes profile, edit the stored message (via Discord API edit) to update the author fields. Alternatively, periodically poll user profiles. 
    - **Citations:** We might note general best practice: data retention policies (see e.g. “Data retention policy” principles). However, specific retention after 2 weeks is user-specified, so no standard to cite. We can cite the home assistant link [66] to show how other projects limit DB growth (but it’s off-topic). Probably skip citation here.  

**Tasks:**  
  - [ ] **Database:** Modify `message_backups` (or equivalent) table to add `tracked` (BOOLEAN) and `expires_at` (DATETIME) columns. Write a migration for existing DB. (If using Turso, adjust accordingly.)  
  - [ ] **Backend logic:** 
    - In the send/backup handler, record `tracked` flag when creating a backup if the UI requested it. 
    - Add a scheduled job (e.g. hourly with `setInterval` or a cron, or use Turso’s CDC features if available) to delete backups where `expires_at` is in the past. 
    - For tracking: Use Discord’s Gateway or REST. Discord API does not have events for profile change (except on the Gateway with GUILD_MEMBERS intent “user update”), so best is: whenever a tracked backup is loaded or perhaps on a schedule, fetch the user’s current avatar/username and compare. If changed, call `PATCH /channels/{channel}/messages/{message}` to edit. (Note: editing a message’s author embed requires editing the embed object; ensure the bot has permission to edit that message.)  
  - [ ] **Frontend UI:** 
    - In the “Backups” list, add a “Track” button/icon for each saved message. If clicked, open modal with track enabled. 
    - In “Edit Backup Details” modal, add a “Track this message” switch. If “Track” is off and “Scheduled” is off, auto-set `expires_at = now + 2 weeks`. If “Scheduled” is on, show a date picker for end date (and store in `expires_at`).  
    - Ensure the logic is clear: only one of `tracked` or finite expiry. If “Track” is checked, disable expiry.  
  - [ ] **Testing:** Write tests covering: saving a backup with “tracked” on/off, verify DB flags; simulating a user profile change and checking that the bot edits the message accordingly; deleting old backups after expiry. Add regression tests for the UI (if using Jest or similar) to ensure the new checkboxes and date pickers appear.  

## Phase 5 – Custom Executor Payloads & Auto-Updates

**Goal:** Review and harden the “Custom Executor Payloads & Auto-Updates” feature. Ensure it’s secure and avoids Discord restrictions.  

- **Current State:** The README mentions “Custom Executor Payloads & Auto-Updates”, but details are unclear. Likely, the system allows “custom” payload JSON to be sent or editing messages automatically. Possibly an advanced user feature to define exact message payloads or regularly update messages.  
- **Risks:** Any mechanism that allows injecting arbitrary JSON into the Discord API should be carefully validated to prevent abuse. We should ensure: 
  - Only fields that Discord supports (per their API) are allowed (see Discord API Message object).
  - Prevent sending invalid or dangerous fields (e.g. `tts`, `nonce`, `flags` outside the allowed range, or malicious embed content). 
  - Rate-limit automated updates and ensure idempotency (e.g. do not repeatedly edit for no reason). 
- **Improvement:** 
  - Create a schema for acceptable custom payload. Validate it server-side (e.g. using a JSON schema or manual checks) before sending to Discord. 
  - For “Auto-Update”: If this means automatically editing a sent message on some schedule or trigger, ensure it uses the bot’s `PATCH /messages` endpoint appropriately. Document what parts of a message can be auto-updated (content, embeds, components) and what happens if e.g. the message was deleted. 
  - No citation needed here, but we should follow Discord API docs for valid message payload structure (e.g. https://discord.com/developers/docs/resources/channel#edit-message). 
- **Tasks:**  
  - [ ] Review the code under “Executor” that handles custom payloads (likely in the flow execution code). Ensure it sanitizes inputs. Possibly restrict the fields (e.g. disallow `webhook_id` or such that don’t apply to bots).  
  - [ ] Document and test the auto-update behavior. If there is a UI option, clarify it (remove confusion).  
  - [ ] Add tests: e.g. send a custom payload with all fields, check it hits Discord; try to send an invalid field and assert it is rejected (400). 

## Phase 6 – Rich Picker UI Bugs

**Goal:** Identify and fix known UI bugs in the “Rich Picker” component (presumably a UI element for choosing images or embed colors).  

- **Scope:** The user mentioned “richpicker menu UI bugs” but gave no specifics. We must test the UI manually or review its code. Possibly issues might include: 
  - Broken layout, unresponsive elements, or state not updating correctly.
  - Often the “color picker” or “image picker” in Discord embeds can be tricky.
- **Approach:** 
  - Use the frontend and try out the Rich Picker (in the component for editing embed images or colors). Note any obvious bugs (e.g. dropdown not closing, incorrect preview, keyboard issues). 
  - Check issue trackers or commit history for recent changes to those components. 
- **Tasks:**  
  - [ ] List discovered bugs (e.g. “Rich color picker does not update embed color in real time” etc.).  
  - [ ] Fix each bug (likely in `client/src/components` under embeds).  
  - [ ] Add UI tests if possible (e.g. via Jest/React Testing Library) to prevent regressions.  

## Phase 7 – Regression Test Suite

**Goal:** Add comprehensive tests to cover: endpoints, UI flows, and edge cases not yet covered.  

- **Areas for new tests:**  
  - **Permissions:** Already added a test for staff channel/guild allowlists. Also test staff fetching messages: a staff user allowed in channel but not in guild should get HTTP 403 on both list and single-message endpoints. Test admin still works. Test missing or malformed tokens fail (should be 401).  
  - **Message sending:** Test webhook mode rejection (we did earlier). Test empty payload, or payload with invalid JSON (should 400).  
  - **Bot Identity:** Test our new `/api/bot-info` returns correct fields.  
  - **Backups:** Test creating a backup (POST to `/api/backups` or similar) with and without scheduling, and verify DB state. Test editing/deleting backups.  
  - **Tracking:** Simulate a profile change event and verify message is updated. (This may be complex to simulate, but at least test the code path directly: mock Discord API returning new name and check update call.)  
  - **User variables:** Test that using `{user<ID>}` in a template yields the expected username in the payload to Discord (with mocking of Discord API).  
  - **Custom payloads:** Test sending a message with a known custom payload shape succeeds, and one with disallowed fields is rejected.  
  - **Rich picker:** If possible, add a simple test ensuring the component renders and updates state.  
- **Regression vs New:** Focus on *existing features plus the above additions*. Do not write tests for completely new features (like unknown UI flows).  

**Tasks:**  
  - [ ] Audit current tests (`client/__tests__`, `server/tests`). Fill gaps as noted.  
  - [ ] Write new tests in `server/tests/` for all REST routes (send, interactions, channels, backups, bot-info, etc.) covering success and failure.  
  - [ ] Write new tests in `client/__tests__` (Vitest or Jest) for critical UI components (BotDispatchModal, BackupEditor, etc.), focusing on state changes and static content.  
  - [ ] Ensure test suite is green and covers >80% of new logic.  

## Phase 8 – Staff Permissions Audit

**Goal:** Review all staff-protected routes and data access to ensure channel/guild allowlists and admin bypass work correctly. Add tests for any uncovered cases.  

- **Review Points:** 
  - We fixed the main send endpoint and one message-lookup endpoint to check both channel *and* guild allowlists. Confirm all other routes that take a `channelId` or `guildId` do the same. For example: editing or deleting a message, listing channels, listing messages, etc.  
  - Confirm admin bypass still works (i.e., `isAdmin` or `admin-key` should override allowlists).  
  - Confirm malformed allowlist data is handled (e.g., if `allowed_channel_ids` or `allowed_guild_ids` in DB is invalid JSON, the helper should treat it as empty list and forbid). Our `parseAllowedIds` catches exceptions. Maybe add tests for corrupt data.  
  - If Turso fallback means SQLite, confirm the staffRepository retrieval still works (no silent fallback). Possibly fail-fast if DB is misconfigured (see Phase 2 note about DB).  
- **Cross-Guild Fetching:** Even if there’s “only one server” now, we should plan for multi-guild. Tests: a staff member allowed in one guild tries to access another guild’s channel (should 403). Also ensure staff cannot fudge IDs (e.g. a channel ID from one guild might be accessible if it belongs to allowed guild). Because Discord channel IDs are unique, the guild lookup is necessary.  
- **Tasks:**  
  - [ ] In `server/src/routes`, check every route that uses `staffContext` (e.g. profiles, accesses, channel list, message list, message send/edit/delete). Ensure calls to `assertStaffChannelAllowed` and `assertStaffGuildAllowed` are present. Insert missing checks.  
  - [ ] Write tests for each staff route: allowed vs disallowed guild.  
  - [ ] Confirm `assertStaffGuildAllowed` is also used on message retrieval endpoints (we added it in Phase 1 for GET message and in send). Also consider reaction/edit/delete endpoints if any (though not sure if implemented).  
  - [ ] Ensure `assertStaffGuildAllowed` catches lookup failures (it currently throws on no guildId; test that scenario too).  

## Phase 9 – Database Review & Optimization

**Goal:** Audit the database schema and usage; apply best practices for SQLite/Turso. Ensure unnecessary data isn’t stored, and frequently queried fields are indexed. Improve reliability.  

- **Schema & Indexes:** Inspect each table (staff, templates, messages, flows, backups, etc.). For each:  
  - Check if there are indexes on columns used in WHERE clauses (e.g. `discord_message_id`, `discord_channel_id`, user IDs). If missing, consider adding indexes (especially if tables grow large). For example, `messages` table might need an index on `author_id` or `flow_id`.  
  - Ensure primary keys are `INTEGER PRIMARY KEY` (this uses `rowid` alias for fastest lookups). If any table uses `AUTOINCREMENT` unnecessarily, consider removing it unless monotonic IDs are required.  
  - If any tables store JSON (like allowed IDs in staff, or embeds), confirm if they should be normalized. For example, `allowed_channel_ids` is a JSON string; this can’t be indexed. For a scalable solution, we might want a separate table mapping staff to allowed channels. But that’s a larger refactor; likely out of scope now. We can note it as “out of scope for now”.  
  - Check for unused or redundant columns. (This requires examining migrations or code. For example, if `allowed_role_ids` is defined but unused, consider removing.)  
- **Pragmas & Connection:** As per best practices:  
  - **WAL mode:** Enable `PRAGMA journal_mode = WAL`. This allows concurrent reads during writes (helpful if the web client reads data while the server writes).  
  - **Foreign Keys:** If using foreign keys between tables (e.g. messages → channels or templates → actions), ensure `PRAGMA foreign_keys = ON`. (The `better-sqlite3` docs say foreign keys default OFF.) If constraints exist, this will enforce referential integrity.  
  - **Synchronous mode:** Set `PRAGMA synchronous = NORMAL` (safe with WAL, reduces unnecessary disk syncs).  
  - **Busy timeout:** Set `PRAGMA busy_timeout = 5000` (wait 5s) to avoid “database is locked” errors under concurrent access.  
  - Ensure these pragmas are set **once on startup** (in `server/config/database.ts` or wherever the DB is opened). The best-practices doc emphasizes setting them *before any queries*.  
  - **Transaction Handling:** Currently, Turso transactions are a no-op (`if useTurso then await fn()`), meaning multi-statement transactions aren’t atomic. This should be fixed: use `BEGIN TRANSACTION` / `COMMIT` explicitly for SQLite and equivalent for Turso (see libSQL docs). If not easily fixed, at least note as technical debt.  
  - **Close DB:** Ensure the DB is closed on app shutdown to flush WAL (as [61†L146-L154] suggests). Add handlers for `SIGINT`/`SIGTERM` to close the database connection (not just let Node exit abruptly).  
- **Data Retention:** Aside from backups which we addressed in Phase 4, consider if logs or old entries should be pruned (e.g. action logs, if any). If there is an “audit” table streaming to Discord (as hinted by the marketing copy), ensure it’s actually storing only needed events or not at all if using “zero-DB mode.”  
- **Turso vs SQLite fallback:** As noted, if `TURSO_DATABASE_URL` is missing, the app silently uses local SQLite, risking data loss on redeploy. Modify startup so that if a Turso environment variable is set incomplete (either URL or auth token missing), the server fails to start (or logs an error and exits). Document the requirement that both must be present in production.  
- **Tasks:**  
  - [ ] Review each table schema (can run `PRAGMA table_info(name)` on SQLite or inspect `server/src/migrations` if available). Note any missing `STRICT` (for type safety) or `INTEGER PRIMARY KEY` usage.  
  - [ ] Add indexes on columns used in JOIN/WHERE (e.g. foreign key columns, lookup columns like `discord_message_id`). For example, if sending often looks up a message by ID, ensure an index on that column.  
  - [ ] In `server/config/database.ts`, set the recommended pragmas on open: WAL, foreign_keys, busy_timeout, synchronous, cache_size, temp_store. Cite [61†L98-L105] as justification.  
  - [ ] Add shutdown hooks to close the DB (like in [61†L148-L156]).  
  - [ ] Handle Turso environment check: if only one of URL/token is set, throw an error at startup (so deploy fails fast).  
  - [ ] If feasible, migrate `better-sqlite3` to use connection options that enable shared cache, or consider using `db.pragma('cache_size', -20000)` for more memory cache (as in [61]).  
  - [ ] Add tests: e.g. simulate a locked database and verify busy_timeout helps. Not all pragmas are easily testable, but at least test a multi-statement operation to ensure ACID (maybe manual).  
  - [ ] Update the architecture note (`memory.md` or docs) to mention these DB settings and the fact that Turso (libSQL) is behind an env toggle.

## Phase 10 – Remove Marketing Copy and Improve UI Text

**Goal:** Remove or rephrase any AI-generated or misleading marketing text in the app and docs. Ensure UI/help text is clear and accurate.  

- **Examples:** The user specifically called out `"Zero-DB Storage Mode: Audit events stream straight to Discord, using 0 KB SQLite space."` We need to find where this text appears (likely in a UI tooltip or README). Remove it or reword it. For example, say “Event logs can be sent to your Discord via a webhook (optionally), so you can view them in a channel without storing them in SQLite.” (Only if that feature exists.)  
- **General:** Search the UI and documentation for phrases that sound like marketing fluff or AI filler. Replace with concise explanations or remove if irrelevant.  
- **Citations:** This is editorial; no external citation needed. We could reference style guides (Frontend Checklist says to use clear, honest wording), but not necessary.  

**Tasks:**  
  - [ ] Grep the codebase for suspicious phrases (e.g. “0 KB SQLite”, “auto-update”, “storage mode”). Remove or rewrite them.  
  - [ ] Review README and in-app help text for any outdated info (e.g. remove any mention of the removed webhook mode).  
  - [ ] Ensure consistency (e.g. “Server Bot” vs “Discord Bot”).  
  - [ ] Possibly consult a front-end copywriting checklist (e.g. [29]) to make sure tooltips are succinct and clear.  

## Phase 11 – Discord Policy and Security Review

**Goal:** Ensure all features comply with Discord’s Developer Terms and common security practices. Document any potential issues.  

- **User Data:** We already covered user data minimization for `{user<ID>}` (Phase 3) and staff permissions (Phase 8). Explicitly note: *No feature should use a Discord user’s personal token (no “self-bot”) or scrape data without consent*. All operations must use the bot token and scopes granted in Discord’s Developer Portal.  
- **Rate Limits:** The app should respect Discord rate limits. For example, bulk-editing tracked messages could hit limits if many occur at once. We might implement slight delays or coalesce edits. At minimum, handle 429 responses by retrying after the `retry_after` interval (Discord API returns this in 429s).  
- **Intents & Gateway:** The bot’s `DISCORD_BOT_TOKEN` should have the appropriate Gateway Intents enabled (especially `GUILD_MEMBERS` if we fetch user names). Check the docs: to fetch arbitrary user profile by ID, no intent is needed if using REST; but if relying on cache, the GUILD_MEMBERS intent might be necessary for nickname updates. Clarify in docs that if “auto-fetch user names” is used, the bot needs the “Guild Members” intent if you want real-time updates.  
- **No Self-Bots:** Ensure nowhere in the code do we accidentally send requests as if from a user’s token. Always use the official Discord library methods (discord.js/Sapphire).  
- **Content Moderation:** Since users can send arbitrary embed content, remind developers that the app should not facilitate spam. But given this is a self-deployed tool, the developer is responsible for how it’s used. Possibly cite Discord Community Guidelines if relevant: “Applications must not facilitate harassment or illegal activities” (but this is general). We might cite the Discord Developer Terms [69†L124-L132] that forbid misuse of the API.  
- **Citations:** We already have [41] and [69]. Perhaps cite [69†L124-L132] (prohibiting misuse of the API) as a general warning. Also [69†L75-L83] about correct app descriptions and not misrepresenting identity (we should ensure the app’s name/desc in Discord Developer Portal is accurate).  

**Tasks:**  
  - [ ] Audit usage of Discord APIs in the code. For each, ensure we use bot token (not user token) and have the needed scope/intent.  
  - [ ] Add error handling for rate limits (429 responses) if not already present.  
  - [ ] Update documentation to say which intents the bot needs (especially if enabling new features like auto-fetch).  
  - [ ] Add a note in `memory.md` or docs: “All data fetched is either public (usernames/avatars) or belongs to the server/app; do not store user DMs or PII.”  
  - [ ] If any features could inadvertently DM users, warn against it or disable.  
  - [ ] Review OAuth flows: if the app has an OAuth redirect for “Bot Access,” ensure we ask only for the minimum scopes (bot join + interactions, possibly `applications.commands`), following least-privilege.

## Deliverables and Next Steps

- After review, we will implement the above phases **locally**. Each phase’s tasks should be committed separately with clear messages.  
- **Memory File:** We will create a `memory.md` (outside of GitHub, as local documentation) that captures the final architecture notes, design decisions, and developer instructions (including these phases, important CLI commands like `npm test`, env var requirements, etc.). This is for future reference and onboarding. Do **not** include secrets or user data.  
- **Staging and Testing:** We should test the combined changes locally (`npm test`, `npm run dev`) before pushing. Then push phase-by-phase (or as grouped commits) to GitHub after each phase passes all tests.  
- **Out of Scope:** We will *not* implement a full chat history tracker or complex user-session features beyond what’s requested. We will not redesign the entire database schema (except for small column additions/indexes). We will not migrate from SQLite to another database (Turso is already chosen). We will not implement single-sign-on or advanced authentication (not requested). The focus is on fixing and enhancing existing features.  

**Citations:** This plan cites Render docs on repository hosting and SQLite best practices for pragmas and performance. Where relevant, Discord policy documents are referenced to underscore compliance requirements. Additional guidance (e.g. front-end copy best practices) is followed implicitly. All references reflect current (2026) information.  

Please review this phased plan. Once you confirm it matches your priorities, I will proceed with implementing the changes phase-by-phase.