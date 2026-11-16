import React, { useState } from "react";
import { ChevronDown, ChevronRight, Link, X, UserRound, MessageSquareText } from "lucide-react";
import { Limits } from "@dmb/shared";
import { DiscordMentionInput } from "../DiscordMentionInput";
import { FileAttachmentsSection } from "../FileAttachmentsSection";
import type { ExtendedMessageData } from "../../../utils/discord";

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

const SectionCard: React.FC<{
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ size?: number }>;
  open: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}> = ({ title, subtitle, icon: Icon, open, onToggle, badge, children }) => (
  <section className="overflow-hidden rounded-[10px] border border-[#272D3A] bg-[#161A23]">
    <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 bg-[#10131A] px-3.5 py-3 text-left transition-colors hover:bg-[#151A24]">
      <span className="flex min-w-0 items-center gap-2.5">
        <Icon size={14} className="shrink-0 text-[#9AA5B8]" />
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-[#E8ECF4]">{title}</span>
          {subtitle && <span className="mt-0.5 block text-[10px] text-[#7F899C]">{subtitle}</span>}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {badge && <span className="rounded-md border border-[#272D3A] bg-[#1D2230] px-1.5 py-0.5 font-mono text-[10px] text-[#AEB8CA]">{badge}</span>}
        {open ? <ChevronDown size={14} className="text-[#8D96A8]" /> : <ChevronRight size={14} className="text-[#8D96A8]" />}
      </span>
    </button>
    {open && <div className="space-y-3 border-t border-[#272D3A] p-3.5">{children}</div>}
  </section>
);

export const ContentTab: React.FC<ContentTabProps> = ({
  message,
  isV2,
  ensureActive,
  setField,
  setExtendedField,
}) => {
  const [threadOpen, setThreadOpen] = useState(Boolean(message.thread_name || message.thread_id || message.message_link));
  const [identityOpen, setIdentityOpen] = useState(Boolean(message.username || message.avatar_url));

  return (
    <div className="space-y-3">
      {!isV2 && (
        <section className="rounded-[10px] border border-[#272D3A] bg-[#161A23] p-3.5 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#F1F3F9]">Message Content</h3>
              <p className="mt-0.5 text-[11px] text-[#8993A5]">Compose the text that appears in your Discord message.</p>
            </div>
            <span className="rounded-md border border-[#272D3A] bg-[#10131A] px-2 py-1 font-mono text-[10px] text-[#8D96A8]">PRIMARY</span>
          </div>
          <DiscordMentionInput
            label="Content"
            maxLength={Limits.content}
            rows={6}
            value={message.content || ""}
            placeholder="Say something… (type @, #, :, or {status} / {sunc})"
            onChange={(value) => {
              ensureActive();
              setField("content", value);
            }}
          />
        </section>
      )}
      {isV2 && (
        <div className="rounded-[10px] border border-[#818CF8]/25 bg-[#818CF8]/[0.06] p-3 text-xs text-[#B9C4D8]">
          Components V2 messages use Text Display blocks for message text. Open the Components V2 tab to edit those blocks.
        </div>
      )}

      <SectionCard
        title="Edit Existing Message / Forum Thread Target"
        subtitle="Existing message link, thread ID, or a new forum thread title."
        icon={MessageSquareText}
        open={threadOpen}
        onToggle={() => setThreadOpen((value) => !value)}
        badge={message.message_link || message.thread_id || message.thread_name ? "Configured" : undefined}
      >
        {message.message_link && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-[#818CF8]/25 bg-[#818CF8]/[0.07] px-3 py-2">
            <span className="flex min-w-0 items-center gap-2 text-[11px] text-[#D5DCFA]">
              <Link size={13} className="shrink-0" />
              <span className="truncate">{message.link_mode === "edit" ? `Editing message ${message.edit_message_id || ""}` : "Replying to linked Discord message"}</span>
            </span>
            <button type="button" onClick={() => {
              ensureActive();
              setExtendedField("message_link", undefined);
              setExtendedField("link_mode", undefined);
              setExtendedField("edit_channel_id", undefined);
              setExtendedField("edit_message_id", undefined);
              setExtendedField("message_reference", undefined);
            }} className="rounded p-1 text-[#F87171] hover:bg-[#F87171]/10 hover:text-white" title="Clear linked message"><X size={13} /></button>
          </div>
        )}
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#9AA5B8]">Existing Thread ID</label>
          <input
            type="text"
            inputMode="numeric"
            value={message.thread_id || ""}
            placeholder="Paste an existing Discord thread ID"
            onChange={(event) => { ensureActive(); setExtendedField("thread_id", event.target.value); }}
            className="w-full rounded-md border border-[#272D3A] bg-[#10131A] px-3 py-2 text-xs text-[#F1F3F9] outline-none transition-colors placeholder:text-[#626D80] focus:border-[#818CF8]"
          />
          <p className="mt-1 text-[10px] leading-relaxed text-[#7F899C]">When set, this existing thread takes priority over the selected channel and forum thread name.</p>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-[#9AA5B8]">Forum Thread Name</label>
            <span className="font-mono text-[10px] tabular-nums text-[#7F899C]">{message.thread_name?.length || 0}/100</span>
          </div>
          <input
            type="text"
            maxLength={100}
            value={message.thread_name || ""}
            placeholder="Optional forum thread title…"
            onChange={(event) => { ensureActive(); setField("thread_name", event.target.value); }}
            className="w-full rounded-md border border-[#272D3A] bg-[#10131A] px-3 py-2 text-xs text-[#F1F3F9] outline-none transition-colors placeholder:text-[#626D80] focus:border-[#818CF8]"
          />
        </div>
      </SectionCard>

      <FileAttachmentsSection />

      <SectionCard
        title="Webhook / Identity Override"
        subtitle="Override the display name and avatar for this webhook message."
        icon={UserRound}
        open={identityOpen}
        onToggle={() => setIdentityOpen((value) => !value)}
        badge={message.username || message.avatar_url ? "Configured" : undefined}
      >
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#9AA5B8]">Username Override</label>
          <input
            type="text"
            maxLength={80}
            value={message.username || ""}
            placeholder="Leave empty to use the webhook username"
            onChange={(event) => { ensureActive(); setField("username", event.target.value); }}
            className="w-full rounded-md border border-[#272D3A] bg-[#10131A] px-3 py-2 text-xs text-[#F1F3F9] outline-none transition-colors placeholder:text-[#626D80] focus:border-[#818CF8]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#9AA5B8]">Avatar URL Override</label>
          <input
            type="url"
            value={message.avatar_url || ""}
            placeholder="https://example.com/avatar.png"
            onChange={(event) => { ensureActive(); setField("avatar_url", event.target.value); }}
            className="w-full rounded-md border border-[#272D3A] bg-[#10131A] px-3 py-2 text-xs text-[#F1F3F9] outline-none transition-colors placeholder:text-[#626D80] focus:border-[#818CF8]"
          />
        </div>
      </SectionCard>
    </div>
  );
};

export default ContentTab;
