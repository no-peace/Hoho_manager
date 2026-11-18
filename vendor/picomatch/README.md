# HoHo temporary picomatch security fork

This directory vendors picomatch 4.0.7 with the repeated-wildcard extglob ReDoS mitigation from [upstream PR #262](https://github.com/micromatch/picomatch/pull/262), pinned to commit `3222059ac27492d9c0147fee5c65f751bbd851ab`.

- Upstream project: https://github.com/micromatch/picomatch
- Upstream base: 4.0.7
- Advisory: GHSA-fc5q-39xc-vjpf / CVE-2026-112366
- Local package version: `4.0.8+hoho.0` (a private downstream patched build, not an upstream release)
- License: MIT; see [LICENSE](./LICENSE)

The patch is limited to the upstream PR's `lib/parse.js` changes. The root package manifest depends on this local copy so all transitive picomatch consumers use the patched implementation.

This is a temporary downstream mitigation, not a claim that the upstream project has merged or released the fix. Replace this directory and the root dependency with the official patched npm release once published. Do not set `maxExtglobRecursion: false` for untrusted patterns; the upstream PR documents that as an explicit safeguard opt-out.
