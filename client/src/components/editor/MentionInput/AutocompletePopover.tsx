import React, { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { AutocompleteItem } from "../../../utils/mentionParser";
import { calculateFloatingPosition } from "../../../utils/floatingPosition";

export interface AutocompletePopoverProps {
  headerLabel: React.ReactNode;
  items: AutocompleteItem[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onApply: (item: AutocompleteItem) => void;
  onClose?: () => void;
  maxHeight?: number;
  anchor?: HTMLElement | null;
}

export const AutocompletePopover: React.FC<AutocompletePopoverProps> = ({
  headerLabel,
  items,
  selectedIndex,
  onSelectIndex,
  onApply,
  onClose,
  maxHeight = 260,
  anchor,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [floatingStyle, setFloatingStyle] = useState<CSSProperties>({});

  useEffect(() => {
    if (!anchor) return;
    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect();
      const viewport = window.visualViewport;
      const placement = calculateFloatingPosition(
        { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
        { width: viewport?.width ?? window.innerWidth, height: viewport?.height ?? window.innerHeight, offsetTop: viewport?.offsetTop },
        { menuWidth: rect.width, maxMenuHeight: maxHeight, minMenuHeight: 64, margin: 12, gap: 6 },
      );
      setFloatingStyle({ position: "fixed", top: placement.top, left: placement.left, width: placement.width, maxHeight: placement.maxHeight, zIndex: 60 });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    window.visualViewport?.addEventListener("resize", updatePosition);
    window.visualViewport?.addEventListener("scroll", updatePosition);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      window.visualViewport?.removeEventListener("resize", updatePosition);
      window.visualViewport?.removeEventListener("scroll", updatePosition);
    };
  }, [anchor, maxHeight]);

  useEffect(() => {
    optionRefs.current[selectedIndex]?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex, items]);

  useEffect(() => {
    if (!onClose) return;
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [anchor, onClose]);



  if (items.length === 0) return null;

  return typeof document === "undefined" ? null : createPortal(
    <div
      ref={containerRef}
      className="fixed rounded-lg bg-[#2b2d31] border border-[#26282d] shadow-2xl overflow-hidden z-40 animate-in fade-in zoom-in-95 duration-150"
      style={floatingStyle}
    >
      <div className="px-3 py-1.5 bg-[#18191c] text-[10px] font-bold uppercase tracking-wider text-[#949ba4] border-b border-[#26282d] flex items-center justify-between">
        {headerLabel}
        <span className="text-[9px] lowercase font-normal text-[#949ba4] inline-flex items-center gap-1">
          <kbd className="rounded border border-[#35373c] bg-[#111214] px-1 py-0.5 font-mono text-[9px]">Tab / Enter</kbd>
        </span>
      </div>

      <div role="listbox" aria-activedescendant={items[selectedIndex] ? `autocomplete-option-${items[selectedIndex].id}` : undefined} className="overflow-y-auto p-1 space-y-0.5 custom-scrollbar" style={{ maxHeight: Math.max(40, Number(floatingStyle.maxHeight ?? maxHeight) - 38) }}>
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              ref={(node) => { optionRefs.current[idx] = node; }}
              id={`autocomplete-option-${item.id}`}
              role="option"
              aria-selected={isSelected}
              key={item.id}
              type="button"
              disabled={item.disabled}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => onSelectIndex(idx)}
              onClick={() => onApply(item)}
              className={`w-full text-left px-2 py-1.5 rounded-md text-xs flex items-center justify-between gap-2 transition-colors ${
                item.disabled
                  ? "opacity-70 cursor-default text-[#949ba4]"
                  : isSelected
                    ? "bg-[#5865f2] text-white"
                    : "text-[#dbdee1] hover:bg-[#35373c] hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {item.icon}
                <span className="font-semibold truncate">{item.title}</span>
              </div>
              {item.subtitle && (
                <span
                  className={`text-[10px] truncate shrink-0 max-w-[190px] ${
                    isSelected ? "text-white/85" : "text-[#949ba4]"
                  }`}
                >
                  {item.subtitle}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
};

export default AutocompletePopover;
