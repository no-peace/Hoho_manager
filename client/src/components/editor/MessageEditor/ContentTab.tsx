import React, { useState } from "react";
import { ChevronDown, ChevronRight, Link, X } from "lucide-react";
import { Limits } from "@dmb/shared";
import { DiscordMentionInput } from "../DiscordMentionInput";
import { FileAttachmentsSection } from "../FileAttachmentsSection";
import type { ExtendedMessageData } from "../../../utils/discord";
import { UI_THEME_CONFIG } from "../../../config/uiThemeConfig";

export interface ContentTabProps {
  message: ExtendedMessageData;
  isV2: boolean;
  ensureActive: () => void;
  setField: (key: any, value: any) => void;
  setExtendedField: <K extends keyof ExtendedMessageData>(
    key: K,
    value: ExtendedMessageData[K],
  ) => void;
}

export const ContentTab: React.FC<ContentTabProps> = ({
  message,
  isV2,
  ensureActive,
  setField,
  setExtendedField,
}) => {
  const [threadOpen, setThreadOpen] = useState(Boolean(message.thread_name || message.thread_id));

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {/* Thread Sub-Section */}
        <div className={UI_THEME_CONFIG.surfaces.editorSubSection}>
          <button
            type="button"
            onClick={() => setThreadOpen(!threadOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-left text-xs font-bold text-[#F1F3F9] hover:bg-[#282a2e] transition-colors"
          >
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[0.6875rem] text-[#A1A8B8]">
              {threadOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />} Thread
            </span>
            {(message.thread_id || message.thread_name) && (
              <span className="text-[0.625rem] text-[#949cf7] font-semibold truncate max-w-[150px]">
                {message.thread_id ? "Existing thread" : `#${message.thread_name}`}
              </span>
            )}
          </button>

          {threadOpen && (
            <div className="p-3 pt-1 border-t border-[#272D3A] space-y-2.5">
              <div>
                <label className="mb-1 block text-[0.625rem] font-bold uppercase tracking-wider text-[#A1A8B8]">
                  Existing Thread ID
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={message.thread_id || ""}
                  placeholder="Paste an existing Discord thread ID"
                  onChange={(event) => {
                    ensureActive();
                    setExtendedField("thread_id", event.target.value);
                  }}
                  className="w-full rounded border border-[#272D3A] bg-[#1D2230] px-2.5 py-1.5 text-xs text-[#F1F3F9] focus:border-[#818CF8] focus:outline-none"
                />
                <p className="mt-1 text-[0.625rem] leading-relaxed text-[#A1A8B8]">
                  When set, this existing thread takes priority over the selected channel and forum thread name.
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[0.625rem] font-bold text-[#A1A8B8] uppercase tracking-wider">
                    Forum Thread Name
                  </label>
                  <span className="text-[0.625rem] text-[#A1A8B8] font-mono tabular-nums">
                    {message.thread_name?.length || 0}/100
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
                  className="w-full bg-[#272D3A] text-xs text-[#F1F3F9] px-2.5 py-1.5 rounded border border-[#272D3A] focus:border-[#818CF8] focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Linked Discord Message Status Bar */}
        {message.message_link && (
          <div className="rounded-lg border border-[#272D3A] bg-[#161A23] px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-[0.625rem] font-bold uppercase tracking-wider text-[#A1A8B8]">
              Linked Discord Message
            </span>
            <div className="flex items-center gap-1.5 text-[0.6875rem] px-2 py-0.5 rounded bg-[#818CF8]/15 border border-[#818CF8]/30 text-[#dee0fc]">
              <Link size={12} />
              <span>
                {message.link_mode === "edit"
                  ? `Editing Msg #${message.edit_message_id?.slice(-6)}`
                  : `Replying to Msg #${message.message_reference?.message_id?.slice(-6)}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  ensureActive();
                  setExtendedField("message_link", undefined);
                  setExtendedField("link_mode", undefined);
                  setExtendedField("edit_channel_id", undefined);
                  setExtendedField("edit_message_id", undefined);
                  setExtendedField("message_reference", undefined);
                }}
                className="text-[#f28b8b] hover:text-white ml-1"
                title="Clear Link"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        {/* Files Sub-Section */}
        <FileAttachmentsSection />
      </div>

      {/* Classic Content Input */}
      {!isV2 && (
        <DiscordMentionInput
          label="Content"
          maxLength={Limits.content}
          rows={4}
          value={message.content || ""}
          placeholder="Say something… (type @, #, :, or {status} / {sunc})"
          onChange={(val) => {
            ensureActive();
            setField("content", val);
          }}
        />
      )}
    </div>
  );
};

export default ContentTab;
