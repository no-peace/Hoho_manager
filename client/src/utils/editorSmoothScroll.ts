import Lenis from "lenis";

let editorLenis: Lenis | null = null;
let editorScrollWrapper: HTMLElement | null = null;

/** Attach Lenis to the editor's own scroll container (not the page). */
export function initializeEditorLenis(wrapper: HTMLElement): () => void {
  if (editorScrollWrapper === wrapper && editorLenis) return () => undefined;

  editorLenis?.destroy();
  editorScrollWrapper = wrapper;
  const content = wrapper.querySelector<HTMLElement>("[data-editor-scroll-content]");

  editorLenis = new Lenis({
    wrapper,
    content: content ?? wrapper,
    autoRaf: true,
    smoothWheel: true,
    duration: 0.85,
  });

  return () => {
    if (editorScrollWrapper !== wrapper) return;
    editorLenis?.destroy();
    editorLenis = null;
    editorScrollWrapper = null;
  };
}

/** Smoothly bring a message's editor card into view after preview selection. */
export function scrollToMessageEditor(index: number): void {
  if (typeof document === "undefined") return;
  const target = editorScrollWrapper?.querySelector<HTMLElement>(
    `[data-message-editor-index="${index}"]`,
  );
  if (!target) return;

  if (editorLenis) editorLenis.scrollTo(target, { offset: -12, duration: 0.85 });
  else target.scrollIntoView({ behavior: "smooth", block: "start" });
}


/** Focus the first editable control in the selected message after scrolling it into view. */
export function focusMessageEditor(index: number): void {
  if (typeof document === "undefined") return;
  const message = editorScrollWrapper?.querySelector<HTMLElement>(
    `[data-message-editor-index="${index}"]`,
  );
  const field = message?.querySelector<HTMLElement>(
    "textarea:not([disabled]), input:not([disabled]):not([type=checkbox]):not([type=radio]), [contenteditable=true]",
  );
  if (!field) return;
  field.focus({ preventScroll: true });
  if (field instanceof HTMLTextAreaElement || (field instanceof HTMLInputElement && ["text", "search", "url", "tel", "password"].includes(field.type))) {
    const end = field.value.length;
    field.setSelectionRange(end, end);
  }
}
