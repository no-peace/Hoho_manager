---
name: render-free-runtime
description: Keep Hoho_manager within Render Free's 0.1 CPU and 512 MB RAM limits with bounded work, safe polling, and graceful shutdown.
---

# Render Free Runtime — Hoho_manager

Treat CPU, memory, network requests, database rows read, and writes as constrained budgets.

## CPU and background work

- Prefer event-driven work over new polling loops.
- Reuse existing scheduler/timer ownership. Prevent overlapping ticks and duplicate intervals.
- Defer expensive maintenance away from startup and user-facing bursts. Keep sweeps bounded and resumable.
- Bound concurrency; avoid unbounded `Promise.all`, tight loops, and large synchronous transformations.

## Memory

- Every cache needs a maximum entry/byte budget, expiry or invalidation policy, and cleanup.
- Do not cache whole tables or unbounded Discord objects.
- Page or stream large datasets instead of materializing them.
- Release timers, listeners, closures, streams, and large payloads after use.
- Cancel or drain unused fetch response bodies.

## Database and network

- Avoid full-table scans, repeated reads, N+1 queries, and oversized result sets.
- Select only required columns and rows; use indexed bounded queries.
- Batch related statements only when transaction semantics remain correct.
- Use explicit timeouts and propagate cancellation where possible.
- Never automatically retry non-idempotent Discord sends after ambiguous outcomes.

## Startup and shutdown

- Validate production configuration before opening long-lived resources.
- Start the HTTP listener before optional maintenance when startup latency matters.
- Stop polling producers before awaiting in-flight work. Cap the wait, close the HTTP server, then close local DB resources.
- Clear intervals and unref timers when appropriate. Avoid unbounded shutdown waits.

Before adding a background task, document its trigger, cadence, per-run work limit, overlap protection, DB budget, memory bound, and shutdown behavior.
