# HoHo Manager Studio Layout Designer

> **Current implementation status — 2026-11-18:** The Puck editor, atomic Desktop/Mobile publishing, server validation, owner authorization, client publishing workflow and live Studio runtime are integrated. The Part C wording below is the schema/acceptance contract, not an outstanding implementation task. Source tests exist but have not been executed in this work session. See `docs/GEMINI_HANDOFF_CURRENT.md` and `docs/REPOSITORY_AUDIT_LEDGER.md` for current status.

## Purpose

The Design Lab at `/design` edits the existing HoHo Manager Studio shell. It is not a blank website builder and does not ask the owner to recreate the product from scratch.

The editor starts with values mapped from the current Studio implementation:

- Desktop header: 56 px, 16 px horizontal inset, 32 px logo.
- Desktop workbench: editor first, live preview second, 50/50 initial split, 6 px splitter gap, 440 px inspector overlay on the right.
- Mobile header: 56 px, compact 12 px inset, 28 px logo.
- Mobile workbench: editor is the default pane; Editor and Preview are separate tabs.
- Mobile bottom navigation: 60 px, editor tab first, preview tab second, Dispatch remains present.
- Current editor, preview and inspector surfaces use the existing HoHo Manager dark palette.

Desktop and Mobile are separate Puck documents. Changing the Desktop document does not overwrite Mobile, and vice versa.

## Puck 0.24 integration

The repository installs `@puckeditor/core@0.24.x`. The Design Lab uses the Puck 0.24 APIs:

- `renderFields` with `FieldTab` and card-style `FieldGroup` for a readable inspector.
- Slot fields with explicit `allow` lists for the fixed Editor, Preview and Inspector panels.
- Number, text, radio and select fields with bounded options.
- Global permissions disable insertion, deletion, duplication and drag. The shell structure remains protected; owners customize layout using explicit fields such as split ratio, inspector width/side, panel order, spacing, surfaces and navigation order.
- `dnd.behavior = "static"`, `disableAutoScroll`, and `disableOutlineDrag` avoid unnecessary layout movement in this fixed-structure editor.
- Dedicated 1440 px Desktop and 390 px Mobile viewports. The Puck iframe waits for and synchronizes the host styles so the preview uses the same scoped layout CSS.
- The editor and Puck stylesheet remain lazy-loaded with the `/design` route.

Official references:

- Puck 0.24 release: https://puckeditor.com/blog/puck-024
- Puck component configuration: https://puckeditor.com/docs/api-reference/configuration/component-config
- Field grouping and tabs: https://puckeditor.com/docs/integrating-puck/field-grouping
- Slot fields and allowlists: https://puckeditor.com/docs/api-reference/fields/slot
- Puck permissions: https://puckeditor.com/docs/api-reference/permissions
- Puck viewport and iframe options: https://puckeditor.com/docs/api-reference/components/puck
- Puck global theming tokens: https://puckeditor.com/docs/extending-puck/theming

## Editable regions

### Desktop
- Header height, horizontal inset, logo size, background, border and motion.
- Editor/Preview width ratio, order and gap.
- Inspector overlay width and side.
- Editor, Preview and Inspector surface, padding, radius and label.
- Entrance motion and timing for the header, workspace and panels.

### Mobile
- Header height, horizontal inset, logo size, background and border.
- Default Editor or Preview pane.
- Workspace spacing and panel padding.
- Inspector bottom-sheet preview visibility and height. This only controls the Design Lab preview; it does not remove the production inspector from the live application.
- Editor/Preview bottom-tab order, navigation height, horizontal inset, background, active accent and labels.
- Motion settings.

### Motion
Safe presets: none, fade, fade-up, slide-left, slide-right, zoom-in, float and pulse. Duration and delay are bounded options. These are production-facing settings, not preview-only decoration: the live Studio runtime applies them to the corresponding header, workspace, navigation and panel surfaces. The Design Lab preview and production shell must both respect `prefers-reduced-motion`; when reduction is requested, suppress preset animation and its delay (do not merely shorten it).

## Draft and export behavior

- Changes are saved to a user-specific local draft after a 450 ms debounce; no server write occurs per field change.
- Import/export uses a versioned `hoho-app-layout.json` file containing both Desktop and Mobile documents.
- Imported documents are checked for the expected shell sections, unique component IDs, and the allowed component types before they are accepted.
- Error recovery must preserve `hoho:app-layout-draft:v1:*` and `hoho:user-theme-library:v1:*` local records.
- A portable JSON export is the backup if browser storage is unavailable or cleared.

## Version 1 document schema — Agent 3 handoff

The current Puck document format is **HoHo App Layout schema version 1**. Desktop and Mobile are separate documents and must remain independent. The persisted/published unit is the pair; neither side is valid for publishing by itself.

### Container and Puck document shape

The editor, local draft, and runtime validator consume this object:

```ts
interface AppLayoutDocuments {
  desktop: AppLayoutDocument;
  mobile: AppLayoutDocument;
  updatedAt?: string; // optional metadata, max 64 characters
}

interface AppLayoutDocument {
  root: { props?: Record<string, never> }; // omitted props normalize to {}
  content: AppLayoutNode[];
}

interface AppLayoutNode {
  type: string;
  props: Record<string, unknown>;
}
```

No other keys are allowed at the document, root, node, or component-props level. The root props object must be empty. Every component node has exactly `type` and `props`. Every component props object includes an `id`; IDs match `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`, are at most 64 characters, and are globally unique within that responsive document.

The document is JSON-only. Arbitrary HTML, JavaScript, event handlers, CSS strings, selectors, URLs, custom components and unknown properties are rejected. Component `id` values are editor/document identity and validation keys only; The production runtime must not treat them as caller-controlled production DOM IDs or selectors.

### Desktop document

Top-level `content` contains exactly these components in this order:

1. `DesktopHeader`
2. `DesktopWorkspace`

`DesktopHeader.props` allowlist:

- `id`: component ID.
- `height`: integer 44–80.
- `horizontalPadding`: integer 8–36.
- `logoSize`: integer 20–48.
- `background`, `borderColor`: `#RRGGBB` only.
- `animation`: `none | fade | fade-up | slide-left | slide-right | zoom-in | float | pulse`.
- `animationDuration`: `180ms | 300ms | 500ms | 700ms | 1200ms | 2000ms | 3000ms`.
- `animationDelay`: `0ms | 100ms | 200ms | 350ms`.

`DesktopWorkspace.props` allowlist:

- `id`: component ID.
- `editorRatio`: integer 28–72 (percentage).
- `inspectorWidth`: integer 300–520 (pixels).
- `workspaceGap`: integer 0–24 (pixels).
- `panelOrder`: `editor-first | preview-first`.
- `inspectorPosition`: `left | right`.
- `borderColor`: `#RRGGBB`.
- `animation`, `animationDuration`, `animationDelay`: same motion enums as DesktopHeader.
- `content`: exactly one each of `EditorPanel`, `PreviewPanel`, and `InspectorPanel`. Their order in the array is not semantic; `panelOrder` controls Editor/Preview placement.

### Mobile document

Top-level `content` contains exactly these components in this order:

1. `MobileHeader`
2. `MobileWorkspace`
3. `MobileBottomNavigation`

`MobileHeader.props` uses the same properties as DesktopHeader, with these ranges: `height` 44–72, `horizontalPadding` 8–28, and `logoSize` 20–40.

`MobileWorkspace.props` allowlist:

- `id`: component ID.
- `defaultPane`: `editor | preview`.
- `showInspector`: `show | hide`.
- `inspectorHeight`: integer 180–520 (pixels).
- `workspaceGap`: integer 0–20 (pixels).
- `panelPadding`: integer 8–28 (pixels).
- `borderColor`: `#RRGGBB`.
- `animation`, `animationDuration`, `animationDelay`: same motion enums.
- `content`: exactly one each of `EditorPanel`, `PreviewPanel`, and `InspectorPanel`.

`MobileBottomNavigation.props` allowlist:

- `id`: component ID.
- `height`: integer 48–84 (pixels).
- `horizontalPadding`: integer 8–28 (pixels).
- `background`, `accent`: `#RRGGBB`.
- `tabOrder`: `editor-first | preview-first`.
- `showLabels`: `show | hide`.
- `activeTab`: `editor | preview | dispatch` (preview-only selected-state presentation; optional in earlier version-1 exports, defaults to `editor`).
- `editorLabel`, `previewLabel`, `dispatchLabel`: trimmed text, 1–48 characters, no control characters (optional in earlier version-1 exports; defaults to `Editor`, `Preview`, and `Dispatch`).
- `animation`, `animationDuration`, `animationDelay`: same motion enums.

### Workspace panel schemas

All panels require:

- `id`: component ID.
- `label`: trimmed text, 1–48 characters, no control characters.
- `surface`: `#RRGGBB`.
- `padding`: integer 0–32 (pixels).
- `radius`: integer 0–24 (pixels).
- `animation`, `animationDuration`, `animationDelay`: same motion enums.

`EditorPanel` additionally requires `showToolbar: show | hide`. `PreviewPanel` and `InspectorPanel` do not accept `showToolbar`.

### Validation and import rules

- The combined UTF-8 JSON serialization of the Desktop/Mobile pair must not exceed **65,536 bytes (64 KiB)**.
- Numeric values must be integers inside the component-specific ranges above; validation rejects out-of-range values rather than silently clamping imported documents.
- Every color is a six-digit HEX string. No CSS color functions, CSS variables, gradients, URLs or style fragments are accepted.
- All enum values are exact, case-sensitive allowlist values. Motion duration and delay are bounded presets, not arbitrary CSS timing strings.
- Unknown or missing component properties, unknown component types, malformed nodes, invalid nesting, duplicate/empty IDs, missing shell regions and duplicate/missing workspace panels are rejected.
- The optional `updatedAt` metadata value is a string of at most 64 characters.
- Version-1 export envelope has exactly `format: "hoho-app-layout"`, `version: 1`, `exportedAt` (string, max 64 characters), `desktop`, and `mobile`. The import parser validates the entire pair before replacing the editor state.
- Existing version-1 exports produced before the navigation-label controls remain compatible: missing `activeTab` and tab labels normalize to the defaults above. Legacy boolean `EditorPanel.showToolbar` values normalize to the current string enum. The optional empty `root.props` object may be omitted and is normalized to `{}`.

### Local persistence expectations

- Draft key: `hoho:app-layout-draft:v1:${userId || "local"}`.
- Draft value: the `AppLayoutDocuments` object above, serialized as JSON. Desktop and Mobile are saved together in one localStorage value, but remain distinct nested documents.
- `DesignLabPage` debounces writes by 450 ms after edits. There is no per-field server write and no production publishing side effect.
- `saveAppLayoutDraft` validates before writing and returns `false` when storage or validation fails. `loadAppLayoutDraft` returns `null` for missing, inaccessible or invalid drafts; the editor then uses built-in defaults.
- Export remains the portable backup. Import/export always carries both responsive documents so an older half-pair cannot silently overwrite one mode.
- Do not clear this draft namespace as part of theme cache cleanup.

## Runtime contract for the production Studio

Part C must treat the Desktop/Mobile pair as one atomic published configuration, with a schema version of `1`. Server validation must independently implement the same allowlists and constraints above; client validation is not an authorization or security boundary.

The current client resolver is `resolveAppLayoutData(desktop, mobile)`. It validates both documents before returning a resolved object. The resolved object is the explicit production contract; The production runtime consumes these resolved fields rather than reading arbitrary Puck props at runtime.

- `desktop`: header dimensions/colors plus `headerMotion`; workbench split, inspector geometry, order, gap, border and `workspaceMotion`; each panel's background, padding, radius and label (`editorLabel`, `previewLabel`, `inspectorLabel`); `showToolbar` for the Desktop Editor; and `editorMotion`, `previewMotion`, `inspectorMotion`.
- `mobile`: header dimensions/colors plus `headerMotion`; default pane, inspector-preview visibility/height, workspace spacing and `workspaceMotion`; each panel's background, independent `editorPadding`/`previewPadding`/`inspectorPadding`, radius and label; Mobile Editor `showToolbar`; `editorMotion`, `previewMotion`, `inspectorMotion`; navigation dimensions/colors/order/label visibility/active state and resolved tab labels; and `navMotion`.
- Each resolved motion value has the typed shape `{ animation, duration, delay }`. The allowed animation presets are `none | fade | fade-up | slide-left | slide-right | zoom-in | float | pulse`; duration is one of `180ms | 300ms | 500ms | 700ms | 1200ms | 2000ms | 3000ms`; delay is one of `0ms | 100ms | 200ms | 350ms`.
- `showToolbar` is a boolean resolved independently for Desktop and Mobile from the corresponding `EditorPanel`.
- Panel labels are trimmed, validated text (1–48 characters, no control characters) and are resolved independently for Desktop and Mobile.

`getAppLayoutCssVariables(resolved)` maps the CSS-supported dimensions, colors, panel geometry and positioning to the existing `--hoho-layout-*` custom properties. Desktop `editorRatio` is passed directly to `SplitPane.initialRatio`, not represented as a CSS variable. Mobile Editor, Preview and Inspector padding are exposed independently as `--hoho-layout-mobile-editor-padding`, `--hoho-layout-mobile-preview-padding` and `--hoho-layout-mobile-inspector-padding`, each with pixel units; the workspace-level `--hoho-layout-mobile-panel-padding` remains a separate setting. Motion is intentionally exposed as typed values rather than arbitrary CSS. The production runtime maps each preset through a fixed, code-owned animation/class allowlist and apply the validated duration and delay as bounded timing values; never pass a document-provided CSS string or selector to the DOM. Panel and navigation labels must be assigned as text content, and selected-tab state as a fixed class/state. Do not interpolate labels into CSS or HTML.

### Required production application in the live Studio

| Resolved setting | Required real Studio behavior |
|---|---|
| `headerMotion` | Apply to the corresponding Desktop/Mobile Studio header. |
| `workspaceMotion` | Apply to the Desktop workbench or Mobile workspace container. |
| `navMotion` | Apply to the real Mobile bottom navigation. |
| `editorMotion`, `previewMotion`, `inspectorMotion` | Apply independently to the corresponding panel surfaces at each breakpoint. |
| `editorLabel`, `previewLabel`, `inspectorLabel` | Render as the visible headings/titles of the real Editor, Preview and Inspector panels at the matching breakpoint. |
| `editorPadding`, `previewPadding`, `inspectorPadding` (Mobile) | Apply the corresponding independently resolved padding to each real Mobile panel. Do not substitute the workspace-level `panelPadding` for these panel-level values. |
| `showToolbar` | Show or hide only the real editor toolbar for that breakpoint. Hiding it must not hide the editor, message content, or unrelated critical controls. |
| `defaultPane` | Select the initial Editor or Preview pane when a Mobile Studio workspace is first mounted. A later configuration refresh must not unexpectedly reset a pane the user has already selected. |
| `showLabels` | Show or hide the text labels on the real Mobile bottom navigation while preserving its accessible names. |
| `editorTabLabel`, `previewTabLabel`, `dispatchTabLabel` | Render as text in the corresponding real Mobile navigation items. |

For reduced motion, Part C must detect `prefers-reduced-motion: reduce` in the production shell and disable the configured entrance/loop animation and delay for every motion-bearing region. This override takes precedence over the published motion values. The preview must use the same reduced-motion policy.

The production implementation must:
1. Validate Desktop and Mobile fully before any write.
2. Persist both documents in one versioned record, with publisher identity and timestamps as required by Part C.
3. Commit both or neither; never publish a partial responsive pair.
4. Resolve the pair using the same documented defaults/ranges and fall back to the built-in Desktop/Mobile defaults if the stored record is missing, malformed or unsupported.
5. Apply only the resolved allowlisted values to the real Studio shell as specified above. Never render Puck documents as arbitrary production markup and never mount a second Studio instance for preview.
6. Keep local drafts distinct from published server state. The local draft namespace is not a publish store.

The following settings are explicitly Design Lab preview-only and are not part of the production behavior contract: Mobile `showInspector` and `inspectorHeight` (whether the preview draws an inspector bottom sheet and how tall it is), and Mobile `activeTab` (which navigation item is highlighted in the preview). They are validated and persisted in the Puck document for preview fidelity, but are deliberately excluded from the production `ResolvedAppLayout` object and runtime CSS variables. They must not remove the production inspector or force the live app's selected pane or navigation state. Component `id` values are also not production DOM IDs. Preview-only settings must not dispatch messages, mutate message state, or trigger Discord operations. Mobile tab labels, tab order, navigation sizing/colors, and label visibility are production settings and are applied to the real navigation.

## Publishing and runtime integration status

The following implementation is present in the current branch:

1. Forward-only migration 015 stores the complete Desktop/Mobile pair in one authoritative row.
2. Server validation independently enforces document/component/property allowlists, bounded dimensions/colors/motion, unique IDs and the combined size limit before persistence.
3. The publish endpoint checks the authorized publisher identity from the verified session and writes both documents atomically.
4. The public read endpoint and client API expose the published pair; missing or invalid data falls back to built-in defaults.
5. The Studio runtime consumes resolved values for header, split ratio, workspace/panel sizing and surfaces, labels, toolbar visibility, inspector positioning, mobile default pane/navigation and motion.
6. Local drafts remain distinct from server-published state. Publishing requires explicit confirmation and reports the server result.

Preview-only settings (`showInspector`, `inspectorHeight`, and `activeTab`) remain in the editor document for preview rendering but are excluded from the production resolved runtime contract.

**Verification status:** source tests are present, but typecheck, test suite, build, browser QA, Lighthouse, live database migration and production deployment have not been executed/verified in this work session.

## Verification

After implementation, run:

```bash
npm run typecheck
npm test
npm run build
```

Then verify owner and allowed-user access, Desktop and Mobile editing, local draft recovery, import/export, server publication, live runtime refresh, and desktop/mobile browser layouts. Run Lighthouse after the runtime work is complete. Record only checks actually executed against the final commit.
