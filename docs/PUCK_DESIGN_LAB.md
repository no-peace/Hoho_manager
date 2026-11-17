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
