---
name: systematic-debugging
description: Evidence-first investigation for bugs, regressions, performance problems, and unexpected behavior in Hoho_manager.
---

# Systematic Debugging

Use before proposing a fix for any bug, regression, failing test, or unexpected behavior. Find the root cause, not merely the visible symptom.

## Establish evidence

1. Read the complete error, stack trace, logs, and request/interaction context.
2. Reproduce when the environment permits. If not reproducible, state that and gather more evidence.
3. Inspect the current diff and recent commits.
4. Trace data/control flow across client → API → service → database, or Discord interaction → command/listener → API → service.
5. Compare the failing path with a working path in this repository.
6. Separate facts, inferences, and unknowns.

## Test one hypothesis

- State one specific root-cause hypothesis and supporting evidence.
- Make the smallest change that can confirm or reject it.
- Do not bundle cleanup, refactoring, and unrelated fixes.
- If it fails, return to evidence gathering; do not stack speculative patches.
- After repeated failed attempts, question the architecture before another workaround.

## Implement and verify

- Fix the earliest incorrect boundary/state transition, not a downstream symptom.
- Inspect and update narrow relevant tests where appropriate.
- Review callers, error paths, cleanup paths, and resource use.
- Report verification accurately.

## Hoho_manager constraints

- Do not run npm/npx, tests, typechecks, builds, or GitHub Actions. The maintainer runs local validation after pulling.
- Tests may be inspected or updated, but never claim they passed when not executed.
- When runtime reproduction is unavailable, use source inspection, call-site tracing, commit history, and existing test expectations. Mark the result source-reviewed, not runtime-verified.
- Keep diagnostics free of tokens/secrets and avoid permanent high-frequency logging or polling on Render Free.
