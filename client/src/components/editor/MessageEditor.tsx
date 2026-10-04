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
import { ComponentPalette } from "./ComponentPalette";
import { FileAttachmentsSection } from "./FileAttachmentsSection";
import { useMessage } from "../../hooks/useMessage";
import { useMessageStore } from "../../store/messageStore";
import { EDITOR_MODES } from "../../utils/constants";

export const MessageEditor = () => {
  const { data, problems } = useMessage();
  const mode = useMessageStore((state) => state.mode);
  const setMode = useMessageStore((state) => state.setMode);
  const setField = useMessageStore((state) => state.setField);
  const addEmbed = useMessageStore((state) => state.addEmbed);
  const [identityOpen, setIdentityOpen] = useState(false);

  const identitySection = (
    <section className="bg-[#232428] rounded border border-[#1e1f22]">
      <button
        type="button"
        onClick={() => setIdentityOpen(!identityOpen)}
        className="w-full flex items-center justify-between p-2.5 text-left text-xs font-bold text-[#949ba4] hover:text-[#dbdee1] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2]"
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
  );

  return (
    <div className="space-y-3">
      {/* Editor Mode Tabs */}
      <div
        className="flex rounded-lg bg-[#1e1f22] p-1 border border-[#111214]"
        role="tablist"
        aria-label="Editor Mode"
      >
        <button
          type="button"
          role="tab"
          id="editor-tab-classic"
          aria-selected={mode === EDITOR_MODES.CLASSIC}
          onClick={() => setMode(EDITOR_MODES.CLASSIC)}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2] ${
            mode === EDITOR_MODES.CLASSIC
              ? "bg-[#5865f2] text-white shadow-sm"
              : "text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]/50"
          }`}
        >
          Classic
        </button>
        <button
          type="button"
          role="tab"
          id="editor-tab-v2"
          aria-selected={mode === EDITOR_MODES.V2}
          onClick={() => setMode(EDITOR_MODES.V2)}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865f2] ${
            mode === EDITOR_MODES.V2
              ? "bg-[#5865f2] text-white shadow-sm"
              : "text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c]/50"
          }`}
        >
          Components V2
        </button>
      </div>

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

      {mode === EDITOR_MODES.V2 ? (
        <>
          {identitySection}
          <FileAttachmentsSection />
          <section className="pt-1">
            <DiscohookComponentsEditor />
          </section>

          {/* Component palette — always visible in the editor pane (Discohook style),
              no need to open the toolbox drawer to add elements. */}
          <section className="bg-[#232428] rounded border border-[#1e1f22] p-2.5 space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#949ba4] flex items-center gap-1.5">
              Component Palette
            </h3>
            <ComponentPalette />
          </section>
        </>
      ) : (
        <>
          {/* Message Text Content */}
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

          {identitySection}

          {/* File Attachments */}
          <FileAttachmentsSection />

          {/* Embeds Section */}
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
        </>
      )}
    </div>
  );
};

export default MessageEditor;