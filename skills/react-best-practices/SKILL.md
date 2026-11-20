---
name: react-best-practices
description: React 19 hooks, state, rendering, and performance guidance adapted to Hoho_manager's Vite SPA.
---

# React Best Practices — Hoho_manager

Use for `client/src`. The client is React 19 + Vite 8 + Tailwind 4 with Zustand, dnd-kit, Motion, and Lenis. It is not a Next.js App Router or React Server Components application.

## Priorities

1. Preserve the existing architecture and visual language. Do not introduce Next.js, RSC, Server Actions, SWR, or another state library.
2. Avoid request waterfalls. Start independent requests together only when concurrency is bounded and failure handling remains correct.
3. Keep Zustand subscriptions narrow; do not subscribe large editor trees to frequently changing state.
4. Derive values during render where possible. Do not use effects merely to mirror props or calculate derived state.
5. Use effects to synchronize external systems. Clean up timers, listeners, observers, animation frames, and abortable requests.
6. Keep typing, keyboard, pointer, and drag paths cheap. Avoid large synchronous transformations on every keystroke or pointer move.
7. Memoize only when it prevents expensive work, stabilizes identity needed by a child/library, or is supported by profiling.
8. Lazy-load heavy, infrequently used features only when it improves initial loading without delaying an immediate interaction.
9. Use stable domain IDs for React keys and dnd-kit sortable IDs; never array positions for reorderable editor content.
10. Preserve `client/src/utils/editorSmoothScroll.ts` and Lenis behavior unless explicitly asked to change scrolling.

## Async pattern

For independent requests, start them before awaiting:

```ts
const [profile, settings] = await Promise.all([
  fetchProfile(),
  fetchSettings(),
]);
```

Keep fan-out small under Render/Turso limits. Preserve dependencies, write ordering, and transaction semantics. Do not parallelize Discord sends when ordering matters.

## Ignore Next.js-only rules

Ignore Server Actions, RSC serialization, `React.cache()`, Next.js route handlers, and `next/dynamic`. Translate only the underlying React/browser principle when it applies to this Vite SPA.

Inspect tests and callers. Do not run npm, tests, typechecks, or builds in this repository.
