import React, { useState } from "react";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Layers,
  ListFilter,
  User,
  Shield,
  Hash,
  AtSign,
} from "lucide-react";
import { ButtonStyle, ComponentType, type ComponentNode } from "@dmb/shared";
import { useMessageStore } from "../../store/messageStore";
import { useActionStore } from "../../store/actionStore";
import { componentLabel } from "../../utils/componentsV2";

const isLinkButton = (component?: Partial<ComponentNode>) =>
  component?.type === ComponentType.Button &&
  (component?.style === ButtonStyle.Link || Boolean(component?.url));

const SELECT_TYPE_MAP: Record<
  number,
  { label: string; icon: React.FC<{ size?: number; className?: string }> }
> = {
  [ComponentType.StringSelect]: { label: "String Select", icon: ListFilter },
  [ComponentType.UserSelect]: { label: "User Select", icon: User },
  [ComponentType.RoleSelect]: { label: "Role Select", icon: Shield },
  [ComponentType.ChannelSelect]: { label: "Channel Select", icon: Hash },
  [ComponentType.MentionableSelect]: { label: "Mentionable Select", icon: AtSign },
};

export const DiscohookComponentsEditor: React.FC = () => {
  const components = useMessageStore((state) => state.data.components);
  const addComponent = useMessageStore((state) => state.addComponent);
  const addActionRowChild = useMessageStore((state) => state.addActionRowChild);
  const removeComponentById = useMessageStore((state) => state.removeComponentById);
  const moveComponentById = useMessageStore((state) => state.moveComponentById);
  const duplicateComponentById = useMessageStore((state) => state.duplicateComponentById);
  const select = useMessageStore((state) => state.select);
  const selection = useMessageStore((state) => state.selection);
  const flows = useActionStore((state) => state.flows);

  const [selectMenuDropdownRow, setSelectMenuDropdownRow] = useState<string | null>(null);

  // Collect top-level action rows and container-nested action rows
  interface RowEntry {
    row: ComponentNode;
    containerId: string | null;
    containerLabel?: string;
  }

  const rowEntries: RowEntry[] = [];
  for (const comp of components) {
    if (comp.type === ComponentType.ActionRow) {
      rowEntries.push({ row: comp, containerId: null });
    } else if (comp.type === ComponentType.Container && Array.isArray(comp.components)) {
      for (const child of comp.components) {
        if (child.type === ComponentType.ActionRow) {
          rowEntries.push({
            row: child,
            containerId: comp._id ?? null,
            containerLabel: "Container Row",
          });
        }
      }
    }
  }

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

  const getFlowBadge = (child: ComponentNode) => {
    if (isLinkButton(child)) {
      return { label: "🔗 Link", color: "bg-[#4e5058] text-[#dbdee1]" };
    }
    const customId = child.custom_id || child._action_custom_id;
    const stepList = customId ? flows[customId] : undefined;
    if (stepList && stepList.length > 0) {
      const hasModal = stepList.some((s) => s.type === "open_modal");
      if (hasModal) {
        return { label: "📋 Modal", color: "bg-[#5865f2] text-white" };
      }
      return { label: "⚡ Flow", color: "bg-[#23a55a] text-white" };
    }
    return { label: "No Action", color: "bg-[#35373c] text-[#949ba4]" };
  };

  return (
    <div className="space-y-4 font-sans">
      <div className="flex items-center justify-between pb-1 border-b border-[#1e1f22]">
        <div className="flex items-center gap-2">
          <Layers size={15} className="text-[#5865f2]" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#dbdee1]">
            Action Rows & Components
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-[#949ba4] bg-[#1e1f22] px-2 py-0.5 rounded">
          {rowEntries.length} / 5 Rows
        </span>
      </div>

      {rowEntries.length === 0 ? (
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
          {rowEntries.map((entry, rowIndex) => {
            const { row, containerId, containerLabel } = entry;
            const rowChildren = row.components || [];
            const isFull = rowChildren.length >= 5;
            const hasSelectMenu = rowChildren.some((c) => c.type in SELECT_TYPE_MAP);

            return (
              <div
                key={row._id}
                className="bg-[#232428] border border-[#1e1f22] rounded-lg p-3 space-y-3 shadow-sm"
              >
                {/* Row Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white tracking-wide">
                      {containerLabel ? `${containerLabel} #${rowIndex + 1}` : `Action Row #${rowIndex + 1}`}
                    </span>
                    <span className="text-[10px] text-[#949ba4] bg-[#1e1f22] px-1.5 py-0.5 rounded">
                      {hasSelectMenu ? "1/1 Select Menu" : `${rowChildren.length}/5 buttons`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={rowIndex === 0}
                      onClick={() => row._id && moveComponentById(row._id, -1, containerId)}
                      className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] disabled:opacity-30 disabled:hover:bg-transparent"
                      title="Move Row Up"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={rowIndex === rowEntries.length - 1}
                      onClick={() => row._id && moveComponentById(row._id, 1, containerId)}
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

                {/* Items in this Row */}
                <div className="space-y-2">
                  {hasSelectMenu ? (
                    /* Dedicated Select Menu Card */
                    rowChildren.map((child: ComponentNode) => {
                      const isSelected =
                        selection?.kind === "component" && selection.id === child._id;
                      const selectMeta = SELECT_TYPE_MAP[child.type] || {
                        label: "Select Menu",
                        icon: ListFilter,
                      };
                      const IconComp = selectMeta.icon;
                      const flowBadge = getFlowBadge(child);

                      return (
                        <div
                          key={child._id}
                          onClick={() => child._id && select({ kind: "component", id: child._id })}
                          className={`group p-3 rounded-lg border cursor-pointer select-none transition-all flex items-center justify-between gap-3 ${
                            isSelected
                              ? "bg-[#5865f2]/20 border-[#5865f2] shadow-sm"
                              : "bg-[#1e1f22] hover:bg-[#2b2d31] border-[#111214] hover:border-[#383a40]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-1.5 rounded bg-[#35373c] text-white">
                              <IconComp size={15} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">
                                  {selectMeta.label}
                                </span>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${flowBadge.color}`}
                                >
                                  {flowBadge.label}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#949ba4] truncate mt-0.5">
                                {child.placeholder || "No placeholder set"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (child._id) removeComponentById(child._id);
                              }}
                              className="p-1 text-[#949ba4] hover:text-[#f28b8b] hover:bg-[#da373c]/20 rounded transition-colors"
                              title="Delete Select Menu"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    /* Horizontal Buttons List with Left/Right Reordering & Badges */
                    <div className="flex flex-wrap gap-2">
                      {rowChildren.map((child: ComponentNode, childIndex: number) => {
                        const isSelected =
                          selection?.kind === "component" && selection.id === child._id;
                        const styleInfo = getStyleBadge(child.style);
                        const isLink = isLinkButton(child);
                        const flowBadge = getFlowBadge(child);

                        return (
                          <div
                            key={child._id}
                            onClick={() =>
                              child._id && select({ kind: "component", id: child._id })
                            }
                            className={`group relative flex items-center gap-2 pl-2 pr-1.5 py-1.5 rounded-md border cursor-pointer select-none transition-all ${
                              isSelected
                                ? "bg-[#5865f2]/20 border-[#5865f2] shadow-sm"
                                : "bg-[#2b2d31] hover:bg-[#35373c] border-[#1e1f22] hover:border-[#383a40]"
                            }`}
                          >
                            {/* Horizontal Reordering Controls */}
                            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                disabled={childIndex === 0}
                                onClick={() =>
                                  child._id &&
                                  row._id &&
                                  moveComponentById(child._id, -1, row._id)
                                }
                                className="p-0.5 text-[#949ba4] hover:text-white disabled:opacity-20 transition-colors"
                                title="Move Left"
                              >
                                <ChevronLeft size={12} />
                              </button>
                              <button
                                type="button"
                                disabled={childIndex === rowChildren.length - 1}
                                onClick={() =>
                                  child._id &&
                                  row._id &&
                                  moveComponentById(child._id, 1, row._id)
                                }
                                className="p-0.5 text-[#949ba4] hover:text-white disabled:opacity-20 transition-colors"
                                title="Move Right"
                              >
                                <ChevronRight size={12} />
                              </button>
                            </div>

                            {/* Style Color Pill */}
                            <div
                              className={`w-3.5 h-3.5 rounded flex items-center justify-center text-white text-[9px] ${styleInfo.bg}`}
                              title={styleInfo.label}
                            >
                              {isLink && <ExternalLink size={9} />}
                            </div>

                            {/* Label */}
                            <span className="text-xs font-semibold text-white max-w-[120px] truncate">
                              {child.label || componentLabel(child) || "Untitled Button"}
                            </span>

                            {/* Flow / Modal Badge */}
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${flowBadge.color}`}
                            >
                              {flowBadge.label}
                            </span>

                            {/* Quick Delete */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (child._id) removeComponentById(child._id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-[#f28b8b] text-[#949ba4] transition-opacity"
                              title="Remove button"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Add Item Actions for this Row */}
                {!hasSelectMenu && (
                  <div className="flex items-center gap-2 pt-1 border-t border-[#1e1f22] relative">
                    <button
                      type="button"
                      disabled={isFull}
                      onClick={() => row._id && addActionRowChild(row._id, ComponentType.Button)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#35373c] hover:bg-[#4752c4] hover:text-white text-xs text-[#dbdee1] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={13} /> Add Button
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        disabled={rowChildren.length > 0}
                        onClick={() =>
                          setSelectMenuDropdownRow(
                            selectMenuDropdownRow === row._id ? null : (row._id ?? null)
                          )
                        }
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#35373c] hover:bg-[#4752c4] hover:text-white text-xs text-[#dbdee1] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title={
                          rowChildren.length > 0
                            ? "Select menus must be the only item in their action row"
                            : "Add Select Menu"
                        }
                      >
                        <Plus size={13} /> Add Select Menu <ChevronDown size={11} />
                      </button>

                      {selectMenuDropdownRow === row._id && (
                        <div className="absolute top-full left-0 mt-1 w-44 bg-[#1e1f22] border border-[#111214] rounded shadow-2xl z-50 py-1">
                          {Object.entries(SELECT_TYPE_MAP).map(([typeNum, meta]) => (
                            <button
                              key={typeNum}
                              type="button"
                              onClick={() => {
                                if (row._id) {
                                  addActionRowChild(row._id, Number(typeNum));
                                }
                                setSelectMenuDropdownRow(null);
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-[#dbdee1] hover:bg-[#5865f2] hover:text-white transition-colors flex items-center gap-2"
                            >
                              <meta.icon size={13} /> {meta.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Another Action Row */}
          {rowEntries.length < 5 && (
            <button
              type="button"
              onClick={() => addComponent(ComponentType.ActionRow, null)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-[#35373c] hover:border-[#5865f2] hover:bg-[#35373c]/30 text-xs font-bold text-[#b5bac1] hover:text-white transition-all"
            >
              <Plus size={14} /> Add Action Row ({rowEntries.length}/5)
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DiscohookComponentsEditor;