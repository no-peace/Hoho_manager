import React from "react";
import type { AutocompleteItem } from "../../../utils/mentionParser";

export interface AutocompletePopoverProps {
  headerLabel: React.ReactNode;
  items: AutocompleteItem[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onApply: (item: AutocompleteItem) => void;
  dropdownPosition: "top" | "bottom";
}

export const AutocompletePopover: React.FC<AutocompletePopoverProps> = ({
  headerLabel,
  items,
  selectedIndex,
  onSelectIndex,
  onApply,
  dropdownPosition,
}) => {
  if (items.length === 0) return null;

  return (
    <div
      className={`absolute left-0 right-0 rounded-lg bg-[#2b2d31] border border-[#26282d] shadow-2xl overflow-hidden z-40 animate-in fade-in zoom-in-95 duration-150 ${
        dropdownPosition === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
      }`}
      style={{ maxHeight: "260px" }}
    >
      <div className="px-3 py-1.5 bg-[#18191c] text-[10px] font-bold uppercase tracking-wider text-[#949ba4] border-b border-[#26282d] flex items-center justify-between">
        {headerLabel}
        <span className="text-[9px] lowercase font-normal text-[#949ba4] inline-flex items-center gap-1">
          <kbd className="rounded border border-[#35373c] bg-[#111214] px-1 py-0.5 font-mono text-[9px]">Tab / Enter</kbd>
        </span>
      </div>

      <div className="overflow-y-auto max-h-52 p-1 space-y-0.5 custom-scrollbar">
        {items.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
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
    </div>
  );
};

export default AutocompletePopover;
