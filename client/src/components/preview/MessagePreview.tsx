import React, { useEffect, useState } from "react";
import { Bot, Eye, Info, FileText, Link2, Music } from "lucide-react";
import type { ComponentNode, MessageData } from "@dmb/shared";
import { ComponentType, MessageFlags } from "@dmb/shared";
import { Markdown } from "./Markdown";
import { EmbedPreview } from "./EmbedPreview";
import { ContainerPreview } from "./ContainerPreview";
import { AutoComponent } from "./ComponentPreview";
import { useGlobalStore } from "../../store/globalStore";
import { useMessageStore, type AttachedFile } from "../../store/messageStore";

const TopLevelComponent = ({ component }: { component: ComponentNode }) => {
  if (component.type === ComponentType.Container) {
    return <ContainerPreview component={component} />;
  }
  return <AutoComponent component={component} />;
};

const AttachmentPreviewItem = ({ file }: { file: AttachedFile }) => {
  const isImage = file.type.startsWith("image/");
  const isAudio = file.type.startsWith("audio/");

  if (isImage && file.previewUrl) {
    return (
      <div className="relative group max-w-[400px] rounded-lg overflow-hidden border border-[#3f4147] bg-[#2b2d31]">
        {file.spoiler ? (
          <div className="relative">
            <img
              src={file.previewUrl}
              alt={file.name}
              className="max-h-[300px] w-auto rounded filter blur-lg object-contain"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 font-semibold text-xs text-white uppercase tracking-wider">
              Spoiler
            </div>
          </div>
        ) : (
          <img
            src={file.previewUrl}
            alt={file.name}
            className="max-h-[300px] w-auto rounded object-contain"
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-[#3f4147] bg-[#2b2d31] max-w-[400px]">
      <div className="p-2 rounded bg-[#1e1f22] text-[#5865f2] shrink-0">
        {file.url ? <Link2 size={20} /> : isAudio ? <Music size={20} /> : <FileText size={20} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {file.spoiler && (
            <span className="bg-[#1e1f22] text-[#f28b8b] text-[10px] font-bold px-1.5 py-0.5 rounded">
              SPOILER
            </span>
          )}
          <span className="text-xs font-semibold text-white truncate block">{file.name}</span>
        </div>
        <span className="text-[11px] text-[#949ba4] block">
          {file.url ? "External URL attachment" : `${(file.size / 1024).toFixed(1)} KB`}
        </span>
      </div>
    </div>
  );
};

export const MessagePreview: React.FC = () => {
  const messages = useMessageStore((state) => state.messages);
  const activeIndex = useMessageStore((state) => state.activeMessageIndex);
  const setActiveIndex = useMessageStore((state) => state.setActiveMessageIndex);
  const attachedFiles = useMessageStore((state) => state.attachedFiles);
  const botIdentity = useGlobalStore((state) => state.botIdentity);
  const globalMode = useMessageStore((state) => state.mode);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const totalEmbeds = messages.reduce((acc, m) => acc + (m.embeds?.length ?? 0), 0);
  const totalContentLength = messages.reduce((acc, m) => acc + (m.content?.length ?? 0), 0);
  const totalComponents = messages.reduce((acc, m) => acc + (m.components?.length ?? 0), 0);
  const isEmpty =
    totalContentLength === 0 &&
    totalEmbeds === 0 &&
    totalComponents === 0 &&
    attachedFiles.length === 0;

  return (
    <div className="flex h-full flex-col bg-[#313338] text-[#dbdee1] select-text">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-[#1e1f22] px-4 py-2.5 text-xs font-medium text-[#949ba4] bg-[#2b2d31]/50">
        <span className="flex items-center gap-1.5 uppercase tracking-wide font-bold">
          <Eye size={14} className="text-[#5865f2]" />
          Preview
        </span>
        <span className="text-[11px] bg-[#1e1f22] px-2 py-0.5 rounded text-[#dbdee1]">
          {messages.length} Message{messages.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Main Chat Stream */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 custom-scrollbar space-y-1">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-[#949ba4] py-16">
            <Info size={32} className="mb-3 text-[#4e5058]" />
            <p className="text-sm font-semibold text-[#dbdee1]">Your preview will appear here</p>
            <p className="max-w-xs text-xs mt-1 text-[#949ba4] leading-relaxed">
              Add text, an embed, or interactive Discord components in the left editor to preview them live.
            </p>
          </div>
        ) : (
          messages.map((message: MessageData, msgIndex: number) => {
            const prevMessage = msgIndex > 0 ? messages[msgIndex - 1] : null;

            // Group consecutive messages by same author
            const isSameAuthor = Boolean(
              prevMessage &&
                (prevMessage.username || "") === (message.username || "") &&
                (prevMessage.avatar_url || "") === (message.avatar_url || "")
            );

            const resolvedAvatar =
              message.avatar_url?.trim() ||
              botIdentity?.avatar ||
              "https://cdn.discordapp.com/embed/avatars/0.png";

            const resolvedUsername =
              message.username?.trim() || botIdentity?.username || "Message Builder";

            const isV2Message =
              Boolean(message.flags && (message.flags & MessageFlags.IsComponentsV2) !== 0) ||
              globalMode === "v2";

            const isActive = activeIndex === msgIndex;

            const classicActionRows = (message.components || []).filter(
              (c) => c.type === ComponentType.ActionRow
            );
            const v2Components = message.components || [];

            return (
              <div
                key={msgIndex}
                onClick={() => setActiveIndex(msgIndex)}
                className={`group rounded-lg px-2.5 py-1 transition-all cursor-pointer border ${
                  isActive
                    ? "bg-[#2e3035]/80 border-[#5865f2]/40 shadow-sm"
                    : "hover:bg-[#2e3035]/40 border-transparent"
                } ${isSameAuthor ? "mt-0.5" : "mt-3.5 first:mt-0"}`}
              >
                {!isSameAuthor ? (
                  <div className="flex gap-4">
                    <img
                      src={resolvedAvatar}
                      alt=""
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://cdn.discordapp.com/embed/avatars/0.png";
                      }}
                      className="h-10 w-10 shrink-0 rounded-full object-cover mt-0.5 shadow-sm"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-white hover:underline text-[15px]">
                          {resolvedUsername}
                        </span>

                        <span className="inline-flex items-center gap-0.5 rounded bg-[#5865f2] px-1 py-0.5 text-[10px] font-bold text-white uppercase leading-none">
                          <Bot size={10} />
                          APP
                        </span>

                        <span className="text-xs text-[#949ba4]">
                          Today at{" "}
                          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      <div className="mt-1 space-y-2">
                        {isV2Message ? (
                          <div className="space-y-2">
                            {v2Components.map((component) => (
                              <div key={component._id}>
                                <TopLevelComponent component={component} />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            {message.content && (
                              <Markdown
                                content={message.content}
                                className="text-[15px] text-[#dbdee1]"
                              />
                            )}

                            {isActive && attachedFiles.length > 0 && (
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

                            {classicActionRows.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                {classicActionRows.map((row) => (
                                  <div key={row._id}>
                                    <TopLevelComponent component={row} />
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-4">
                    <div className="w-10 shrink-0 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] text-[#949ba4] font-mono select-none">
                        {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      {isV2Message ? (
                        <div className="space-y-2">
                          {v2Components.map((component) => (
                            <div key={component._id}>
                              <TopLevelComponent component={component} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          {message.content && (
                            <Markdown
                              content={message.content}
                              className="text-[15px] text-[#dbdee1]"
                            />
                          )}

                          {isActive && attachedFiles.length > 0 && (
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

                          {classicActionRows.length > 0 && (
                            <div className="space-y-1.5 pt-1">
                              {classicActionRows.map((row) => (
                                <div key={row._id}>
                                  <TopLevelComponent component={row} />
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MessagePreview;