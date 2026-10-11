import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import type { EmbedData } from "@dmb/shared";
import { Limits } from "@dmb/shared";
import { ColorPicker } from "../ui/ColorPicker";
import { DiscordMentionInput } from "./DiscordMentionInput";
import { embedCharCount, decimalToHex } from "../../utils/discord";
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

  // Sub-section collapse toggles (matching Discohook)
  const [isOpen, setIsOpen] = useState(true);
  const [authorOpen, setAuthorOpen] = useState(Boolean(embed.author?.name));
  const [bodyOpen, setBodyOpen] = useState(true);
  const [fieldsOpen, setFieldsOpen] = useState(Boolean(embed.fields && embed.fields.length > 0));
  const [imagesOpen, setImagesOpen] = useState(Boolean(embed.image?.url || embed.thumbnail?.url));
  const [footerOpen, setFooterOpen] = useState(Boolean(embed.footer?.text || embed.timestamp));

  // "Add URL" active states
  const [showAuthorUrl, setShowAuthorUrl] = useState(Boolean(embed.author?.url));
  const [showTitleUrl, setShowTitleUrl] = useState(Boolean(embed.url));
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

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
        borderLeftColor: embed.color ? accentColorHex : "#202225",
      }}
      onClick={() => id && select({ kind: "embed", id })}
    >
      {/* ── Embed Card Header (Title & Global Actions) ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#232428] border-b border-[#1e1f22] select-none">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] transition-colors"
          >
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <span className="text-xs font-bold text-white uppercase tracking-wider truncate">
            {embed.title ? `Embed: ${embed.title}` : `Embed #${index + 1}`}
          </span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
              used > Limits.embed.total
                ? "bg-[#da373c]/20 text-[#f28b8b]"
                : used > Limits.embed.total * 0.9
                  ? "bg-[#f0b232]/20 text-[#f0b232]"
                  : "bg-[#1e1f22] text-[#949ba4]"
            }`}
          >
            {used}/{Limits.embed.total}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Move Up"
            disabled={index === 0}
            onClick={(e) => {
              e.stopPropagation();
              if (id) moveEmbed(id, -1);
            }}
            className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            title="Move Down"
            onClick={(e) => {
              e.stopPropagation();
              if (id) moveEmbed(id, 1);
            }}
            className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c]"
          >
            <ChevronDown size={14} />
          </button>
          <button
            type="button"
            title="Duplicate"
            onClick={(e) => {
              e.stopPropagation();
              if (id) duplicateEmbed(id);
            }}
            className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c]"
          >
            <Copy size={13} />
          </button>
          <button
            type="button"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              if (id) removeEmbed(id);
            }}
            className="p-1 rounded text-[#f28b8b] hover:text-white hover:bg-[#da373c]/30"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="p-3 space-y-3 font-sans text-xs">
          {/* ── 1. Accent Color Strip ── */}
          <div className="flex items-center justify-between p-2 rounded bg-[#1e1f22] border border-[#111214]">
            <div className="flex items-center gap-2">
              <div
                className="w-5 h-5 rounded cursor-pointer border border-[#383a40]"
                style={{ backgroundColor: accentColorHex }}
                onClick={() => setColorPickerOpen(!colorPickerOpen)}
              />
              <span className="text-[11px] font-semibold text-[#dbdee1]">Accent Color:</span>
              <span className="text-[11px] font-mono text-[#949ba4]">{accentColorHex}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateEmbed(id, { color: null })}
                className="text-[10px] text-[#949ba4] hover:text-white hover:underline"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setColorPickerOpen(!colorPickerOpen)}
                className="px-2 py-0.5 rounded bg-[#35373c] hover:bg-[#4e5058] text-[10px] font-medium text-white transition-colors"
              >
                {colorPickerOpen ? "Close Picker" : "Change Color"}
              </button>
            </div>
          </div>

          {colorPickerOpen && (
            <div className="p-3 rounded-lg bg-[#1e1f22] border border-[#111214] animate-in fade-in duration-100">
              <ColorPicker
                value={embed.color ?? null}
                onChange={(color) => updateEmbed(id, { color })}
              />
            </div>
          )}

          {/* ── 2. Author Sub-Section ── */}
          <div className="border border-[#1e1f22] rounded bg-[#232428] overflow-hidden">
            <button
              type="button"
              onClick={() => setAuthorOpen(!authorOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-semibold text-[#dbdee1] hover:bg-[#282a2e] transition-colors"
            >
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] text-[#949ba4]">
                {authorOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Author
              </span>
              {embed.author?.name && (
                <span className="text-[10px] text-[#949ba4] truncate max-w-[150px]">
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
                    <span className="text-[10px] text-[#949ba4] font-mono">
                      {(embed.author?.name?.length || 0)}/256
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={256}
                    value={embed.author?.name || ""}
                    placeholder="Author Name"
                    onChange={(e) =>
                      updateEmbed(id, {
                        author: {
                          name: e.target.value,
                          url: embed.author?.url,
                          icon_url: embed.author?.icon_url,
                        },
                      })
                    }
                    className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] outline-none"
                  />
                </div>

                {!showAuthorUrl ? (
                  <button
                    type="button"
                    onClick={() => setShowAuthorUrl(true)}
                    className="text-[11px] text-[#5865f2] hover:underline flex items-center gap-1"
                  >
                    <Plus size={11} /> Add Author URL
                  </button>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                      Author URL
                    </label>
                    <input
                      type="url"
                      value={embed.author?.url || ""}
                      placeholder="https://..."
                      onChange={(e) =>
                        updateEmbed(id, {
                          author: {
                            name: embed.author?.name || "",
                            url: e.target.value || undefined,
                            icon_url: embed.author?.icon_url,
                          },
                        })
                      }
                      className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                    Author Icon URL
                  </label>
                  <input
                    type="url"
                    value={embed.author?.icon_url || ""}
                    placeholder="https://..."
                    onChange={(e) =>
                      updateEmbed(id, {
                        author: {
                          name: embed.author?.name || "",
                          url: embed.author?.url,
                          icon_url: e.target.value || undefined,
                        },
                      })
                    }
                    className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── 3. Body Sub-Section (Title & Description) ── */}
          <div className="border border-[#1e1f22] rounded bg-[#232428] overflow-hidden">
            <button
              type="button"
              onClick={() => setBodyOpen(!bodyOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-semibold text-[#dbdee1] hover:bg-[#282a2e] transition-colors"
            >
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] text-[#949ba4]">
                {bodyOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Body
              </span>
              {embed.title && (
                <span className="text-[10px] text-[#949ba4] truncate max-w-[150px]">
                  {embed.title}
                </span>
              )}
            </button>

            {bodyOpen && (
              <div className="p-3 pt-1 border-t border-[#1e1f22] space-y-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">
                      Title
                    </label>
                    <span className="text-[10px] text-[#949ba4] font-mono">
                      {(embed.title?.length || 0)}/256
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={256}
                    value={embed.title || ""}
                    placeholder="Embed Title"
                    onChange={(e) => updateEmbed(id, { title: e.target.value })}
                    className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] outline-none"
                  />
                </div>

                {!showTitleUrl ? (
                  <button
                    type="button"
                    onClick={() => setShowTitleUrl(true)}
                    className="text-[11px] text-[#5865f2] hover:underline flex items-center gap-1"
                  >
                    <Plus size={11} /> Add Title URL
                  </button>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                      Title URL
                    </label>
                    <input
                      type="url"
                      value={embed.url || ""}
                      placeholder="https://..."
                      onChange={(e) => updateEmbed(id, { url: e.target.value || undefined })}
                      className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] outline-none"
                    />
                  </div>
                )}

                <div>
                  <DiscordMentionInput
                    label="Description"
                    maxLength={Limits.embed.description}
                    rows={4}
                    value={embed.description || ""}
                    placeholder="Embed description (supports markdown, @mentions, #channels, :emojis:)"
                    onChange={(val) => updateEmbed(id, { description: val })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── 4. Fields Sub-Section (Draggable 25 Fields Grid) ── */}
          <div className="border border-[#1e1f22] rounded bg-[#232428] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e1f22]">
              <button
                type="button"
                onClick={() => setFieldsOpen(!fieldsOpen)}
                className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] font-semibold text-[#949ba4] hover:text-white"
              >
                {fieldsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Fields (
                {(embed.fields || []).length}/25)
              </button>

              <button
                type="button"
                disabled={(embed.fields || []).length >= 25}
                onClick={() => addEmbedField(id)}
                className="px-2 py-0.5 rounded bg-[#35373c] hover:bg-[#4e5058] text-[10px] font-semibold text-white flex items-center gap-1 disabled:opacity-40"
              >
                <Plus size={11} /> Add Field
              </button>
            </div>

            {fieldsOpen && (
              <div className="p-3 space-y-3">
                {(embed.fields || []).length === 0 ? (
                  <p className="text-[11px] text-[#949ba4] text-center py-2">
                    No fields added yet. Embeds can hold up to 25 fields.
                  </p>
                ) : (
                  (embed.fields || []).map((field, fieldIdx) => {
                    const fieldId = field._id || "";
                    return (
                      <div
                        key={fieldId || fieldIdx}
                        className="p-2.5 rounded-lg bg-[#1e1f22] border border-[#111214] space-y-2 relative group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#949ba4]">
                            Field #{fieldIdx + 1}
                          </span>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 text-[11px] text-[#dbdee1] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(field.inline)}
                                onChange={(e) =>
                                  updateEmbedField(id, fieldId, { inline: e.target.checked })
                                }
                                className="rounded bg-[#2b2d31] border-[#383a40] text-[#5865f2] focus:ring-0"
                              />
                              Inline
                            </label>
                            <button
                              type="button"
                              onClick={() => removeEmbedField(id, fieldId)}
                              className="text-[#949ba4] hover:text-[#f28b8b] p-0.5 rounded hover:bg-[#da373c]/20 transition-colors"
                              title="Delete Field"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        <div>
                          <input
                            type="text"
                            maxLength={256}
                            value={field.name || ""}
                            placeholder="Field Name"
                            onChange={(e) =>
                              updateEmbedField(id, fieldId, { name: e.target.value })
                            }
                            className="w-full bg-[#2b2d31] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#1e1f22] focus:border-[#5865f2] outline-none"
                          />
                        </div>

                        <div>
                          <DiscordMentionInput
                            maxLength={Limits.embed.fieldValue}
                            rows={2}
                            value={field.value || ""}
                            placeholder="Field Value (supports markdown, @mentions, :emojis:)"
                            onChange={(val) => updateEmbedField(id, fieldId, { value: val })}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* ── 5. Images Sub-Section (Image & Thumbnail URLs) ── */}
          <div className="border border-[#1e1f22] rounded bg-[#232428] overflow-hidden">
            <button
              type="button"
              onClick={() => setImagesOpen(!imagesOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-semibold text-[#dbdee1] hover:bg-[#282a2e] transition-colors"
            >
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] text-[#949ba4]">
                {imagesOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Images
              </span>
              {(embed.image?.url || embed.thumbnail?.url) && (
                <span className="text-[10px] text-[#949ba4] truncate max-w-[150px]">
                  Configured
                </span>
              )}
            </button>

            {imagesOpen && (
              <div className="p-3 pt-1 border-t border-[#1e1f22] space-y-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                    Image URL (Large Display)
                  </label>
                  <input
                    type="url"
                    value={embed.image?.url || ""}
                    placeholder="https://..."
                    onChange={(e) =>
                      updateEmbed(id, { image: e.target.value ? { url: e.target.value } : undefined })
                    }
                    className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                    Thumbnail URL (Top-Right Icon)
                  </label>
                  <input
                    type="url"
                    value={embed.thumbnail?.url || ""}
                    placeholder="https://..."
                    onChange={(e) =>
                      updateEmbed(id, {
                        thumbnail: e.target.value ? { url: e.target.value } : undefined,
                      })
                    }
                    className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── 6. Footer Sub-Section (Text, Icon & Timestamp) ── */}
          <div className="border border-[#1e1f22] rounded bg-[#232428] overflow-hidden">
            <button
              type="button"
              onClick={() => setFooterOpen(!footerOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-semibold text-[#dbdee1] hover:bg-[#282a2e] transition-colors"
            >
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[10px] text-[#949ba4]">
                {footerOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Footer & Timestamp
              </span>
              {embed.footer?.text && (
                <span className="text-[10px] text-[#949ba4] truncate max-w-[150px]">
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
                    maxLength={2048}
                    value={embed.footer?.text || ""}
                    placeholder="Footer note"
                    onChange={(e) =>
                      updateEmbed(id, {
                        footer: { text: e.target.value, icon_url: embed.footer?.icon_url },
                      })
                    }
                    className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#949ba4] uppercase tracking-wider mb-1">
                    Footer Icon URL
                  </label>
                  <input
                    type="url"
                    value={embed.footer?.icon_url || ""}
                    placeholder="https://..."
                    onChange={(e) =>
                      updateEmbed(id, {
                        footer: {
                          text: embed.footer?.text || "",
                          icon_url: e.target.value || undefined,
                        },
                      })
                    }
                    className="w-full bg-[#1e1f22] text-xs text-[#dbdee1] px-2.5 py-1.5 rounded border border-[#232428] focus:border-[#5865f2] outline-none"
                  />
                </div>

                <div className="pt-1 border-t border-[#1e1f22] space-y-2">
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

export default React.memo(EmbedEditor);