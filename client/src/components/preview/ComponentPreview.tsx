import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import type { ComponentNode } from "@dmb/shared";
import { ComponentType } from "@dmb/shared";
import { Markdown } from "./Markdown";
import { ActionRowPreview, ButtonPreview, SelectPreview } from "./ActionRowPreview";
import { useUserPlaceholderPreview } from "./UserPlaceholderPreviewContent";
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
  resolveUserPlaceholders: (value: string) => string,
): string | undefined => {
  if (!url) return undefined;

  const resolvedUrl = resolveUserPlaceholders(url);

  if (resolvedUrl.startsWith("attachment://")) {
    const filename = resolvedUrl.slice("attachment://".length);
    const match = attachedFiles.find(
      (f) => f.name === filename || `SPOILER_${f.name}` === filename,
    );
    if (match) return match.previewUrl;
  }
  return resolvedUrl;
};

const SectionPreview = ({ component }: { component: ComponentNode }) => {
  const attachedFiles = useMessageStore((s) => s.attachedFiles);
  const { resolveUserPlaceholders } = useUserPlaceholderPreview();
  const thumbnail = resolveAttachment(component.accessory?.media?.url, attachedFiles, resolveUserPlaceholders);
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
  const { resolveUserPlaceholders } = useUserPlaceholderPreview();
  if (items.length === 0) return <p className="text-xs text-[#949ba4]">No gallery images</p>;

  const cols = items.length === 1 ? "grid-cols-1" : items.length === 2 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className={`grid gap-1.5 ${cols}`}>
      {items.map((item) => (
        <img
          key={item._id}
          src={resolveAttachment(item.media.url, attachedFiles, resolveUserPlaceholders)}
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
  let preview: ReactNode = null;

  switch (component.type) {
    case ComponentType.TextDisplay:
      preview = <TextDisplayPreview component={component} />;
      break;
    case ComponentType.Separator:
      preview = <SeparatorPreview component={component} />;
      break;
    case ComponentType.Section:
      preview = <SectionPreview component={component} />;
      break;
    case ComponentType.MediaGallery:
      preview = <MediaGalleryPreview component={component} />;
      break;
    case ComponentType.File:
      preview = <FilePreview component={component} />;
      break;
    case ComponentType.ActionRow:
      preview = <ActionRowPreview component={component} />;
      break;
    case ComponentType.Button:
      preview = <ButtonPreview button={component} />;
      break;
    case ComponentType.StringSelect:
    case ComponentType.UserSelect:
    case ComponentType.RoleSelect:
    case ComponentType.MentionableSelect:
    case ComponentType.ChannelSelect:
      preview = <SelectPreview select={component} />;
      break;
    default:
      return null;
  }

  return (
    <div
      data-preview-component-id={component._id}
      className="min-w-0 cursor-pointer rounded-sm outline-offset-2 transition-[outline-color] hover:outline hover:outline-1 hover:outline-[#818CF8]/60 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#818CF8]/60"
    >
      {preview}
    </div>
  );
};
export { TextDisplayPreview, SeparatorPreview, SectionPreview, MediaGalleryPreview, FilePreview };
export default AutoComponent;
