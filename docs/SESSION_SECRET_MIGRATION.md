# Production session-secret migration

The server now requires a dedicated production `SESSION_SECRET`. It must be at least 32 characters and must not equal `ADMIN_API_KEY`.

`ADMIN_API_KEY` remains the shared server/bot API credential. Do not rotate it as part of this change.

## Configure Render before deploying the new server code

1. Generate a new random secret locally. From a terminal with Node.js installed, run:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Use the generated 64-character value only for `SESSION_SECRET`. Do not reuse `ADMIN_API_KEY`, `ENCRYPTION_KEY`, or any other credential.

2. In the Render Dashboard, open the `Hoho_manager` web service, then **Environment**.
3. Add `SESSION_SECRET` with the generated value. Keep the existing `ADMIN_API_KEY` unchanged.
4. Save the environment change. Configure the value before manually deploying or resuming the service; production startup now fails closed if the dedicated secret is missing, shorter than 32 characters, or equal to the admin key.

## Existing browser sessions

Choose one of these behaviors:

- **Immediate re-authentication (recommended):** leave `SESSION_LEGACY_ADMIN_KEY_UNTIL` unset. Existing sessions signed with `ADMIN_API_KEY` become invalid and users sign in again.
- **Bounded compatibility:** before deploying, set `SESSION_LEGACY_ADMIN_KEY_UNTIL` to an ISO-8601 UTC timestamp no more than 24 hours in the future, for example `2026-11-22T10:30:00.000Z`. This preserves only admin-key sessions issued before the migration began. Tokens issued after the migration start are rejected even if signed with the old key. The compatibility window closes automatically at the cutoff.

The cutoff is optional and should not be extended. After it expires, remove `SESSION_LEGACY_ADMIN_KEY_UNTIL` from Render. No database migration is required.

## Security behavior

- New sessions are always signed with `SESSION_SECRET`.
- With no compatibility cutoff, only `SESSION_SECRET` signatures are accepted.
- During the optional window, `ADMIN_API_KEY` signatures are accepted only for tokens issued before the migration start and only until the cutoff.
- The admin key is never accepted as a fallback production signing key.
- Local development may continue using the existing `ADMIN_API_KEY` fallback when `SESSION_SECRET` is blank.
