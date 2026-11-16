import React from "react";
import type { AutocompleteItem } from "../../../utils/mentionParser";
import { AutocompletePopover } from "./AutocompletePopover";

export interface SpecializedMenuProps {
  items: AutocompleteItem[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onApply: (item: AutocompleteItem) => void;
  dropdownPosition: "top" | "bottom";
  maxHeight?: number;
  anchor?: HTMLElement | null;
}

export const VariableMenu: React.FC<SpecializedMenuProps> = (props) => (
  <AutocompletePopover
    {...props}
    headerLabel={<span className="flex items-center gap-1.5">Variables</span>}
  />
);

export default VariableMenu;
