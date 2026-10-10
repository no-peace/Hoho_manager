import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Plus,
  Trash2,
  X,
  Link,
} from "lucide-react";
import type { EmbedData } from "@dmb/shared";
import { Limits } from "@dmb/shared";
import { IconButton } from "../ui/Button";
import { ColorPicker } from "../ui/ColorPicker";
import { DiscordMentionInput } from "./DiscordMentionInput";
import { embedCharCount, decimalToHex, parseHexColor } from "../../utils/discord";
import { useMessageStore } from "../../store/messageStore";

export interface EmbedEditorProps {
  embed: EmbedData;
  index: number;
}

export const EmbedEditor: React.FC<EmbedEditorProps> = ({ embed, index }) => {
  const updateEmbed = useMessageStore((state) => state.updateEmbed);
  const removeEmbed = useMessageStore((state) => state.removeEmbed);
  const duplicateEmbed = useMessageStore((state) => state.duplicateEmbed);
  const moveEmbed = useMessageStore((state) => state.moveEmbed);
  const addEmbedField = useMessageStore((state) => state.addEmbedField);
  const updateEmbedField = useMessageStore((state) => state.updateEmbedField);
  const removeEmbedField = useMessageStore((state) => state.removeEmbedField);
  const selection = useMessageStore((state) => state.selection);
  const select = useMessageStore((state) => state.select);

  // Sub-section collapse toggles (Discohook style)
  const [open, setOpen] = useState(true);
  const [authorOpen, setAuthorOpen] = useState(Boolean(embed.author?.name));
  const [bodyOpen, setBodyOpen] = useState(true);
  const [fieldsOpen, setFieldsOpen] = useState(Boolean(embed.fields && embed.fields.length > 0));
  const [imagesOpen, setImagesOpen] = useState(Boolean(embed.image?.url || embed.thumbnail?.url));
  const [footerOpen, setFooterOpen] = useState(Boolean(embed.footer?.text || embed.timestamp));

  // "Add URL" toggle states
  const [showAuthorUrl, setShowAuthorUrl] = useState(Boolean(embed.author?.url));
  const [showTitleUrl, setShowTitleUrl] = useState(Boolean(embed.url));
  const [showColorPicker, setShowColorPicker] = useState(false);

  const id = embed._id ?? "";
  const active = selection?.kind === "embed" && selection.id === id;
  const used = embedCharCount(embed);

  const accentColorHex = embed.color
    ? decimalToHex(embed.color)
    : "#202225";

  return (
    <div
      className={`rounded-lg bg-[#2b2d31] border transition-all overflow-hidden ${
        active ? "border-[#5865f2] ring-1 ring-[#5865f2]" : "border-[#1e1f22]"
      }`}
      style={{
        borderLeftWidth: "4px",
        borderLeftColor: embed.color ? accentColorHex : "#4e5058",
      }}
    >
      {/* ── Main Embed Header ── */}
      <div
        className="flex items-center justify-between p-2.5 cursor-pointer select-none bg-[#232428] hover:bg-[#282a2e] transition-colors border-b border-[#1e1f22]"
        onClick={() => select({ kind: "embed", id })}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c]"
            onClick={(event) => {
              event.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <span className="text-xs font-bold text-[#dbdee1] truncate">
            Embed {index + 1} - {embed.title || embed.author?.name || "Untitled"}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span
            className={`mr-1 text-[11px] font-mono tabular-nums ${
              used > Limits.embed.total
                ? "text-[#f28b8b] font-bold"
                : used > Limits.embed.total * 0.9
                ? "text-[#f0b232]"
                : "text-[#949ba4]"
            }`}
          >
            {used}/{Limits.embed.total}
          </span>
          <IconButton
            icon={ChevronUp}
            label="Move up"
            size={13}
            onClick={(e) => {
              e.stopPropagation();
              moveEmbed(id, -1);
            }}
          />
          <IconButton
            icon={ChevronDown}
            label="Move down"
            size={13}
            onClick={(e) => {
              e.stopPropagation();
              moveEmbed(id, 1);
            }}
          />
          <IconButton
            icon={Copy}
            label="Duplicate embed"
            size={13}
            onClick={(e) => {
              e.stopPropagation();
              duplicateEmbed(id);
            }}
          />
          <IconButton
            icon={Trash2}
            label="Delete embed"
            size={13}
            onClick={(e) => {
              e.stopPropagation();
              removeEmbed(id);
            }}
          />
        </div>
      </div>

      {open && (
        <div className="p-3 space-y-3 bg-[#2b2d31]">
          {/* ── 1. AUTHOR SUB-SECTION ── */}
          <div className="rounded border border-[#1e1f22] bg-[#232428] overflow-hidden">
            <button
              type="button"
              onClick={() => setAuthorOpen(!authorOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#dbdee1] hover:bg-[#282a2e] transition-colors"
            >
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-[#949ba4]">
                {authorOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Author
              </span>
              {embed.author?.name && (
                <span className="text-[10px] text-[#949ba4] font-normal truncate max-w-[150px]">
                  {embed.author.name}
                </span>
              )}
            </button>

            {authorOpen && (
              <div className="p-3 pt-1 border-t border-[#1e1f22] space-y-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">
                      Author Name
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#949ba4] font-mono">
                        {(embed.author?.name?.length || 0)}/256
                      </span>
                      {!showAuthorUrl && (
                        <button
                          type="button"
                          onClick={() => setShowAuthorUrl(true)}
                          className="px-2 py-0.5 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white text-[10px] font-semibold transition-colors flex items-center gap-1"
                        >
                          <Link size={10} /> Add URL
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={embed.author?.name ?? ""}
                    maxLength={256}
                    placeholder="Author display name"
                    onChange={(e) =>
                      updateEmbed(id, {
                        author: { ...embed.author, name: e.target.value },
                      })
                    }
                    className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                  />
                </div>

                {showAuthorUrl && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">
                        Author URL
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowAuthorUrl(false);
                          updateEmbed(id, {
                            author: { ...embed.author, url: undefined },
                          });
                        }}
                        className="text-[#949ba4] hover:text-[#f28b8b] text-[10px]"
                        title="Remove Author URL"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={embed.author?.url ?? ""}
                      placeholder="https://…"
                      onChange={(e) =>
                        updateEmbed(id, {
                          author: { ...embed.author, url: e.target.value },
                        })
                      }
                      className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                    Author Icon URL
                  </label>
                  <input
                    type="text"
                    value={embed.author?.icon_url ?? ""}
                    placeholder="https://cdn.discordapp.com/…"
                    onChange={(e) =>
                      updateEmbed(id, {
                        author: { ...embed.author, icon_url: e.target.value },
                      })
                    }
                    className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── 2. BODY SUB-SECTION ── */}
          <div className="rounded border border-[#1e1f22] bg-[#232428] overflow-hidden">
            <button
              type="button"
              onClick={() => setBodyOpen(!bodyOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#dbdee1] hover:bg-[#282a2e] transition-colors"
            >
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-[#949ba4]">
                {bodyOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Body
              </span>
              {embed.title && (
                <span className="text-[10px] text-[#949ba4] font-normal truncate max-w-[150px]">
                  {embed.title}
                </span>
              )}
            </button>

            {bodyOpen && (
              <div className="p-3 pt-1 border-t border-[#1e1f22] space-y-3">
                {/* Title */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">
                      Title
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[#949ba4] font-mono">
                        {(embed.title?.length || 0)}/256
                      </span>
                      {!showTitleUrl && (
                        <button
                          type="button"
                          onClick={() => setShowTitleUrl(true)}
                          className="px-2 py-0.5 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white text-[10px] font-semibold transition-colors flex items-center gap-1"
                        >
                          <Link size={10} /> Add URL
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={embed.title ?? ""}
                    maxLength={256}
                    placeholder="Announcement Title"
                    onChange={(e) => updateEmbed(id, { title: e.target.value })}
                    className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                  />
                </div>

                {/* Title URL */}
                {showTitleUrl && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">
                        Title URL
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTitleUrl(false);
                          updateEmbed(id, { url: undefined });
                        }}
                        className="text-[#949ba4] hover:text-[#f28b8b] text-[10px]"
                        title="Remove Title URL"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={embed.url ?? ""}
                      placeholder="https://…"
                      onChange={(e) => updateEmbed(id, { url: e.target.value })}
                      className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                    />
                  </div>
                )}

                {/* Sidebar Color */}
                <div>
                  <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                    Sidebar Color
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={embed.color ? decimalToHex(embed.color) : ""}
                        placeholder="Click to Set or enter hex (#5865f2)"
                        onChange={(e) => {
                          const parsed = parseHexColor(e.target.value);
                          if (parsed !== null) updateEmbed(id, { color: parsed });
                          else if (!e.target.value.trim()) updateEmbed(id, { color: null });
                        }}
                        className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] font-mono pl-3 pr-9 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded border border-black/40 shadow-inner"
                        style={{ backgroundColor: accentColorHex }}
                        title="Open Color Palette"
                      />
                    </div>
                    {embed.color != null && (
                      <button
                        type="button"
                        onClick={() => updateEmbed(id, { color: null })}
                        className="text-[10px] text-[#949ba4] hover:text-white px-2 py-1 rounded hover:bg-[#35373c]"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {showColorPicker && (
                    <div className="mt-2 p-2 rounded bg-[#1e1f22] border border-[#232428]">
                      <ColorPicker
                        value={embed.color ?? null}
                        onChange={(color) => updateEmbed(id, { color })}
                      />
                    </div>
                  )}
                </div>

                {/* Description with DiscordMentionInput */}
                <DiscordMentionInput
                  label="Description"
                  maxLength={Limits.embed.description}
                  rows={4}
                  value={embed.description ?? ""}
                  placeholder="Markdown and mentions are supported **here** (type @, #, or :)."
                  onChange={(val) => updateEmbed(id, { description: val })}
                />
              </div>
            )}
          </div>

          {/* ── 3. FIELDS SUB-SECTION (25 fields limit) ── */}
          <div className="rounded border border-[#1e1f22] bg-[#232428] overflow-hidden">
            <button
              type="button"
              onClick={() => setFieldsOpen(!fieldsOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#dbdee1] hover:bg-[#282a2e] transition-colors"
            >
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-[#949ba4]">
                {fieldsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Fields (
                {embed.fields?.length || 0}/25)
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFieldsOpen(true);
                  addEmbedField(id);
                }}
                disabled={(embed.fields?.length || 0) >= 25}
                className="px-2 py-0.5 rounded bg-[#5865f2] hover:bg-[#4752c4] disabled:opacity-40 text-white text-[10px] font-semibold transition-colors flex items-center gap-1"
              >
                <Plus size={10} /> Add Field
              </button>
            </button>

            {fieldsOpen && (
              <div className="p-3 pt-1 border-t border-[#1e1f22] space-y-2.5">
                {(!embed.fields || embed.fields.length === 0) ? (
                  <p className="text-[11px] text-[#949ba4] italic py-2 text-center">
                    No fields added. Click "Add Field" to add tabular or bulleted data.
                  </p>
                ) : (
                  embed.fields.map((field, fieldIdx) => (
                    <div
                      key={field._id}
                      className="rounded bg-[#1e1f22] border border-[#232428] p-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
                          Field {fieldIdx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-[11px] text-[#dbdee1] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.inline}
                              onChange={(e) =>
                                updateEmbedField(id, field._id ?? "", { inline: e.target.checked })
                              }
                              className="rounded bg-[#2b2d31] border-[#383a40] text-[#5865f2] focus:ring-0"
                            />
                            Inline
                          </label>
                          <button
                            type="button"
                            onClick={() => removeEmbedField(id, field._id ?? "")}
                            className="p-1 text-[#949ba4] hover:text-[#f28b8b] hover:bg-[#da373c]/20 rounded transition-colors"
                            title="Delete Field"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Field Name */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-[#949ba4] uppercase">
                            Name
                          </label>
                          <span className="text-[10px] text-[#949ba4] font-mono">
                            {(field.name?.length || 0)}/256
                          </span>
                        </div>
                        <input
                          type="text"
                          value={field.name}
                          maxLength={256}
                          placeholder="Field Title"
                          onChange={(e) =>
                            updateEmbedField(id, field._id ?? "", { name: e.target.value })
                          }
                          className="w-full bg-[#2b2d31] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#383a40] focus:border-[#5865f2] focus:outline-none"
                        />
                      </div>

                      {/* Field Value with DiscordMentionInput */}
                      <DiscordMentionInput
                        label="Value"
                        maxLength={Limits.embed.fieldValue}
                        rows={2}
                        value={field.value}
                        placeholder="Field Value (markdown supported)"
                        onChange={(val) =>
                          updateEmbedField(id, field._id ?? "", { value: val })
                        }
                      />
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* ── 4. IMAGES SUB-SECTION ── */}
          <div className="rounded border border-[#1e1f22] bg-[#232428] overflow-hidden">
            <button
              type="button"
              onClick={() => setImagesOpen(!imagesOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#dbdee1] hover:bg-[#282a2e] transition-colors"
            >
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-[#949ba4]">
                {imagesOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Images
              </span>
              {(embed.image?.url || embed.thumbnail?.url) && (
                <span className="text-[10px] text-[#5865f2] font-semibold">Configured</span>
              )}
            </button>

            {imagesOpen && (
              <div className="p-3 pt-1 border-t border-[#1e1f22] space-y-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                    Large Image URL
                  </label>
                  <input
                    type="text"
                    value={embed.image?.url ?? ""}
                    placeholder="https://… or attachment://…"
                    onChange={(e) => updateEmbed(id, { image: { url: e.target.value } })}
                    className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                    Thumbnail URL
                  </label>
                  <input
                    type="text"
                    value={embed.thumbnail?.url ?? ""}
                    placeholder="https://… or attachment://…"
                    onChange={(e) => updateEmbed(id, { thumbnail: { url: e.target.value } })}
                    className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── 5. FOOTER SUB-SECTION ── */}
          <div className="rounded border border-[#1e1f22] bg-[#232428] overflow-hidden">
            <button
              type="button"
              onClick={() => setFooterOpen(!footerOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#dbdee1] hover:bg-[#282a2e] transition-colors"
            >
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px] text-[#949ba4]">
                {footerOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Footer & Timestamp
              </span>
              {embed.footer?.text && (
                <span className="text-[10px] text-[#949ba4] font-normal truncate max-w-[150px]">
                  {embed.footer.text}
                </span>
              )}
            </button>

            {footerOpen && (
              <div className="p-3 pt-1 border-t border-[#1e1f22] space-y-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">
                      Footer Text
                    </label>
                    <span className="text-[10px] text-[#949ba4] font-mono">
                      {(embed.footer?.text?.length || 0)}/2048
                    </span>
                  </div>
                  <input
                    type="text"
                    value={embed.footer?.text ?? ""}
                    maxLength={2048}
                    placeholder="Footer note"
                    onChange={(e) =>
                      updateEmbed(id, {
                        footer: { ...embed.footer, text: e.target.value },
                      })
                    }
                    className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                    Footer Icon URL
                  </label>
                  <input
                    type="text"
                    value={embed.footer?.icon_url ?? ""}
                    placeholder="https://…"
                    onChange={(e) =>
                      updateEmbed(id, {
                        footer: { ...embed.footer, icon_url: e.target.value },
                      })
                    }
                    className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] focus:outline-none"
                  />
                </div>

                <div className="pt-1 border-t border-[#1e1f22]">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-[#dbdee1] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(embed.timestamp)}
                        onChange={(e) =>
                          updateEmbed(id, {
                            timestamp: e.target.checked ? new Date().toISOString() : null,
                          })
                        }
                        className="rounded bg-[#1e1f22] border-[#383a40] text-[#5865f2] focus:ring-0"
                      />
                      Include Timestamp
                    </label>
                    {embed.timestamp && (
                      <span className="text-[10px] text-[#949ba4] font-mono">
                        {new Date(embed.timestamp).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmbedEditor;