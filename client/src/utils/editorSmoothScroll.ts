import Lenis from "lenis";

let editorLenis: Lenis | null = null;
let editorScrollWrapper: HTMLElement | null = null;

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

const usesCoarsePointer = (): boolean =>
  typeof window !== "undefined" &&
  Boolean(window.matchMedia?.("(pointer: coarse)").matches);

/** Attach Lenis only to the editor's own scroll container on fine-pointer devices. */
export function initializeEditorLenis(wrapper: HTMLElement): () => void {
  if (editorScrollWrapper === wrapper) {
    return () => {
      if (editorScrollWrapper !== wrapper) return;
      editorLenis?.destroy();
      editorLenis = null;
      editorScrollWrapper = null;
    };
  }

  editorLenis?.destroy();
  editorLenis = null;
  editorScrollWrapper = wrapper;

  // Native touch scrolling has better momentum and gesture arbitration than wheel smoothing.
  if (usesCoarsePointer() || prefersReducedMotion()) {
    return () => {
      if (editorScrollWrapper !== wrapper) return;
      editorScrollWrapper = null;
    };
  }

  const content = wrapper.querySelector<HTMLElement>("[data-editor-scroll-content]");

  editorLenis = new Lenis({
    wrapper,
    content: content ?? wrapper,
    autoRaf: true,
    smoothWheel: true,
    duration: 0.8,
  });

  return () => {
    if (editorScrollWrapper !== wrapper) return;
    editorLenis?.destroy();
    editorLenis = null;
    editorScrollWrapper = null;
  };
}

const findEditorTarget = (wrapper: HTMLElement, index: number, targetId?: string): HTMLElement | null => {
  const message = wrapper.querySelector<HTMLElement>(
    `[data-message-editor-index="${index}"]`,
  );
  if (!message || !targetId) return message;

  return (
    Array.from(message.querySelectorAll<HTMLElement>("[data-editor-target-id]")).find(
      (element) => element.dataset.editorTargetId === targetId,
    ) ?? message
  );
};

/**
 * Smoothly navigate inside the editor's own scroll container.
 * A target ID drills into a component/embed; without one, the message card is used.
 */
export function scrollToMessageEditor(index: number, targetId?: string): void {
  if (typeof document === "undefined") return;
  const wrapper =
    editorScrollWrapper ??
    document.querySelector<HTMLElement>("[data-editor-scroll-container]");
  if (!wrapper) return;

  let attempts = 0;
  const navigate = () => {
    if (!wrapper.isConnected) return;

    // Mobile SplitPane keeps the editor mounted but marks the inactive pane hidden/inert.
    const hiddenPane = wrapper.closest('[aria-hidden="true"], .invisible');
    const target = findEditorTarget(wrapper, index, targetId);
    if ((!target || hiddenPane) && attempts < 8) {
      attempts += 1;
      window.requestAnimationFrame(navigate);
      return;
    }
    if (!target) return;

    const reducedMotion = prefersReducedMotion();
    if (editorLenis && editorScrollWrapper === wrapper) {
      editorLenis.scrollTo(target, {
        offset: -16,
        duration: reducedMotion ? 0 : 0.8,
        immediate: reducedMotion,
      });
      return;
    }

    // Calculate relative to the editor wrapper. scrollIntoView() can also move the
    // page or SplitPane ancestors, which is undesirable in the nested workspace.
    const wrapperRect = wrapper.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const top = Math.max(0, wrapper.scrollTop + targetRect.top - wrapperRect.top - 16);
    if (reducedMotion) {
      wrapper.scrollTop = top;
    } else if (typeof wrapper.scrollTo === "function") {
      wrapper.scrollTo({ top, behavior: "smooth" });
    } else {
      wrapper.scrollTop = top;
    }
  };

  navigate();
}

/** Focus the first editable control in the selected message without causing a second scroll. */
export function focusMessageEditor(index: number): void {
  if (typeof document === "undefined") return;
  const wrapper =
    editorScrollWrapper ??
    document.querySelector<HTMLElement>("[data-editor-scroll-container]");
  const message = wrapper?.querySelector<HTMLElement>(
    `[data-message-editor-index="${index}"]`,
  );
  const field = message?.querySelector<HTMLElement>(
    "textarea:not([disabled]), input:not([disabled]):not([type=checkbox]):not([type=radio]), [contenteditable=true]",
  );
  if (!field) return;
  field.focus({ preventScroll: true });
  if (
    field instanceof HTMLTextAreaElement ||
    (field instanceof HTMLInputElement &&
      ["text", "search", "url", "tel", "password"].includes(field.type))
  ) {
    const end = field.value.length;
    field.setSelectionRange(end, end);
  }
}
