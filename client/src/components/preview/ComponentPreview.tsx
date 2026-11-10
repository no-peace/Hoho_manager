import { FileText } from "lucide-react";
import type { ComponentNode } from "@dmb/shared";
import { ComponentType } from "@dmb/shared";
import { Markdown } from "./Markdown";
import { ActionRowPreview, ButtonPreview } from "./ActionRowPreview";
import { useMessageStore } from "../../store/messageStore";

/**
 * Previews for the components that can sit inside a container (plus action rows,
 * which can also be top-level).
 *
 * Deliberately does **not** handle Container  containers are only legal at the
 * top level, and keeping them out of this file avoids a circular import between
 * the two preview modules.
 */

const TextDisplayPreview = ({ component }: { component: ComponentNode }) => (
  <Markdown content={component.content ?? ""} className="text-sm text-[#dbdee1]" />
);

const SeparatorPreview = ({ component }: { component: ComponentNode }) =>
  component.divider === false ? (
    <div style={{ height: component.spacing === 2 ? 16 : 8 }} />
  ) : (
    <hr
      className="border-0 bg-[#3f4147]"
      style={{ height: 1, margin: `${component.spacing === 2 ? 12 : 6}px 0` }}
    />
  );

const resolveAttachment = (
  url: string | undefined,
  attachedFiles: { name: string; previewUrl: string }[],
): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith("attachment://")) {
    const filename = url.slice("attachment://".length);
    const match = attachedFiles.find(
      (f) => f.name === filename || `SPOILER_${f.name}` === filename,
    );
    if (match) return match.previewUrl;
  }
  return url;
};

const SectionPreview = ({ component }: { component: ComponentNode }) => {
  const attachedFiles = useMessageStore((s) => s.attachedFiles);
  const thumbnail = resolveAttachment(component.accessory?.media?.url, attachedFiles);
  const isButton = component.accessory?.type === ComponentType.Button;

  return (
    <div className="flex items-start gap-3 max-w-[520px]">
      <div className="min-w-0 flex-1 space-y-1 break-words">
        {(component.components ?? []).map((child) => (
          <AutoComponent key={child._id} component={child} />
        ))}
      </div>
      {thumbnail && (
        <img src={thumbnail} alt="" className="h-20 w-20 shrink-0 rounded object-cover" />
      )}
      {isButton && component.accessory && (
        <div className="shrink-0">
          <ButtonPreview button={component.accessory} />
        </div>
      )}
    </div>
  );
};

const MediaGalleryPreview = ({ component }: { component: ComponentNode }) => {
  const attachedFiles = useMessageStore((s) => s.attachedFiles);
  const items = component.items ?? [];
  if (items.length === 0) return <p className="text-xs text-[#6d6f78]">No gallery images</p>;

  const cols = items.length === 1 ? "grid-cols-1" : items.length === 2 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className={`grid gap-1.5 ${cols}`}>
      {items.map((item) => (
        <img
          key={item._id}
          src={resolveAttachment(item.media.url, attachedFiles)}
          alt={item.description ?? ""}
          className="h-32 w-full rounded object-cover"
        />
      ))}
    </div>
  );
};

const FilePreview = ({ component }: { component: ComponentNode }) => {
  const url = component.file?.url ?? "";
  const name = url.split("/").pop() || "attachment";

  return (
    <div className="inline-flex items-center gap-2 rounded border border-[#3f4147] bg-[#2b2d31] px-3 py-2">
      <FileText size={16} className="text-[#b5bac1]" />
      <span className="text-sm text-[#dbdee1]">{name}</span>
    </div>
  );
};

export interface AutoComponentProps {
  component: ComponentNode;
}

/** Dispatch a non-container component to its preview. */
export const AutoComponent = ({ component }: AutoComponentProps) => {
  switch (component.type) {
    case ComponentType.TextDisplay:
      return <TextDisplayPreview component={component} />;
    case ComponentType.Separator:
      return <SeparatorPreview component={component} />;
    case ComponentType.Section:
      return <SectionPreview component={component} />;
    case ComponentType.MediaGallery:
      return <MediaGalleryPreview component={component} />;
    case ComponentType.File:
      return <FilePreview component={component} />;
    case ComponentType.ActionRow:
      return <ActionRowPreview component={component} />;
    case ComponentType.Button:
      return <ButtonPreview button={component} />;
    default:
      return null;
  }
};

export { TextDisplayPreview, SeparatorPreview, SectionPreview, MediaGalleryPreview, FilePreview };
export default AutoComponent;
