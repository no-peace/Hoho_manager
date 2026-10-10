import React, { useEffect, useMemo, useState } from "react";
import { Eye, Info, Paperclip, MessageSquare } from "lucide-react";
import {
  ComponentType,
  EDITOR_MODES,
  MessageFlags,
  type ActionRowNode,
  type ComponentNode,
} from "@dmb/shared";
import { useMessageStore, type AttachedFile } from "../../store/messageStore";
import { useGlobalStore } from "../../store/globalStore";
import { Markdown } from "./Markdown";
import { EmbedPreview } from "./EmbedPreview";
import { ActionRowPreview } from "./ActionRowPreview";
import { ComponentPreview } from "./ComponentPreview";

const TopLevelComponent = ({ component }: { component: ComponentNode }) => {
  if (component.type === ComponentType.ActionRow) {
    return <ActionRowPreview component={component as ActionRowNode} />;
  }
  return <ComponentPreview component={component} />;
};

const AttachmentPreviewItem: React.FC<{ file: AttachedFile }> = ({ file }) => {
  const isImage = file.type.startsWith("image/");
  const isAudio = file.type.startsWith("audio/");
  const isVideo = file.type.startsWith("video/");

  if (isImage) {
    return (
      <div className="relative inline-block max-w-[400px] overflow-hidden rounded-lg border border-[#2b2d31] bg-[#1e1f22]">
        <img
          src={file.url}
          alt={file.name}
          className="max-h-[300px] w-auto object-contain"
        />
        {file.spoiler && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <span className="rounded bg-black/60 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-white">
              SPOILER
            </span>
          </div>
        )}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="relative max-w-[400px] overflow-hidden rounded-lg border border-[#2b2d31]">
        <video src={file.url} controls className="max-h-[300px] w-full" />
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="w-full max-w-[400px] rounded-lg border border-[#2b2d31] bg-[#2b2d31] p-2">
        <p className="mb-1 truncate text-xs text-[#dbdee1]">{file.name}</p>
        <audio src={file.url} controls className="w-full" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#2b2d31] bg-[#2b2d31] p-3 text-xs text-[#dbdee1] max-w-[320px]">
      <Paperclip size={18} className="text-[#949ba4] shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{file.name}</p>
        <p className="text-[10px] text-[#949ba4]">
          {(file.size / 1024).toFixed(1)} KB
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
  const [now, setNow] = useState(() => new Date());

  const displayMessages = useMemo(() => (messages && messages.length > 0 ? messages : [data]), [messages, data]);

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
          displayMessages.map((msg, index) => {
            const isActive = index === activeMessageIndex;
            const effectiveAvatar =
              msg.avatar_url || botIdentity?.avatar || defaultDiscordAvatar;
            const effectiveUsername =
              msg.username || botIdentity?.username || "Message Builder";

            const prevMsg = index > 0 ? displayMessages[index - 1] : undefined;
            const prevAvatar =
              prevMsg?.avatar_url || botIdentity?.avatar || defaultDiscordAvatar;
            const isGrouped =
              index > 0 &&
              (prevMsg?.username || botIdentity?.username) === effectiveUsername &&
              prevAvatar === effectiveAvatar;

            const actionRows =
              msg.components?.filter((c) => c.type === ComponentType.ActionRow) ?? [];

            return (
              <div
                key={index}
                onClick={() => setActiveMessageIndex?.(index)}
                className={`group relative rounded-md p-2 transition-all cursor-pointer ${
                  isActive
                    ? "ring-2 ring-[#5865f2] bg-[#5865f2]/5 shadow-sm"
                    : "hover:bg-[#2b2d31]/40"
                }`}
              >
                {displayMessages.length > 1 && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-medium text-[#949ba4] opacity-40 group-hover:opacity-100 transition-opacity">
                    <MessageSquare size={12} />
                    <span>Message {index + 1}</span>
                  </div>
                )}

                {msg.thread_name && index === 0 && (
                  <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-[#dbdee1] border-b border-[#3f4147] pb-1">
                    <span className="text-[#949ba4]">Thread:</span>
                    <span>{msg.thread_name}</span>
                  </div>
                )}

                <div className="flex gap-4">
                  <div className="w-10 shrink-0">
                    {!isGrouped && (
                      <div className="h-10 w-10 overflow-hidden rounded-full bg-[#5865f2] select-none">
                        {effectiveAvatar ? (
                          <img
                            src={effectiveAvatar}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                            {effectiveUsername.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {!isGrouped && (
                      <div className="flex items-baseline gap-2">
                        <span className="text-[15px] font-medium text-white hover:underline cursor-pointer">
                          {effectiveUsername}
                        </span>
                        <span className="rounded bg-[#5865f2] px-1 py-0.2 text-[10px] font-semibold text-white">
                          BOT
                        </span>
                        <time className="text-xs text-[#949ba4]">
                          Today at{" "}
                          {now.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                    )}

                    <div className="mt-0.5 space-y-2">
                      {isV2 ? (
                        <>
                          {msg.components &&
                            msg.components.map((component) => (
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
                          {msg.content && (
                            <Markdown
                              content={msg.content}
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

                          {msg.embeds &&
                            msg.embeds.map((embed) => (
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MessagePreview;