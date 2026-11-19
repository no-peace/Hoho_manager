import React from "react";
import type { DiscordPoll } from "@dmb/shared";

export const PollPreview: React.FC<{ poll: DiscordPoll }> = ({ poll }) => (
  <div className="max-w-[520px] rounded-xl border border-[#4e5058] bg-[#2b2d31] p-3">
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="text-[9px] font-bold uppercase tracking-wider text-[#949ba4]">Poll preview</span>
      <span className="text-[9px] text-[#949ba4]">{poll.duration}h · {poll.allow_multiselect ? "Multiple answers" : "One answer"}</span>
    </div>
    <p className="mb-3 text-sm font-semibold text-[#f2f3f5]">{poll.question.text}</p>
    <div className="space-y-1.5">
      {poll.answers.map((answer, index) => (
        <div key={index} className="flex items-center gap-2 rounded-md border border-[#4e5058] bg-[#1e1f22] px-2.5 py-2">
          <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[#949ba4]" />
          {answer.poll_media.emoji?.name && <span className="text-xs">{answer.poll_media.emoji.name}</span>}
          <span className="min-w-0 flex-1 truncate text-xs text-[#dbdee1]">{answer.poll_media.text}</span>
        </div>
      ))}
    </div>
    <p className="mt-2 text-[9px] text-[#949ba4]">Vote controls appear after dispatching to Discord.</p>
  </div>
);

export default PollPreview;
