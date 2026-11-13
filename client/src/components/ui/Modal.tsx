// client/src/components/ui/Modal.tsx
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { ErrorBoundary } from "./ErrorBoundary";
import { UI_THEME_CONFIG } from "../../config/uiThemeConfig";
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  zIndex?: string;
  className?: string;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
}

// Module-level stack for managing active modal count and top-most escape handling
let openModalCount = 0;
let previousBodyOverflow = "";
const modalStack: (() => void)[] = [];

if (typeof document !== "undefined") {
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape" && modalStack.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      const topClose = modalStack[modalStack.length - 1];
      topClose?.();
    }
  });
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-md",
  zIndex = "z-[9990]",
  className = "",
  closeOnBackdropClick = true,
  closeOnEscape = true,
}) => {
  const modalBoxRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Body scroll lock & modal stack management
  useEffect(() => {
    if (!open) return;

    if (typeof document !== "undefined" && document.body) {
      if (openModalCount === 0) previousBodyOverflow = document.body.style.overflow;
      openModalCount++;
      document.body.style.overflow = "hidden";
    }

    if (closeOnEscape) {
      modalStack.push(onClose);
    }

    return () => {
      openModalCount = Math.max(0, openModalCount - 1);
      if (typeof document !== "undefined" && document.body && openModalCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
      }
      if (closeOnEscape) {
        const idx = modalStack.lastIndexOf(onClose);
        if (idx !== -1) {
          modalStack.splice(idx, 1);
        }
      }
    };
  }, [open, onClose, closeOnEscape]);

  // Accessible Focus Management & Trap
  useEffect(() => {
    if (!open) return;
    if (typeof document === "undefined") return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    // Focus the first focusable element inside the modal or the modal container itself
    const timer = setTimeout(() => {
      if (modalBoxRef.current) {
        const focusable = modalBoxRef.current.querySelectorAll<HTMLElement>(focusableSelector);
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          modalBoxRef.current.focus();
        }
      }
    }, 30);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modalBoxRef.current) return;

      const focusables = Array.from(
        modalBoxRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      ).filter((el) => el.offsetParent !== null); // visible only

      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first || !modalBoxRef.current.contains(document.activeElement)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last || !modalBoxRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className={`fixed inset-0 ${zIndex} ${UI_THEME_CONFIG.surfaces.modalBackdrop}`}
      onClick={handleBackdropClick}
    >
      <motion.div
        ref={modalBoxRef}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.95, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: UI_THEME_CONFIG.motion.durations.enter, ease: UI_THEME_CONFIG.motion.easeOut } }}
        exit={{ opacity: 0, scale: 0.95, y: 4, transition: { duration: UI_THEME_CONFIG.motion.durations.exit, ease: UI_THEME_CONFIG.motion.easeExit } }}
        className={`${UI_THEME_CONFIG.surfaces.modalPanel} ${width} ${className}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className={UI_THEME_CONFIG.surfaces.modalHeader}>
            <h2 className="text-[14px] font-bold text-white uppercase tracking-wider truncate mr-2">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-[#b5bac1] hover:text-white transition-colors shrink-0 p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2]"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div className="p-5 overflow-y-auto text-[#dbdee1] flex-1 text-sm leading-relaxed custom-scrollbar">
          <ErrorBoundary level="modal" fallbackTitle="Dialog Content Error">
            {children}
          </ErrorBoundary>
        </div>

        {footer && (
          <div className={UI_THEME_CONFIG.surfaces.modalFooter}>
            {footer}
          </div>
        )}
      </motion.div>
    </motion.div>
  );

  if (typeof document === "undefined" || !document.body) {
    return null;
  }

  return createPortal(<AnimatePresence>{open ? modalContent : null}</AnimatePresence>, document.body);
};

export default Modal;
