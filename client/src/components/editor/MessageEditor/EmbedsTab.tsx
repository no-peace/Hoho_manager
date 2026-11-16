import React from "react";
import { Plus, Sparkles } from "lucide-react";
import type { EmbedData } from "@dmb/shared";
import { EmbedEditor } from "../EmbedEditor";

export interface EmbedsTabProps {
  embeds: EmbedData[];
  onAddEmbed: () => void;
  canAdd: boolean;
}

export const EmbedsTab: React.FC<EmbedsTabProps> = ({ embeds, onAddEmbed, canAdd }) => {
  const count = embeds?.length ?? 0;

  return (
    <section className="space-y-3 pt-1" aria-label="Embeds">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="text-xs font-semibold text-[#F1F3F9]">Embeds</h3>
          <span className="rounded-md border border-[#272D3A] bg-[#10131A] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-[#A1A8B8]">
            {count} / 10
          </span>
        </div>
        <button
          type="button"
          onClick={onAddEmbed}
          disabled={!canAdd}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[8px] bg-[#818CF8] px-3 text-xs font-semibold text-[#0B0D12] transition-colors hover:bg-[#6366F1] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={13} /> Add Embed
        </button>
      </div>

      {count === 0 ? (
        <div className="rounded-[10px] border border-dashed border-[#272D3A] bg-[#161A23] px-5 py-7 text-center">
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-[9px] bg-[#818CF8]/10 text-[#A5B4FC]">
            <Sparkles size={17} />
          </div>
          <h4 className="mt-3 text-sm font-semibold text-[#F1F3F9]">No embeds yet</h4>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-[#A1A8B8]">
            Add an embed to build a rich Discord message with titles, fields, images, and footers.
          </p>
          <button
            type="button"
            onClick={onAddEmbed}
            disabled={!canAdd}
            className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[#818CF8]/40 bg-[#818CF8]/10 px-3 text-xs font-semibold text-[#C7D2FE] transition-colors hover:bg-[#818CF8]/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={13} /> Create First Embed
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {embeds.map((embed, embedIdx) => (
            <EmbedEditor key={embed._id || embedIdx} embed={embed} index={embedIdx} />
          ))}
        </div>
      )}
    </section>
  );
};

export default EmbedsTab;
