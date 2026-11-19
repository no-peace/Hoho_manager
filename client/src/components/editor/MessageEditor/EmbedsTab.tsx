import React from "react";
import type { EmbedData } from "@dmb/shared";
import { EmbedEditor } from "../EmbedEditor";
import { SortableItem, SortableList } from "../../ui/SortableList";
import { useMessageStore } from "../../../store/messageStore";

export interface EmbedsTabProps {
  embeds: EmbedData[];
}

export const EmbedsTab: React.FC<EmbedsTabProps> = ({ embeds }) => {
  if (!embeds || embeds.length === 0) return null;

  return (
    <SortableList
      items={embeds.map((embed, index) => embed._id ?? `embed-${index}`)}
      onReorder={(activeId, overId) => useMessageStore.getState().reorderEmbeds(activeId, overId)}
      strategy="vertical"
      className="space-y-2.5 pt-1"
    >
      {embeds.map((embed, embedIdx) => {
        const id = embed._id ?? `embed-${embedIdx}`;
        return (
          <SortableItem key={id} id={id}>
            <EmbedEditor embed={embed} index={embedIdx} />
          </SortableItem>
        );
      })}
    </SortableList>
  );
};

export default EmbedsTab;
