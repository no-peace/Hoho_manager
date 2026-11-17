# HoHo Manager Design Lab and Theme System

HoHo Manager has two separate appearance layers: the **server theme** and each signed-in user's **personal theme**.

## Theme settings

Appearance & Themes remains available to signed-in users. The owner-only Design Lab link is inside the authenticated profile dropdown (not the top bar); /design remains protected by the existing server-side access check.

### Server theme (owner only)

- The server theme is stored in the production database table server_theme_settings.
- Only Discord IDs listed in OWNER_DISCORD_IDS can publish or edit it. Local Developer admin access is retained in non-production.
- Publishing from the Theme Settings modal writes the validated token set directly to the database. It does not require a Git commit, redeploy, or local file export.
- All website visitors receive the current server theme from GET /api/design/default.
- Open tabs refresh the server theme when they regain focus or become visible. The endpoint uses a short 30-second public cache.
- The owner can publish their current editor values or copy any published community theme to the server.
- Existing checked-in CSS/theme tokens remain the safe initial fallback if the database/API is unavailable.

### Personal themes

- Every authenticated user can open Theme Settings, edit colors/radius/font, preview the result, and apply it privately.
- Save privately stores named private theme presets in browser localStorage and immediately downloads a portable `.hoho-theme.json` file. Presets are not database writes and are not visible to other users. Each preset can be exported again or imported from its file.
- The private theme library is keyed by Discord user ID and does not expire. The active theme selection remains a separate 14-day session cache. Older private-library records with an expiry field are migrated without deleting the saved presets. Downloaded `.hoho-theme.json` files remain available even if browser storage is cleared.
- Personal cache is not refreshed merely by changing browser tabs.
- The selected personal theme overrides the server theme only in that user's browser. Reset to server removes the local override.

### Community theme gallery

- Share with community publishes a validated theme definition to design_themes. This shared registry is required for other users to discover and copy a theme.
- The gallery is available to all signed-in users. Regular users see published themes plus their own private legacy themes. The owner can inspect all users' themes, including older private Design Lab themes.
- A user can edit/delete only their own published theme. Copy/edit creates a new draft owned by the current user.
- The owner can inspect all users' themes and choose Make server theme to copy a selected theme's token set into server_theme_settings.
- The registry stores reusable theme definitions, not each user's active selection or private draft cache.

## Validation and safety

Themes are restricted to a fixed token schema: eight six-digit HEX colors, a supported radius, and one of the supported font families. Server-side validation is authoritative and client-side validation provides immediate feedback.

- Primary text must meet WCAG AA 4.5:1 contrast against the app background and panel.
- Muted text must meet at least 3:1 contrast against the app background and panel.
- No arbitrary CSS, selectors, HTML, scripts, layout definitions, or component structure are accepted by the theme API.
- Theme tokens only change visual CSS variables (colors, font family and radius). They cannot remove, hide, replace, or reorder application controls such as the Send button.
- The Puck document remains a separate owner-only design artifact and is not used as a theme payload for the community gallery. Design Lab now loads the current server theme as its starter palette, exposes page-level brand controls and per-block entrance animation/duration/delay fields, and uses Puck's documented CSS design tokens to style the editor panels and fields.
- Server endpoints never return process.env, .env files, OAuth credentials, bot tokens, database credentials, or server configuration.

## Persistence and deployment

Migration 014_community_and_server_themes adds the public registry flag and server_theme_settings table. The existing migration runner applies it automatically on server startup. Existing Design Lab themes remain private by default; newly shared themes are public.

For Render, configure OWNER_DISCORD_IDS in the server environment. After the code is deployed and the migration has run, the owner can change the server theme directly from the hosted website. No redeploy is needed for later theme changes.

## Performance

- The gallery is loaded only when the user opens Theme Settings; it is not part of the initial page render.
- The Theme Settings component is lazy-loaded from the header.
- The server default endpoint is small and cacheable for 30 seconds.
- Personal theme application is local and does not add a database request to normal app navigation beyond the existing default-theme fetch.
- The app refreshes the server theme on tab focus/visibility, not through a continuously running polling loop.

## Logo alternative text

The HoHo Manager logo image uses descriptive alternative text in the shared logo component, header, and not-found page. The loading-screen logo is also labelled as the HoHo Manager logo.

## Verification

Run from the repository root:
- npm run typecheck
- npm test
- npm run build

Then run the existing mobile and desktop Lighthouse configurations. Do not treat the change as verified until these checks have been run against the deployed/current environment.


## Design Lab editor experience

- The Design Lab entry is located in the profile dropdown for accounts with Design Lab permission; it is removed from the top navigation row.
- The Puck editor chrome uses the documented `--puck-*` theme tokens for dark surfaces, high-contrast text, readable fields, focus rings, responsive sidebars, and selection states.
- The starter page is HoHo Manager-branded (Message Studio, Live Preview, and Interaction Builder) and uses HoHo Manager's current dark palette and the current server theme is loaded when the editor opens. The page root exposes background, content width, base text, accent, card surface, font family, and global corner radius. Heading and paragraph blocks expose type scale, weight, line-height, alignment, and readable width; buttons expose custom colors/radius; feature cards expose surface, border, radius, padding, and shadow controls.
- Every visual block exposes entrance animation, duration, and delay controls. Supported motion presets are fade, fade-up, slide-left/right, zoom, float, and pulse; reduced-motion preferences disable those animations.
- The editor retains Puck's drag-and-drop, outline, inspector, and desktop/tablet/mobile viewport tools. No application control tree or live production dashboard controls are modified by this page builder.
