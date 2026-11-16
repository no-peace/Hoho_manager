import React from "react";
import type { EmbedData } from "@dmb/shared";
import { EmbedEditor } from "../EmbedEditor";

export interface EmbedsTabProps {
  embeds: EmbedData[];
}

export const EmbedsTab: React.FC<EmbedsTabProps> = ({ embeds }) => {
  if (!embeds || embeds.length === 0) return null;

  return (
    <div className="space-y-2.5 pt-1">
      {embeds.map((embed, embedIdx) => (
        <EmbedEditor key={embed._id || embedIdx} embed={embed} index={embedIdx} />
      ))}
    </div>
  );
};

export default EmbedsTab;
