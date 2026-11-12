// client/src/components/ui/Modal.tsx
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

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
const modalStack: (() => void)[] = [];

if (typeof document !== "undefined") {
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape" && modalStack.length > 0) {
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

    openModalCount++;
    if (typeof document !== "undefined" && document.body) {
      document.body.style.overflow = "hidden";
    }

    if (closeOnEscape) {
      modalStack.push(onClose);
    }

    return () => {
      openModalCount = Math.max(0, openModalCount - 1);
      if (typeof document !== "undefined" && document.body) {
        document.body.style.overflow = "hidden"; // Retains Studio's fixed layout invariant
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
      className={`fixed inset-0 ${zIndex} flex items-end justify-center bg-black/75 backdrop-blur-sm p-0 sm:items-center sm:p-4`}
      onClick={handleBackdropClick}
    >
      <motion.div
        ref={modalBoxRef}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } }}
        exit={{ opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } }}
        className={`w-full ${width} rounded-t-2xl sm:rounded-xl bg-[#313338] border border-[#1e1f22] shadow-xl flex flex-col overflow-hidden max-h-[90dvh] sm:max-h-[85vh] mt-auto sm:my-auto outline-none ${className}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1f22] bg-[#2b2d31] shrink-0">
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
          {children}
        </div>

        {footer && (
          <div className="px-5 py-3.5 border-t border-[#1e1f22] bg-[#2b2d31] flex justify-end gap-2.5 shrink-0">
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
