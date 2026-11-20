# Skills Library

Read this routing table before repository work. Load each selected skill's complete `SKILL.md` and its local references. Root [`AGENTS.md`](../AGENTS.md) is authoritative.

| Task | Read first | Then consider |
|---|---|---|
| Any repository task | [Repository instructions](../AGENTS.md) | This index |
| UI, React, hooks, Zustand, client JS | [Modern Web Guidance](modern-web-guidance/SKILL.md), [React Best Practices](react-best-practices/SKILL.md) | [Vercel Interface Guidelines](web-design-guidelines/SKILL.md), [Impeccable](impeccable/SKILL.md), [Design Engineering](emil-design-eng/SKILL.md) |
| UI/accessibility review, forms, responsive behavior | [Vercel Interface Guidelines](web-design-guidelines/SKILL.md) | [Modern Web Guidance](modern-web-guidance/SKILL.md), [Impeccable](impeccable/SKILL.md) |
| Visual design, layout, motion, dark UI | [Impeccable](impeccable/SKILL.md), [Design Engineering](emil-design-eng/SKILL.md) | [Vercel Interface Guidelines](web-design-guidelines/SKILL.md) |
| Browser performance, Lighthouse, CWV | [Performance](performance/SKILL.md), [Core Web Vitals](core-web-vitals/SKILL.md) | [Modern Web Guidance](modern-web-guidance/SKILL.md), [React Best Practices](react-best-practices/SKILL.md) |
| Express/server services/Node.js | [Node.js Backend Patterns](nodejs-backend-patterns/SKILL.md) | [Render Free Runtime](render-free-runtime/SKILL.md), [Sharp Edges](sharp-edges/SKILL.md), [Turso DB](turso-db/SKILL.md) |
| Discord commands, interactions, components, sends | [Discord.js + Sapphire](discordjs-sapphire/SKILL.md) | [Sharp Edges](sharp-edges/SKILL.md), [Node.js Backend Patterns](nodejs-backend-patterns/SKILL.md) |
| Turso, SQLite, SQL, migrations, transactions | [Turso DB](turso-db/SKILL.md) | [Render Free Runtime](render-free-runtime/SKILL.md) |
| TypeScript, schemas, API boundaries | [TypeScript Best Practices](typescript-best-practices/SKILL.md) | [Sharp Edges](sharp-edges/SKILL.md) |
| Auth, permissions, secrets, untrusted input | [Sharp Edges](sharp-edges/SKILL.md) | [Discord.js + Sapphire](discordjs-sapphire/SKILL.md) |
| Render resource limits, polling, shutdown | [Render Free Runtime](render-free-runtime/SKILL.md) | [Node.js Backend Patterns](nodejs-backend-patterns/SKILL.md), [Turso DB](turso-db/SKILL.md) |
| Bugs, regressions, unexpected behavior | [Systematic Debugging](systematic-debugging/SKILL.md) | Then load the relevant domain skill |

## Rules
- Verify every referenced local file exists and read it before relying on it.
- Do not introduce packages, frameworks, database drivers, or architecture just because generic guidance recommends them.
- Modern Web Guidance is queried on demand. Vercel's interface rules are vendored locally for deterministic reviews.
- Load the smallest useful skill set; project-specific constraints and current code take precedence.
