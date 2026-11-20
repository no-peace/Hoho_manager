---
name: sharp-edges
description: Identify security footguns and unsafe defaults in Hoho_manager APIs, permissions, configuration, secrets, cryptographic comparisons, and user-controlled Discord content.
---

# Sharp Edges — Hoho_manager

Use for security-sensitive API design, auth, permissions, secrets, configuration, validation, and external-data boundaries. Make secure behavior the default.

## Project invariants

- Authorization is enforced server-side for every protected operation. UI visibility and disabled controls are not security boundaries.
- Resolve channel ownership through `getChannelGuildId`. Enforce guild/channel allowlists and role-mention allowlists server-side.
- Enforce `can_manage_automation` and `can_use_components_v2` on the server.
- Scrub user-controlled mentions and set explicit allowed-mentions policies.
- Compare secrets/API keys with `crypto.timingSafeEqual` after validating equal byte lengths.
- Fail closed on invalid production configuration or empty privileged allowlists.
- Never log bot/interaction tokens, admin keys, encryption keys, authorization headers, or full sensitive payloads.

## Footgun review

For each security-relevant option, inspect:
1. Zero, empty, null, and negative values: are semantics explicit?
2. Defaults: can omission disable auth, authorization, rate limiting, or validation?
3. Trust boundaries: can user-controlled JSON, URL, path, identifier, SQL, or mention reach a privileged operation?
4. Type confusion: can channel IDs be treated as guild IDs, or unvalidated strings as trusted permissions?
5. Silent failure: can parse/signature/permission failures become permissive fallbacks?
6. Retry semantics: can an automatic retry duplicate a non-idempotent Discord send?
7. Resource exhaustion: can a request create unbounded work, memory, cache growth, polling, or DB reads?

## Design rules

- Prefer semantic functions that validate and authorize internally over exposing raw security primitives to every caller.
- Use explicit allowlists and narrow capability checks, not client-supplied admin booleans.
- Reject invalid configuration at startup rather than silently choosing permissive defaults.
- Keep security parameters typed and validate them at ingress.
- Return safe actionable errors to clients; retain diagnostics in structured logs.
- Do not invent cryptographic algorithms or token formats when maintained platform primitives exist.

For every finding, record attacker-controlled input, vulnerable boundary, concrete impact, and minimal mitigation. Do not label a theoretical issue exploitable without tracing data flow.
