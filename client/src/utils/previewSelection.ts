import type { Selection } from "../store/messageStore";

type PreviewSelectionStore = {
  setActiveMessageIndex: (index: number) => void;
  select: (selection: Selection | null) => void;
};

interface ApplyPreviewComponentSelectionOptions {
  index: number;
  componentId: string;
  isInteractive: boolean;
  isMobileWorkspace: boolean;
  store: PreviewSelectionStore;
  navigateToEditor: () => void;
}

/**
 * Route ordinary preview clicks to the matching editor inspector.
 * Interactive controls remain entirely owned by the live preview.
 */
export const applyPreviewComponentSelection = ({
  index,
  componentId,
  isInteractive,
  isMobileWorkspace,
  store,
  navigateToEditor,
}: ApplyPreviewComponentSelectionOptions): void => {
  if (isInteractive) return;

  store.setActiveMessageIndex(index);
  store.select({ kind: "component", id: componentId });

  if (!isMobileWorkspace) navigateToEditor();
};
