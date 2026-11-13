import { useState } from "react";
import type { AutocompleteType } from "../utils/mentionParser";

/**
 * Owns the keyboard-navigation and active-token state shared by the
 * Discord mention editor's autocomplete menus.
 */
export const useAutocompleteMenu = () => {
  const [acType, setAcType] = useState<AutocompleteType>(null);
  const [acQuery, setAcQuery] = useState("");
  const [acExploitTarget, setAcExploitTarget] = useState("");
  const [acCursorStart, setAcCursorStart] = useState(-1);
  const [acCursorEnd, setAcCursorEnd] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const close = () => {
    setAcType(null);
    setAcQuery("");
    setAcExploitTarget("");
    setAcCursorStart(-1);
    setAcCursorEnd(-1);
    setSelectedIndex(0);
  };

  return {
    acType,
    setAcType,
    acQuery,
    setAcQuery,
    acExploitTarget,
    setAcExploitTarget,
    acCursorStart,
    setAcCursorStart,
    acCursorEnd,
    setAcCursorEnd,
    selectedIndex,
    setSelectedIndex,
    close,
  };
};

export default useAutocompleteMenu;
