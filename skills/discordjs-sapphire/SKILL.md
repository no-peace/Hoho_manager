---
name: discordjs-sapphire
description: Project-specific Discord.js 14, Sapphire 5, Discord API v10, interactions, components, permissions, and reliable message delivery.
---

# Discord.js + Sapphire — Hoho_manager

Use for `bot/`, Discord interaction handling in `server/`, message payload construction, commands, listeners, and API calls. Dependencies are Discord.js 14 and Sapphire 5.

## Runtime split

- `bot/` owns the persistent Sapphire gateway worker: slash commands, presence, and gateway events.
- `server/` owns the HTTP interaction endpoint and action execution. A gateway connection is not required for HTTP-delivered button, select, or modal interactions.
- Keep the API boundary explicit. Use the existing API client and environment validation; do not duplicate business logic in the gateway worker.
- Preserve module-URL-based Sapphire `baseUserDirectory` resolution for both `tsx` and built output.

## Acknowledgement

- Discord requires an initial interaction response within 3 seconds. Reply or defer before slow database, network, or business-logic work.
- Do not wait for Turso or external HTTP calls if that risks the deadline.
- Acknowledge exactly once. After defer/reply, use the matching edit/follow-up APIs.
- Handle expired/already-acknowledged interactions without exposing tokens or raw upstream errors.

## API v10 and Components V2

- Every `custom_id` is at most 100 characters and unique within its message.
- Modal titles are at most 45 characters; modals contain at most 5 top-level components.
- Components V2 total text budget is 4,000 characters. Count all text-bearing component content.
- Every V2 `Section` must have an accessory.
- When sending Classic messages, clear `IsComponentsV2` (`1 << 15`) if the source payload may carry that flag.
- Do not mix Classic and V2 assumptions. Validate the complete payload before sending.

## Permissions and untrusted content

- Enforce permissions server-side; UI visibility and command registration are not authorization.
- Preserve `getChannelGuildId`, guild/channel allowlists, role-mention allowlists, `can_manage_automation`, and `can_use_components_v2`.
- Scrub user-controlled mentions and use explicit allowed-mentions policies.
- Validate guild, channel, message, role, and custom IDs at boundaries.
- Never log bot tokens, interaction tokens, admin keys, or authorization headers.

## Delivery and reliability

- Respect Discord rate limits and the library's built-in handling.
- Never automatically retry a non-idempotent message-send POST after timeout or 5xx. The send may have succeeded even if the response was lost.
- Retry only operations known to be idempotent or protected by an application-level idempotency mechanism.
- Avoid unbounded fan-out, cache growth, and repeated fetches. Render Free limits apply to the API worker.

## Security

- Use `crypto.timingSafeEqual` for secret comparisons after equal-length checks.
- Privileged command allowlists must come from validated environment configuration and fail closed when empty.
- Never trust client-supplied guild, channel, role, or owner identifiers.

## Review checklist

- [ ] Acknowledge before slow work.
- [ ] Enforce permissions server-side.
- [ ] Validate custom ID, modal, and Components V2 limits.
- [ ] Constrain mentions.
- [ ] Do not retry ambiguous message sends.
- [ ] Keep secrets out of logs and compare timing-safely.
- [ ] Clean up timers and listeners.
