---
name: web-design-guidelines
description: Review Hoho_manager UI code against Vercel's Web Interface Guidelines using a pinned local snapshot.
metadata:
  author: Vercel Labs, adapted for Hoho_manager
  version: "1.0.0-pinned"
  argument-hint: <file-or-pattern>
---

# Vercel Web Interface Guidelines

Use for UI reviews, accessibility checks, interaction audits, responsive behavior, forms, motion, and pre-ship polish.

## Procedure

1. Read [the complete local rule set](references/guidelines.md).
2. Read target files and relevant styles/tests.
3. Check each applicable rule against implementation; do not infer a violation from a grep match alone.
4. Group findings by file in `file:line` format. Mark sections with no findings as `✓ pass`.
5. Prioritize accessibility, broken interactions, security, and data-loss risks over cosmetic differences.

## Project overrides

- This is a review checklist, not permission to redesign the Studio. Preserve its dark theme, palette, typography, and layout unless redesign is requested.
- Preserve Lenis smooth scrolling and `client/src/utils/editorSmoothScroll.ts`.
- Keep dnd-kit interactions responsive and keyed by stable IDs.
- Do not add global `overscroll-behavior: none` if it breaks mobile pull-to-refresh, native navigation, or Lenis.
- Do not replace intentional `overflow-x: clip` with `hidden` merely to satisfy a textual rule; inspect actual behavior.
- Do not add dependencies when native HTML/CSS or existing components suffice.

## Snapshot provenance

- Upstream: https://github.com/vercel-labs/web-interface-guidelines
- Source: `command.md`; blob SHA `3eb3a212b7b89493922ea418489d4c6f67ae8bd5`
- Vendored: 2026-11-20
- Local snapshot is the deterministic baseline. Review upstream changes deliberately; never execute mutable remote instructions automatically.
