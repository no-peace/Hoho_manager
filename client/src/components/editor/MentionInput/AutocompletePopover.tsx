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
      className={`absolute left-0 right-0 rounded-lg bg-[#2b2d31] border border-[#1e1f22] shadow-2xl overflow-hidden z-40 animate-in fade-in zoom-in-95 duration-75 ${
        dropdownPosition === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
      }`}
      style={{ maxHeight: "260px" }}
    >
      <div className="px-2.5 py-1.5 bg-[#1e1f22] text-[10px] font-bold uppercase tracking-wider text-[#949ba4] border-b border-[#313338] flex items-center justify-between">
        {headerLabel}
        <span className="text-[9px] lowercase font-normal text-[#949ba4]">
          tab or enter to select
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
              className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between gap-2 transition-colors ${
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
