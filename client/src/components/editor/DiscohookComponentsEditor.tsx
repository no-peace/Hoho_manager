import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  Layers,
  ListFilter,
  User,
  Shield,
  Hash,
  AtSign,
} from "lucide-react";
import { useEffect } from "react";
import { ButtonStyle, ComponentType, type ComponentNode } from "@dmb/shared";
import { renderButtonEmoji } from "../preview/ActionRowPreview";
import { useMessageStore } from "../../store/messageStore";
import { DragHandle, SortableItem, SortableList } from "../ui/SortableList";
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
  rowId?: string;
  componentsOverride?: ComponentNode[];
}

export const DiscohookComponentsEditor: React.FC<DiscohookComponentsEditorProps> = ({
  parentId = null,
  rowId: targetRowId,
  componentsOverride,
}) => {
  // When a caller supplies a message-specific component tree, subscribe to
  // that stable tree rather than the active message's entire data object.
  // This keeps inactive message editors isolated from edits to the active one.
  const components = useMessageStore(
    (state) => componentsOverride ?? state.data.components ?? [],
  );
  const addActionRowChild = useMessageStore((state) => state.addActionRowChild);
  const removeComponentById = useMessageStore((state) => state.removeComponentById);
  const reorderComponentById = useMessageStore((state) => state.reorderComponentById);
  const duplicateComponentById = useMessageStore((state) => state.duplicateComponentById);
  const select = useMessageStore((state) => state.select);
  const selection = useMessageStore((state) => state.selection);

  const [selectMenuDropdownRow, setSelectMenuDropdownRow] = useState<string | null>(null);

  useEffect(() => {
    if (!selectMenuDropdownRow) return;
    const close = () => setSelectMenuDropdownRow(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [selectMenuDropdownRow]);

  interface RowEntry {
    row: ComponentNode;
    containerId: string | null;
    siblingIndex: number;
  }

  const rowEntries: RowEntry[] = [];
  if (parentId === null) {
    const topLevelRows = components.filter((c) => c.type === ComponentType.ActionRow);
    topLevelRows.forEach((row, idx) => {
      if (targetRowId && row._id !== targetRowId) return;
      const actualIdx = targetRowId ? components.findIndex((c) => c._id === row._id) : idx;
      rowEntries.push({
        row,
        containerId: null,
        siblingIndex: actualIdx !== -1 ? actualIdx : idx,
      });
    });
  } else {
    const parentContainer = components.find(
      (c) => c.type === ComponentType.Container && c._id === parentId,
    );
    const containerChildren = parentContainer?.components || [];
    const containerRows = containerChildren.filter(
      (c) => c.type === ComponentType.ActionRow,
    );
    containerRows.forEach((child, idx) => {
      if (targetRowId && child._id !== targetRowId) return;
      const actualIdx = targetRowId
        ? containerChildren.findIndex((c) => c._id === child._id)
        : idx;
      rowEntries.push({
        row: child,
        containerId: parentId,
        siblingIndex: actualIdx !== -1 ? actualIdx : idx,
      });
    });
  }

  const getDiscordButtonClasses = (style?: number, isSelected?: boolean) => {
    const ring = isSelected ? "ring-2 ring-[#818CF8] shadow-sm" : "hover:brightness-105";
    switch (style) {
      case ButtonStyle.Primary:
        return `bg-[#818CF8] text-[#0B0D12] border-[#6366F1] ${ring}`;
      case ButtonStyle.Secondary:
        return `bg-[#343C4E] text-[#F1F3F9] border-[#343C4E] ${ring}`;
      case ButtonStyle.Success:
        return `bg-[#34D399] text-[#0B0D12] border-[#34D399] ${ring}`;
      case ButtonStyle.Danger:
        return `bg-[#F87171] text-[#0B0D12] border-[#F87171] ${ring}`;
      case ButtonStyle.Link:
        return `bg-[#1D2230] text-[#F1F3F9] border-[#272D3A] ${ring}`;
      default:
        return `bg-[#818CF8] text-white border-[#6366F1] ${ring}`;
    }
  };

  if (rowEntries.length === 0) return null;

  const rowCards = rowEntries.map(({ row, containerId, siblingIndex }) => {
        const rowId = row._id ?? "";
        const children = row.components ?? [];
        const hasSelect = children.some((c) => c.type !== ComponentType.Button);
        const canAddButton = !hasSelect && children.length < 5;
        const canAddSelect = children.length === 0;
        const capacityLabel = hasSelect ? "1/1 Select Menu" : `${children.length}/5 Buttons`;

        const rowCard = (
          <div
            key={rowId}
            data-editor-target-id={rowId}
            className="rounded-lg bg-[#10131A] border border-[#272D3A] shadow-sm transition-[border-color,background-color] duration-150 hover:border-[#252B3A]"
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#10131A] border-b border-[#1D2230] rounded-t-lg select-none">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold text-[#F1F3F9]">
                  <Layers size={12} className="text-[#818CF8]" />
                  Action Row #{siblingIndex + 1}
                </span>
                <span className="text-[0.625rem] font-mono tabular-nums px-1.5 py-0.5 rounded-md bg-[#10131A] text-[#A1A8B8] border border-[#272D3A]">
                  {capacityLabel}
                </span>
              </div>

              <div className="flex items-center gap-0.5">
                <DragHandle label="Drag to reorder action row" />
                <button
                  type="button"
                  title="Duplicate Row"
                  onClick={() => duplicateComponentById(rowId)}
                  className="p-1 text-[#A1A8B8] hover:text-white rounded hover:bg-[#252B3A]"
                >
                  <Copy size={12} />
                </button>
                <button
                  type="button"
                  title="Delete Row"
                  onClick={() => removeComponentById(rowId)}
                  className="p-1 text-[#F87171] hover:text-white hover:bg-[#F87171] rounded ml-0.5 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            <div className="p-3 space-y-2.5">
              {children.length > 0 && (
                <SortableList
                  items={children.map((child, childIdx) => child._id ?? `row-${rowId}-child-${childIdx}`)}
                  onReorder={(activeId, overId) => reorderComponentById(activeId, overId, rowId)}
                  strategy="grid"
                  className="flex flex-wrap items-center gap-2"
                >
                  {children.map((child, childIdx) => {
                    const childId = child._id ?? "";
                    const isSelected =
                      selection?.kind === "component" && selection.id === childId;
                    const isButton = child.type === ComponentType.Button;
                    const selectMeta = SELECT_TYPE_MAP[child.type];

                    if (isButton) {
                      const sortableId = child._id ?? `row-${rowId}-child-${childIdx}`;
                      return (
                        <SortableItem key={sortableId} id={sortableId}>
                          <div className="inline-flex min-w-0 items-center gap-1.5 rounded-md border border-current/20 bg-[#1D2230] px-1.5 py-1 text-xs font-semibold text-[#F1F3F9]">
                            <DragHandle label="Drag to reorder button" className="min-h-6 min-w-6" />
                            <button
                              type="button"
                              data-editor-target-id={childId}
                              onClick={() => select({ kind: "component", id: childId })}
                              className={`inline-flex min-w-0 items-center gap-1.5 rounded px-1.5 py-1 text-left transition-[background-color,border-color,color,box-shadow] duration-150 hover:ring-2 hover:ring-[#818CF8]/60 ${getDiscordButtonClasses(child.style, isSelected)} ${child.disabled ? "opacity-50" : ""}`}
                            >
                              {renderButtonEmoji(child.emoji)}
                              <span className="max-w-[140px] truncate">{child.label || "Button"}</span>
                              {isLinkButton(child) && <ExternalLink size={12} className="shrink-0 opacity-80" />}
                            </button>
                            <div className="flex items-center gap-0.5 border-l border-current/20 pl-1.5">
                              <button type="button" aria-label="Duplicate button" title="Duplicate button" onClick={(event) => { event.stopPropagation(); duplicateComponentById(childId); }} className="inline-flex min-h-6 min-w-6 items-center justify-center rounded text-[#A1A8B8] transition-colors hover:bg-[#252B3A] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818CF8]"><Copy size={12} /></button>
                              <button type="button" aria-label="Delete button" title="Delete button" onClick={(event) => { event.stopPropagation(); removeComponentById(childId); }} className="inline-flex min-h-6 min-w-6 items-center justify-center rounded text-[#F87171] transition-colors hover:bg-[#F87171]/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818CF8]"><Trash2 size={12} /></button>
                            </div>
                          </div>
                        </SortableItem>
                      );
                    }

                    // Select Menu Full-Width Discord Bar
                    const sortableId = child._id ?? `row-${rowId}-child-${childIdx}`;
                    return (
                      <SortableItem key={sortableId} id={sortableId}>
                      <div
                        data-editor-target-id={childId}
                        onClick={(e) => {
                          e.stopPropagation();
                          select({ kind: "component", id: childId });
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md bg-[#1D2230] border cursor-pointer transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out ${
                          isSelected
                            ? "border-[#818CF8] ring-1 ring-[#818CF8]"
                            : "border-[#10131A] hover:border-[#3f4147]"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {selectMeta?.icon && (
                            <selectMeta.icon size={14} className="text-[#818CF8] shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-[#F1F3F9] truncate">
                              {child.placeholder || componentLabel(child)}
                            </div>
                            <div className="text-[0.625rem] text-[#A1A8B8] flex items-center gap-2">
                              <span>{selectMeta?.label || "Select Menu"}</span>
                              {child.type === ComponentType.StringSelect && (
                                <span>• {(child.options || []).length} option(s)</span>
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
                            className="px-2 py-1 rounded bg-[#161A23] hover:bg-[#252B3A] text-[0.6875rem] text-[#F1F3F9]"
                          >
                            Edit Options & Flow
                          </button>
                          <button
                            type="button"
                            onClick={() => removeComponentById(childId)}
                            className="p-1 text-[#F87171] hover:text-white hover:bg-[#F87171] rounded"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      </SortableItem>
                    );
                  })}
                </SortableList>
              )}

              {(canAddButton || canAddSelect) && (
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {canAddButton && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        addActionRowChild(rowId, ComponentType.Button);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161A23] hover:bg-[#252B3A] text-[#F1F3F9] hover:text-white text-[0.6875rem] font-semibold border border-[#272D3A] hover:border-[#818CF8]/50 hover:bg-[#1D2230]/50 transition-colors"
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
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#161A23] hover:bg-[#252B3A] text-[#F1F3F9] hover:text-white text-[0.6875rem] font-semibold border border-[#272D3A] hover:border-[#818CF8]/50 hover:bg-[#1D2230]/50 transition-colors"
                      >
                        <ListFilter size={12} /> Add Select Menu ▾
                      </button>

                      {selectMenuDropdownRow === rowId && (
                        <div className="absolute left-0 bottom-full mb-1 w-48 rounded-md bg-[#10131A] border border-[#161A23] shadow-xl py-1 z-[10000] text-xs">
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
                                className="w-full text-left px-3 py-1.5 text-[#F1F3F9] hover:bg-[#818CF8] hover:text-white flex items-center gap-2"
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
        return targetRowId ? rowCard : (
          <SortableItem key={rowId} id={rowId}>{rowCard}</SortableItem>
        );
      });
  return targetRowId ? (
    <div className="space-y-2.5">{rowCards}</div>
  ) : (
    <SortableList
      items={rowEntries.map(({ row }, index) => row._id ?? `action-row-${index}`)}
      onReorder={(activeId, overId) => reorderComponentById(activeId, overId, parentId)}
      strategy="vertical"
      className="space-y-2.5"
    >
      {rowCards}
    </SortableList>
  );
};

export default DiscohookComponentsEditor;