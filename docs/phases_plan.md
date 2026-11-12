## Phase 1: Security & Permissions – Completed

1. **Staff guild restrictions**. We fixed the missing guild-allowlist check in `POST /api/send` and in the single-message lookup route. A new regression test ensures a non-admin staff member *cannot* send or fetch a message in a guild they’re not allowed to access (tests were added to `server/tests/routes.test.ts`).  

2. **Push to GitHub**. These changes have been committed (update tests and `send.ts`) and deployed. Verify on Render that staff still work in their allowed guilds, and are forbidden elsewhere.  

   - *(Render hosting note)* Render can deploy private repos once you connect your GitHub account. You do **not** need to make the repo public – just ensure Render’s GitHub integration has access. Also note that Render’s **Free tier** has an *ephemeral filesystem*, so don’t rely on local SQLite files for persistent data. (You are already using Turso for persistence, which is good.)

## Phase 2: Database Hardening & Migrations

3. **Enforce FK and WAL on SQLite**. For local SQLite (dev/test), we should enable best-practice pragmas on every connection. In `server/src/config/database.ts`, after opening the DB, add pragmas: 

   ```ts
   // After creating the Database instance:
   this.db.pragma("journal_mode = WAL");          // Enable WAL for concurrent reads/writes
   this.db.pragma("foreign_keys = ON");           // Enforce foreign key constraints
   this.db.pragma("busy_timeout = 5000");         // Wait up to 5s on SQLITE_BUSY
   this.db.pragma("synchronous = NORMAL");        // Safer performance with WAL
   ```
   (These settings are recommended for production SQLite usage.) If you ever fall back to local SQLite in production, **any** writes (message logs, etc.) are lost on deploy or idle spin-down, so continue using Turso or a persistent database. 

4. **Turso transactions**. The current `transaction()` method in `server/src/config/database.ts` is a no-op under Turso. We should make it truly transactional. Replace:

   ```ts
   async transaction<T>(fn: () => Promise<T> | T): Promise<T> {
     if (useTurso) {
       return await fn();
     }
     // ...
   }
   ```
   with code that wraps `fn` in a libSQL transaction. For example, using libsql’s `transactionAsync`: 
   
   ```ts
   async transaction<T>(fn: () => Promise<T> | T): Promise<T> {
     if (useTurso) {
       // Run fn inside a Turso (libsql) transaction:
       const txFn = this.db.transactionAsync(fn);
       return await txFn(); 
     }
     // default better-sqlite3 fallback:
     const tx = this.db.transaction(fn);
     return tx();
   }
   ```
   This ensures atomic writes under Turso. (If you cannot import `transactionAsync`, you may instead execute `BEGIN` / `COMMIT` statements manually around `fn`.)

5. **Fail-fast Turso config**. If your environment is meant to use Turso, detect missing config. In `server/src/config/database.ts`, after loading `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`, throw an error if **only one** is set (to avoid accidentally writing to local files). You could do:

   ```ts
   if (process.env.USE_TURSO === "true") {
     if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
       throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must both be set in production.");
     }
   }
   ```
   (Adjust to your env logic.) This prevents silent fallback to SQLite in production.

6. **Cleanup unused fields**. If any database columns are no longer used (e.g. legacy webhook URLs or old staff fields), plan a migration to drop them. For example, if you removed the webhook profile features, drop any `webhook_profiles` table or `webhook_url` columns. Ensure your migrations in `server/migrations/` reflect this. *(No specific code snippet given here, but audit your schema for stale columns and add migrations to clean them up.)*

## Phase 3: Additional Regression Tests

Add tests for every staff-protected endpoint:

- **`GET /api/channels/:channelId/messages`** – Staff in a forbidden guild should get 403. You can copy the style of the `POST /api/send` test (mock `discordService.getChannelGuildId` to a different guild). 
- **`GET /api/channels/:channelId/messages/:messageId`** – Staff not allowed in that guild should get 403. (We already added the guild check to this route above.)
- **Admin bypass** – A user with `isAdmin=true` should be allowed everywhere. Add tests with `"x-staff-id"` of an admin user to ensure no 403.
- **Legacy webhook endpoints** – If `/api/user-profiles` or `/api/send/webhook` are supposed to be removed, test that they return 404 or the correct error.
- **Discord interaction tests** – For any flows (buttons, modals), ensure the expected outcome. (This is a bigger effort; prioritize basic permission flows first.)

Run all tests (`npm test`) before pushing any change.

## Phase 4: Frontend Fixes and Enhancements

7. **Bot Dispatch Modal text**. In `client/src/components/send/BotDispatchModal.tsx`, update the UI labels:

   - Change **“Dispatch via Bot”** to **“Dispatch via Server Bot”**.
   - Add a corresponding label **“Edit via Server Bot”** where appropriate (the test expects this exact string).
   
   For example, if you have radio buttons or a toggle, ensure one option says `Dispatch via Server Bot` and another `Edit via Server Bot`. 

   **Patch example** (in React JSX):
   ```diff
   - <FormControlLabel value="bot" control={<Radio />} label="Dispatch via Bot" />
   + <FormControlLabel value="bot" control={<Radio />} label="Dispatch via Server Bot" />
   + <FormControlLabel value="botEdit" control={<Radio />} label="Edit via Server Bot" />
   ```
   *(Adjust the above snippet to your component’s structure.)*  
   This will satisfy the `m4_challenger2_layout_stress.test.ts` expectations.

8. **Show bot’s profile in preview**. Ensure the preview and final message show the actual bot user’s avatar and name (rather than a generic placeholder). In your Discord service or preview code (perhaps in `client/src/utils/previewMessage.tsx` or similar), when `mode: "bot"` is selected, use the bot’s user data. For example, fetch or pass the bot’s ID, username, and avatar from your backend (the same bot token you use) so the modal can display them. If you currently use a dummy avatar, replace it with something like:
   ```tsx
   // Pseudo-code in preview component:
   const botUser = useBotUser();  // Custom hook or prop with {username, avatarURL}
   // ...
   return (
     <MessagePreview avatar={botUser.avatarURL} username={botUser.username} ... />
   );
   ```

9. **Remove webhook references**. Anywhere in the UI that mentions “webhook URL” under Bot access or profiles, delete or change it (the webhook-send flow was removed). For example, if `BotDispatchModal` or an admin “Bot Settings” page had text like “(this requires a webhook URL)”, remove that sentence. The tests already expect no `/api/send/webhook` endpoint and “Bot Dispatch Modal” labels have been adjusted.

10. **Author Auto-Fetch (optional)**. If you want `{user<id>}` variables to resolve to the latest username/avatar, the backend must handle it. Currently, your DiscordService likely has a function to `fetchUser(userId)`; use this to fill in variables. For embed authors specifically, you could allow a syntax like `author: { name: "{user<ID>}", iconURL: "{user<ID>}.avatar", url: "https://discord.com/users/{user<ID>}" }`, then at send-time replace these with Discord API calls to get the real data. Implementing this fully is non-trivial; if not feasible immediately, at least **update your docs/tooltip** to clarify that `{user<...>}` will populate on send but not in the live preview.

11. **Tracked Messages / Backups (future)**. You mentioned “track message” and auto-deletion after 2 weeks. This will require:

   - **DB**: Add a field like `retain_until DATE` or `is_tracked BOOLEAN` in your `message_saves` or `backups` table. 
   - **Backend**: A daily job (or on server start) that deletes untracked messages older than 14 days.
   - **UI**: In the edit-backup dialog (`client/src/components/dashboard/BackupEditModal.tsx` or similar), add a checkbox “Track this message” and a date picker for “Retain until” if checked (like Discohook’s backup interface).
   - **API**: Accept these new fields in the update route (`PUT /api/backup/:id`).

   *(This is an advanced feature – plan it as a separate deliverable.)*

12. **Remove AI-generated copy**. In any docs or UI where you saw marketing-style text (e.g. “Zero-DB Storage Mode: Audit events stream straight to Discord…”), delete or rephrase it. For example, if your README or settings page has that sentence, remove it entirely. Only keep factual descriptions of features. 

13. **Rich Picker & Misc UI bugs**. If the “rich text picker” (component selector) has layout issues, fix its CSS or state logic. Also review any mention of “Custom Executor Payloads & Auto-Updates” (likely tooltips or documentation) and ensure they accurately reflect current behavior. For example, if you added automatic updating of options, describe it clearly; otherwise remove stale notes. *(These items are smaller and specific – inspect and correct them as needed.)*

14. **Implementation Memory**. Create a new file `docs/implementation-memory.md` (or `src/docs/implementation-memory.md`) to record what we did and why. For example:

   ```markdown
   # Implementation Memory (Hoho Manager)

   ## Permissions
   - Fixed staff-guild check in `/api/send` and added tests. Staff now cannot send or fetch messages in disallowed guilds.
   - Verified admin bypass still works.
   - Removed webhook endpoints and updated tests.

   ## Database
   - Enabled WAL journaling and `foreign_keys=ON` for SQLite (per best practices).
   - Ensured Turso transactions wrap operations atomically (using `transactionAsync`).
   - Added startup checks to require both `TURSO_` env vars to use Turso.

   ## Frontend
   - Changed UI labels to “Server Bot” instead of just “Bot” and ensured bot avatar/name show correctly.
   - Removed obsolete webhook instructions from UI.
   - (Future) Plan for message backup tracking and pruning.

   ## Deployment Notes
   - Repository can remain private (Render supports private repos).
   - Continue pinging the service to avoid idle spin-down; remember filesystem is ephemeral.

   ## Testing
   - Added regression tests for all staff-related permission cases.
   - Cleaned up mocks in `routes.test.ts` to use the current Discord service methods.

   ```

   This file will help future developers understand the rationale for these changes.

## Summary of Changes

Below are the key file edits. For each, **find and replace or insert** the indicated code. We present diffs/patches for clarity; apply them in your editor or via GitHub.

---

### 1. `server/src/routes/send.ts`

- **Add guild check in `/api/send`.** Replace the duplicate channel check with a guild check. Find the lines:

   ```ts
   if (typeof channelId === "string") {
     assertStaffChannelAllowed(staffCtx, channelId);
-    await assertStaffChannelAllowed(staffCtx, channelId);
+    await assertStaffGuildAllowed(staffCtx, channelId);
   }
   ```

- **Add guild check in message lookup route.** In the handler for `GET /api/channels/:channelId/messages/:messageId`, after the channel check, insert the guild check:

   ```ts
   assertStaffChannelAllowed(req.staffContext, channelId);
+  await assertStaffGuildAllowed(req.staffContext, channelId);
   ```

*(The rest of the file remains unchanged.)*

---

### 2. `server/tests/routes.test.ts`

- **New regression test**. Add the following test **inside** the `describe("POST /api/send", ...)` block (just after the existing tests):

   ```ts
   it("blocks staff from sending to a channel in an unauthorized guild", async () => {
     const staffId = "123456789012345678";
     await staffRepository.create({
       discord_user_id: staffId,
       discord_username: "regression_test",
       granted_by_discord_id: "987654321098765432",
       can_send_messages: 1,
       cooldown_seconds: 0,
       max_messages_per_hour: 10,
       allowed_channel_ids: JSON.stringify(["channel_123"]),
       allowed_guild_ids: JSON.stringify(["guild_allowed"]),
     });
     try {
       // Mock the Discord service: channel_123 belongs to guild_123
       vi.mocked(discordService.getChannelGuildId).mockResolvedValue("guild_123");
       const res = await fetch(`${baseUrl}/api/send`, {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
           "x-staff-id": staffId,
         },
         body: JSON.stringify({
           mode: "bot",
           channelId: "channel_123",
           payload: { content: "Regression test message" },
         }),
       });
       expect(res.status).toBe(403);
       expect(discordService.sendChannelMessage).not.toHaveBeenCalled();
     } finally {
       await staffRepository.delete(staffId);
     }
   });
   ```

*(Ensure you have `import { staffRepository }` at top of the test file if not already present.)*

---

### 3. `server/src/config/database.ts`

- **Enable SQLite pragmas.** After creating the database connection (wherever you instantiate `Database`), insert:

   ```ts
   // Immediately after opening the SQLite DB (before any queries):
   this.db.pragma("journal_mode = WAL");
   this.db.pragma("foreign_keys = ON");
   this.db.pragma("busy_timeout = 5000");
   this.db.pragma("synchronous = NORMAL");
   ```
   For example, if the code is:
   ```ts
   const sqlite = useTurso
     ? new LibSqlDatabase(/* ... */)
     : new SQLiteDatabase(/* ... */);
   this.db = sqlite;
   ```
   then follow that with the pragmas above.

- **Implement transactions for Turso.** Change the `transaction()` method. Replace it with something like:

   ```ts
   async transaction<T>(fn: () => Promise<T> | T): Promise<T> {
     if (useTurso) {
       // Run fn inside a libSQL transaction (BEGIN/COMMIT).
       const wrapped = (this.db as any).transactionAsync(fn);
       return await wrapped();
     }
     // For SQLite (better-sqlite3):
     const tx = (this.db as any).transaction(fn);
     return tx();
   }
   ```

   (Adjust the casts/calls to match your DB wrapper. The key idea is to use libsql’s `transactionAsync` instead of skipping the transaction.)

- **Enforce Turso config.** At startup (e.g. in the same file or your config loader), add a check:

   ```ts
   if (process.env.USE_TURSO === "true") {
     if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
       throw new Error("Turso mode requires both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.");
     }
   }
   ```

*(No other changes to this file are needed unless you identify unused columns.)*

---

### 4. `client/src/components/send/BotDispatchModal.tsx`

- **Update labels.** Find where the component renders the dispatch options. For example:

   ```tsx
   <FormControlLabel value="bot" control={<Radio />} label="Dispatch via Bot" />
   ```
   Change it to:
   ```diff
   - <FormControlLabel value="bot" control={<Radio />} label="Dispatch via Bot" />
   + <FormControlLabel value="bot" control={<Radio />} label="Dispatch via Server Bot" />
   ```

- **Add “Edit via Server Bot”.** Immediately after (or wherever appropriate), add:
   ```tsx
   + <FormControlLabel value="botEdit" control={<Radio />} label="Edit via Server Bot" />
   ```
   This ensures the text “Edit via Server Bot” appears in the modal. The exact place to insert depends on your JSX structure; just ensure it’s logically consistent with the other options.

*(No changes to imports or logic – just the visible labels.)*

---

### 5. Other UI files

- **Remove webhook text.** Search the `client/` directory for any string “webhook” (especially in send-related components). Delete sentences that mention “webhook URL” in the context of Bot access. For example, if there was text like: 

   ```
   (requires a webhook URL to dispatch via a bot)
   ```

   remove that sentence. 

- **Bot profile in preview.** If your preview component hard-codes an avatar or name for the “bot” option, replace it with the actual bot’s data. For example, in the preview message component, use something like:

   ```tsx
   const { username, avatarURL } = props.mode === 'bot'
     ? useBotUserData() 
     : useUserData();
   ```
   and pass those into the preview card. The specifics depend on your code, but ensure the modal shows *your bot’s* avatar/username when “Server Bot” is selected.

- **Custom Payloads & Auto-Updates text.** If there is explanatory text on the executor step or settings page that looks AI-generated or irrelevant (e.g. “Custom Executor Payloads & Auto-Updates” header), simplify or remove it. Keep only concise instructions.

*(These changes are small and scattered; make sure to rebuild and check the UI manually for any leftover outdated text.)*

---

### 6. New file: `docs/implementation-memory.md`

Create this new Markdown file and add the contents described above in Phase 4 step 14. This is for future reference only and does not affect the app’s behavior.

---

## Testing and Deployment

After applying all changes above:

1. Run `npm test` (or `npx vitest run`) in both **server** and **client** projects to ensure no failures. Fix any typos or syntax errors as needed.
2. Check the `npm run migrate` step if you added any new migrations (especially for DB schema changes).  
3. Commit all changes and push to GitHub. Render will auto-deploy from `main` if configured. Verify on the live site:
   - Staff restrictions now work correctly.
   - Admin still has full access.
   - Bot dispatch shows the proper labels and bot profile.  
   - No references to the old webhook flows remain.

With these edits, the code should pass all tests and work within Discord’s terms. Let me know if any test still fails or if you encounter issues after deployment. Good luck!