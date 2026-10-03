import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Plus,
  User,
} from "lucide-react";
import { Limits } from "@dmb/shared";
import { Button } from "../ui/Button";
import { TextArea, TextField } from "../ui/Field";
import { EmbedEditor } from "./EmbedEditor";
import { DiscohookComponentsEditor } from "./DiscohookComponentsEditor";
import { useMessage } from "../../hooks/useMessage";
import { useMessageStore } from "../../store/messageStore";

export const MessageEditor = () => {
  const { data, problems } = useMessage();
  const setField = useMessageStore((state) => state.setField);
  const addEmbed = useMessageStore((state) => state.addEmbed);
  const [identityOpen, setIdentityOpen] = useState(false);

  return (
    <div className="space-y-3">
      {problems.length > 0 && (
        <div className="rounded border border-[#da373c]/40 bg-[#da373c]/10 p-2 text-xs">
          <p className="flex items-center gap-1.5 font-semibold text-[#f28b8b]">
            <AlertTriangle size={13} />
            {problems.length} problem{problems.length === 1 ? "" : "s"} to fix
          </p>
          <ul className="mt-1 list-inside list-disc text-[11px] text-[#949ba4]">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Message Text Content: ALWAYS visible */}
      <section className="bg-[#232428] rounded border border-[#1e1f22] p-2.5">
        <TextArea
          label="Content"
          limit={Limits.content}
          rows={4}
          value={data.content || ""}
          placeholder="Say something…"
          onChange={(e) => setField("content", e.target.value)}
        />
      </section>

      {/* Collapsible Message Identity (Username, Avatar, Thread) */}
      <section className="bg-[#232428] rounded border border-[#1e1f22]">
        <button
          type="button"
          onClick={() => setIdentityOpen(!identityOpen)}
          className="w-full flex items-center justify-between p-2.5 text-left text-xs font-bold text-[#949ba4] hover:text-[#dbdee1] transition-colors"
        >
          <span className="flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
            <User size={13} /> Message Identity (Optional)
          </span>
          {identityOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {identityOpen && (
          <div className="p-2.5 pt-0 border-t border-[#1e1f22] space-y-2 mt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <TextField
                label="Username"
                placeholder="Webhook name override"
                value={data.username || ""}
                onChange={(e) => setField("username", e.target.value)}
              />
              <TextField
                label="Avatar URL"
                placeholder="https://…"
                value={data.avatar_url || ""}
                onChange={(e) => setField("avatar_url", e.target.value)}
              />
            </div>
            <TextField
              label="Thread name"
              hint="Only for forum channels"
              value={data.thread_name || ""}
              onChange={(e) => setField("thread_name", e.target.value)}
            />
          </div>
        )}
      </section>

      {/* Embeds Section: ALWAYS visible */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[#949ba4] flex items-center gap-1.5">
            <ImageIcon size={13} /> Embeds
            <span className="text-[#949ba4] text-[11px]">
              {(data.embeds || []).length}/{Limits.embed.embedsPerMessage}
            </span>
          </h3>
          <Button
            size="sm"
            variant="secondary"
            icon={Plus}
            onClick={addEmbed}
            disabled={(data.embeds || []).length >= Limits.embed.embedsPerMessage}
          >
            Add embed
          </Button>
        </div>

        {(!data.embeds || data.embeds.length === 0) ? (
          <p className="rounded border border-dashed border-[#35373c] px-3 py-3 text-center text-xs text-[#949ba4]">
            No embeds yet. Click "Add embed" to create one.
          </p>
        ) : (
          data.embeds.map((embed, index) => (
            <EmbedEditor key={embed._id} embed={embed} index={index} />
          ))
        )}
      </section>

      {/* Visual Action Rows & Interactive Components Builder */}
      <section className="pt-2">
        <DiscohookComponentsEditor />
      </section>
    </div>
  );
};

export default MessageEditor;