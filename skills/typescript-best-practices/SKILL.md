---
name: typescript-best-practices
description: Strict TypeScript practices for Hoho_manager shared contracts, API boundaries, React components, Discord payloads, and Node services.
---

# TypeScript Best Practices — Hoho_manager

Use for every `.ts` and `.tsx` change. Keep types aligned with runtime behavior and the repository's TypeScript configuration.

## Modeling

- Prefer discriminated unions when variants have different required fields or behavior.
- Model impossible states out when it improves clarity; do not add branded/non-empty wrappers without a concrete boundary or misuse risk.
- Prefer the simplest type that keeps normal operations total.
- Use `unknown` for untrusted external data. Narrow it with runtime checks or the repository's schema library before use.
- Derive types with `typeof`, `Pick`, `Omit`, `Parameters`, `ReturnType`, and `Awaited` where that avoids duplication.
- Use `satisfies` to validate literals without widening them.

## Assertions

- Do not use `any` as a shortcut, including `as any`, `@ts-ignore`, or broad index signatures that hide errors.
- Assertions are not categorically forbidden. Use one only when the runtime invariant is established and TypeScript cannot express it; keep it narrow and documented.
- Never assert that unvalidated external data has a trusted domain type.
- A type guard must verify every property needed for its claim; do not implement a guard that merely casts.
- Prefer discriminant narrowing, `in`, `typeof`, `instanceof`, and validated schemas before assertions.
- Use exhaustive `never` checks for important discriminated unions.

## Boundaries

- Validate HTTP bodies/params/query, Discord payloads, environment variables, and upstream HTTP responses at ingress.
- Keep external values as `unknown` until validation completes; convert to a domain type once at the boundary.
- Reuse existing schemas. Do not create parallel validators or duplicate shared contracts.
- Treat database rows as runtime data when migrations or legacy rows may violate declared shapes.

## React and APIs

- Use stable domain IDs for React keys and dnd-kit identities, never array indices for reorderable content.
- Keep Zustand selectors narrow. Clean up effects, timers, observers, animation frames, listeners, and abortable requests.
- Share request/response types through `shared` where client and server both depend on them, but validate server ingress independently.
- Keep Discord payloads within API limits and represent Classic/V2 variants distinctly where useful.
- Use installed Discord.js and discord-api-types definitions; do not widen literals unnecessarily.

## Maintainability

- Object parameters help complex functions, but avoid wrapper allocations in hot loops/render paths without reason.
- Use structured logging in shipped server code.
- Avoid generic abstractions for one call site and dependencies for functionality already in the stack.
