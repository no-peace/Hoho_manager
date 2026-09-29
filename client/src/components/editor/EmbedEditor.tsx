import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Plus, Trash2 } from "lucide-react";
import type { EmbedData } from "@dmb/shared";
import { Limits } from "@dmb/shared";
import { Button, IconButton } from "../ui/Button";
import { Checkbox, TextArea, TextField } from "../ui/Field";
import { ColorPicker } from "../ui/ColorPicker";
import { embedCharCount } from "../../utils/discord";
import { useMessageStore } from "../../store/messageStore";

/**
 * Editor for one classic embed.
 *
 * Collapsed by default so a message with several embeds stays scannable, and
 * expanded automatically when it is the selected embed. The character counter
 * uses Discord's real aggregate limit (6000 across the whole embed), which is the
 * constraint people actually hit.
 */
export interface EmbedEditorProps {
  embed: EmbedData;
  index: number;
}

export const EmbedEditor = ({ embed, index }: EmbedEditorProps) => {
  const updateEmbed = useMessageStore((state) => state.updateEmbed);
  const removeEmbed = useMessageStore((state) => state.removeEmbed);
  const duplicateEmbed = useMessageStore((state) => state.duplicateEmbed);
  const moveEmbed = useMessageStore((state) => state.moveEmbed);
  const addEmbedField = useMessageStore((state) => state.addEmbedField);
  const updateEmbedField = useMessageStore((state) => state.updateEmbedField);
  const removeEmbedField = useMessageStore((state) => state.removeEmbedField);
  const selection = useMessageStore((state) => state.selection);
  const select = useMessageStore((state) => state.select);

  const [open, setOpen] = useState(true);
  const id = embed._id ?? "";
  const active = selection?.kind === "embed" && selection.id === id;
  const used = embedCharCount(embed);

  return (
    <div className={`panel ${active ? "border-blurple" : ""}`}>
      <div
        className="panel-header cursor-pointer"
        onClick={() => select({ kind: "embed", id })}
      >
        <div className="flex items-center gap-1.5">
          <IconButton
            icon={open ? ChevronDown : ChevronRight}
            label={open ? "Collapse" : "Expand"}
            onClick={(event) => {
              event.stopPropagation();
              setOpen((value) => !value);
            }}
          />
          <span className="text-xs font-semibold text-ink">
            Embed {index + 1}
            {embed.title ? ` — ${embed.title}` : ""}
          </span>
        </div>

        <div className="flex items-center gap-0.5">
          <span
            className={`mr-1 text-[11px] tabular-nums ${
              used > Limits.embed.total ? "text-danger" : "text-ink-faint"
            }`}
          >
            {used}/{Limits.embed.total}
          </span>
          <IconButton
            icon={Copy}
            label="Duplicate embed"
            size={13}
            onClick={(event) => {
              event.stopPropagation();
              duplicateEmbed(id);
            }}
          />
          <IconButton
            icon={Trash2}
            label="Delete embed"
            size={13}
            onClick={(event) => {
              event.stopPropagation();
              removeEmbed(id);
            }}
          />
        </div>
      </div>

      {open && (
        <div className="space-y-3 p-3">
          <TextField
            label="Title"
            limit={Limits.embed.title}
            value={embed.title ?? ""}
            placeholder="Announcement"
            onChange={(event) => updateEmbed(id, { title: event.target.value })}
          />

          <TextField
            label="Title URL"
            value={embed.url ?? ""}
            placeholder="https://example.com"
            onChange={(event) => updateEmbed(id, { url: event.target.value })}
          />

          <TextArea
            label="Description"
            limit={Limits.embed.description}
            rows={4}
            value={embed.description ?? ""}
            placeholder="Markdown is supported **here**."
            onChange={(event) => updateEmbed(id, { description: event.target.value })}
          />

          <ColorPicker
            value={embed.color ?? null}
            onChange={(color) => updateEmbed(id, { color })}
          />

          {/* Fields */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="field-label !mb-0">Fields</span>
              <Button size="sm" variant="ghost" icon={Plus} onClick={() => addEmbedField(id)}>
                Add field
              </Button>
            </div>

            <div className="space-y-2">
              {(embed.fields ?? []).map((field) => (
                <div key={field._id} className="rounded border border-line-soft p-2">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1 space-y-2">
                      <TextField
                        label="Name"
                        limit={Limits.embed.fieldName}
                        value={field.name}
                        onChange={(event) =>
                          updateEmbedField(id, field._id ?? "", { name: event.target.value })
                        }
                      />
                      <TextArea
                        label="Value"
                        limit={Limits.embed.fieldValue}
                        rows={2}
                        value={field.value}
                        onChange={(event) =>
                          updateEmbedField(id, field._id ?? "", { value: event.target.value })
                        }
                      />
                    </div>
                    <IconButton
                      icon={Trash2}
                      label="Remove field"
                      size={13}
                      onClick={() => removeEmbedField(id, field._id ?? "")}
                    />
                  </div>
                  <Checkbox
                    className="mt-2"
                    label="Inline"
                    checked={field.inline}
                    onChange={(inline) => updateEmbedField(id, field._id ?? "", { inline })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <TextField
              label="Author name"
              limit={Limits.embed.authorName}
              value={embed.author?.name ?? ""}
              onChange={(event) =>
                updateEmbed(id, { author: { ...embed.author, name: event.target.value } })
              }
            />
            <TextField
              label="Author icon URL"
              value={embed.author?.icon_url ?? ""}
              onChange={(event) =>
                updateEmbed(id, { author: { ...embed.author, icon_url: event.target.value } })
              }
            />
          </div>

          <TextField
            label="Footer text"
            limit={Limits.embed.footerText}
            value={embed.footer?.text ?? ""}
            onChange={(event) =>
              updateEmbed(id, { footer: { ...embed.footer, text: event.target.value } })
            }
          />

          <div className="grid grid-cols-2 gap-2">
            <TextField
              label="Image URL"
              value={embed.image?.url ?? ""}
              onChange={(event) => updateEmbed(id, { image: { url: event.target.value } })}
            />
            <TextField
              label="Thumbnail URL"
              value={embed.thumbnail?.url ?? ""}
              onChange={(event) => updateEmbed(id, { thumbnail: { url: event.target.value } })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Checkbox
              label="Timestamp"
              checked={Boolean(embed.timestamp)}
              onChange={(checked) =>
                updateEmbed(id, { timestamp: checked ? new Date().toISOString() : null })
              }
            />
            <div className="flex gap-1">
              <IconButton
                icon={ChevronRight}
                label="Move up"
                size={13}
                onClick={() => moveEmbed(id, -1)}
              />
              <IconButton
                icon={ChevronDown}
                label="Move down"
                size={13}
                onClick={() => moveEmbed(id, 1)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmbedEditor;
