import React from "react";
import type { DiscordPoll } from "@dmb/shared";
import { useMessageStore } from "../../store/messageStore";

const createDefaultPoll = (): DiscordPoll => ({
  question: { text: "What should we build next?" },
  answers: [
    { poll_media: { text: "More editor features" } },
    { poll_media: { text: "More automation" } },
  ],
  duration: 24,
  allow_multiselect: false,
  layout_type: 1,
});

export const PollEditor: React.FC<{ poll?: DiscordPoll }> = ({ poll }) => {
  const update = (next: DiscordPoll | undefined) =>
    useMessageStore.getState().setField("poll", next);

  return (
    <section className="space-y-3 rounded-xl border border-[#272D3A] bg-[#10131A] p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-[#F1F3F9]">Discord Poll</p>
          <p className="text-[10px] text-[#A1A8B8]">Native poll payload · up to 10 answers</p>
        </div>
        <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#A1A8B8]">
          <input type="checkbox" checked={Boolean(poll)} onChange={(event) => update(event.target.checked ? createDefaultPoll() : undefined)} className="accent-[#818CF8]" />
          Enable
        </label>
      </div>
      {poll && (
        <div className="space-y-2.5 border-t border-[#272D3A] pt-3">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#A1A8B8]">
            Question
            <input maxLength={300} value={poll.question.text} onChange={(event) => update({ ...poll, question: { text: event.target.value } })} className="mt-1 w-full rounded-md border border-[#272D3A] bg-[#1D2230] px-2.5 py-2 text-xs font-normal normal-case text-[#F1F3F9] outline-none focus:border-[#818CF8]" placeholder="Ask your community..." />
          </label>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A8B8]">Answers ({poll.answers.length}/10)</span>
              <button type="button" disabled={poll.answers.length >= 10} onClick={() => update({ ...poll, answers: [...poll.answers, { poll_media: { text: `Option ${poll.answers.length + 1}` } }] })} className="text-[10px] font-semibold text-[#949cf7] hover:text-white disabled:opacity-30">+ Add answer</button>
            </div>
            {poll.answers.map((answer, index) => (
              <div key={index} className="flex items-center gap-2">
                <input maxLength={55} value={answer.poll_media.text} onChange={(event) => update({ ...poll, answers: poll.answers.map((item, itemIndex) => itemIndex === index ? { ...item, poll_media: { ...item.poll_media, text: event.target.value } } : item) })} className="min-w-0 flex-1 rounded-md border border-[#272D3A] bg-[#1D2230] px-2.5 py-1.5 text-xs text-[#F1F3F9] outline-none focus:border-[#818CF8]" aria-label={`Poll answer ${index + 1}`} />
                <button type="button" disabled={poll.answers.length <= 2} onClick={() => update({ ...poll, answers: poll.answers.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`Remove poll answer ${index + 1}`} className="rounded p-1.5 text-[#F87171] hover:bg-[#F87171]/10 disabled:opacity-30">×</button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-[11px] text-[#A1A8B8]">
              <input type="checkbox" checked={poll.allow_multiselect} onChange={(event) => update({ ...poll, allow_multiselect: event.target.checked })} className="accent-[#818CF8]" />
              Allow multiple answers
            </label>
            <label className="flex items-center gap-2 text-[11px] text-[#A1A8B8]">
              Duration
              <select value={poll.duration} onChange={(event) => update({ ...poll, duration: Number(event.target.value) })} className="rounded-md border border-[#272D3A] bg-[#1D2230] px-2 py-1 text-xs text-[#F1F3F9]">
                {[1, 4, 8, 24, 48, 72, 168].map((hours) => <option key={hours} value={hours}>{hours} hour{hours === 1 ? "" : "s"}</option>)}
              </select>
            </label>
          </div>
        </div>
      )}
    </section>
  );
};

export default PollEditor;
