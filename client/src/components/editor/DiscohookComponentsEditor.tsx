import React from "react";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  ExternalLink,
  Layers,
} from "lucide-react";
import { ButtonStyle, ComponentType, type ComponentNode } from "@dmb/shared";
import { useMessageStore } from "../../store/messageStore";
import { componentLabel } from "../../utils/componentsV2";

const isLinkButton = (component?: Partial<ComponentNode>) =>
  component?.type === ComponentType.Button && component?.style === ButtonStyle.Link;

export const DiscohookComponentsEditor: React.FC = () => {
  const components = useMessageStore((state) => state.data.components);
  const addComponent = useMessageStore((state) => state.addComponent);
  const addActionRowChild = useMessageStore((state) => state.addActionRowChild);
  const removeComponentById = useMessageStore((state) => state.removeComponentById);
  const moveComponentById = useMessageStore((state) => state.moveComponentById);
  const duplicateComponentById = useMessageStore((state) => state.duplicateComponentById);
  const select = useMessageStore((state) => state.select);
  const selection = useMessageStore((state) => state.selection);

  const actionRows = components.filter((c) => c.type === ComponentType.ActionRow);

  const getStyleBadge = (style?: number) => {
    switch (style) {
      case ButtonStyle.Primary:
        return { bg: "bg-[#5865f2]", label: "Primary" };
      case ButtonStyle.Secondary:
        return { bg: "bg-[#4e5058]", label: "Secondary" };
      case ButtonStyle.Success:
        return { bg: "bg-[#23a55a]", label: "Success" };
      case ButtonStyle.Danger:
        return { bg: "bg-[#da373c]", label: "Danger" };
      case ButtonStyle.Link:
        return { bg: "bg-[#4e5058]", label: "Link" };
      default:
        return { bg: "bg-[#5865f2]", label: "Button" };
    }
  };

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-center justify-between pb-1 border-b border-[#1e1f22]">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-[#5865f2]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#dbdee1]">
            Action Rows & Buttons
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-[#949ba4] bg-[#1e1f22] px-2 py-0.5 rounded">
          {actionRows.length} / 5 Rows
        </span>
      </div>

      {actionRows.length === 0 ? (
        <div className="p-6 border border-dashed border-[#35373c] rounded-lg text-center space-y-2">
          <p className="text-xs text-[#949ba4]">
            No Action Rows yet. Add an Action Row to begin placing interactive buttons or select menus.
          </p>
          <button
            type="button"
            onClick={() => addComponent(ComponentType.ActionRow, null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-bold transition-colors shadow-sm"
          >
            <Plus size={14} /> Add Action Row
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {actionRows.map((row, rowIndex) => {
            const rowChildren = row.components || [];
            const isFull = rowChildren.length >= 5;

            return (
              <div
                key={row._id}
                className="bg-[#232428] border border-[#1e1f22] rounded-lg p-3 space-y-3 shadow-sm"
              >
                {/* Row Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white tracking-wide">
                      Action Row #{rowIndex + 1}
                    </span>
                    <span className="text-[10px] text-[#949ba4] bg-[#1e1f22] px-1.5 py-0.5 rounded">
                      {rowChildren.length}/5 items
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={rowIndex === 0}
                      onClick={() => row._id && moveComponentById(row._id, -1, null)}
                      className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] disabled:opacity-30 disabled:hover:bg-transparent"
                      title="Move Row Up"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={rowIndex === actionRows.length - 1}
                      onClick={() => row._id && moveComponentById(row._id, 1, null)}
                      className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] disabled:opacity-30 disabled:hover:bg-transparent"
                      title="Move Row Down"
                    >
                      <ChevronDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => row._id && duplicateComponentById(row._id)}
                      className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c]"
                      title="Duplicate Row"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => row._id && removeComponentById(row._id)}
                      className="p-1 rounded text-[#f28b8b] hover:bg-[#da373c]/20"
                      title="Delete Row"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Horizontal Button List */}
                <div className="flex flex-wrap gap-2">
                  {rowChildren.map((child: ComponentNode) => {
                    const isSelected =
                      selection?.kind === "component" && selection.id === child._id;
                    const styleInfo = getStyleBadge(child.style);
                    const isLink = isLinkButton(child);

                    return (
                      <div
                        key={child._id}
                        onClick={() => child._id && select({ kind: "component", id: child._id })}
                        className={`group relative flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-md border cursor-pointer select-none transition-all ${
                          isSelected
                            ? "bg-[#5865f2]/20 border-[#5865f2] shadow-sm"
                            : "bg-[#2b2d31] hover:bg-[#35373c] border-[#1e1f22] hover:border-[#383a40]"
                        }`}
                      >
                        {/* Style Color Pill */}
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center text-white text-[9px] ${styleInfo.bg}`}
                        >
                          {isLink && <ExternalLink size={9} />}
                        </div>

                        {/* Label */}
                        <span className="text-xs font-semibold text-white max-w-[130px] truncate">
                          {child.label || componentLabel(child) || "Untitled Button"}
                        </span>

                        {/* Action Quick Delete */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (child._id) removeComponentById(child._id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-[#f28b8b] text-[#949ba4] transition-opacity"
                          title="Remove item"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Add Item Actions for this Row */}
                <div className="flex items-center gap-2 pt-1 border-t border-[#1e1f22]">
                  <button
                    type="button"
                    disabled={isFull}
                    onClick={() => row._id && addActionRowChild(row._id, ComponentType.Button)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#35373c] hover:bg-[#4752c4] hover:text-white text-xs text-[#dbdee1] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Plus size={13} /> Add Button
                  </button>

                  <button
                    type="button"
                    disabled={rowChildren.length > 0}
                    onClick={() =>
                      row._id && addActionRowChild(row._id, ComponentType.StringSelect)
                    }
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#35373c] hover:bg-[#4752c4] hover:text-white text-xs text-[#dbdee1] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title={
                      rowChildren.length > 0
                        ? "Select menus must be the only item in their action row"
                        : "Add Select Menu"
                    }
                  >
                    <Plus size={13} /> Add Select Menu
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add Another Action Row */}
          {actionRows.length < 5 && (
            <button
              type="button"
              onClick={() => addComponent(ComponentType.ActionRow, null)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-[#35373c] hover:border-[#5865f2] hover:bg-[#35373c]/30 text-xs font-bold text-[#b5bac1] hover:text-white transition-all"
            >
              <Plus size={14} /> Add Action Row ({actionRows.length}/5)
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DiscohookComponentsEditor;