---
name: nodejs-backend-patterns
description: Project-aligned Node.js 22 and Express 5 patterns for Hoho_manager API routes, middleware, services, and shutdown.
---

# Node.js Backend — Hoho_manager

Use for `server/` work. The server uses Node.js 22+, TypeScript, Express 5, Helmet, CORS, express-rate-limit, the shared `DatabaseClient`, and a structured logger. The separate `bot/` worker uses Discord.js/Sapphire.

## Architecture

- Keep routes thin: validate input, authenticate and authorize, call a service, map results to an HTTP response.
- Keep domain logic in services and persistence behind the existing `db` interface. Do not add another DB layer.
- Follow Express 5 async error propagation; avoid redundant wrappers without a concrete compatibility reason.
- Use the existing environment parser and logger. Never read secrets ad hoc or log credentials, tokens, authorization headers, or sensitive payloads.
- Validate HTTP bodies, query/path params, Discord payloads, and upstream responses at ingress. Parsed JSON is untrusted until validated.
- Keep response shapes consistent with neighboring routes. Do not expose internal exception messages or stack traces.
- Use explicit body/request limits and route-appropriate rate limits. Avoid global limits that break normal editor workflows.

## Authorization and security

- Authentication is not authorization. Check the actor's permission for the specific resource and action.
- Resolve channel ownership through `getChannelGuildId`; enforce guild, channel, and role-mention allowlists server-side.
- Enforce `can_manage_automation` and `can_use_components_v2` on the server.
- Scrub user-controlled mentions and set explicit allowed-mentions policies.
- Compare fixed-length secrets with `crypto.timingSafeEqual` after equal-byte-length checks.
- CORS, Helmet, and rate limiting supplement authorization; they do not replace it.

## Resource discipline

- Render Free has 0.1 CPU and 512 MB RAM. Keep synchronous sections, payloads, and result sets small.
- Avoid full-table reads, N+1 queries, unbounded concurrency, and unbounded caches.
- Parallelize independent I/O only when concurrency is bounded and it does not overload Turso or Discord rate limits.
- Every timer, listener, stream, and background loop needs an owner and shutdown path.
- Cancel or drain unused fetch response bodies. Use timeouts and propagate abort signals when possible.
- Do not retry writes unless idempotent or protected by an idempotency key. Never retry ambiguous Discord message sends.
- On shutdown, stop producers, await in-flight work with a finite cap, close the HTTP server, then close local DB resources.

Read [Turso DB](../turso-db/SKILL.md) for SQL/transactions and [Discord.js + Sapphire](../discordjs-sapphire/SKILL.md) for Discord flows. Do not run npm/tests/typechecks/builds in this repository.
