# Preview-to-Editor Navigation and Mobile Inspector Repair Plan

**Status:** Implementation in progress  
**Target branch:** `main`  
**Scope:** Client preview interactions, editor target navigation, mobile inspector, regression coverage.

## Problem statement

The preview currently identifies Components V2 and action-row controls through `data-preview-component-id`, but classic embeds do not expose a preview identity. The preview's delegated click handler therefore cannot route clicks on embed author/title/description/fields/footer to the owning embed. The store already has an `embed` selection variant, but the property inspector does not render it.

On desktop, non-interactive component clicks are reduced to message selection and scroll to the message card. They do not select the corresponding editor control or navigate to that exact control. On touch devices, the editor Lenis instance is intentionally not created, and the fallback uses `scrollIntoView()`, which can scroll an unintended ancestor. Mobile pane switching also needs to finish before an editor target can be scrolled.

## UX contract

### Desktop (>= 1200px)
- Clicking a preview component selects its owning component in the editor model.
- The editor message containing that component expands if collapsed.
- The editor's own scroll container smoothly scrolls to the matching component editor card.
- Clicking anywhere inside a classic embed (including author and footer content) selects the embed and scrolls to its editor card.
- Interactive preview controls retain their own behavior (for example, a select menu can still open) while selection bubbles to the parent message preview.
- The inspector remains available for the selected editable component/embed.

### Mobile and tablet (< 1200px)
- Clicking any component or embed opens the corresponding inspector bottom sheet while keeping Preview visible.
- Embed selection renders the existing embed editor controls in the inspector; author/footer targets resolve to their owning embed.
- Message-level quick edit remains available for blank message content/card selection.
- Choosing **Open Full Editor** switches to Editor first, then scrolls the editor's own container to the selected message/target.
- No Lenis wheel loop is used for touch scrolling. Native scrolling is directed at the editor container, not every ancestor.

## Implementation stages

1. **Preview identity and delegation**
   - Add stable embed IDs and semantic sub-part metadata to embed preview markup.
   - Keep nested component IDs nearest to the clicked leaf; container clicks still resolve to the container.
   - Route embed and component clicks through explicit callbacks in `MessagePreview`.
   - Prevent embed author/title links from navigating away when the user is selecting an editable preview target.

2. **Editor target identity**
   - Add a common `data-editor-target-id` to embed and component editor surfaces.
   - Cover classic action-row child controls and Components V2 top-level/nested/accessory controls.
   - Expand a message editor card when a component/embed belonging to that message is selected.

3. **Unified desktop/mobile selection**
   - Desktop: select the target and scroll to the exact editor target.
   - Mobile/tablet: select the target and show the inspector without switching away from Preview.
   - Extend `PropertyPanel` to render an embed selection using the existing `EmbedEditor`.
   - Keep the selected message index authoritative when the preview points to a non-active message.

4. **Container-aware scrolling**
   - Use Lenis only for fine-pointer wheel scrolling when motion is allowed.
   - Use the editor wrapper's own `scrollTo` for touch/coarse-pointer and reduced-motion cases.
   - Calculate the target offset relative to the editor wrapper; avoid `scrollIntoView()` ancestor side effects.
   - Retry navigation briefly if the editor pane is temporarily hidden or a collapsed card has not expanded yet.
   - Wait for the mobile Editor pane to become visible before navigating from **Open Full Editor**.

5. **Regression tests**
   - Preview click delegation for nested V2 components and embed author/footer content.
   - Embed inspector rendering and selected-message correctness.
   - Exact editor-target scrolling with native touch fallback and reduced-motion behavior.
   - Mobile pane navigation waits for visibility; no scroll is attempted against a hidden pane.
   - Preserve select-menu opening and existing button/flow inspector behavior.

## External implementation references reviewed

- `discohook/discohook`: preview controls accept explicit callbacks; select-menu triggers preserve their own interaction before invoking parent behavior. Relevant source: `packages/site/app/components/preview/ActionRow.tsx`.
- `discohook/discohook`: nested section previews keep their component/accessory structure explicit. Relevant source: `packages/site/app/components/preview/Section.tsx`.
- `merlinfuchs/embed-generator`: separates message preview rendering from message/component rendering and keeps preview-specific interactions local. Relevant source: `embedg-app/src/components/MessagePreview.tsx` and `MessagePreviewComponents.tsx`.
- These are design references, not code to copy wholesale; HoHo Manager's Zustand selection model, Components V2 editor, and split-pane layout remain authoritative.

## Non-goals and safeguards

- Do not replace the split-pane architecture or rewrite the preview renderer.
- Do not disable native select-menu preview interactions.
- Do not introduce a global page scroll when navigating within the editor.
- Respect `prefers-reduced-motion`; do not force animated scrolling for users who opt out.
- Do not claim browser QA, Lighthouse, or test success unless the checks actually ran.
