---
name: core-web-vitals
description: Diagnose and improve LCP, INP, and CLS using field data, browser traces, and controlled lab measurements.
---

# Core Web Vitals

Use for client page-experience performance. Google evaluates these metrics at the 75th percentile of real visits:

| Metric | Good | Needs improvement | Poor |
|---|---:|---:|---:|
| LCP | ≤ 2.5 s | 2.5–4.0 s | > 4.0 s |
| INP | ≤ 200 ms | 200–500 ms | > 500 ms |
| CLS | ≤ 0.1 | 0.1–0.25 | > 0.25 |

## Measure first

1. Prefer page-level CrUX field data. Label origin-level data as a fallback.
2. Capture a browser trace under stated device/network conditions.
3. Attribute the issue to the relevant resource, interaction, or layout shift.
4. Change only the cause supported by evidence.
5. Re-run an equivalent lab measurement after the change.
6. Do not claim immediate field improvement; CrUX/RUM needs new real visits.

If only source code is available, describe likely causes as hypotheses. Do not claim a metric is failing without runtime or field evidence.

## Metric diagnosis

- **LCP:** separate TTFB, resource load delay, resource load duration, and element render delay. Make the actual LCP resource discoverable; prioritize it only when justified. Do not lazy-load the LCP image or add speculative preloads.
- **INP:** separate input delay, event-handler processing, and presentation delay. Keep critical handlers small and avoid expensive synchronous work on typing/drag paths.
- **CLS:** identify the shifted node and trigger. Reserve image/media dimensions, avoid late layout insertion, and inspect font swaps and layout-affecting animations.

## Hoho_manager constraints

Preserve React/Vite architecture, Studio theme, Lenis, and dnd-kit performance. Avoid a heavy monitoring SDK without a concrete need. Keep telemetry minimal, private, bounded, and compatible with Render Free.
