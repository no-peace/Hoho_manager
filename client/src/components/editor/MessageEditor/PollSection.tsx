import React, { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { DiscordPoll } from "@dmb/shared";
import { useMessageStore } from "../../../store/messageStore";
import { DragHandle, SortableItem, SortableList } from "../../ui/SortableList";
import { uid } from "../../../utils/constants";

const createDefaultPoll = (): DiscordPoll => ({
  question: { text: "What should we build next?" },
  answers: [
    { _id: uid(), poll_media: { text: "More editor features" } },
    { _id: uid(), poll_media: { text: "More automation" } },
  ],
  duration: 24,
  allow_multiselect: false,
  layout_type: 1,
});

export const PollSection: React.FC<{ poll?: DiscordPoll }> = ({ poll }) => {
  const [expanded, setExpanded] = useState(Boolean(poll));
  const update = (next: DiscordPoll | undefined) =>
    useMessageStore.getState().setField("poll", next);

  return (
    <section className="overflow-hidden rounded-xl border border-[#272D3A] bg-[#10131A]">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronDown size={13} className={`shrink-0 text-[#A1A8B8] transition-transform ${expanded ? "" : "-rotate-90"}`} />
          <span className="text-xs font-bold text-[#F1F3F9]">Poll</span>
          <span className="text-[10px] text-[#A1A8B8]">{poll ? `${poll.answers.length} answers` : "Optional native Discord poll"}</span>
        </button>
        <label className="inline-flex items-center gap-2 text-[10px] font-semibold text-[#A1A8B8]">
          <input type="checkbox" checked={Boolean(poll)} onChange={(event) => { update(event.target.checked ? createDefaultPoll() : undefined); setExpanded(event.target.checked); }} className="accent-[#818CF8]" />
          Enable
        </label>
      </div>
      {expanded && poll && (
        <div className="space-y-3 border-t border-[#272D3A] p-3">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#A1A8B8]">
            Question
            <input maxLength={300} value={poll.question.text} onChange={(event) => update({ ...poll, question: { text: event.target.value } })} className="mt-1 w-full rounded-md border border-[#272D3A] bg-[#1D2230] px-2.5 py-2 text-xs font-normal normal-case text-[#F1F3F9] outline-none focus:border-[#818CF8]" placeholder="Ask your community..." />
          </label>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A1A8B8]">Answers ({poll.answers.length}/10)</span>
            <button type="button" disabled={poll.answers.length >= 10} onClick={() => update({ ...poll, answers: [...poll.answers, { _id: uid(), poll_media: { text: `Option ${poll.answers.length + 1}` } }] })} className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#949cf7] hover:text-white disabled:opacity-30"><Plus size={11} /> Add answer</button>
          </div>
          <SortableList
            items={poll.answers.map((answer, index) => answer._id ?? `poll-answer-${index}`)}
            onReorder={(activeId, overId) => {
              const from = poll.answers.findIndex((answer, index) => (answer._id ?? `poll-answer-${index}`) === activeId);
              const to = poll.answers.findIndex((answer, index) => (answer._id ?? `poll-answer-${index}`) === overId);
              if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return;
              const answers = [...poll.answers];
              const [moved] = answers.splice(from, 1);
              if (moved) answers.splice(to, 0, moved);
              update({ ...poll, answers });
            }}
            strategy="vertical"
            renderOverlay={(activeId) => `Answer ${poll.answers.findIndex((answer, index) => (answer._id ?? `poll-answer-${index}`) === activeId) + 1}`}
            className="space-y-1.5"
          >
            {poll.answers.map((answer, index) => {
              const id = answer._id ?? `poll-answer-${index}`;
              return (
                <SortableItem key={id} id={id} className="flex items-center gap-1.5 rounded-lg border border-[#272D3A] bg-[#161A23] p-1.5">
                  <DragHandle label={`Drag poll answer ${index + 1}`} />
                  <input
                    aria-label={`Answer ${index + 1} emoji`}
                    maxLength={8}
                    value={answer.poll_media.emoji?.name ?? ""}
                    onChange={(event) => update({ ...poll, answers: poll.answers.map((item, itemIndex) => item._id === answer._id ? { ...item, poll_media: { ...item.poll_media, emoji: event.target.value ? { name: event.target.value } : undefined } } : item) })}
                    placeholder="😀"
                    className="w-10 rounded-md border border-[#272D3A] bg-[#1D2230] px-1.5 py-1.5 text-center text-xs text-[#F1F3F9] outline-none focus:border-[#818CF8]"
                  />
                  <input
                    aria-label={`Poll answer ${index + 1}`}
                    maxLength={55}
                    value={answer.poll_media.text}
                    onChange={(event) => update({ ...poll, answers: poll.answers.map((item, itemIndex) => itemIndex === index ? { ...item, poll_media: { ...item.poll_media, text: event.target.value } } : item) })}
                    className="min-w-0 flex-1 rounded-md border border-[#272D3A] bg-[#1D2230] px-2.5 py-1.5 text-xs text-[#F1F3F9] outline-none focus:border-[#818CF8]"
                  />
                  <button type="button" disabled={poll.answers.length <= 1} onClick={() => update({ ...poll, answers: poll.answers.filter((item) => item._id !== answer._id) })} aria-label={`Remove poll answer ${index + 1}`} className="rounded p-1.5 text-[#F87171] transition-colors hover:bg-[#F87171]/10 disabled:opacity-30"><Trash2 size={13} /></button>
                </SortableItem>
              );
            })}
          </SortableList>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#272D3A] pt-2">
            <label className="flex items-center gap-2 text-[11px] text-[#A1A8B8]">
              <input type="checkbox" checked={poll.allow_multiselect} onChange={(event) => update({ ...poll, allow_multiselect: event.target.checked })} className="accent-[#818CF8]" />
              Allow multiple answers
            </label>
            <label className="flex items-center gap-2 text-[11px] text-[#A1A8B8]">
              Duration
              <select value={poll.duration} onChange={(event) => update({ ...poll, duration: Number(event.target.value) })} className="rounded-md border border-[#272D3A] bg-[#1D2230] px-2 py-1 text-xs text-[#F1F3F9]">
                {[1, 4, 8, 24, 48, 72, 168].map((hours) => <option key={hours} value={hours}>{hours}h</option>)}
              </select>
            </label>
          </div>
        </div>
      )}
    </section>
  );
};

export default PollSection;
