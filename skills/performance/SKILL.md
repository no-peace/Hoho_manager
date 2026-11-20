---
name: performance
description: Measure and improve browser and Node.js performance with profiling evidence, bounded resource budgets, and regression-aware verification.
---

# Performance Engineering — Hoho_manager

Use for client responsiveness, API latency, memory, CPU, background work, and database efficiency.

## Measurement discipline

- Define the user-visible or resource-budget problem before optimizing.
- Capture a baseline under known conditions and identify the bottleneck.
- Separate field metrics, lab measurements, and source-level hypotheses.
- Change one dominant cause at a time and compare equivalent measurements.
- Avoid micro-optimizations without evidence.

## Client

- Use browser traces and React profiling to identify long tasks, rerenders, layout work, and network waterfalls.
- Keep typing, drag-and-drop, keyboard interactions, and scroll handlers cheap.
- Preserve stable IDs and Lenis integration.
- Reserve image dimensions, lazy-load below-fold assets, and prioritize only critical above-fold assets.
- Consider list virtualization only after measuring list size and rendering cost.

## Server

- Profile CPU and memory before introducing workers, caches, or background jobs.
- Keep caches bounded and invalidate them correctly.
- Bound concurrency, response sizes, query limits, and maintenance batch sizes.
- Avoid full-table scans and repeated DB reads.
- Cancel/drain unused response bodies and propagate abort signals.
- Respect Render Free's 0.1 CPU / 512 MB memory and Turso Free read/write budgets.

Do not run tests, typechecks, builds, or profiling commands in this repository unless the maintainer explicitly changes the repository workflow. Report what evidence is available and what remains unmeasured.
