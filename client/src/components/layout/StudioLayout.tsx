import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, DownloadCloud, Edit3, Eye, Plus, Send } from "lucide-react";
import { Header } from "./Header";
import { MessageEditor } from "../editor/MessageEditor";
import { MessagePreview } from "../preview/MessagePreview";
import { CultMorphSurface } from "../ui/CultSkiperPrimitives";
import { CountUpNumber } from "../reactbits/ReactBitsPrimitives";
import { useMessageStore, type Selection, type EmbedPreviewPart } from "../../store/messageStore";
import { useActionStore } from "../../store/actionStore";
import { useTemplateStore } from "../../store/templateStore";
import { useGlobalStore } from "../../store/globalStore";
import { UI_THEME_CONFIG } from "../../config/uiThemeConfig";
import { SplitPane } from "./SplitPane";
import { focusMessageEditor, initializeEditorLenis, scrollToMessageEditor } from "../../utils/editorSmoothScroll";
import { applyPreviewComponentSelection } from "../../utils/previewSelection";
import { STARTER_BLUEPRINTS } from "../../utils/starterBlueprints";
import { request } from "../../api/client";
import { SortableItem, SortableList } from "../ui/SortableList";

const PropertyPanel = React.lazy(() =>
  import("../editor/PropertyPanel").then((module) => ({ default: module.PropertyPanel })),
);
const ImportLiveMessageModal = React.lazy(() => import("./ImportLiveMessageModal").then((module) => ({ default: module.ImportLiveMessageModal })));
const ScheduledMessageModal = React.lazy(() => import("./ScheduledMessageModal").then((module) => ({ default: module.ScheduledMessageModal })));

export const StudioLayout: React.FC = () => {
  const [mobileView, setMobileView] = useState<"editor" | "preview">("editor");
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const editorScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const channelId = params.get("importChannel");
    const messageId = params.get("importMessage");
    if (!channelId || !messageId) return;

    params.delete("importChannel");
    params.delete("importMessage");
    const remainingQuery = params.toString();
    const cleanUrl = `${window.location.pathname}${remainingQuery ? `?${remainingQuery}` : ""}${window.location.hash}`;
    window.history.replaceState({}, document.title, cleanUrl);

    if (!/^\d{17,20}$/.test(channelId) || !/^\d{17,20}$/.test(messageId)) {
      useGlobalStore.getState().showToast("The Discord import link contains an invalid ID.", "error");
      return;
    }

    void request<{ data: any; mode: "classic" | "v2" }>(
      `/api/discord/messages/${encodeURIComponent(channelId)}/${encodeURIComponent(messageId)}`,
    ).then((result) => {
      useMessageStore.getState().load({ data: result.data, mode: result.mode as any });
      useGlobalStore.getState().showToast("Discord message restored into HoHo Studio.", "success");
      setMobileView("editor");
    }).catch((error) => {
      useGlobalStore.getState().showToast(
        error instanceof Error ? error.message : "Could not restore the Discord message.",
        "error",
      );
    });
  }, []);

  useEffect(() => {
    const wrapper = editorScrollRef.current;
    if (!wrapper) return;
    return initializeEditorLenis(wrapper);
  }, []);

  const isMobileWorkspace = () => window.matchMedia("(max-width: 1199px)").matches;

  const handlePreviewMessageSelect = (index: number) => {
    // On mobile, keep Preview visible and open a compact message-content inspector.
    // On desktop, reveal the editor card before scrolling/focusing its first field.
    const store = useMessageStore.getState();
    store.setActiveMessageIndex(index);
    store.select({ kind: "message", index });
    if (isMobileWorkspace()) return;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrollToMessageEditor(index);
      focusMessageEditor(index);
      store.select(null);
    }));
  };

  const handlePreviewComponentSelect = (index: number, componentId: string, isInteractive: boolean) => {
    applyPreviewComponentSelection({
      index,
      componentId,
      isInteractive,
      isMobileWorkspace: isMobileWorkspace(),
      store: useMessageStore.getState(),
      navigateToEditor: () => {
        requestAnimationFrame(() => requestAnimationFrame(() => scrollToMessageEditor(index, componentId)));
      },
    });
  };

  const handlePreviewEmbedSelect = (
    index: number,
    embedId: string,
    part?: EmbedPreviewPart,
    fieldId?: string,
  ) => {
    const store = useMessageStore.getState();
    store.setActiveMessageIndex(index);
    store.select({ kind: "embed", id: embedId, part, fieldId });

    if (!isMobileWorkspace()) {
      requestAnimationFrame(() => requestAnimationFrame(() => scrollToMessageEditor(index, embedId, part, fieldId)));
    }
  };

  const scrollSelectedTargetIntoEditor = (selection?: Selection) => {
    const store = useMessageStore.getState();
    const index = selection?.kind === "message" ? selection.index : store.activeMessageIndex;
    const targetId =
      selection?.kind === "embed" || selection?.kind === "component"
        ? selection.id
        : undefined;
    const targetPart = selection?.kind === "embed" ? selection.part : undefined;
    const fieldId = selection?.kind === "embed" ? selection.fieldId : undefined;

    store.setActiveMessageIndex(index);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrollToMessageEditor(index, targetId, targetPart, fieldId);
      store.select(null);
    }));
  };

  const handleOpenFullEditor = (selection?: Selection) => {
    setMobileView("editor");
    scrollSelectedTargetIntoEditor(selection);
  };

  const currentUser = useGlobalStore((state) => state.currentUser);
  const setConfigModalOpen = useGlobalStore((state) => state.setConfigModalOpen);
  const setBackupsModalOpen = useGlobalStore((state) => state.setBackupsModalOpen);
  const setJsonModalOpen = useGlobalStore((state) => state.setJsonModalOpen);
  const openBotModal = useGlobalStore((state) => state.openBotModal);
  const showToast = useGlobalStore((state) => state.showToast);
  const openConfirm = useGlobalStore((state) => state.openConfirm);

  const addMessage = useMessageStore((state) => state.addMessage);
  const displayMessages = useMessageStore((state) => state.messages);
  const reorderMessages = useMessageStore((state) => state.reorderMessages);
  // Jakob's Law: Familiar Studio Keyboard Shortcuts (Ctrl/Cmd+S -> Backups, Ctrl/Cmd+Enter -> Dispatch)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditingText =
        Boolean(target?.closest("input, textarea, [contenteditable='true']"));
      if ((event.metaKey || event.ctrlKey) && !isEditingText) {
        const key = event.key.toLowerCase();
        if (key === "z") {
          event.preventDefault();
          if (event.shiftKey) useMessageStore.getState().redo();
          else useMessageStore.getState().undo();
          return;
        }
        if (key === "y" && event.ctrlKey) {
          event.preventDefault();
          useMessageStore.getState().redo();
          return;
        }
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setBackupsModalOpen(true);
      } else if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        openBotModal("send");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setBackupsModalOpen, openBotModal]);

  const handleClearAll = () => {
    openConfirm({
      title: "Clear All Messages",
      message: "Clear all messages and start fresh?",
      confirmLabel: "Clear All",
      danger: true,
      onConfirm: () => {
        useMessageStore.getState().reset();
        useActionStore.getState().reset();
        useTemplateStore.getState().detach();
        showToast("Cleared all messages.", "info");
      },
    });
  };

  return (
    <div className={UI_THEME_CONFIG.surfaces.appShell}>
      <Header
        onOpenBackups={() => setBackupsModalOpen(true)}
        onOpenJson={() => setJsonModalOpen(true)}
        onClearAll={handleClearAll}
        onOpenSend={openBotModal}
      />

      {currentUser && !currentUser.hasDefaultBotAccess && !currentUser.isAdmin && (
        <div className="bg-[#f0b232]/15 border-b border-[#f0b232]/30 px-3 py-1 flex items-center justify-between text-[0.6875rem] shrink-0">
          <span className="text-[#F1F3F9] truncate">
            <strong className="text-[#f0b232]">Server Bot Access Required:</strong> Ask a Head Admin to grant access to the configured server bot.
          </span>
          <button
            type="button"
            onClick={() => setConfigModalOpen(true)}
            className="px-2 py-0.5 rounded bg-[#f0b232] text-[#111214] font-bold hover:bg-[#f0b232]/90 transition-colors shrink-0 ml-2"
          >
            View Bot Access
          </button>
        </div>
      )}

      <main className="relative flex min-h-0 flex-1 overflow-hidden">
        <SplitPane
          initialRatio={0.5}
          left={
            <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-[#0B0D12] min-[1200px]:rounded-[10px] min-[1200px]:border min-[1200px]:border-[#272D3A]">
              <div ref={editorScrollRef} data-editor-scroll-container className="min-h-0 flex-1 overflow-y-auto bg-[#0B0D12] p-3 custom-scrollbar sm:p-4">
                <div data-editor-scroll-content className="space-y-3">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button type="button" onClick={() => setImportModalOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#272D3A] bg-[#161A23] px-2.5 py-1.5 text-[10px] font-semibold text-[#A1A8B8] transition-colors hover:border-[#818CF8] hover:text-white">
                      <DownloadCloud size={12} /> Import Live Message
                    </button>
                    <button type="button" onClick={() => setScheduleModalOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#272D3A] bg-[#161A23] px-2.5 py-1.5 text-[10px] font-semibold text-[#A1A8B8] transition-colors hover:border-[#818CF8] hover:text-white">
                      <CalendarClock size={12} /> Schedule
                    </button>
                  </div>
                  <SortableList
                    items={displayMessages.map((_, idx) => `message-${idx}`)}
                    onReorder={(activeId, overId) => reorderMessages(Number(activeId.slice(8)), Number(overId.slice(8)))}
                    strategy="vertical"
                    renderOverlay={(activeId) => `Message ${Number(activeId.slice(8)) + 1}`}
                    className="space-y-3"
                  >
                    {displayMessages.map((_, idx) => {
                      const id = `message-${idx}`;
                      return (
                        <SortableItem key={id} id={id}>
                          <MessageEditor index={idx} />
                        </SortableItem>
                      );
                    })}
                  </SortableList>
                  <CultMorphSurface
                    triggerLabel={<>Add Message (<CountUpNumber value={displayMessages.length} suffix="/10" />)</>}
                    triggerIcon={<Plus size={15} />}
                    title="Choose Message Mode"
                    disabled={displayMessages.length >= 10}
                    className="mt-2 pb-4"
                  >
                    <div className="space-y-2">
                      <button type="button" onClick={() => addMessage({ flags: 0 })} className="flex w-full items-start gap-3 rounded-lg border border-[#272D3A] bg-[#1D2230] p-3 text-left transition-colors hover:border-[#818CF8] hover:bg-[#252B3A]">
                        <div className="shrink-0 rounded bg-[#272D3A] p-2 font-mono text-xs font-bold text-[#F1F3F9]">TXT</div>
                        <div><p className="text-sm font-bold text-white">Standard Message (Classic)</p><p className="mt-0.5 text-xs text-[#A1A8B8]">Classic message with content, embeds, attachments, and action rows.</p></div>
                      </button>
                      <button type="button" onClick={() => addMessage({ flags: 32768, components: [{ _id: Math.random().toString(36).slice(2, 10), type: 10, content: "" }] })} className="flex w-full items-start gap-3 rounded-lg border border-[#272D3A] bg-[#1D2230] p-3 text-left transition-colors hover:border-[#818CF8] hover:bg-[#252B3A]">
                        <div className="shrink-0 rounded bg-[#818CF8]/20 p-2 font-mono text-xs font-bold text-[#949cf7]">V2</div>
                        <div><p className="text-sm font-bold text-white">Components V2 Message</p><p className="mt-0.5 text-xs text-[#A1A8B8]">Build layouts with containers, text blocks, galleries, files, separators, and action rows.</p></div>
                      </button>
                      <div className="border-t border-[#272D3A] pt-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#A1A8B8]">Start from a V2 Blueprint</p>
                        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {STARTER_BLUEPRINTS.map((blueprint) => (
                            <button
                              key={blueprint.id}
                              type="button"
                              onClick={() => {
                                const created = blueprint.create();
                                addMessage(created.message);
                                created.flows.forEach((flow) => useActionStore.getState().setFlow(flow.customId, flow.steps));
                                showToast(`${blueprint.title} added to Studio.`, "info");
                              }}
                              className="rounded-lg border border-[#272D3A] bg-[#161A23] p-2.5 text-left transition-colors hover:border-[#818CF8] hover:bg-[#252B3A]"
                            >
                              <span className="block text-xs font-semibold text-[#F1F3F9]">{blueprint.title}</span>
                              <span className="mt-0.5 block text-[10px] leading-relaxed text-[#A1A8B8]">{blueprint.description}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CultMorphSurface>
                </div>
              </div>
            </section>
          }
          right={
            <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none border-0 bg-[#313338] min-[1200px]:rounded-[10px] min-[1200px]:border min-[1200px]:border-[#272D3A]">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#313338]">
                <MessagePreview onSelectMessage={handlePreviewMessageSelect} onSelectPreviewComponent={handlePreviewComponentSelect} onSelectPreviewEmbed={handlePreviewEmbedSelect} />
              </div>
            </section>
          }
          mobileActivePane={mobileView === "editor" ? "left" : "right"}
          onMobilePaneChange={(pane) => {
            setMobileView(pane === "left" ? "editor" : "preview");
            if (pane === "left") scrollSelectedTargetIntoEditor(useMessageStore.getState().selection ?? undefined);
          }}
          className="min-h-0 min-w-0 flex-1"
        />
        <React.Suspense fallback={null}><PropertyPanel onOpenFullEditor={handleOpenFullEditor} /></React.Suspense>
      </main>

      <React.Suspense fallback={null}>
        <ImportLiveMessageModal open={importModalOpen} onClose={() => setImportModalOpen(false)} />
        <ScheduledMessageModal open={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} />
      </React.Suspense>

      {/* Native-feeling segmented mobile workspace dock */}
      <nav aria-label="Mobile workspace navigation" className="min-[1200px]:hidden flex items-center gap-2.5 border-t border-[#202531] bg-[#0D1017]/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md shrink-0 z-30">
        <div className="flex flex-1 items-center gap-1 rounded-xl border border-[#232836] bg-[#141821] p-1">
          <button type="button" onClick={() => setMobileView("editor")} aria-label="Editor" aria-pressed={mobileView === "editor"} className={`relative flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${mobileView === "editor" ? "border-[#818CF8]/40 bg-[#242A3A] text-[#F1F3F9] shadow-xs" : "border-transparent text-[#8B93A7] hover:text-[#F1F3F9]"}`}>
            <Edit3 size={14} /><span>Editor</span>
            <span className="rounded bg-black/20 px-1.5 py-0.5 font-mono text-[0.625rem]"><CountUpNumber value={displayMessages.length} /></span>
          </button>
          <button type="button" onClick={() => setMobileView("preview")} aria-label="Preview" aria-pressed={mobileView === "preview"} className={`relative flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${mobileView === "preview" ? "border-[#818CF8]/40 bg-[#242A3A] text-[#F1F3F9] shadow-xs" : "border-transparent text-[#8B93A7] hover:text-[#F1F3F9]"}`}>
            <Eye size={14} /><span>Preview</span>
          </button>
        </div>
        <button type="button" onClick={() => openBotModal("send")} aria-label="Dispatch" className="flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl bg-[#248046] px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1a6334] active:scale-[0.98]">
          <Send size={13} /><span>Dispatch</span>
        </button>
      </nav>
    </div>
  );
};

export default StudioLayout;
