# Repository Agent Instructions

Read `skills/INDEX.md` before planning or editing. Read every applicable skill's complete `SKILL.md` and its referenced local files. Project constraints override generic skill advice.

## Architecture
- `shared`: shared types and schemas.
- `bot`: Discord.js 14 + Sapphire 5 gateway worker.
- `server`: Express 5 API and Discord interaction endpoint; local SQLite via `better-sqlite3`, Turso Cloud via the custom HTTP v2 pipeline.
- `client`: React 19 + Vite 8 + Tailwind 4 + Zustand + dnd-kit + Lenis.

## Hard constraints
- Render Free: 0.1 CPU, 512 MB RAM. Turso Free. Keep memory, polling, background work, and DB reads/writes minimal. Bound caches, avoid full-table scans, and drain/cancel unused fetch response bodies.
- Acknowledge Discord interactions comfortably within 3 seconds. Defer before slow work.
- Never automatically retry a non-idempotent Discord message-send POST after timeout/5xx; the send may already have succeeded.
- Enforce permissions server-side. Preserve `getChannelGuildId`, guild/channel/role-mention allowlists, `can_manage_automation`, `can_use_components_v2`, and mention scrubbing. Compare secrets with `crypto.timingSafeEqual`.
- Strict TypeScript: no `any` shortcuts, incomplete code, TODO/TBD, or placeholder comments.
- Do not run `npm`, `npx`, tests, typechecks, builds, or GitHub Actions. The maintainer runs local validation after pulling.
- Preserve Studio dark theme, palette, typography, layout, Lenis scrolling (`client/src/utils/editorSmoothScroll.ts`), and fast dnd-kit interactions. Use stable IDs, never array indices, for sortable identities and React keys.

## Workflow
1. Read the relevant skills and inspect current code/callers.
2. Make the smallest complete change.
3. Review security, resource use, type safety, and regressions.
4. State modified files and exact validation not performed. Never claim unrun checks passed.
