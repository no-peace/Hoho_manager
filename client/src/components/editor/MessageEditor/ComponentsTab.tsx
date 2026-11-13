import React, { useState } from "react";
import {
  Box,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Image as ImageIcon,
  Layers,
  Link,
  Minus,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import {
  ButtonStyle,
  ComponentType,
  Limits,
  type ComponentNode,
  type GalleryItem,
} from "@dmb/shared";
import { DiscordMentionInput } from "../DiscordMentionInput";
import { DiscohookComponentsEditor } from "../DiscohookComponentsEditor";
import { ColorPicker } from "../../ui/ColorPicker";
import { TextField } from "../../ui/Field";
import { useMessageStore } from "../../../store/messageStore";
import { uid } from "../../../utils/constants";
import { decimalToHex, type ExtendedMessageData } from "../../../utils/discord";
import {
  buttonStylePatch,
  newButton,
  newGalleryItem,
  newThumbnail,
} from "../../../utils/componentsV2";

export const V2_ADD_OPTIONS = [
  { label: "Content", type: ComponentType.TextDisplay, icon: Type },
  { label: "Container", type: ComponentType.Container, icon: Box },
  { label: "Media Gallery", type: ComponentType.MediaGallery, icon: ImageIcon },
  { label: "File", type: ComponentType.File, icon: FileText },
  { label: "Separator", type: ComponentType.Separator, icon: Minus },
  { label: "Action Row", type: ComponentType.ActionRow, icon: Layers },
] as const;

const CONTAINER_CHILD_OPTIONS = [
  { label: "Content", type: ComponentType.TextDisplay, icon: Type },
  { label: "Media Gallery", type: ComponentType.MediaGallery, icon: ImageIcon },
  { label: "File", type: ComponentType.File, icon: FileText },
  { label: "Separator", type: ComponentType.Separator, icon: Minus },
  { label: "Action Row", type: ComponentType.ActionRow, icon: Layers },
] as const;


export interface ComponentsTabProps {
  message: ExtendedMessageData;
  isV2: boolean;
  ensureActive: () => void;
}

export const ComponentsTab: React.FC<ComponentsTabProps> = ({
  message,
  isV2,
  ensureActive,
}) => {
  const addComponent = useMessageStore((state) => state.addComponent);
  const updateComponentById = useMessageStore((state) => state.updateComponentById);
  const removeComponentById = useMessageStore((state) => state.removeComponentById);
  const moveComponentById = useMessageStore((state) => state.moveComponentById);
  const duplicateComponentById = useMessageStore((state) => state.duplicateComponentById);
  const selection = useMessageStore((state) => state.selection);
  const select = useMessageStore((state) => state.select);
  const [openContainerAddId, setOpenContainerAddId] = useState<string | null>(null);
  const [openAccessoryMenuId, setOpenAccessoryMenuId] = useState<string | null>(null);

  if (!isV2) {
    return (
      <div className="pt-1">
        <DiscohookComponentsEditor parentId={null} componentsOverride={message.components || []} />
      </div>
    );
  }

  const v2TopComponents = message.components || [];
  // Count V2 characters across all TextDisplay components
  const countV2Chars = (nodes: ComponentNode[]): number =>
    nodes.reduce((sum, n) => {
      const own = n.type === ComponentType.TextDisplay ? (n.content?.length ?? 0) : 0;
      const children = Array.isArray(n.components) ? countV2Chars(n.components) : 0;
      return sum + own + children;
    }, 0);

  const totalV2Chars = countV2Chars(message.components || []);

  // Render any V2 component card (top-level or nested inside a Container)
  const renderV2ComponentCard = (
    comp: ComponentNode,
    compIdx: number,
    siblingCount: number,
    parentId: string | null,
  ) => {
    const id = comp._id ?? "";
    const isSelected = selection?.kind === "component" && selection.id === id;

    const getComponentTitle = (c: ComponentNode, i: number) => {
      switch (c.type) {
        case ComponentType.TextDisplay:
          return `Text #${i + 1}`;
        case ComponentType.Section:
          return `Section #${i + 1}`;
        case ComponentType.Container:
          return `Container #${i + 1}`;
        case ComponentType.MediaGallery:
          return `Gallery #${i + 1}`;
        case ComponentType.File:
          return `File #${i + 1}`;
        case ComponentType.Separator:
          return `Separator #${i + 1}`;
        case ComponentType.ActionRow:
          return `Action Row #${i + 1}`;
        default:
          return `Component #${i + 1}`;
      }
    };

    const cardHeader = (
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#232428] border-b border-[#1e1f22] rounded-t-lg select-none">
        <span className="text-xs font-bold uppercase tracking-wider text-[#dbdee1]">
          {getComponentTitle(comp, compIdx)}
        </span>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {compIdx > 0 && (
            <button
              type="button"
              onClick={() => {
                ensureActive();
                if (id) moveComponentById(id, -1, parentId);
              }}
              className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c]"
              title="Move Up"
            >
              <ChevronUp size={13} />
            </button>
          )}
          {compIdx < siblingCount - 1 && (
            <button
              type="button"
              onClick={() => {
                ensureActive();
                if (id) moveComponentById(id, 1, parentId);
              }}
              className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c]"
              title="Move Down"
            >
              <ChevronDown size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              ensureActive();
              if (id) duplicateComponentById(id);
            }}
            className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c]"
            title="Duplicate"
          >
            <Copy size={13} />
          </button>
          <button
            type="button"
            onClick={() => {
              ensureActive();
              if (id) removeComponentById(id);
            }}
            className="p-1 rounded text-[#949ba4] hover:text-[#f28b8b] hover:bg-[#da373c]/20"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );

    // 1. TextDisplay (Content)
    if (comp.type === ComponentType.TextDisplay) {
      return (
        <div
          key={id || compIdx}
          onClick={(e) => {
            e.stopPropagation();
            ensureActive();
          }}
          className="rounded-lg bg-[#2b2d31] border border-[#26282d] transition-[border-color,box-shadow] duration-150"
        >
          {cardHeader}
          <div className="p-3 space-y-2.5">
            <DiscordMentionInput
              label="Content"
              maxLength={Limits.components.textDisplay}
              rows={3}
              value={comp.content || ""}
              placeholder="Write markdown, @mentions, #channels, :emojis:, or {status} / {sunc}…"
              onChange={(val) => {
                ensureActive();
                if (id) updateComponentById(id, { content: val });
              }}
            />

            {/* Discohook + Add Accessory button (converts TextDisplay to Section) */}
            <div className="relative inline-block" onMouseDown={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenAccessoryMenuId(openAccessoryMenuId === id ? null : id);
                }}
                className="px-2.5 py-1 rounded bg-[#35373c] hover:bg-[#4e5058] text-xs font-semibold text-[#dbdee1] hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <Plus size={12} /> Add Accessory <ChevronDown size={12} />
              </button>
              {openAccessoryMenuId === id && (
                <div className="absolute left-0 bottom-full mb-1 w-44 bg-[#1e1f22] border border-[#111214] rounded-lg shadow-2xl py-1 z-30 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      ensureActive();
                      if (id) {
                        updateComponentById(id, {
                          type: ComponentType.Section,
                          content: undefined,
                          components: [
                            {
                              _id: uid(),
                              type: ComponentType.TextDisplay,
                              content: comp.content || "",
                            },
                          ],
                          accessory: newThumbnail(""),
                        });
                      }
                      setOpenAccessoryMenuId(null);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2"
                  >
                    <ImageIcon size={13} /> Thumbnail
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      ensureActive();
                      if (id) {
                        updateComponentById(id, {
                          type: ComponentType.Section,
                          content: undefined,
                          components: [
                            {
                              _id: uid(),
                              type: ComponentType.TextDisplay,
                              content: comp.content || "",
                            },
                          ],
                          accessory: newButton(ButtonStyle.Primary),
                        });
                      }
                      setOpenAccessoryMenuId(null);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2"
                  >
                    <Layers size={13} /> Button
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      ensureActive();
                      if (id) {
                        updateComponentById(id, {
                          type: ComponentType.Section,
                          content: undefined,
                          components: [
                            {
                              _id: uid(),
                              type: ComponentType.TextDisplay,
                              content: comp.content || "",
                            },
                          ],
                          accessory: newButton(ButtonStyle.Link),
                        });
                      }
                      setOpenAccessoryMenuId(null);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2"
                  >
                    <Link size={13} /> Link Button
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // 2. Section (TextDisplay(s) + Accessory)
    if (comp.type === ComponentType.Section) {
      const sectionTexts = comp.components || [];
      const accessory = comp.accessory;

      return (
        <div
          key={id || compIdx}
          onClick={(e) => {
            e.stopPropagation();
            ensureActive();
          }}
          className="rounded-lg bg-[#2b2d31] border border-[#26282d] transition-[border-color,box-shadow] duration-150"
        >
          {cardHeader}
          <div className="p-3 space-y-3">
            {sectionTexts.map((tNode, tIdx) => (
              <div key={tNode._id || tIdx} className="space-y-1">
                <DiscordMentionInput
                  label={`Section Text #${tIdx + 1}`}
                  maxLength={Limits.components.textDisplay}
                  rows={2}
                  value={tNode.content || ""}
                  onChange={(val) => {
                    ensureActive();
                    const next = sectionTexts.map((item, i) =>
                      i === tIdx ? { ...item, content: val } : item,
                    );
                    if (id) updateComponentById(id, { components: next });
                  }}
                />
              </div>
            ))}

            {/* Accessory Editor */}
            {accessory && (
              <div className="rounded bg-[#232428] border border-[#1e1f22] p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4]">
                    Accessory {" "}
                    {accessory.type === ComponentType.Thumbnail ? "Thumbnail" : "Button"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      ensureActive();
                      if (id) {
                        updateComponentById(id, {
                          type: ComponentType.TextDisplay,
                          content: sectionTexts.map((t) => t.content || "").join("\n"),
                          components: undefined,
                          accessory: undefined,
                        });
                      }
                    }}
                    className="text-[11px] text-[#f28b8b] hover:underline flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Remove Accessory
                  </button>
                </div>

                {accessory.type === ComponentType.Thumbnail ? (
                  <div>
                    <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                      Thumbnail Image URL
                    </label>
                    <input
                      type="url"
                      value={accessory.media?.url || ""}
                      placeholder="https://… or attachment://…"
                      onChange={(e) => {
                        ensureActive();
                        if (id) {
                          updateComponentById(id, {
                            accessory: {
                              ...accessory,
                              media: { url: e.target.value },
                            },
                          });
                        }
                      }}
                      className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#2b2d31] focus:border-[#5865f2] focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                          Button Style
                        </label>
                        <select
                          value={accessory.style ?? ButtonStyle.Primary}
                          onChange={(e) => {
                            ensureActive();
                            if (id) {
                              const nextStyle = Number(e.target.value);
                              updateComponentById(id, {
                                accessory: {
                                  ...accessory,
                                  ...buttonStylePatch(accessory, nextStyle),
                                },
                              });
                            }
                          }}
                          className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#2b2d31] focus:border-[#5865f2] focus:outline-none"
                        >
                          <option value={ButtonStyle.Primary}>Primary (Blurple)</option>
                          <option value={ButtonStyle.Secondary}>Secondary (Grey)</option>
                          <option value={ButtonStyle.Success}>Success (Green)</option>
                          <option value={ButtonStyle.Danger}>Danger (Red)</option>
                          <option value={ButtonStyle.Link}>Link (URL)</option>
                        </select>
                      </div>
                      <div>
                        <TextField
                          label="Button Label"
                          limit={80}
                          value={accessory.label || ""}
                          placeholder="Button Text"
                          onChange={(e) => {
                            ensureActive();
                            if (id) {
                              updateComponentById(id, {
                                accessory: { ...accessory, label: e.target.value },
                              });
                            }
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                          {accessory.style === ButtonStyle.Link ? "Link URL" : "Actions Flow"}
                        </label>
                        {accessory.style === ButtonStyle.Link ? (
                          <input
                            type="url"
                            value={accessory.url || ""}
                            placeholder="https://..."
                            onChange={(e) => {
                              ensureActive();
                              if (id) {
                                updateComponentById(id, {
                                  accessory: { ...accessory, url: e.target.value },
                                });
                              }
                            }}
                            className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#2b2d31] focus:border-[#5865f2] focus:outline-none"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              ensureActive();
                              const targetAccId = accessory._id || uid();
                              if (!accessory._id && id) {
                                updateComponentById(id, {
                                  accessory: { ...accessory, _id: targetAccId },
                                });
                              }
                              select({ kind: "component", id: targetAccId });
                            }}
                            className="w-full px-2.5 py-1.5 rounded bg-[#5865f2] hover:bg-[#4752c4] text-xs font-semibold text-white transition-colors"
                          >
                            Configure Actions & Emoji
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    // 3. MediaGallery
    if (comp.type === ComponentType.MediaGallery) {
      const items = comp.items || [];
      const updateGalleryItem = (itemIdx: number, patch: Partial<GalleryItem>) => {
        ensureActive();
        const next = items.map((it, idx) => (idx === itemIdx ? { ...it, ...patch } : it));
        if (id) updateComponentById(id, { items: next });
      };

      return (
        <div
          key={id || compIdx}
          onClick={(e) => {
            e.stopPropagation();
            ensureActive();
          }}
          className="rounded-lg bg-[#2b2d31] border border-[#26282d] transition-[border-color,box-shadow] duration-150"
        >
          {cardHeader}
          <div className="p-3 space-y-2.5">
            {items.map((item, itemIdx) => (
              <div
                key={item._id || itemIdx}
                className="rounded bg-[#232428] border border-[#1e1f22] p-2.5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[#dbdee1]">
                    Media Item #{itemIdx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      ensureActive();
                      if (id) {
                        updateComponentById(id, {
                          items: items.filter((_, i) => i !== itemIdx),
                        });
                      }
                    }}
                    className="p-1 text-[#949ba4] hover:text-[#f28b8b]"
                    title="Remove Media Item"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <input
                  type="url"
                  value={item.media?.url || ""}
                  placeholder="https://example.com/image.png or attachment://…"
                  onChange={(e) =>
                    updateGalleryItem(itemIdx, { media: { url: e.target.value } })
                  }
                  className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#2b2d31] focus:border-[#5865f2] focus:outline-none"
                />
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={item.description || ""}
                    placeholder="Alt text / description (optional)"
                    onChange={(e) =>
                      updateGalleryItem(itemIdx, { description: e.target.value })
                    }
                    className="flex-1 bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1 rounded border border-[#2b2d31] focus:border-[#5865f2] focus:outline-none"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-[#dbdee1] cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={Boolean(item.spoiler)}
                      onChange={(e) =>
                        updateGalleryItem(itemIdx, { spoiler: e.target.checked })
                      }
                    />
                    Spoiler
                  </label>
                </div>
              </div>
            ))}

            <button
              type="button"
              disabled={items.length >= 10}
              onClick={() => {
                ensureActive();
                if (id) {
                  updateComponentById(id, { items: [...items, newGalleryItem("")] });
                }
              }}
              className="px-3 py-1.5 rounded bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus size={13} /> Add Media ({items.length}/10)
            </button>
          </div>
        </div>
      );
    }

    // 4. File
    if (comp.type === ComponentType.File) {
      return (
        <div
          key={id || compIdx}
          onClick={(e) => {
            e.stopPropagation();
            ensureActive();
          }}
          className="rounded-lg bg-[#2b2d31] border border-[#26282d] transition-[border-color,box-shadow] duration-150"
        >
          {cardHeader}
          <div className="p-3 space-y-2">
            <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">
              File URL or Attachment URI
            </label>
            <input
              type="text"
              value={comp.file?.url || ""}
              placeholder="attachment://filename.ext or https://…"
              onChange={(e) => {
                ensureActive();
                if (id) updateComponentById(id, { file: { url: e.target.value } });
              }}
              className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
            />
          </div>
        </div>
      );
    }

    // 5. Separator
    if (comp.type === ComponentType.Separator) {
      return (
        <div
          key={id || compIdx}
          onClick={(e) => {
            e.stopPropagation();
            ensureActive();
          }}
          className="rounded-lg bg-[#2b2d31] border border-[#26282d] transition-[border-color,box-shadow] duration-150"
        >
          {cardHeader}
          <div className="p-3 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#dbdee1]">Spacing Size:</span>
              <div className="inline-flex rounded bg-[#1e1f22] p-0.5 border border-[#111214]">
                <button
                  type="button"
                  onClick={() => {
                    ensureActive();
                    if (id) updateComponentById(id, { spacing: 1 });
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded ${
                    (comp.spacing ?? 1) === 1
                      ? "bg-[#5865f2] text-white"
                      : "text-[#949ba4] hover:text-white"
                  }`}
                >
                  Small
                </button>
                <button
                  type="button"
                  onClick={() => {
                    ensureActive();
                    if (id) updateComponentById(id, { spacing: 2 });
                  }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded ${
                    comp.spacing === 2
                      ? "bg-[#5865f2] text-white"
                      : "text-[#949ba4] hover:text-white"
                  }`}
                >
                  Large
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-[#dbdee1] cursor-pointer">
              <input
                type="checkbox"
                checked={comp.divider !== false}
                onChange={(e) => {
                  ensureActive();
                  if (id) updateComponentById(id, { divider: e.target.checked });
                }}
              />
              Show divider line
            </label>
          </div>
        </div>
      );
    }

    // 6. Action Row (inside V2 message or Container)
    if (comp.type === ComponentType.ActionRow) {
      return (
        <div
          key={id || compIdx}
          onClick={(e) => {
            e.stopPropagation();
            ensureActive();
          }}
        >
          <DiscohookComponentsEditor
            parentId={parentId}
            rowId={id}
            componentsOverride={v2TopComponents}
          />
        </div>
      );
    }

    // 7. Container (top-level V2 layout container with Accent Color & nested components)
    if (comp.type === ComponentType.Container) {
      const children = comp.components || [];
      const accentHex =
        comp.accent_color !== null && comp.accent_color !== undefined
          ? decimalToHex(comp.accent_color)
          : "#5865f2";

      return (
        <div
          key={id || compIdx}
          onClick={(e) => {
            e.stopPropagation();
            ensureActive();
          }}
          className={`rounded-lg bg-[#232428] border transition-[background-color,border-color,box-shadow] duration-150 ease-out ${
            isSelected ? "border-[#5865f2] ring-1 ring-[#5865f2]" : "border-[#1e1f22]"
          }`}
          style={{
            borderLeftWidth: "4px",
            borderLeftColor: comp.accent_color != null ? accentHex : "#383a40",
          }}
        >
          {cardHeader}
          <div className="p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#2b2d31] p-2.5 rounded border border-[#1e1f22]">
              <ColorPicker
                label="Container Accent Color"
                value={comp.accent_color ?? null}
                onChange={(accent_color) => {
                  ensureActive();
                  if (id) updateComponentById(id, { accent_color });
                }}
              />
            </div>

            {/* Nested Components inside Container */}
            <div className="space-y-2.5 pl-2 border-l-2 border-[#1e1f22]">
              {children.map((child, childIdx) =>
                renderV2ComponentCard(child, childIdx, children.length, id),
              )}
            </div>

            {/* + Add to Container Dropdown */}
            <div className="relative inline-block" onMouseDown={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() =>
                  setOpenContainerAddId(openContainerAddId === id ? null : id)
                }
                className="px-3 py-1.5 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Plus size={13} /> Add to Container <ChevronDown size={13} />
              </button>

              {openContainerAddId === id && (
                <div className="absolute left-0 bottom-full mb-1.5 w-48 bg-[#1e1f22] border border-[#111214] shadow-2xl rounded-lg py-1 z-30">
                  {CONTAINER_CHILD_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => {
                          ensureActive();
                          addComponent(opt.type, id);
                          setOpenContainerAddId(null);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2"
                      >
                        <Icon size={14} /> {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return null;
  };


  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs italic text-[#949ba4] px-0.5 tabular-nums">
        <span>
          <span className={totalV2Chars >= Limits.components.textDisplay ? "text-[#f28b8b] font-bold" : totalV2Chars / Limits.components.textDisplay >= 0.9 ? "text-yellow-400" : "text-[#dbdee1]"}>
            {totalV2Chars}
          </span>
          /{Limits.components.textDisplay} characters
        </span>
        <span>{v2TopComponents.length}/40 top-level components</span>
      </div>
      {v2TopComponents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#35373c] p-4 text-center text-xs text-[#949ba4]">
          No V2 components yet. Use the Add menu below to add Content, a Container, Media Gallery, File, Separator, or Action Row.
        </div>
      ) : (
        <div className="space-y-2.5">
          {v2TopComponents.map((comp, compIdx) =>
            renderV2ComponentCard(comp, compIdx, v2TopComponents.length, null),
          )}
        </div>
      )}
    </div>
  );
};

export default ComponentsTab;
