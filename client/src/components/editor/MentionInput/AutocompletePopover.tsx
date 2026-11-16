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
        { menuWidth: rect.width, maxMenuHeight: maxHeight, margin: 12, gap: 6 },
      );
      setFloatingStyle({ position: "fixed", top: placement.top, left: placement.left, width: placement.width, maxHeight: placement.maxHeight, zIndex: 10000 });
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
      className="fixed rounded-[10px] bg-[#161A23] border border-[#272D3A] shadow-xl overflow-hidden z-[10000] animate-in fade-in zoom-in-95 duration-150"
      style={floatingStyle}
    >
      <div className="px-3 py-1.5 bg-[#10131A] text-[10px] font-medium text-[#A1A8B8] border-b border-[#202531] flex items-center justify-between">
        {headerLabel}
        <span className="text-[9px] lowercase font-normal text-[#949ba4] inline-flex items-center gap-1">
          <kbd className="rounded border border-[#272D3A] bg-[#1D2230] px-1 py-0.5 font-mono text-[9px]">Tab / Enter</kbd>
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
                    ? "bg-[#818CF8]/15 text-[#F1F3F9] border-l-2 border-[#818CF8]"
                    : "text-[#A1A8B8] hover:bg-[#252B3A] hover:text-[#F1F3F9]"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {item.icon}
                <span className="font-semibold truncate">{item.title}</span>
              </div>
              {item.subtitle && (
                <span
                  className={`text-[10px] truncate shrink-0 max-w-[190px] ${
                    isSelected ? "text-[#E5E7F3]" : "text-[#6F788A]"
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
