# Design System: HoHo Manager Studio

## 1. Visual Theme & Atmosphere
HoHo Manager is a high-density, dark-first Discord Bot & Components V2 developer studio inspired by production workbench patterns on Mobbin, Refero, and ScreensDesign.
- **Density:** 7/10 (Cockpit Studio — compact, scannable, zero wasted chrome)
- **Motion:** 7/10 (Snappy sub-200ms ease-out entrances, 20% faster exits, Disney squash-and-stretch toggles, Sileo gooey physics toasts)
- **Shared Config Source:** `client/src/config/uiThemeConfig.ts` (`UI_THEME_CONFIG`) defines the shared button, field, modal, badge, animation, and named surface tokens. Feature-specific legacy classes are not yet fully migrated; new shared UI should use the existing semantic tokens rather than introducing another near-duplicate style.

## 2. Color Palette & Roles (`UI_THEME_CONFIG.colors`)
- **Obsidian Border (`#111214`)** — Structural 1px dividers and input borders
- **Carbon Elevated (`#18191c`)** — Floating popovers, dropdown menus, Sileo toast surface
- **Chrome Toolbar (`#1e1f22`)** — Top header bar and input field backgrounds
- **Slate Header (`#232428`)** — Collapsible card headers and sub-section bars
- **Editor Panel (`#2b2d31`)** — Left editor rail and modal footers
- **Preview Canvas (`#313338`)** — Authentic Discord message preview backdrop
- **Blurple Fill (`#5865f2`) / AA Text Blurple (`#949cf7`)** — Primary interactive fill (`#5865f2`) paired with high-contrast `#949cf7` (`5.9:1` WCAG AA) for text links/badges on dark surfaces

## 2.1 Shared Surface Tokens & Migration Rules

The shared surface tokens currently cover:
- Studio header and app shell
- Public-page header and navigation states
- Component Inspector backdrop, docked panel, header, and scroll body
- Docs variable-reference card, mobile variable card, and copy control
- Message editor active/inactive cards, buttons, fields, badges, and modal surfaces

When changing a repeated UI pattern:
1. Check `UI_THEME_CONFIG` and the semantic CSS utilities first.
2. Extend a shared token only when the pattern is reused or represents a stable product surface.
3. Prefer the shared `Button`, `IconButton`, `Field`, `Modal`, and `Tabs` primitives.
4. Preserve the dark Discord-inspired palette and current compact workbench hierarchy; do not apply a global redesign as a substitute for consistency.
5. Keep responsive breakpoints aligned with the Studio's 1200px workspace transition unless a component has a documented reason to differ.

## 3. Typography Rules
- **Display & UI Body:** `Geist Sans`, `-apple-system`, `sans-serif`
- **Code, Snowflakes & Counters:** `Geist Mono`, `JetBrains Mono`, `monospace` with `tabular-nums`

## 3.1 Layout & Measurement Units

Use these units consistently for new UI and when touching existing styles. Prefer responsive constraints over blindly replacing every fixed dimension.

- **Typography: `rem`.** Use Tailwind's default text utilities (which are rem-based) or explicit rem values for custom sizes. Do not introduce pixel-based font sizes. Keep the browser root size user-adjustable; do not set a fixed `html { font-size: ...px }`.
- **Parent-relative layout: `%`.** Use percentages for widths/heights that should scale with the containing block. Prefer `w-full` / `h-full` where appropriate, and combine fluid sizing with rem-based `min-width`, `max-width`, or `clamp()` constraints when a component needs a readable limit.
- **Viewport-sized sections: `vw` and dynamic viewport height.** Use `100vw` only for genuinely viewport-edge-to-edge width. For nested/full-width content, prefer `100%` to avoid scrollbar-induced horizontal overflow. Use `100dvh` for full-screen height so mobile browser chrome and dynamic viewports are handled correctly; use `svh` only when a stable small viewport is specifically required.
- **Borders: `px`.** Keep structural border widths in pixels (normally `1px`; use `2px` only when the visual hierarchy requires it). Do not convert border thickness to rem.
- **Component sizing and spacing:** Prefer rem-based spacing and dimensions for controls, panels, and readable max-widths. Fixed pixel dimensions are acceptable only for device-pixel details, canvas drawing, hairline alignment, or third-party/protocol fidelity.
- **Breakpoints:** Use the existing Tailwind responsive breakpoints and the documented 1200px Studio workspace transition. Breakpoint thresholds are media-query conditions, not component sizing, so pixel thresholds remain appropriate.
- **Motion, transforms, shadows, and canvas coordinates:** Keep units appropriate to the underlying CSS or rendering API; this convention does not require converting every numeric value to rem.

### Migration and review policy
1. Apply the convention to new code and every file being materially revised.
2. When migrating existing UI, preserve rendered dimensions at the default 16px root size (for example, 12px becomes `0.75rem`).
3. Do not mass-convert Discord message preview values when a pixel value is deliberately reproducing Discord's rendered output; document that fidelity exception at the component.
4. Check both narrow mobile and wide desktop layouts after changing units. Percentage sizing must not cause controls or text columns to collapse.

## 4. The 20 UX & Disney Animation Rules
All 20 rules (Squash & Stretch, Solid Drawing in 3D, Anticipation, Appeal, Staging, Fitts's Law, Pose to Pose, Bigger Hit Areas, Follow Through, Hick's Law, Slow In/Out, Miller's Law, Arcs, Doherty Threshold, Secondary Action, Postel's Law, Snappy Timing, Jakob's Law, Exaggerated Feedback, Frequency of Use) are codified in `client/src/config/uiThemeConfig.ts`.
