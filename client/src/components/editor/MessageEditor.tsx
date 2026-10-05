import { useState, useRef, useEffect } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Plus,
  Sliders,
  Flag,
  AtSign,
} from "lucide-react";
import { Limits } from "@dmb/shared";
import { Button } from "../ui/Button";
import { TextArea, TextField } from "../ui/Field";
import { EmbedEditor } from "./EmbedEditor";
import { DiscohookComponentsEditor } from "./DiscohookComponentsEditor";
import { ComponentPalette } from "./ComponentPalette";
import { FileAttachmentsSection } from "./FileAttachmentsSection";
import { FlagsModal } from "./FlagsModal";
import { AllowedMentionsModal } from "./AllowedMentionsModal";
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
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [flagsOpen, setFlagsOpen] = useState(false);
  const [mentionsOpen, setMentionsOpen] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
        setOptionsMenuOpen(false);
      }
    };
    if (optionsMenuOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [optionsMenuOpen]);

  const profileSection = (
    <div className="border border-[#1e1f22] rounded-lg bg-[#2b2d31] shadow-sm transition-colors overflow-hidden">
      <button
        type="button"
        onClick={() => setIdentityOpen(!identityOpen)}
        className="w-full flex items-center justify-between p-3 text-left text-xs font-bold text-[#949ba4] hover:bg-[#35373c]/30 hover:text-[#dbdee1] transition-colors focus-visible:outline-none"
      >
        <span className="flex items-center gap-1.5 uppercase tracking-wide text-xs font-bold">
          Profile
        </span>
        {identityOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {identityOpen && (
        <div className="p-3 pt-1 border-t border-[#1e1f22] space-y-3 bg-[#313338]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TextField
              label="Username"
              placeholder="Webhook name override"
              value={data.username || ""}
              onChange={(e) => setField("username", e.target.value)}
            />
            <TextField
              label="Avatar URL"
              placeholder="https://."
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
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Editor Mode Tabs & Options */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="flex-1 flex rounded-lg bg-[#1e1f22] p-1 border border-[#111214]"
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

        {/* Options Dropdown */}
        <div className="relative" ref={optionsRef}>
          <button
            type="button"
            onClick={() => setOptionsMenuOpen(!optionsMenuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e1f22] hover:bg-[#35373c] border border-[#111214] rounded-lg text-xs font-semibold text-[#dbdee1] transition-colors"
            title="Message Options (Flags, Allowed Mentions)"
          >
            <Sliders size={13} className="text-[#949ba4]" />
            <span>Options</span>
            <ChevronDown size={12} className="text-[#949ba4]" />
          </button>

          {optionsMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-[#1e1f22] border border-[#111214] rounded-lg shadow-2xl py-1 z-30 space-y-0.5">
              <button
                type="button"
                onClick={() => { setOptionsMenuOpen(false); setFlagsOpen(true); }}
                className="w-full text-left px-3 py-1.5 text-xs text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Flag size={13} />
                  <span>Flags</span>
                </div>
                {Boolean(data.flags) && (
                  <span className="text-[10px] bg-[#5865f2] text-white px-1.5 py-0.2 rounded font-mono">
                    {data.flags}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setOptionsMenuOpen(false); setMentionsOpen(true); }}
                className="w-full text-left px-3 py-1.5 text-xs text-[#dbdee1] hover:bg-[#5865f2] hover:text-white flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2">
                  <AtSign size={13} />
                  <span>Allowed Mentions</span>
                </div>
                {Boolean(data.allowed_mentions) && (
                  <span className="text-[10px] bg-[#23a55a] text-white px-1.5 py-0.2 rounded">
                    Active
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
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
          {profileSection}
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

          {profileSection}

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

      <FlagsModal open={flagsOpen} onClose={() => setFlagsOpen(false)} />
      <AllowedMentionsModal open={mentionsOpen} onClose={() => setMentionsOpen(false)} />
    </div>
  );
};

export default MessageEditor;
