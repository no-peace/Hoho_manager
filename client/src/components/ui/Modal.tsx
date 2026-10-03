// client/src/components/ui/Modal.tsx
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-md",
}) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`w-full ${width} rounded-lg bg-[#313338] border border-[#1e1f22] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 max-h-[85vh]`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1f22] bg-[#2b2d31] shrink-0">
            <h2 className="text-[14px] font-bold text-white uppercase tracking-wider">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-[#b5bac1] hover:text-white transition-colors"
              aria-label="Close"
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
      </div>
    </div>,
    document.body
  );
};

export default Modal;