import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Plus, Trash2,  } from "lucide-react";
import type { EmbedData } from "@dmb/shared";
import { Limits } from "@dmb/shared";
import { Button } from "../ui/Button";
import { Checkbox, TextArea, TextField } from "../ui/Field";
import { ColorPicker } from "../ui/ColorPicker";
import { embedCharCount } from "../../utils/discord";
import { useMessageStore } from "../../store/messageStore";

const EmbedEditorSection = ({ name, children, defaultOpen = false }: { name: string, children: React.ReactNode, defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  
  return (
    <div className="border-b border-[#1e1f22] last:border-b-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="w-full flex items-center justify-between py-2 px-3 text-[#949ba4] hover:bg-[#35373c]/30 transition-colors focus-visible:outline-none"
      >
        <span className="text-xs font-bold uppercase tracking-wide">{name}</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && (
        <div className="p-3 pt-1 space-y-3">
          {children}
        </div>
      )}
    </div>
  );
};

export interface EmbedEditorProps {
  embed: EmbedData;
  index: number;
}

export const EmbedEditor = ({ embed, index }: EmbedEditorProps) => {
  const updateEmbed = useMessageStore((state) => state.updateEmbed);
  const removeEmbed = useMessageStore((state) => state.removeEmbed);
  const duplicateEmbed = useMessageStore((state) => state.duplicateEmbed);
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
    <div className={`border rounded-lg bg-[#2b2d31] shadow-sm transition-colors border-[#1e1f22] relative overflow-hidden ${active ? 'ring-1 ring-[#5865f2]' : ''}`}>
      {embed.color && (
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: `#${embed.color.toString(16).padStart(6, '0')}` }} />
      )}
      <div
        className="flex items-center justify-between p-2 pl-4 text-[#dbdee1] cursor-pointer hover:bg-[#35373c]/50 transition-colors bg-[#232428] border-b border-[#1e1f22]"
        onClick={() => select({ kind: "embed", id })}
      >
        <div className="flex items-center gap-1.5 grow" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
          {open ? <ChevronDown size={16} className="text-[#949ba4]" /> : <ChevronRight size={16} className="text-[#949ba4]" />}
          <span className="text-sm font-semibold">
            Embed {index + 1}
            {embed.title ? <span className="text-[#949ba4] font-normal ml-1">- {embed.title}</span> : ""}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`mr-2 text-xs tabular-nums font-medium ${used > Limits.embed.total ? "text-[#da373c]" : "text-[#949ba4]"}`}>
            {used} / {Limits.embed.total}
          </span>
          <button type="button" className="p-1 hover:text-[#dbdee1] text-[#949ba4] transition-colors rounded" onClick={(e) => { e.stopPropagation(); duplicateEmbed(id); }}>
            <Copy size={14} />
          </button>
          <button type="button" className="p-1 hover:text-[#da373c] text-[#f28b8b] transition-colors rounded" onClick={(e) => { e.stopPropagation(); removeEmbed(id); }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {open && (
        <div className="flex flex-col bg-[#313338]">
          <EmbedEditorSection name="Author" defaultOpen={!!embed.author?.name}>
            <TextField label="Author name" limit={Limits.embed.authorName} value={embed.author?.name ?? ""} placeholder="John Doe" onChange={(e) => updateEmbed(id, { author: { ...embed.author, name: e.target.value } })} />
            <TextField label="Author URL" value={embed.author?.url ?? ""} placeholder="https://example.com" onChange={(e) => updateEmbed(id, { author: { ...embed.author, url: e.target.value } })} />
            <TextField label="Author icon URL" value={embed.author?.icon_url ?? ""} placeholder="https://." onChange={(e) => updateEmbed(id, { author: { ...embed.author, icon_url: e.target.value } })} />
          </EmbedEditorSection>
          
          <EmbedEditorSection name="Body" defaultOpen={true}>
            <TextField label="Title" limit={Limits.embed.title} value={embed.title ?? ""} placeholder="Announcement" onChange={(e) => updateEmbed(id, { title: e.target.value })} />
            <TextField label="Title URL" value={embed.url ?? ""} placeholder="https://example.com" onChange={(e) => updateEmbed(id, { url: e.target.value })} />
            <TextArea label="Description" limit={Limits.embed.description} rows={4} value={embed.description ?? ""} placeholder="Markdown is supported **here**." onChange={(e) => updateEmbed(id, { description: e.target.value })} />
            <ColorPicker value={embed.color ?? null} onChange={(color) => updateEmbed(id, { color })} />
          </EmbedEditorSection>
          
          <EmbedEditorSection name="Fields" defaultOpen={(embed.fields?.length || 0) > 0}>
            <div className="space-y-2">
              {embed.fields?.map((field, i) => (
                <div key={field._id || i} className="border border-[#1e1f22] bg-[#2b2d31] rounded p-3 relative group">
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" className="p-1 hover:text-[#da373c] text-[#949ba4] rounded" onClick={() => field._id && removeEmbedField(id, field._id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <TextField label={`Field ${i + 1} name`} limit={Limits.embed.fieldName} value={field.name} placeholder="Name" onChange={(e) => field._id && updateEmbedField(id, field._id, { name: e.target.value })} />
                    <TextArea label="Value" limit={Limits.embed.fieldValue} rows={2} value={field.value} placeholder="Value" onChange={(e) => field._id && updateEmbedField(id, field._id, { value: e.target.value })} />
                    <Checkbox label="Inline" checked={field.inline ?? false} onChange={(inline) => field._id && updateEmbedField(id, field._id, { inline })} />
                  </div>
                </div>
              ))}
              <Button size="sm" variant="secondary" icon={Plus} disabled={(embed.fields?.length || 0) >= Limits.embed.fields} onClick={() => addEmbedField(id)}>
                Add Field
              </Button>
            </div>
          </EmbedEditorSection>
          
          <EmbedEditorSection name="Images" defaultOpen={!!embed.image?.url || !!embed.thumbnail?.url}>
            <TextField label="Image URL" value={embed.image?.url ?? ""} placeholder="https://." onChange={(e) => updateEmbed(id, { image: { url: e.target.value } })} />
            <TextField label="Thumbnail URL" value={embed.thumbnail?.url ?? ""} placeholder="https://." onChange={(e) => updateEmbed(id, { thumbnail: { url: e.target.value } })} />
          </EmbedEditorSection>
          
          <EmbedEditorSection name="Footer" defaultOpen={!!embed.footer?.text}>
            <TextArea label="Footer text" limit={Limits.embed.footerText} rows={2} value={embed.footer?.text ?? ""} placeholder="Footer" onChange={(e) => updateEmbed(id, { footer: { ...embed.footer, text: e.target.value } })} />
            <TextField label="Footer icon URL" value={embed.footer?.icon_url ?? ""} placeholder="https://." onChange={(e) => updateEmbed(id, { footer: { ...embed.footer, icon_url: e.target.value } })} />
            <TextField label="Timestamp" type="datetime-local" value={embed.timestamp ? new Date(embed.timestamp).toISOString().slice(0, 16) : ""} onChange={(e) => updateEmbed(id, { timestamp: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
          </EmbedEditorSection>
        </div>
      )}
    </div>
  );
};
