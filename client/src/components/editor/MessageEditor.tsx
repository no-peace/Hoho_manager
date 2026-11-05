import React, { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Trash2,
  Edit2,
  Plus,
  Link,
  SlidersHorizontal,
  Image as ImageIcon,
  Layers,
  X,
  Type,
  Box,
  FileText,
  Minus,
} from "lucide-react";
import {
  Limits,
  ComponentType,
  MessageFlags,
  ButtonStyle,
  type ComponentNode,
  type GalleryItem,
} from "@dmb/shared";
import { DiscordMentionInput } from "./DiscordMentionInput";
import { EmbedEditor } from "./EmbedEditor";
import { DiscohookComponentsEditor } from "./DiscohookComponentsEditor";
import { FileAttachmentsSection } from "./FileAttachmentsSection";
import { ColorPicker } from "../ui/ColorPicker";
import { useMessageStore } from "../../store/messageStore";
import { EDITOR_MODES, uid } from "../../utils/constants";
import { decimalToHex } from "../../utils/discord";
import { newGalleryItem, newButton, newThumbnail } from "../../utils/componentsV2";

export interface MessageEditorProps {
  index: number;
}

const V2_ADD_OPTIONS = [
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

export const MessageEditor: React.FC<MessageEditorProps> = ({ index }) => {
  const messages = useMessageStore((state) => state.messages);
  const data = useMessageStore((state) => state.data);
  const activeMessageIndex = useMessageStore((state) => state.activeMessageIndex ?? 0);
  const setActiveMessageIndex = useMessageStore((state) => state.setActiveMessageIndex);
  const duplicateMessage = useMessageStore((state) => state.duplicateMessage);
  const removeMessage = useMessageStore((state) => state.removeMessage);
  const moveMessage = useMessageStore((state) => state.moveMessage);
  const setMessageMode = useMessageStore((state) => state.setMessageMode);
  const setField = useMessageStore((state) => state.setField);
  const addEmbed = useMessageStore((state) => state.addEmbed);
  const addComponent = useMessageStore((state) => state.addComponent);
  const updateComponentById = useMessageStore((state) => state.updateComponentById);
  const removeComponentById = useMessageStore((state) => state.removeComponentById);
  const moveComponentById = useMessageStore((state) => state.moveComponentById);
  const duplicateComponentById = useMessageStore((state) => state.duplicateComponentById);
  const selection = useMessageStore((state) => state.selection);

  const message = (messages && messages[index]) || (index === 0 ? data : messages?.[0]) || data;
  const isActive = activeMessageIndex === index;

  // Fixed per-message format determined from the message's own flags/mode
  const isV2 =
    Boolean((message.flags ?? 0) & MessageFlags.IsComponentsV2) ||
    (message as any).mode === EDITOR_MODES.V2;

  // Ensure store points at this message before mutating
  const ensureActive = () => {
    if (activeMessageIndex !== index) {
      setActiveMessageIndex(index);
    }
  };

  // Local collapsible section states matching Discohook
  const [isOpen, setIsOpen] = useState(true);
  const [threadOpen, setThreadOpen] = useState(Boolean(message.thread_name));
  const [profileOpen, setProfileOpen] = useState(Boolean(message.username || message.avatar_url));

  // Rename message state
  const [isEditingName, setIsEditingName] = useState(false);
  const [customName, setCustomName] = useState("");

  // Dropdown states with outside-click handling
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [messageLinkInput, setMessageLinkInput] = useState("");
  const [openContainerAddId, setOpenContainerAddId] = useState<string | null>(null);
  const [openAccessoryMenuId, setOpenAccessoryMenuId] = useState<string | null>(null);

  const addMenuRef = useRef<HTMLDivElement>(null);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menus when clicking outside
  useEffect(() => {
    if (!addMenuOpen && !optionsMenuOpen && !openContainerAddId && !openAccessoryMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (addMenuOpen && addMenuRef.current && !addMenuRef.current.contains(target)) {
        setAddMenuOpen(false);
      }
      if (optionsMenuOpen && optionsMenuRef.current && !optionsMenuRef.current.contains(target)) {
        setOptionsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [addMenuOpen, optionsMenuOpen, openContainerAddId, openAccessoryMenuId]);

  // Count V2 characters across all TextDisplay components
  const countV2Chars = (nodes: ComponentNode[]): number =>
    nodes.reduce((sum, n) => {
      const own = n.type === ComponentType.TextDisplay ? (n.content?.length ?? 0) : 0;
      const children = Array.isArray(n.components) ? countV2Chars(n.components) : 0;
      return sum + own + children;
    }, 0);

  const totalV2Chars = isV2 ? countV2Chars(message.components || []) : 0;

  // Render any V2 component card (top-level or nested inside a Container)
  const renderV2ComponentCard = (
    comp: ComponentNode,
    compIdx: number,
    siblingCount: number,
    parentId: string | null
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
      <div className="flex items-center justify-between px-3 py-2 bg-[#232428] border-b border-[#1e1f22] rounded-t-lg select-none">
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
          className="rounded-lg bg-[#2b2d31] border border-[#1e1f22]"
        >
          {cardHeader}
          <div className="p-3 space-y-2.5">
            <DiscordMentionInput
              label="Content"
              maxLength={Limits.components.textDisplay}
              rows={3}
              value={comp.content || ""}
              placeholder="Write markdown, @mentions, #channels, or :emojis:…"
              onChange={(val) => {
                ensureActive();
                if (id) updateComponentById(id, { content: val });
              }}
            />

            {/* Discohook + Add Accessory button (converts TextDisplay to Section) */}
            <div className="relative inline-block">
              <button
                type="button"
                onClick={() =>
                  setOpenAccessoryMenuId(openAccessoryMenuId === id ? null : id)
                }
                className="px-2.5 py-1 rounded bg-[#35373c] hover:bg-[#4e5058] text-xs font-semibold text-[#dbdee1] hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <Plus size={12} /> Add Accessory <ChevronDown size={12} />
              </button>
              {openAccessoryMenuId === id && (
                <div className="absolute left-0 top-full mt-1 w-44 bg-[#1e1f22] border border-[#111214] rounded-lg shadow-2xl py-1 z-30 text-xs">
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
          className="rounded-lg bg-[#2b2d31] border border-[#1e1f22] overflow-hidden"
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
                      i === tIdx ? { ...item, content: val } : item
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
                    Accessory —{" "}
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
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                        Button Label
                      </label>
                      <input
                        type="text"
                        maxLength={80}
                        value={accessory.label || ""}
                        onChange={(e) => {
                          ensureActive();
                          if (id) {
                            updateComponentById(id, {
                              accessory: { ...accessory, label: e.target.value },
                            });
                          }
                        }}
                        className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#2b2d31] focus:border-[#5865f2] focus:outline-none"
                      />
                    </div>
                    {accessory.style === ButtonStyle.Link && (
                      <div>
                        <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                          Link URL
                        </label>
                        <input
                          type="url"
                          value={accessory.url || ""}
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
                      </div>
                    )}
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
          className="rounded-lg bg-[#2b2d31] border border-[#1e1f22] overflow-hidden"
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
          className="rounded-lg bg-[#2b2d31] border border-[#1e1f22] overflow-hidden"
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
          className="rounded-lg bg-[#2b2d31] border border-[#1e1f22] overflow-hidden"
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
          <DiscohookComponentsEditor parentId={parentId} />
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
          className={`rounded-lg bg-[#232428] border transition-all ${
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
                renderV2ComponentCard(child, childIdx, children.length, id)
              )}
            </div>

            {/* + Add to Container Dropdown */}
            <div className="relative inline-block">
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

  // Deduplicate top-level ActionRow rendering in V2 so DiscohookComponentsEditor renders once for top-level rows
  const v2TopComponents = message.components || [];
  let renderedTopActionRows = false;

  return (
    <div
      onClick={() => ensureActive()}
      className={`rounded-lg bg-[#292b2f] border transition-all ${
        isActive
          ? "border-[#5865f2] ring-1 ring-[#5865f2] shadow-md"
          : "border-[#1e1f22] hover:border-[#383a40]"
      }`}
    >
      {/* ── Message Collapsible Trigger Header (Discohook style) ── */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-[#232428] border-b border-[#1e1f22] select-none">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] transition-colors"
          >
            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>

          {isEditingName ? (
            <input
              type="text"
              autoFocus
              value={customName}
              placeholder={`Message ${index + 1}`}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setCustomName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setIsEditingName(false);
              }}
              className="bg-[#1e1f22] text-xs font-bold text-white px-2 py-0.5 rounded border border-[#5865f2] outline-none"
            />
          ) : (
            <span className="text-xs font-bold text-[#dbdee1] truncate">
              {customName || `Message ${index + 1}`}
            </span>
          )}

          {/* Fixed Message Format Badge */}
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              isV2
                ? "bg-[#5865f2]/20 text-[#5865f2] border border-[#5865f2]/40"
                : "bg-[#1e1f22] text-[#949ba4]"
            }`}
          >
            {isV2 ? "Components V2" : "Classic"}
          </span>
        </div>

        {/* Action icons: Move Up, Move Down, Rename, Duplicate, Delete */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {index > 0 && (
            <button
              type="button"
              onClick={() => moveMessage?.(index, -1)}
              className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] transition-colors"
              title="Move Message Up"
            >
              <ChevronUp size={14} />
            </button>
          )}

          {index < messages.length - 1 && (
            <button
              type="button"
              onClick={() => moveMessage?.(index, 1)}
              className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] transition-colors"
              title="Move Message Down"
            >
              <ChevronDown size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setCustomName(customName || `Message ${index + 1}`);
              setIsEditingName(true);
            }}
            className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] transition-colors"
            title="Rename Message"
          >
            <Edit2 size={13} />
          </button>

          <button
            type="button"
            onClick={() => duplicateMessage?.(index)}
            disabled={messages.length >= 10}
            className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] disabled:opacity-30 transition-colors"
            title="Duplicate Message"
          >
            <Copy size={13} />
          </button>

          <button
            type="button"
            onClick={() => removeMessage?.(index)}
            disabled={messages.length <= 1}
            className="p-1 rounded text-[#949ba4] hover:text-[#f28b8b] hover:bg-[#da373c]/20 disabled:opacity-30 transition-colors"
            title="Delete Message"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* ── Message Body Panel ── */}
      {isOpen && (
        <div className="p-3 space-y-3 bg-[#2b2d31]">
          {/* Shared Collapsible Thread & Profile Sections (Discohook style) */}
          <div className="space-y-2">
            {/* Thread Sub-Section */}
            <div className="rounded border border-[#1e1f22] bg-[#232428] overflow-hidden">
              <button
                type="button"
                onClick={() => setThreadOpen(!threadOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#dbdee1] hover:bg-[#282a2e] transition-colors"
              >
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-[#949ba4]">
                  {threadOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Thread
                </span>
                {message.thread_name && (
                  <span className="text-[10px] text-[#5865f2] font-semibold truncate max-w-[150px]">
                    #{message.thread_name}
                  </span>
                )}
              </button>

              {threadOpen && (
                <div className="p-3 pt-1 border-t border-[#1e1f22] space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">
                        Forum Thread Name
                      </label>
                      <span className="text-[10px] text-[#949ba4] font-mono">
                        {(message.thread_name?.length || 0)}/100
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={100}
                      value={message.thread_name || ""}
                      placeholder="Optional forum thread title…"
                      onChange={(e) => {
                        ensureActive();
                        setField("thread_name", e.target.value);
                      }}
                      className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Profile Override Sub-Section */}
            <div className="rounded border border-[#1e1f22] bg-[#232428] overflow-hidden">
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#dbdee1] hover:bg-[#282a2e] transition-colors"
              >
                <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-[#949ba4]">
                  {profileOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Profile Override
                </span>
                {message.username && (
                  <span className="text-[10px] text-[#949ba4] truncate max-w-[150px]">
                    {message.username}
                  </span>
                )}
              </button>

              {profileOpen && (
                <div className="p-3 pt-1 border-t border-[#1e1f22] space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">
                        Name
                      </label>
                      <span className="text-[10px] text-[#949ba4] font-mono">
                        {(message.username?.length || 0)}/80
                      </span>
                    </div>
                    <input
                      type="text"
                      maxLength={80}
                      value={message.username || ""}
                      placeholder="Bot Name Override"
                      onChange={(e) => {
                        ensureActive();
                        setField("username", e.target.value);
                      }}
                      className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                      Avatar URL
                    </label>
                    <input
                      type="url"
                      value={message.avatar_url || ""}
                      placeholder="https://…"
                      onChange={(e) => {
                        ensureActive();
                        setField("avatar_url", e.target.value);
                      }}
                      className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Files Sub-Section */}
            <FileAttachmentsSection />
          </div>

          {!isV2 ? (
            /* ── Standard (Classic) Message Body ── */
            <>
              <DiscordMentionInput
                label="Content"
                maxLength={Limits.content}
                rows={4}
                value={message.content || ""}
                placeholder="Say something… (type @, #, or : for suggestions)"
                onChange={(val) => {
                  ensureActive();
                  setField("content", val);
                }}
              />

              {/* Embeds List */}
              {message.embeds && message.embeds.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  {message.embeds.map((embed, embedIdx) => (
                    <EmbedEditor key={embed._id || embedIdx} embed={embed} index={embedIdx} />
                  ))}
                </div>
              )}

              {/* Classic Action Rows */}
              <div className="pt-1">
                <DiscohookComponentsEditor parentId={null} />
              </div>
            </>
          ) : (
            /* ── Components V2 Message Body (Discohook ComponentMessageEditor) ── */
            <>
              <div className="flex items-center justify-between text-xs italic text-[#949ba4] px-0.5">
                <span>
                  <span
                    className={
                      totalV2Chars >= Limits.components.textDisplay
                        ? "text-[#f28b8b] font-bold"
                        : totalV2Chars / Limits.components.textDisplay >= 0.9
                        ? "text-yellow-400"
                        : "text-[#dbdee1]"
                    }
                  >
                    {totalV2Chars}
                  </span>
                  /{Limits.components.textDisplay} characters
                </span>
                <span>{(message.components || []).length}/40 top-level components</span>
              </div>

              {v2TopComponents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#35373c] p-4 text-center text-xs text-[#949ba4]">
                  No V2 components yet. Click <span className="text-white font-semibold">+ Add</span> below to add Content, a Container, Media Gallery, File, Separator, or Action Row.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {v2TopComponents.map((comp, compIdx) => {
                    if (comp.type === ComponentType.ActionRow) {
                      if (renderedTopActionRows) return null;
                      renderedTopActionRows = true;
                    }
                    return renderV2ComponentCard(
                      comp,
                      compIdx,
                      v2TopComponents.length,
                      null
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ── Bottom Action Toolbar (+ Add ▾, Set Link, Options ▾) ── */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#1e1f22]">
            {/* Mode-Aware + Add ▾ Dropdown */}
            <div className="relative" ref={addMenuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  ensureActive();
                  setAddMenuOpen(!addMenuOpen);
                }}
                className="px-3 py-1.5 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus size={13} /> Add <ChevronDown size={13} />
              </button>

              {addMenuOpen && (
                <div className="absolute left-0 bottom-full mb-1.5 w-48 bg-[#1e1f22] border border-[#111214] shadow-2xl rounded-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-75">
                  {!isV2 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          ensureActive();
                          addEmbed();
                          setAddMenuOpen(false);
                        }}
                        disabled={(message.embeds || []).length >= 10}
                        className="w-full text-left px-3 py-1.5 text-xs text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2 disabled:opacity-40"
                      >
                        <ImageIcon size={14} /> Add Embed
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          ensureActive();
                          addComponent(ComponentType.ActionRow, null);
                          setAddMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2"
                      >
                        <Layers size={14} /> Add Action Row
                      </button>
                    </>
                  ) : (
                    V2_ADD_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.type}
                          type="button"
                          onClick={() => {
                            ensureActive();
                            addComponent(opt.type, null);
                            setAddMenuOpen(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2"
                        >
                          <Icon size={14} /> {opt.label}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Set Link Button */}
            <button
              type="button"
              onClick={() => setLinkModalOpen(true)}
              className="px-3 py-1.5 rounded bg-[#35373c] hover:bg-[#4e5058] text-[#dbdee1] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Link size={13} /> Set Link
            </button>

            {/* Options ▾ Button */}
            <div className="relative" ref={optionsMenuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOptionsMenuOpen(!optionsMenuOpen);
                }}
                className="px-3 py-1.5 rounded bg-[#35373c] hover:bg-[#4e5058] text-[#dbdee1] hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <SlidersHorizontal size={13} /> Options <ChevronDown size={13} />
              </button>

              {optionsMenuOpen && (
                <div className="absolute left-0 bottom-full mb-1.5 w-56 bg-[#1e1f22] border border-[#111214] shadow-2xl rounded-lg py-1 z-30 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      const text = JSON.stringify(message, null, 2);
                      navigator.clipboard.writeText(text);
                      alert("Message JSON copied to clipboard!");
                      setOptionsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2"
                  >
                    <Copy size={13} /> Copy Message JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMessageMode(
                        index,
                        isV2 ? EDITOR_MODES.CLASSIC : EDITOR_MODES.V2
                      );
                      setOptionsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center gap-2"
                  >
                    <Layers size={13} /> Convert to {isV2 ? "Classic" : "Components V2"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Set Link Modal */}
      {linkModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#2b2d31] rounded-lg border border-[#1e1f22] p-4 w-full max-w-sm space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Set Message Link / Reference
              </h4>
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="text-[#949ba4] hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-[11px] text-[#949ba4]">
              Enter a Discord message link to reply to or edit.
            </p>
            <input
              type="text"
              placeholder="https://discord.com/channels/..."
              value={messageLinkInput}
              onChange={(e) => setMessageLinkInput(e.target.value)}
              className="w-full bg-[#1e1f22] text-xs text-white px-2.5 py-1.5 rounded border border-[#383a40] focus:border-[#5865f2] focus:outline-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="px-3 py-1.5 text-xs text-[#949ba4] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="px-3 py-1.5 rounded bg-[#5865f2] hover:bg-[#4752c4] text-xs font-semibold text-white"
              >
                Save Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(MessageEditor);