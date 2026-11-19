# HoHo Manager — V15 Plan: Live Preview Overflow, Direct Button Config & App-Wide Drag-and-Drop

**Target Repository:** `no-peace/Hoho_manager` (`main` branch, post-V14)  
**Execution Rules for ChatGPT:**
- Implement all batches cleanly and commit/push to `main`.
- **Do NOT run `npm` checks or rely on GitHub Actions** (Actions are intentionally disabled; the owner will `git pull` and run `npm install`, `npm run typecheck`, `npm test`, and `npm run build` locally).
- **Keep `lenis` (`client/src/utils/editorSmoothScroll.ts`) untouched.**
- Follow accessible web UI practices: visible `:focus-visible` rings, explicit CSS transition properties (never `transition: all`), `touch-action: none` on drag handles so mobile touch-drag works smoothly, `aria-label` on icon buttons, and `prefers-reduced-motion` respect.

---

## Batch 1 — Fix Live Preview Double Scrollbar & Select Menu Dropdown Clipping

### Root Causes Found
1. **Nested double scroll containers:** `StudioLayout.tsx` wraps `<MessagePreview />` inside an `overflow-y-auto p-3 sm:p-4 custom-scrollbar` container, AND `MessagePreview.tsx` creates a second `flex-1 overflow-y-auto` scroll box inside it without `h-full`. This produces a cramped inner scrollbar halfway down the preview pane with dead gray space below it, cutting off open select menus.
2. **Container clipping:** `ContainerPreview.tsx` uses `overflow-hidden`, which clips any select menu opened inside a Components V2 Container.
3. **Inline dropdown positioning:** `SelectPreview` in `ActionRowPreview.tsx` renders its dropdown inline (`absolute`) inside the scroll container instead of portaling it to `document.body`.

### Changes
1. **`client/src/components/layout/StudioLayout.tsx`**
   - In the `right` pane `<section>`, remove the outer `overflow-y-auto p-3 sm:p-4 custom-scrollbar` wrapper around `<MessagePreview />`.
   - Replace it with `<div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#313338]">` so `<MessagePreview />` owns the **single** full-height scroll area (`h-full`) with its `LIVE PREVIEW` toolbar pinned at the top.

2. **`client/src/components/preview/MessagePreview.tsx`**
   - Ensure the root flex wrapper inside `<UserPlaceholderPreviewProvider>` uses `className="flex h-full min-h-0 flex-1 flex-col select-text"`.
   - Keep the single scroll container `<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#313338] p-3 pb-24 sm:p-4 sm:pb-28 custom-scrollbar">` so there is only ONE scrollbar for the entire preview pane and comfortable bottom breathing room.

3. **`client/src/components/preview/ContainerPreview.tsx`**
   - Change `overflow-hidden` to `overflow-visible` on the container wrapper so child dropdowns/popovers are never clipped by container boundaries.
   - Add `rounded-l-[7px]` to the left accent bar `<span>` so the color stripe still matches the container's rounded left corners without needing `overflow-hidden`.

4. **`client/src/components/preview/ActionRowPreview.tsx` (`SelectPreview`)**
   - Portal the open listbox dropdown (`role="listbox"`) into `document.body` using `createPortal(..., document.body)` with `position: "fixed"` and `zIndex: 99999` (matching the pattern in `SearchableDiscordSelect.tsx`).
   - Compute viewport-clamped `top`, `left`, `width`, and `maxHeight` from `containerRef.current.getBoundingClientRect()` (flipping upward automatically when space below `< 240px` and space above is larger).
   - Keep a `portalRef` on the portaled listbox and update the outside-click handler so clicks inside `portalRef.current` do not dismiss the menu.
   - Reposition (or close cleanly) on window `resize` and scroll events (`window.addEventListener("scroll", ..., true)`), ignoring scroll events originating inside `portalRef.current` itself so scrolling long option lists works normally.
   - Ensure `SelectPreview` tests (`ActionRowPreview.test.tsx`) still pass with `screen.getByRole("listbox")` (Testing Library queries `document.body`, so portals work out of the box).

---

## Batch 2 — Direct Button Config Inspection from Live Preview

### Root Causes Found
- `ButtonPreview` sets `data-preview-interactive="true"`. In `MessagePreview.tsx` and `previewSelection.ts`, any click on `data-preview-interactive="true"` returns early without selecting the component.
- Clicking near a button hits `ActionRowPreview` (`data-preview-component-id={component._id}`), opening the Action Row in `PropertyPanel` (which only offers "Add Button" / "Add Select Menu").

### Changes
1. **`client/src/components/preview/ActionRowPreview.tsx`**
   - **`ButtonPreview`**:
     - Remove `data-preview-interactive="true"` from the wrapper `div` so clicking any button in the Live Preview routes directly to that button's `_id` in `PropertyPanel` (opening its **Properties** and **Actions Flow** tabs immediately).
     - Keep `data-preview-component-id={button._id}` on the wrapper `div` and add subtle hover focus affordance (`hover:ring-2 hover:ring-[#818CF8]/70 rounded-lg`) so it is clear buttons are clickable to configure.
     - For disabled buttons (`button.disabled`), remove `pointer-events-none` from the inner `<button>` (or keep `cursor-pointer` on the wrapper and `pointer-events-none` only on the inner button while keeping the click handler on the wrapper) so users can still click a disabled button in Preview to inspect and re-enable it.
   - **`SelectPreview`**:
     - Keep `data-preview-interactive="true"` on the interactive select trigger/listbox so clicking the select bar still opens and tests the dropdown preview.
     - Add a compact, accessible inline edit button (e.g., a subtle `Sliders` icon button with `aria-label="Configure select menu"` and `data-preview-component-id={select._id}` *without* `data-preview-interactive="true"`) beside or inside the right edge of the select preview wrapper so users can also jump straight to the Select Menu's inspector config in one click.

2. **`client/src/components/editor/ComponentForms.tsx` (`ActionRowForm`)**
   - Upgrade the Action Row inspector form so that when an Action Row itself is selected, in addition to "Add Button" / "Add Select Menu", it renders a clean list of the row's existing child buttons/selects where clicking any item immediately calls `useMessageStore.getState().select({ kind: "component", id: child._id })` to open that child's config.

3. **`client/src/components/preview/__tests__/MessagePreview.test.tsx` & `client/src/utils/__tests__/previewSelection.test.ts`**
   - Add a test confirming that clicking a `ButtonPreview` in `MessagePreview` selects that button's `_id` (not the parent Action Row) with `isInteractive = false`.
   - Keep the existing test confirming that clicking a `SelectPreview` trigger opens its listbox without hijacking selection.

---

## Batch 3 — Clean Up Action Row Button Pills (Remove `1 steps` Badge & Broken Hover Toolbar)

### Root Causes Found
- `DiscohookComponentsEditor.tsx` renders an ugly `⚡ {stepCount} steps` pill inside every button (`1 steps` grammar bug + visual clutter).
- Hovering a button spawns a floating `absolute -top-7 right-0` toolbar (`< > [copy] [trash]`) that overlaps the `Action Row #2 1/5 Buttons` header, closes when the pointer crosses the gap, and is inaccessible on touch screens.

### Changes
1. **`client/src/components/editor/DiscohookComponentsEditor.tsx`**
   - **Remove the `⚡ {stepCount} steps` badge** from button pills (and remove the `⚡ {stepCount} steps` text from Select Menu bars too; remove `getFlowStepCount` and the unused `useActionStore` subscription if nothing else uses it).
   - **Delete the floating `absolute -top-7 right-0` toolbar completely.**
   - Redesign each Button chip inside the Action Row as a clean, tactile **inline sortable pill**:
     - **Left:** A `GripVertical` drag handle (`cursor-grab active:cursor-grabbing touch-none`, `aria-label="Drag to reorder button"`).
     - **Center:** Optional emoji + button label (`truncate max-w-[140px]`) + `ExternalLink` icon if it's a Link button. Clicking this area selects the button in `PropertyPanel`.
     - **Right (inline inside the pill, separated by a subtle 1px vertical divider `border-l border-current/20 pl-1.5`):** Always-accessible inline `Copy` (`aria-label="Duplicate button"`) and `Trash2` (`aria-label="Delete button"`) icon buttons with `e.stopPropagation()` and clean `min-h-[24px] min-w-[24px]` hit targets — zero floating overlap, zero hover-gap traps, works on both desktop and mobile!
   - Remove the `<` and `>` (`ChevronLeft`, `ChevronRight`) buttons from Action Row buttons completely (replaced by drag-and-drop in Batch 4).

---

## Batch 4 — Reusable Drag-and-Drop Architecture (`@dnd-kit`) & Atomic Store Reordering

### Why `@dnd-kit`
- Supports both vertical lists (Messages, V2 Blocks, Container children, Embeds, Embed Fields, Flow Steps, nested `Then`/`Else` branches) and horizontal/wrapping grids (Action Row buttons) with dedicated drag handles so inputs/textareas inside cards never misfire drags.
- Works smoothly on **desktop mouse, mobile touch, and keyboard** (`PointerSensor`, `TouchSensor`, `KeyboardSensor`).

### Changes
1. **`client/package.json`**
   - Add dependencies:
     - `"@dnd-kit/core": "^6.3.1"`
     - `"@dnd-kit/sortable": "^10.0.0"`
     - `"@dnd-kit/utilities": "^3.2.2"`

2. **`client/src/utils/tree.ts`**
   - Add `reorderComponent(components: ComponentNode[] | undefined, activeId: string, overId: string, parentId: string | null = null): TreeResult`:
     - Finds `oldIndex` and `newIndex` among the target sibling list (`parentId ? findComponent(components, parentId)?.components : components`).
     - If either is `-1` or `oldIndex === newIndex`, returns `{ components: components ?? [], found: false }`.
     - Moves the item atomically with splice (`const next = [...list]; const [moved] = next.splice(oldIndex, 1); next.splice(newIndex, 0, moved);`).
     - Returns the updated root or parent container tree.
   - Keep existing `moveComponent` exported so existing unit tests continue passing.

3. **`client/src/store/messageStore.ts`**
   - Add atomic drag-and-drop reorder actions:
     - `reorderComponentById(activeId: string, overId: string, parentId?: string | null): void` (delegates to `reorderComponent` in `tree.ts`).
     - `reorderEmbeds(activeId: string, overId: string): void`
     - `reorderEmbedFields(embedId: string, activeId: string, overId: string): void`
     - `reorderMessages(fromIndex: number, toIndex: number): void` (reorders `messages` and updates `activeMessageIndex` to follow the moved/active message accurately).

4. **Create `client/src/components/ui/SortableList.tsx`**
   - Build a clean, typed, reusable wrapper around `DndContext`, `SortableContext`, and `useSortable`:
     - Configured with `PointerSensor` (`activationConstraint: { distance: 6 }`), `TouchSensor` (`activationConstraint: { delay: 180, tolerance: 6 }`), and `KeyboardSensor` (`sortableKeyboardCoordinates`).
     - Supports `strategy?: "vertical" | "horizontal" | "grid"` (`verticalListSortingStrategy`, `horizontalListSortingStrategy`, `rectSortingStrategy`).
     - Exposes a `<SortableItem id={...}>` render-prop or context hook `useSortableHandle()` returning `{ attributes, listeners, setActivatorNodeRef, isDragging }` so every card can wire a crisp `<DragHandle />` (`GripVertical` icon, `touch-none cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-[#818CF8]`).
     - Applies subtle elevation while dragging (`opacity-80 shadow-xl ring-2 ring-[#818CF8]/70 z-30`) and honors `prefers-reduced-motion`.

---

## Batch 5 — Wire Drag-and-Drop Everywhere & Remove Cluttered Reorder Arrows

Wire `<SortableList>` + `<DragHandle />` across every reorderable list in the editor and remove redundant `ChevronUp`/`ChevronDown`/`ChevronLeft`/`ChevronRight` reorder buttons:

1. **Action Row Buttons (`client/src/components/editor/DiscohookComponentsEditor.tsx`)**
   - Wrap the buttons flex-wrap list in `<SortableList strategy="grid" items={buttonIds} onReorder={(activeId, overId) => reorderComponentById(activeId, overId, rowId)}>`.
   - Attach the drag handle to each button pill's left `GripVertical` grip.
   - Also replace the Action Row header's `ChevronUp` / `ChevronDown` buttons with a drag handle when rendered inside a sortable parent list (keep `Copy` and `Trash2`).

2. **Action Flow Steps & Nested `Then` / `Else` Branches (`client/src/components/actions/StepList.tsx`)**
   - Wrap `steps` in `<SortableList strategy="vertical" items={stepIds} onReorder={handleReorderSteps}>` (ensure every step has a stable `_id`, generating a fallback key only if missing and persisting `_id` when committing).
   - Place a `GripVertical` drag handle immediately to the left of the `#{index + 1}` badge in each step card header.
   - Because `BranchEditor` renders `<StepList>` recursively, both top-level flows AND nested `Then` / `Else` branches automatically get independent drag-and-drop step reordering!

3. **V2 Components & Container Children (`client/src/components/editor/MessageEditor/ComponentsTab.tsx`)**
   - Wrap top-level V2 components in `<SortableList strategy="vertical" ... onReorder={(activeId, overId) => reorderComponentById(activeId, overId, null)}>`.
   - Wrap children inside each V2 `Container` in `<SortableList strategy="vertical" ... onReorder={(activeId, overId) => reorderComponentById(activeId, overId, containerId)}>`.
   - Place a `GripVertical` drag handle on the left of every V2 component card header (Text Display, Action Row, Section, Media Gallery, File, Separator, Container) and remove the `ChevronUp` / `ChevronDown` arrow buttons.

4. **Embeds & Embed Fields (`client/src/components/editor/MessageEditor/EmbedsTab.tsx` & `client/src/components/editor/EmbedEditor.tsx`)**
   - Wrap Embed cards in `EmbedsTab.tsx` with `<SortableList strategy="vertical" ... onReorder={reorderEmbeds}>` and place a `GripVertical` handle in each `EmbedEditor` header (removing `Move Up` / `Move Down` arrows).
   - Wrap Embed Fields inside `EmbedEditor.tsx` with `<SortableList strategy="vertical" ... onReorder={(activeId, overId) => reorderEmbedFields(id, activeId, overId)}>` and place a `GripVertical` handle on each field row (removing `Move Up` / `Move Down` arrows).

5. **Multi-Message Cards (`client/src/components/layout/StudioLayout.tsx` & `client/src/components/editor/MessageEditor/index.tsx`)**
   - Wrap the `displayMessages` list in `StudioLayout.tsx` with `<SortableList strategy="vertical" ... onReorder={...}>` calling `reorderMessages(fromIndex, toIndex)`.
   - Place a `GripVertical` handle in the `MessageEditor` header (when `messageCount > 1`) and remove the `ChevronUp` / `ChevronDown` message reorder arrows.

6. **String Select Options (`client/src/components/editor/ComponentForms.tsx`)**
   - If String Select options have reorder controls (or a list of options), wrap them in `<SortableList strategy="vertical">` with a `GripVertical` handle so users can drag-reorder dropdown options directly inside the Inspector.

---

## Batch 6 — Unit Tests & Handoff Update

1. **`client/src/utils/__tests__/tree.test.ts`**
   - Add unit tests for `reorderComponent` covering top-level reordering (forward & backward), Container child reordering, Action Row button reordering, and no-op/missing IDs.
2. **`client/src/components/preview/__tests__/MessagePreview.test.tsx` & `client/src/components/preview/__tests__/ActionRowPreview.test.tsx`**
   - Verify portaled `SelectPreview` listbox opens in `document.body`, closes on outside click/Escape, and does not clip.
   - Verify clicking a `ButtonPreview` selects that button's `_id` for Inspector editing.
3. **`docs/GEMINI_HANDOFF_CURRENT.md`**
   - Update with the V15 changes (preview portal + single scrollbar, direct button inspection, cleaned Action Row pills, and `@dnd-kit` drag-and-drop across all editor lists & flows).
