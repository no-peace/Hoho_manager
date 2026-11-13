# Design System: HoHo Manager Studio

## 1. Visual Theme & Atmosphere
HoHo Manager is a high-density, dark-first Discord Bot & Components V2 developer studio inspired by production workbench patterns on Mobbin, Refero, and ScreensDesign.
- **Density:** 7/10 (Cockpit Studio — compact, scannable, zero wasted chrome)
- **Motion:** 7/10 (Snappy sub-200ms ease-out entrances, 20% faster exits, Disney squash-and-stretch toggles, Sileo gooey physics toasts)
- **Single Config Source:** `client/src/config/uiThemeConfig.ts` (`UI_THEME_CONFIG`) governs every button, field, card, modal, badge, and animation curve.

## 2. Color Palette & Roles (`UI_THEME_CONFIG.colors`)
- **Obsidian Border (`#111214`)** — Structural 1px dividers and input borders
- **Carbon Elevated (`#18191c`)** — Floating popovers, dropdown menus, Sileo toast surface
- **Chrome Toolbar (`#1e1f22`)** — Top header bar and input field backgrounds
- **Slate Header (`#232428`)** — Collapsible card headers and sub-section bars
- **Editor Panel (`#2b2d31`)** — Left editor rail and modal footers
- **Preview Canvas (`#313338`)** — Authentic Discord message preview backdrop
- **Blurple Fill (`#5865f2`) / AA Text Blurple (`#949cf7`)** — Primary interactive fill (`#5865f2`) paired with high-contrast `#949cf7` (`5.9:1` WCAG AA) for text links/badges on dark surfaces

## 3. Typography Rules
- **Display & UI Body:** `Geist Sans`, `-apple-system`, `sans-serif`
- **Code, Snowflakes & Counters:** `Geist Mono`, `JetBrains Mono`, `monospace` with `tabular-nums`

## 4. The 20 UX & Disney Animation Rules
All 20 rules (Squash & Stretch, Solid Drawing in 3D, Anticipation, Appeal, Staging, Fitts's Law, Pose to Pose, Bigger Hit Areas, Follow Through, Hick's Law, Slow In/Out, Miller's Law, Arcs, Doherty Threshold, Secondary Action, Postel's Law, Snappy Timing, Jakob's Law, Exaggerated Feedback, Frequency of Use) are codified in `client/src/config/uiThemeConfig.ts`.
