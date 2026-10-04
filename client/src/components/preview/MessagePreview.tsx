import { useEffect, useState } from "react";
import { Bot, Eye, Info, FileText, Link2, Music } from "lucide-react";
import type { ComponentNode } from "@dmb/shared";
import { ComponentType, MessageFlags } from "@dmb/shared";
import { Markdown } from "./Markdown";
import { EmbedPreview } from "./EmbedPreview";
import { ContainerPreview } from "./ContainerPreview";
import { AutoComponent } from "./ComponentPreview";
import { useMessage } from "../../hooks/useMessage";
import { useGlobalStore } from "../../store/globalStore";
import { useMessageStore, type AttachedFile } from "../../store/messageStore";
import { EDITOR_MODES } from "../../utils/constants";

/**
 * Live preview of the message as Discord would render it.
 *
 * This is the feedback loop that makes the editor usable, so it aims for visual
 * fidelity rather than structural reuse: embeds, Components V2 blocks and the
 * message chrome are all reproduced with Discord's real colours and spacing.
 *
 * The clock is captured once on mount and refreshed on a timer so the preview
 * doesn't jitter on every keystroke.
 */
const TopLevelComponent = ({ component }: { component: ComponentNode }) =>
  component.type === ComponentType.Container ? (
    <ContainerPreview component={component} />
  ) : (
    <AutoComponent component={component} />
  );

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const AttachmentPreviewItem = ({ file }: { file: AttachedFile }) => {
  const [spoilerHidden, setSpoilerHidden] = useState(Boolean(file.spoiler));
  const isUrl = Boolean(file.url && !file.file);
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const isAudio = file.type.startsWith("audio/");

  if (isImage) {
    return (
      <div className="relative inline-block max-w-sm rounded-lg overflow-hidden border border-[#232428] bg-[#2b2d31]">
        {spoilerHidden ? (
          <div
            onClick={() => setSpoilerHidden(false)}
            className="cursor-pointer bg-black/80 backdrop-blur-md p-6 flex flex-col items-center justify-center min-w-[200px] min-h-[140px] select-none hover:bg-black/85 transition-colors"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-white bg-black/60 px-3 py-1 rounded-full border border-white/20">
              Spoiler
            </span>
            <span className="text-[11px] text-[#949ba4] mt-2">Click to view</span>
          </div>
        ) : (
          <div className="relative group">
            <img
              src={file.previewUrl}
              alt={file.name}
              className="max-h-72 max-w-full rounded-md object-contain"
            />
            {file.spoiler && (
              <button
                type="button"
                onClick={() => setSpoilerHidden(true)}
                className="absolute top-2 right-2 bg-black/70 hover:bg-black/90 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                Hide
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="relative inline-block max-w-sm rounded-lg overflow-hidden border border-[#232428] bg-[#2b2d31]">
        {spoilerHidden ? (
          <div
            onClick={() => setSpoilerHidden(false)}
            className="cursor-pointer bg-black/80 backdrop-blur-md p-6 flex flex-col items-center justify-center min-w-[200px] min-h-[140px] select-none hover:bg-black/85 transition-colors"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-white bg-black/60 px-3 py-1 rounded-full border border-white/20">
              Spoiler
            </span>
            <span className="text-[11px] text-[#949ba4] mt-2">Click to view video</span>
          </div>
        ) : (
          <video
            src={file.previewUrl}
            controls
            className="max-h-72 max-w-full rounded-md"
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative flex items-center gap-3 p-3 rounded-lg bg-[#2b2d31] border border-[#1e1f22] max-w-sm">
      <div className="p-2.5 rounded-md bg-[#1e1f22] text-[#949ba4] shrink-0">
        {isUrl ? <Link2 size={22} /> : isAudio ? <Music size={22} /> : <FileText size={22} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-[#5865f2] truncate" title={file.url ?? file.name}>
          {file.spoiler ? `SPOILER_${file.name}` : file.name}
        </p>
        <p className="text-[11px] text-[#949ba4] mt-0.5">
          {isUrl ? "External URL" : formatBytes(file.size)}
        </p>
      </div>
    </div>
  );
};

export const MessagePreview = () => {
  const { mode, data, payload, isEmpty } = useMessage();
  const { botIdentity } = useGlobalStore();
  const attachedFiles = useMessageStore((state) => state.attachedFiles);
  const [now, setNow] = useState(() => new Date());

  // Refresh the "Today at …" label every minute.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const defaultDiscordAvatar = (() => {
    if (!botIdentity?.id || !/^\d+$/.test(botIdentity.id)) return null;
    try {
      return `https://cdn.discordapp.com/embed/avatars/${(BigInt(botIdentity.id) >> 22n) % 6n}.png`;
    } catch {
      return null;
    }
  })();
  const effectiveAvatar =
    data.avatar_url || botIdentity?.avatar || defaultDiscordAvatar;
  const effectiveUsername =
    data.username || botIdentity?.username || "Message Builder";
  const isV2 = mode === EDITOR_MODES.V2;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-line bg-chrome px-4 py-2.5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-strong">
          <Eye size={14} /> Preview
        </h2>
        <span className="rounded-md bg-raised px-2 py-0.5 text-[10px] font-medium text-ink-muted">
          {isV2 ? "Components V2" : "Classic"}
        </span>
      </div>

      {/* Discord's chat background, kept literal so the preview reads as Discord. */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#313338] p-4">
        {isEmpty ? (
          <p className="flex items-center gap-2 text-xs text-ink-faint">
            <Info size={13} /> Nothing to preview yet.
          </p>
        ) : (
          <div className="flex gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-blurple">
              {effectiveAvatar ? (
                <img
                  src={effectiveAvatar}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    if (defaultDiscordAvatar && e.currentTarget.src !== defaultDiscordAvatar) {
                      e.currentTarget.src = defaultDiscordAvatar;
                    } else {
                      e.currentTarget.style.display = "none";
                    }
                  }}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  <Bot size={18} className="text-white" />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                <span className="text-[15px] font-medium text-[#f2f3f5]">{effectiveUsername}</span>
                <span className="rounded bg-blurple px-1 py-px text-[10px] font-semibold text-white">
                  APP
                </span>
                <span className="text-xs text-[#949ba4]">
                  Today at {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </p>

              <div className="mt-0.5 space-y-2">
                {/* Unified preview: render content, embeds, components, and attached files */}
                {payload.content && (
                  <Markdown content={payload.content} className="text-[15px] text-[#dbdee1]" />
                )}

                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 pb-1">
                    {attachedFiles.map((file) => (
                      <AttachmentPreviewItem key={file.id} file={file} />
                    ))}
                  </div>
                )}

                {data.embeds &&
                  data.embeds.map((embed) => <EmbedPreview key={embed._id} embed={embed} />)}

                {data.components &&
                  data.components.map((component) => (
                    <div key={component._id}>
                      <TopLevelComponent component={component} />
                    </div>
                  ))}
              </div>

              {isV2 && (
                <p className="mt-3 font-mono text-[10px] text-ink-faint">
                  flags: {MessageFlags.IsComponentsV2} (IsComponentsV2)
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagePreview;
