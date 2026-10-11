import React, { useEffect, useState, useMemo } from "react";
import { Bot, Eye, Info, FileText, Link2, Music } from "lucide-react";
import type { ComponentNode } from "@dmb/shared";
import { ComponentType, MessageFlags } from "@dmb/shared";
import { Markdown } from "./Markdown";
import { EmbedPreview } from "./EmbedPreview";
import { ContainerPreview } from "./ContainerPreview";
import { AutoComponent } from "./ComponentPreview";
import { ActionRowPreview } from "./ActionRowPreview";
import { useGlobalStore } from "../../store/globalStore";
import { useMessageStore, type AttachedFile } from "../../store/messageStore";
import { EDITOR_MODES } from "../../utils/constants";

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
  const mode = useMessageStore((state) => state.mode);
  const messages = useMessageStore((state) => state.messages);
  const data = useMessageStore((state) => state.data);
  const activeMessageIndex = useMessageStore((state) => state.activeMessageIndex ?? 0);
  const setActiveMessageIndex = useMessageStore((state) => state.setActiveMessageIndex);
  const attachedFiles = useMessageStore((state) => state.attachedFiles);
  const botIdentity = useGlobalStore((state) => state.botIdentity);
  const displayMessages = useMemo(() => (messages && messages.length > 0 ? messages : [data]), [messages, data]);
  const [now, setNow] = useState(() => new Date());

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

  const isV2 = mode === EDITOR_MODES.V2;
  const isAllEmpty = displayMessages.every(
    (m) =>
      !m.content &&
      (!m.embeds || m.embeds.length === 0) &&
      (!m.components || m.components.length === 0) &&
      attachedFiles.length === 0,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-[#1e1f22] bg-[#2b2d31] px-4 py-2.5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-white">
          <Eye size={14} className="text-[#5865f2]" /> Preview
        </h2>
        <span className="rounded-md bg-[#1e1f22] px-2 py-0.5 text-[10px] font-medium text-[#949ba4]">
          {isV2 ? "Components V2" : "Classic"}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#313338] p-4 space-y-3 custom-scrollbar">
        {isAllEmpty ? (
          <p className="flex items-center gap-2 text-xs text-[#949ba4]">
            <Info size={13} /> Nothing to preview yet.
          </p>
        ) : (
          displayMessages.map((message, index) => {
            const isActive = index === activeMessageIndex;
            const effectiveAvatar =
              message.avatar_url || botIdentity?.avatar || defaultDiscordAvatar;
            const effectiveUsername =
              message.username || botIdentity?.username || "Message Builder";

            const prevMessage = index > 0 ? displayMessages[index - 1] : undefined;
            const prevAvatar =
              prevMessage?.avatar_url || botIdentity?.avatar || defaultDiscordAvatar;
            const prevUsername =
              prevMessage?.username || botIdentity?.username || "Message Builder";

            const isConsecutive =
              index > 0 &&
              effectiveUsername === prevUsername &&
              effectiveAvatar === prevAvatar;

            const actionRows = (message.components || []).filter(
              (c) => c.type === ComponentType.ActionRow,
            );

            return (
              <div
                key={index}
                onClick={() => setActiveMessageIndex?.(index)}
                className={`group relative flex gap-3 p-2.5 rounded-lg transition-all cursor-pointer ${
                  isActive
                    ? "ring-2 ring-[#5865f2] bg-[#5865f2]/5 shadow-sm"
                    : "hover:bg-[#2b2d31]/40"
                } ${
                  isConsecutive ? "pl-14 -mt-1" : "mt-2 first:mt-0"
                }`}
                title={`Message ${index + 1}${isActive ? " (Active)" : " - Click to edit"}`}
              >
                {!isConsecutive && (
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#5865f2]">
                    {effectiveAvatar ? (
                      <img
                        src={effectiveAvatar}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          if (
                            defaultDiscordAvatar &&
                            e.currentTarget.src !== defaultDiscordAvatar
                          ) {
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
                )}

                <div className="min-w-0 flex-1">
                  {!isConsecutive && (
                    <p className="flex items-center gap-2">
                      <span className="text-[15px] font-medium text-[#f2f3f5]">
                        {effectiveUsername}
                      </span>
                      <span className="rounded bg-[#5865f2] px-1 py-px text-[10px] font-semibold text-white">
                        APP
                      </span>
                      <span className="text-xs text-[#949ba4]">
                        Today at{" "}
                        {now.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </p>
                  )}

                  <div className="mt-0.5 space-y-2">
                    {isV2 ? (
                      <>
                        {message.components &&
                          message.components.map((component) => (
                            <div key={component._id}>
                              <TopLevelComponent component={component} />
                            </div>
                          ))}
                        <p className="mt-2 font-mono text-[10px] text-[#949ba4]">
                          flags: {MessageFlags.IsComponentsV2} (IsComponentsV2)
                        </p>
                      </>
                    ) : (
                      <>
                        {message.content && (
                          <Markdown
                            content={message.content}
                            className="text-[15px] text-[#dbdee1]"
                          />
                        )}

                        {index === activeMessageIndex && attachedFiles.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1 pb-1">
                            {attachedFiles.map((file) => (
                              <AttachmentPreviewItem key={file.id} file={file} />
                            ))}
                          </div>
                        )}

                        {message.embeds &&
                          message.embeds.map((embed) => (
                            <EmbedPreview key={embed._id} embed={embed} />
                          ))}

                        {actionRows.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {actionRows.map((row) => (
                              <ActionRowPreview key={row._id} component={row} />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default React.memo(MessagePreview);