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
  Sliders,
  Zap,
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

export interface DiscohookComponentsEditorProps {
  parentId?: string | null;
}

export const DiscohookComponentsEditor: React.FC<DiscohookComponentsEditorProps> = ({
  parentId = null,
}) => {
  const data = useMessageStore((state) => state.data);
  const components = data.components || [];
  const addActionRowChild = useMessageStore((state) => state.addActionRowChild);
  const removeComponentById = useMessageStore((state) => state.removeComponentById);
  const moveComponentById = useMessageStore((state) => state.moveComponentById);
  const duplicateComponentById = useMessageStore((state) => state.duplicateComponentById);
  const select = useMessageStore((state) => state.select);
  const selection = useMessageStore((state) => state.selection);
  const flows = useActionStore((state) => state.flows);

  const [selectMenuDropdownRow, setSelectMenuDropdownRow] = useState<string | null>(null);

  interface RowEntry {
    row: ComponentNode;
    containerId: string | null;
    siblingIndex: number;
    siblingCount: number;
  }

  const rowEntries: RowEntry[] = [];
  if (parentId === null) {
    const topLevelRows = components.filter((c) => c.type === ComponentType.ActionRow);
    topLevelRows.forEach((row, idx) => {
      rowEntries.push({
        row,
        containerId: null,
        siblingIndex: idx,
        siblingCount: topLevelRows.length,
      });
    });
  } else {
    const parentContainer = components.find(
      (c) => c.type === ComponentType.Container && c._id === parentId,
    );
    const containerRows = (parentContainer?.components || []).filter(
      (c) => c.type === ComponentType.ActionRow,
    );
    containerRows.forEach((child, idx) => {
      rowEntries.push({
        row: child,
        containerId: parentId,
        siblingIndex: idx,
        siblingCount: containerRows.length,
      });
    });
  }

  const getDiscordButtonClasses = (style?: number, isSelected?: boolean) => {
    const ring = isSelected ? "ring-2 ring-white shadow-lg" : "hover:brightness-110";
    switch (style) {
      case ButtonStyle.Primary:
        return `bg-[#5865f2] text-white border-[#4752c4] ${ring}`;
      case ButtonStyle.Secondary:
        return `bg-[#4e5058] text-white border-[#3f4147] ${ring}`;
      case ButtonStyle.Success:
        return `bg-[#248046] text-white border-[#1a6334] ${ring}`;
      case ButtonStyle.Danger:
        return `bg-[#da373c] text-white border-[#a1282c] ${ring}`;
      case ButtonStyle.Link:
        return `bg-[#4e5058] text-[#dbdee1] border-[#3f4147] ${ring}`;
      default:
        return `bg-[#5865f2] text-white border-[#4752c4] ${ring}`;
    }
  };

  const getFlowStepCount = (child: ComponentNode): number => {
    if (isLinkButton(child)) return 0;
    const customId = child.custom_id ?? "";
    const flowSteps = flows[customId] || [];
    if (flowSteps.length > 0) return flowSteps.length;
    if (customId && customId !== "action:dud") return 1;
    return 0;
  };

  if (rowEntries.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {rowEntries.map(({ row, containerId, siblingIndex, siblingCount }) => {
        const rowId = row._id ?? "";
        const children = row.components ?? [];
        const hasSelect = children.some((c) => c.type !== ComponentType.Button);
        const canAddButton = !hasSelect && children.length < 5;
        const canAddSelect = children.length === 0;
        const capacityLabel = hasSelect ? "1/1 Select Menu" : `${children.length}/5 Buttons`;

        return (
          <div
            key={rowId}
            className="rounded-lg bg-[#232428] border border-[#1e1f22] shadow-sm transition-colors hover:border-[#313338]"
          >
            {/* ── Action Row Header ── */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#1e1f22]/70 border-b border-[#1e1f22] rounded-t-lg select-none">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#dbdee1] uppercase tracking-wider">
                  <Layers size={12} className="text-[#5865f2]" />
                  Action Row #{siblingIndex + 1}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#2b2d31] text-[#949ba4] border border-[#313338]">
                  {capacityLabel}
                </span>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  title="Move Row Up"
                  disabled={siblingIndex === 0}
                  onClick={() => moveComponentById(rowId, -1, containerId)}
                  className="p-1 text-[#949ba4] hover:text-white disabled:opacity-30 rounded hover:bg-[#35373c]"
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  type="button"
                  title="Move Row Down"
                  disabled={siblingIndex === siblingCount - 1}
                  onClick={() => moveComponentById(rowId, 1, containerId)}
                  className="p-1 text-[#949ba4] hover:text-white disabled:opacity-30 rounded hover:bg-[#35373c]"
                >
                  <ChevronDown size={13} />
                </button>
                <button
                  type="button"
                  title="Duplicate Row"
                  onClick={() => duplicateComponentById(rowId)}
                  className="p-1 text-[#949ba4] hover:text-white rounded hover:bg-[#35373c]"
                >
                  <Copy size={12} />
                </button>
                <button
                  type="button"
                  title="Delete Row"
                  onClick={() => removeComponentById(rowId)}
                  className="p-1 text-[#f28b8b] hover:text-white hover:bg-[#da373c] rounded ml-0.5 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* ── Action Row Body ── */}
            <div className="p-3 space-y-2.5">
              {children.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {children.map((child, childIdx) => {
                    const childId = child._id ?? "";
                    const isSelected =
                      selection?.kind === "component" && selection.id === childId;
                    const isButton = child.type === ComponentType.Button;
                    const stepCount = getFlowStepCount(child);
                    const selectMeta = SELECT_TYPE_MAP[child.type];

                    if (isButton) {
                      return (
                        <div
                          key={childId}
                          onClick={(e) => {
                            e.stopPropagation();
                            select({ kind: "component", id: childId });
                          }}
                          className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-[5px] border text-xs font-semibold cursor-pointer transition-all select-none ${getDiscordButtonClasses(
                            child.style,
                            isSelected,
                          )} ${child.disabled ? "opacity-50" : ""}`}
                        >
                          <span className="truncate max-w-[150px]">
                            {child.label || "Button"}
                          </span>

                          {isLinkButton(child) ? (
                            <ExternalLink size={12} className="opacity-80 shrink-0" />
                          ) : stepCount > 0 ? (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono"
                              title={`${stepCount} Flow Action(s)`}
                            >
                              <Zap size={10} className="text-[#f0b232]" />
                              {stepCount}
                            </span>
                          ) : null}

                          <Sliders size={11} className="opacity-60 group-hover:opacity-100" />

                          {/* Compact floating controls on hover */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="hidden group-hover:flex items-center gap-0.5 absolute -top-6 right-0 bg-[#111214] border border-[#2b2d31] rounded px-1 py-0.5 shadow-lg z-20"
                          >
                            <button
                              type="button"
                              disabled={childIdx === 0}
                              onClick={() => moveComponentById(childId, -1, rowId)}
                              className="p-0.5 text-[#949ba4] hover:text-white disabled:opacity-30"
                              title="Move Left"
                            >
                              <ChevronLeft size={11} />
                            </button>
                            <button
                              type="button"
                              disabled={childIdx === children.length - 1}
                              onClick={() => moveComponentById(childId, 1, rowId)}
                              className="p-0.5 text-[#949ba4] hover:text-white disabled:opacity-30"
                              title="Move Right"
                            >
                              <ChevronRight size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => duplicateComponentById(childId)}
                              className="p-0.5 text-[#949ba4] hover:text-white"
                              title="Duplicate"
                            >
                              <Copy size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeComponentById(childId)}
                              className="p-0.5 text-[#f28b8b] hover:text-white"
                              title="Remove"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // Select Menu Full-Width Discord Bar
                    return (
                      <div
                        key={childId}
                        onClick={(e) => {
                          e.stopPropagation();
                          select({ kind: "component", id: childId });
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md bg-[#1e1f22] border cursor-pointer transition-all ${
                          isSelected
                            ? "border-[#5865f2] ring-1 ring-[#5865f2]"
                            : "border-[#111214] hover:border-[#3f4147]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {selectMeta?.icon && (
                            <selectMeta.icon size={14} className="text-[#5865f2] shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-[#dbdee1] truncate">
                              {child.placeholder || componentLabel(child)}
                            </div>
                            <div className="text-[10px] text-[#949ba4] flex items-center gap-2">
                              <span>{selectMeta?.label || "Select Menu"}</span>
                              {child.type === ComponentType.StringSelect && (
                                <span>• {(child.options || []).length} option(s)</span>
                              )}
                              {stepCount > 0 && (
                                <span className="text-[#f0b232]">• ⚡ {stepCount} flow step(s)</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => select({ kind: "component", id: childId })}
                            className="px-2 py-1 rounded bg-[#2b2d31] hover:bg-[#35373c] text-[11px] text-[#dbdee1]"
                          >
                            Edit Options & Flow
                          </button>
                          <button
                            type="button"
                            onClick={() => removeComponentById(childId)}
                            className="p-1 text-[#f28b8b] hover:text-white hover:bg-[#da373c] rounded"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Add Button / Add Select Menu Controls ── */}
              {(canAddButton || canAddSelect) && (
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {canAddButton && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addActionRowChild(rowId, ComponentType.Button);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] hover:text-white text-[11px] font-semibold border border-[#313338] transition-colors"
                    >
                      <Plus size={12} /> Add Button
                    </button>
                  )}

                  {canAddSelect && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectMenuDropdownRow(
                            selectMenuDropdownRow === rowId ? null : rowId,
                          );
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] hover:text-white text-[11px] font-semibold border border-[#313338] transition-colors"
                      >
                        <ListFilter size={12} /> Add Select Menu ▾
                      </button>

                      {selectMenuDropdownRow === rowId && (
                        <div className="absolute left-0 bottom-full mb-1 w-48 rounded-md bg-[#111214] border border-[#2b2d31] shadow-xl py-1 z-40 text-xs">
                          {Object.entries(SELECT_TYPE_MAP).map(([typeNum, meta]) => {
                            const IconComponent = meta.icon;
                            return (
                              <button
                                key={typeNum}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addActionRowChild(rowId, Number(typeNum));
                                  setSelectMenuDropdownRow(null);
                                }}
                                className="w-full text-left px-3 py-1.5 text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2"
                              >
                                <IconComponent size={13} />
                                {meta.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DiscohookComponentsEditor;