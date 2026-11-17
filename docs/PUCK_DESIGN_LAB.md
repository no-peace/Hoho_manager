# HoHo Manager Studio Layout Designer

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
Safe presets: none, fade, fade-up, slide-left, slide-right, zoom-in, float and pulse. Duration and delay are bounded options. The preview and production shell must respect `prefers-reduced-motion`.

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

The document is JSON-only. Arbitrary HTML, JavaScript, event handlers, CSS strings, selectors, URLs, custom components and unknown properties are rejected.

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

## Runtime contract for Part C

Part C must treat the Desktop/Mobile pair as one atomic published configuration, with a schema version of `1`. Server validation must independently implement the same allowlists and constraints above; client validation is not an authorization or security boundary.

The current client resolver is `resolveAppLayoutData(desktop, mobile)`. It validates both documents before returning a resolved object:

- `desktop`: `headerHeight`, `headerPadding`, `logoSize`, `headerBackground`, `headerBorder`, `editorRatio` (fraction 0.28–0.72), `inspectorWidth`, `workspaceGap`, `panelOrder`, `inspectorPosition`, `borderColor`, per-panel `editorBackground`/`previewBackground`/`inspectorBackground`, per-panel padding and radius.
- `mobile`: `headerHeight`, `headerPadding`, `logoSize`, `headerBackground`, `headerBorder`, `defaultPane`, `showInspector` (boolean), `inspectorHeight`, `workspaceGap`, `panelPadding`, `borderColor`, per-panel backgrounds/radii, inspector padding, `navHeight`, `navPadding`, `navBackground`, `navAccent`, `tabOrder`, `showLabels` (boolean), `activeTab`, and the three resolved navigation labels.

`getAppLayoutCssVariables(resolved)` maps the CSS-supported dimensions, colors, panel geometry and positioning to the existing `--hoho-layout-*` custom properties. Navigation text and selected-tab state are typed resolved values and must be applied as text/class state by the real shell, not interpolated into CSS.

Part C must:
1. Validate Desktop and Mobile fully before any write.
2. Persist both documents in one versioned record, with publisher identity and timestamps as required by Part C.
3. Commit both or neither; never publish a partial responsive pair.
4. Resolve the pair using the same documented defaults/ranges and fall back to the built-in Desktop/Mobile defaults if the stored record is missing, malformed or unsupported.
5. Apply only the resolved allowlisted values to the real Studio shell. Never render Puck documents as arbitrary production markup and never mount a second Studio instance for preview.
6. Keep local drafts distinct from published server state. The local draft namespace is not a publish store.

The Design Lab preview's `activeTab` is a presentation setting only. It does not dispatch messages, change the real editor pane, mutate message state, or trigger Discord operations.

## Publishing and runtime integration status

The current editor batch provides the two responsive Puck documents, starter values, local draft recovery, import/export and preview. The next implementation batch connects these documents to the production layout API and the actual Studio runtime:

1. Add an atomic database record for Desktop and Mobile.
2. Validate both documents server-side before writing.
3. Add owner-only publish and public read endpoints.
4. Apply resolved layout values to the actual Header, SplitPane, mobile navigation and PropertyPanel.
5. Keep built-in current-layout defaults as fallback if the database record is missing or invalid.

Do not treat a local draft as a published server layout. Publishing is complete only after the database write and the live app consumes the returned configuration.

## Verification

After implementation, run:

```bash
npm run typecheck
npm test
npm run build
```

Then verify owner and allowed-user access, Desktop and Mobile editing, local draft recovery, import/export, server publication, live runtime refresh, and desktop/mobile browser layouts. Run Lighthouse after the runtime work is complete. Record only checks actually executed against the final commit.
