import React, { useEffect, useState, useMemo, Suspense } from "react";
import { Bot, Eye, FileText, Link2, Music, Play } from "lucide-react";
import type { ComponentNode, FlowStep } from "@dmb/shared";
import { ComponentType, MessageFlags } from "@dmb/shared";
import { Markdown } from "./Markdown";
import { EmbedPreview } from "./EmbedPreview";
import { UserPlaceholderPreviewProvider } from "./UserPlaceholderPreviewContent";
import { ContainerPreview } from "./ContainerPreview";
import { AutoComponent } from "./ComponentPreview";
import { ActionRowPreview } from "./ActionRowPreview";
import { useGlobalStore } from "../../store/globalStore";
import { useActionStore } from "../../store/actionStore";
import { useDiscordCacheStore } from "../../store/discordCacheStore";
import { useMessageStore, type AttachedFile, type EmbedPreviewPart } from "../../store/messageStore";
import { EDITOR_MODES } from "../../utils/constants";
import { scrollToMessageEditor } from "../../utils/editorSmoothScroll";
import { simulateFlow, type FlowSimulationResult } from "../../utils/flowSimulator";

const FlowSimulatorDrawer = React.lazy(() => import("./FlowSimulatorDrawer").then((module) => ({ default: module.FlowSimulatorDrawer })));

const findPreviewComponent = (nodes: ComponentNode[], id: string): ComponentNode | undefined => {
  for (const node of nodes) {
    if (node._id === id) return node;
    const nested = findPreviewComponent(node.components ?? [], id);
    if (nested) return nested;
    if (node.accessory?._id === id) return node.accessory;
  }
  return undefined;
};

const getModalFieldIds = (steps: FlowStep[]): string[] => {
  const ids = new Set<string>();
  const visit = (items: FlowStep[]) => items.forEach((step) => {
    const config = step.config ?? {};
    if (step.type === "open_modal") {
      const rows = Array.isArray(config.components) ? config.components : [];
      rows.forEach((row: any) => (row?.component ? [row.component] : Array.isArray(row?.components) ? row.components : []).forEach((field: any) => {
        const id = field?.custom_id ?? field?.customId;
        if (typeof id === "string" && id) ids.add(id);
      }));
    }
    ["then", "else", "pass", "fail"].forEach((key) => {
      const branch = config[key];
      if (Array.isArray(branch)) visit(branch as FlowStep[]);
    });
  });
  visit(steps);
  return [...ids];
};

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
            data-preview-ignore-message-navigation="true"
            className="cursor-pointer bg-black/80 backdrop-blur-md p-6 flex flex-col items-center justify-center min-w-[200px] min-h-[140px] select-none hover:bg-black/85 transition-colors"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-white bg-black/60 px-3 py-1 rounded-full border border-white/20">
              Spoiler
            </span>
            <span className="text-[0.6875rem] text-[#949ba4] mt-2">Click to view</span>
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
                className="absolute top-2 right-2 bg-black/70 hover:bg-black/90 text-white text-[0.625rem] uppercase font-bold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
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
            data-preview-ignore-message-navigation="true"
            className="cursor-pointer bg-black/80 backdrop-blur-md p-6 flex flex-col items-center justify-center min-w-[200px] min-h-[140px] select-none hover:bg-black/85 transition-colors"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-white bg-black/60 px-3 py-1 rounded-full border border-white/20">
              Spoiler
            </span>
            <span className="text-[0.6875rem] text-[#949ba4] mt-2">Click to view video</span>
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
        <p className="text-xs font-semibold text-[#949cf7] truncate" title={file.url ?? file.name}>
          {file.spoiler ? `SPOILER_${file.name}` : file.name}
        </p>
        <p className="text-[0.6875rem] text-[#b5bac1] mt-0.5">
          {isUrl ? "External URL" : formatBytes(file.size)}
        </p>
      </div>
    </div>
  );
};

interface MessagePreviewProps {
  onSelectMessage?: (index: number) => void;
  onSelectPreviewComponent?: (index: number, componentId: string, isInteractive: boolean) => void;
  onSelectPreviewEmbed?: (index: number, embedId: string, part?: EmbedPreviewPart, fieldId?: string) => void;
}

export const MessagePreview = ({ onSelectMessage, onSelectPreviewComponent, onSelectPreviewEmbed }: MessagePreviewProps) => {
  const messages = useMessageStore((state) => state.messages);
  const data = useMessageStore((state) => state.data);
  const activeMessageIndex = useMessageStore((state) => state.activeMessageIndex ?? 0);
  const setActiveMessageIndex = useMessageStore((state) => state.setActiveMessageIndex);
  const selectComponent = useMessageStore((state) => state.select);
  const attachedFiles = useMessageStore((state) => state.attachedFiles);
  const botIdentity = useGlobalStore((state) => state.botIdentity);
  const selectedGuildId = useGlobalStore((state) => state.selectedGuildId);
  const cachedRoles = useDiscordCacheStore((state) => selectedGuildId ? state.roles[selectedGuildId] ?? [] : []);
  const [testFlow, setTestFlow] = useState(false);
  const [simulationSteps, setSimulationSteps] = useState<FlowStep[] | null>(null);
  const [simulationResult, setSimulationResult] = useState<FlowSimulationResult | null>(null);
  const [simulatedRoleIds, setSimulatedRoleIds] = useState<string[]>([]);
  const [modalInputs, setModalInputs] = useState<Record<string, string>>({});
  const [simulationModalFieldIds, setSimulationModalFieldIds] = useState<string[]>([]);
  const [simulationSelectedValues, setSimulationSelectedValues] = useState<string[]>([]);
  const displayMessages = useMemo(
    () => (messages && messages.length > 0 ? messages : [data]),
    [messages, data]
  );
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!testFlow || !selectedGuildId || useDiscordCacheStore.getState().roles[selectedGuildId]) return;
    void useDiscordCacheStore.getState().fetchRoles(selectedGuildId);
  }, [testFlow, selectedGuildId]);

  useEffect(() => {
    if (!testFlow || !simulationSteps) return;
    setSimulationResult(simulateFlow(simulationSteps, {
      username: "DemoUser",
      userId: "123456789012345678",
      serverName: selectedGuildId ? "Selected Server" : "Example Server",
      serverId: selectedGuildId ?? undefined,
      heldRoleIds: simulatedRoleIds,
      modalInputs,
      selectedValues: simulationSelectedValues,
    }));
  }, [testFlow, simulationSteps, simulatedRoleIds, modalInputs, simulationSelectedValues, selectedGuildId]);

  const handleSelectMessage = (index: number) => {
    setActiveMessageIndex?.(index);
    if (onSelectMessage) onSelectMessage(index);
    else scrollToMessageEditor(index);
  };

  const handleMessageCardClick = (event: React.MouseEvent<HTMLDivElement>, index: number) => {
    const target = event.target as HTMLElement;
    // Preserve native preview interactions; only ordinary message content/card space navigates.
    if (
      target.closest(
        'button, a, input, textarea, select, video, audio, [role="button"], [data-preview-component-id], [data-preview-ignore-message-navigation]',
      )
    ) {
      return;
    }
    handleSelectMessage(index);
  };

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

  const activeMessage = displayMessages[activeMessageIndex] ?? data;
  const activeIsV2 =
    Boolean((activeMessage?.flags ?? 0) & MessageFlags.IsComponentsV2) ||
    (activeMessage as any)?.mode === EDITOR_MODES.V2;

  const isAllEmpty = displayMessages.every(
    (m) =>
      !m.content &&
      (!m.embeds || m.embeds.length === 0) &&
      (!m.components || m.components.length === 0) &&
      !m.poll &&
      attachedFiles.length === 0,
  );

  return (
    <UserPlaceholderPreviewProvider source={displayMessages}>
      <div className="relative flex h-full min-h-0 flex-1 flex-col select-text">
        {/* Enhanced Preview Toolbar */}
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-[#1e1f22] bg-[#2b2d31] px-3.5 py-1.5 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-white">
            <Eye size={14} className="text-[#5865f2]" /> Live Preview
          </h2>
          <span className="rounded-md bg-[#5865f2]/15 border border-[#5865f2]/30 px-2 py-0.5 text-[0.625rem] font-semibold text-[#b9bcf8]">
            Message {activeMessageIndex + 1}: {activeIsV2 ? "Components V2" : "Classic"}
          </span>
        </div>

        {/* Viewport Device & Density Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setTestFlow((value) => !value);
              setSimulationResult(null);
              setSimulationSteps(null);
            }}
            aria-pressed={testFlow}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818CF8] ${testFlow ? "border-[#818CF8]/60 bg-[#5865F2]/25 text-white" : "border-[#4e5058] bg-[#18191c] text-[#b5bac1] hover:text-white"}`}
          >
            <Play size={11} /> Test Flow
          </button>
          {displayMessages.length > 1 && (
            <div className="flex items-center gap-1 bg-[#18191c] p-0.5 rounded-lg border border-[#26282d] mr-1">
              {displayMessages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectMessage(i)}
                  className={`px-2 py-0.5 rounded-md text-[0.625rem] font-bold transition-colors ${
                    i === activeMessageIndex
                      ? "bg-[#5865f2] text-white shadow-xs"
                      : "text-[#949ba4] hover:text-white"
                  }`}
                  title={`View Message ${i + 1}`}
                >
                  #{i + 1}
                </button>
              ))}
            </div>
          )}

        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#313338] p-3 pb-24 sm:p-4 sm:pb-28 custom-scrollbar">
        {/* Responsive Discord Preview Container */}
        <div className="w-full max-w-4xl mx-auto ">

          {isAllEmpty ? (
            <div className="mx-auto flex min-h-40 max-w-md flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#4e5058] bg-[#2b2d31]/70 px-5 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1e1f22] text-[#6d717a]"><Bot size={20} /></div>
              <p className="text-xs font-medium text-[#b5bac1]">Nothing to preview yet — type content, add an embed, or insert a V2 component.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayMessages.map((message, index) => {
                const isActive = index === activeMessageIndex;
                const isMsgV2 =
                  Boolean((message.flags ?? 0) & MessageFlags.IsComponentsV2) ||
                  (message as any).mode === EDITOR_MODES.V2;

                const prevMessage = index > 0 ? displayMessages[index - 1] : null;
                const effectiveAvatar = message.avatar_url?.trim() || botIdentity?.avatar || defaultDiscordAvatar;
                const effectiveUsername = message.username?.trim() || botIdentity?.username || "Message Builder";
                const prevAvatar = prevMessage?.avatar_url?.trim() || botIdentity?.avatar || defaultDiscordAvatar;
                const prevUsername = prevMessage?.username?.trim() || botIdentity?.username || "Message Builder";

                const isConsecutive =
                  index > 0 &&
                  effectiveUsername === prevUsername &&
                  effectiveAvatar === prevAvatar;

                const actionRows = (message.components || []).filter(
                  (c) => c.type === ComponentType.ActionRow,
                );

                const timeString = now.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={index}
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      const embedElement = target.closest<HTMLElement>("[data-preview-embed-id]");
                      const embedId = embedElement?.dataset.previewEmbedId;
                      if (embedId) {
                        const partElement = target.closest<HTMLElement>("[data-preview-embed-part]");
                        const part = partElement?.dataset.previewEmbedPart as EmbedPreviewPart | undefined;
                        const fieldId = partElement?.dataset.previewEmbedFieldId;
                        if (target.closest("a")) event.preventDefault();
                        setActiveMessageIndex?.(index);
                        if (onSelectPreviewEmbed) {
                          onSelectPreviewEmbed(index, embedId, part, fieldId);
                        } else {
                          selectComponent({ kind: "embed", id: embedId, part, fieldId });
                        }
                        return;
                      }

                      const componentElement = target.closest<HTMLElement>("[data-preview-component-id]");
                      const componentId = componentElement?.dataset.previewComponentId;
                      if (componentId) {
                        const selectedOption = target.closest<HTMLElement>("[data-preview-select-value]")?.dataset.previewSelectValue;
                        const isInteractive = componentElement.dataset.previewInteractive === "true";
                        const component = findPreviewComponent(message.components ?? [], componentId);
                        const isSimulatable =
                          component?.type === ComponentType.Button
                            ? component.style !== 5 && component.style !== 6
                            : component?.type === ComponentType.StringSelect ||
                              component?.type === ComponentType.UserSelect ||
                              component?.type === ComponentType.RoleSelect ||
                              component?.type === ComponentType.ChannelSelect ||
                              component?.type === ComponentType.MentionableSelect;
                        if (testFlow && isSimulatable && (!isInteractive || selectedOption !== undefined)) {
                          const customId = component?._action_custom_id || component?.custom_id;
                          const steps = customId ? useActionStore.getState().getFlow(customId) : [];
                          setSimulationSteps(steps);
                          setSimulationSelectedValues(selectedOption ? [selectedOption] : []);
                          setSimulationModalFieldIds(getModalFieldIds(steps));
                          setModalInputs({});
                          setSimulationResult(simulateFlow(steps, {
                            username: "DemoUser",
                            userId: "123456789012345678",
                            serverName: selectedGuildId ? "Selected Server" : "Example Server",
                            serverId: selectedGuildId ?? undefined,
                            heldRoleIds: simulatedRoleIds,
                            selectedValues: selectedOption ? [selectedOption] : [],
                          }));
                          return;
                        }
                        if (isInteractive) {
                          onSelectPreviewComponent?.(index, componentId, true);
                          return;
                        }

                        setActiveMessageIndex?.(index);
                        if (onSelectPreviewComponent) {
                          onSelectPreviewComponent(index, componentId, false);
                        } else {
                          selectComponent({ kind: "component", id: componentId });
                        }
                        return;
                      }
                      handleMessageCardClick(event, index);
                    }}
                    className={`group relative flex gap-3 p-2.5 rounded-xl  cursor-pointer ${
                      isActive
                        ? "ring-2 ring-[#5865f2]/80 bg-[#5865f2]/5 shadow-sm"
                        : "hover:bg-[#2b2d31]/40"
                    } ${
                      isConsecutive ? "pl-14 -mt-1" : "mt-2 first:mt-0"
                    }`}
                    title={`Message ${index + 1}${isActive ? " (Active)" : " - Click to edit"}`}
                  >
                    {/* Discord-style avatar */}
                    {!isConsecutive && (
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#5865f2] border border-[#111214]/40">
                        {effectiveAvatar ? (
                          <img
                            src={effectiveAvatar}
                            alt=""
                            width={40}
                            height={40}
                            decoding="async"
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
                      {/* Discord-style message header */}
                      {!isConsecutive && (
                        <p className="flex items-center gap-2">
                          <span className="text-[0.9375rem] font-medium text-[#f2f3f5]">
                            {effectiveUsername}
                          </span>
                          <span className="rounded bg-[#5865f2] px-1 py-px text-[0.625rem] font-semibold text-white">
                            APP
                          </span>
                          <span className="text-xs text-[#949ba4]">
                            Today at {timeString}
                          </span>
                        </p>
                      )}


                      <div className="mt-0.5 space-y-2">
                        {isMsgV2 ? (
                          <div className="space-y-2 max-w-[520px]">
                            {message.components &&
                              message.components.map((component) => (
                                <div key={component._id}>
                                  <TopLevelComponent component={component} />
                                </div>
                              ))}
                            <p className="mt-2 font-mono text-[0.625rem] text-[#949ba4]">
                              flags: {MessageFlags.IsComponentsV2} (IsComponentsV2)
                            </p>
                          </div>
                        ) : (
                          <>
                            {message.content && (
                              <Markdown
                                content={message.content}
                                className="text-[0.9375rem] text-[#dbdee1] leading-relaxed break-words"
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
                            {message.poll && (
                              <div className="max-w-[520px] rounded-xl border border-[#4e5058] bg-[#2b2d31] p-3">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#949ba4]">Poll preview</span>
                                  <span className="text-[9px] text-[#949ba4]">{message.poll.duration}h · {message.poll.allow_multiselect ? "Multiple answers" : "One answer"}</span>
                                </div>
                                <p className="mb-3 text-sm font-semibold text-[#f2f3f5]">{message.poll.question.text}</p>
                                <div className="space-y-1.5">
                                  {message.poll.answers.map((answer, answerIndex) => (
                                    <div key={answerIndex} className="flex items-center gap-2 rounded-md border border-[#4e5058] bg-[#1e1f22] px-2.5 py-2">
                                      <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[#949ba4]" />
                                      <span className="min-w-0 flex-1 truncate text-xs text-[#dbdee1]">{answer.poll_media.text}</span>
                                    </div>
                                  ))}
                                </div>
                                <p className="mt-2 text-[9px] text-[#949ba4]">Vote controls appear after dispatching to Discord.</p>
                              </div>
                            )}

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
              })}
            </div>
          )}
        </div>
      </div>
      </div>
      {testFlow && simulationResult && (
        <div className="absolute inset-x-0 bottom-0 z-40 px-2 pb-2 sm:px-3">
          <Suspense fallback={<div className="rounded-t-xl border border-[#272D3A] bg-[#10131A] px-3 py-3 text-[11px] text-[#A1A8B8]">Loading flow simulator…</div>}>
            <FlowSimulatorDrawer
              result={simulationResult}
              roles={cachedRoles}
              heldRoleIds={simulatedRoleIds}
              modalFieldIds={simulationModalFieldIds}
              modalInputs={modalInputs}
              onToggleRole={(roleId) => setSimulatedRoleIds((current) => current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId])}
              onModalInputChange={(fieldId, value) => setModalInputs((current) => ({ ...current, [fieldId]: value }))}
              onClose={() => { setSimulationResult(null); setSimulationSteps(null); }}
            />
          </Suspense>
        </div>
      )}
    </UserPlaceholderPreviewProvider>
  );
};

export default React.memo(MessagePreview);