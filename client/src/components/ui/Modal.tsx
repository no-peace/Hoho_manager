import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Modal dialog.
 *
 * Closes on Escape and on backdrop click. `role="dialog"` plus `aria-modal`
 * conveys the state to screen readers, and focus moves to the panel on open so
 * keyboard users are not left behind on the page that opened it.
 */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}

export const Modal = ({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-lg",
}: ModalProps) => {
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        autoFocus
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`w-full ${width} max-h-[85vh] overflow-hidden rounded-xl border border-line-soft bg-raised shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
          <h2 className="text-base font-semibold text-ink-strong">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-ink-muted hover:bg-hover hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-4">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line-soft px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
