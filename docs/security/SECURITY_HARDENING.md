# HoHo Manager security hardening review

**Review date:** 2026-11-15  
**Branch:** `security/hardening-2026-11`  
**Scope:** Express API, Discord OAuth/session handling, staff authorization, WEAO/executor routes, URL attachment downloads, request parsing, HTTP security headers, and CI dependency checks.

This is a source-level security review with targeted regression coverage. It is not a third-party penetration test, and no production data or Discord messages were modified.

## Findings addressed

### High — Private templates could be exposed through public WEAO resolution

The WEAO routes previously searched every saved template across every user. A matching private template could be returned with its message payload and action flows through the exploit resolver.

**Changes**
- WEAO template lookup now returns only templates owned by the caller or explicitly marked public.
- A custom executor linked to another user's private template is not resolvable.
- Exploit listing and resolution require the `can_use_weao_exploits` staff permission (or a valid administrator key).
- Executor listing is no longer anonymous; it uses the same WEAO staff permission.
- Public WEAO changelog lookups remain public because they do not expose saved user templates.

### High — URL attachment downloads were vulnerable to DNS-rebinding SSRF

The previous flow validated DNS results and then used `fetch()`, which performed a separate DNS lookup for the connection. A rebinding hostname could change its answer between those steps.

**Changes**
- Resolve the hostname once, reject the request if any returned address is blocked, and connect using the validated address through a pinned `lookup` callback.
- Do not follow redirects.
- Block loopback, private, link-local, carrier-grade NAT, multicast, reserved/documentation ranges, IPv4-mapped private addresses, and IPv6 NAT64/6to4 paths.
- Preserve per-file and combined attachment byte limits and apply a request timeout.

### High — Production could fall back to a known development admin key

The production environment previously inherited `dev-admin-key` when `ADMIN_API_KEY` was missing. A warning alone did not prevent startup.

**Changes**
- The development default is now used only outside production.
- Production startup stops if `ADMIN_API_KEY` is missing, equals the development default, or is shorter than 32 characters.
- A separate `SESSION_SECRET` is documented and recommended. The current admin-key fallback remains for compatibility, and verification accepts both configured session and admin keys during rotation; newly issued sessions use the configured session secret.
- A weak explicitly configured production `SESSION_SECRET` is rejected at startup.
- Production startup also requires a dedicated `ENCRYPTION_KEY` of at least 32 characters. New secrets use it; decryption retains the admin-key-derived legacy key as a migration fallback so existing stored bot tokens remain readable.

### High — Anonymous upload requests could consume multipart processing resources

The send route parsed and buffered multipart data before authentication and per-user rate limiting.

**Changes**
- Attach the caller identity, reject anonymous callers, and apply the send limiter before multipart parsing.
- The message-specific send/edit permission check still runs after parsing, when the form fields are available.

### High — Cookie-authenticated mutations lacked explicit CSRF origin enforcement

CORS controls browser response access; by itself it does not stop a cross-site form submission from reaching a state-changing endpoint.

**Changes**
- In production, unsafe HTTP methods accept browser origins only when they match a configured `CLIENT_ORIGIN`.
- If the browser omits `Origin`, a valid `Referer` is checked.
- A request carrying the browser session cookie is rejected if it has neither a trusted origin nor a trusted referer.
- Machine-to-machine requests without a browser session cookie and without an `Origin` header remain supported.

### Medium — Gateway relay lacked the general API rate limit and accepted weakly shaped payloads

**Changes**
- Apply the API rate limiter to `/api/interactions/relay` without throttling Discord's signed interaction endpoint.
- Require snowflake-shaped interaction/application IDs, match the configured application ID when present, limit token length/characters, accept only component or modal-submit interactions, and require a bounded `custom_id`.
- Discord's signed interaction path retains timestamp and Ed25519 signature verification. Interaction receipt storage already provides duplicate-delivery handling.

### Medium — OAuth authorization codes were not bound with PKCE

**Changes**
- Discord login now generates a per-request PKCE verifier and S256 challenge.
- The verifier is stored in a short-lived HttpOnly cookie and sent only during the server-side token exchange.
- The callback requires both the matching state cookie and a valid verifier, then clears both cookies.

### Medium — Session tokens did not require a valid bounded expiry window

**Changes**
- Reject oversized tokens, malformed claims, non-snowflake user IDs, missing/non-integer `iat` or `exp`, expired tokens, future-issued tokens, and lifetimes longer than the configured 24-hour TTL.
- Validate the millisecond issue time against the signed second-level issue time.

### Medium — Host-header redirect injection and permissive inline script CSP

**Changes**
- HTTPS redirects now use only hosts present in configured frontend origins or the Discord OAuth redirect URI; an unrecognized Host header is rejected.
- Production CSP no longer allows inline scripts. Inline styles remain enabled because the current UI uses runtime style attributes.

## Existing controls confirmed during review

- Helmet security headers, HSTS in production, frame denial, MIME-sniffing protection, and a restrictive default CSP.
- CORS is configured with explicit production origins and credentials.
- General API and authentication rate limits are present.
- JSON, URL-encoded, multipart, and Discord raw-body parsing have explicit size limits.
- Discord webhook interactions use Ed25519 signature verification and a five-minute timestamp window.
- Staff permission checks query active staff records and do not trust stale session permission flags.
- Template service ownership checks are enforced server-side.
- SQL repository calls use parameterized values in the reviewed paths.
- Dependabot is already configured for weekly npm and GitHub Actions updates.
- The existing security workflow runs Gitleaks, Semgrep security rules, and `npm audit --audit-level=high`; its push trigger now covers all branches.

## Production configuration required

Before deploying this branch, verify the Render environment:

1. Set `NODE_ENV=production`.
2. Set `ADMIN_API_KEY` to a unique random value of at least 32 characters. The server will now refuse to start with a missing, default, or short value.
3. Set `SESSION_SECRET` to a separate random value of at least 32 characters. Session verification supports the previous admin-key fallback during rotation, so existing sessions can age out naturally.
4. Set a dedicated `ENCRYPTION_KEY` to a random value of at least 32 characters. Production startup now refuses to run without it. Existing admin-key-encrypted bot tokens remain decryptable during migration; new values use the dedicated key.
5. Set `CLIENT_ORIGIN` to the exact HTTPS frontend origin(s), without a trailing slash.
6. Keep `DISCORD_REDIRECT_URI` HTTPS and exactly matched in the Discord Developer Portal.

## Local validation results

Validated on Node.js 24 in an isolated temporary worktree, not in the user's existing modified checkout:

- Shared package: 42 tests passed.
- Server: 225 tests passed.
- Client: 190 tests passed.
- Bot: 27 tests passed.
- Total: 484 tests passed.
- Typecheck: all workspaces passed.
- Build: all workspaces passed.
- `npm audit --audit-level=high`: 0 vulnerabilities.

The new SSRF regression suite contains four checks and passed. GitHub Actions checks for the draft PR had not yet reported a run at the time this report was updated. The security workflow still needs to complete before merge.

## Residual risks and limits

- Express rate limiting currently uses its default in-memory store. If the service runs multiple instances, limits are per instance; use a shared store for cluster-wide enforcement.
- The URL attachment feature still permits downloads from arbitrary public HTTP(S) hosts. Private/reserved addresses and DNS rebinding are blocked, but a strict destination allowlist would provide a smaller outbound network surface if product requirements permit it.
- The admin API key remains a powerful shared credential. Keep it out of browser bundles, logs, screenshots, and source control; rotate it if exposure is suspected.
- The app still needs production secret configuration and deployment validation. This branch has not been deployed to production by this review.
- Automated tests and CI results must be checked before merge; a passing test suite is not a substitute for an external penetration test.

## Research references

- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
- [Express production security best practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [RFC 9700 — OAuth 2.0 Security Best Current Practice](https://www.rfc-editor.org/rfc/rfc9700.html)
- [Discord OAuth2 documentation](https://discord.com/developers/docs/topics/oauth2) — Discord documents authorization-code state validation and supports PKCE with S256.
