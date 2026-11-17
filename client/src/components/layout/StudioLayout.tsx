import React, { useEffect, useMemo, useRef, useState } from "react";
import { Edit3, Eye, Plus, Send } from "lucide-react";
import { motion } from "motion/react";
import { Header } from "./Header";
import { MessageEditor } from "../editor/MessageEditor";
import { MessagePreview } from "../preview/MessagePreview";
import { CultMorphSurface } from "../ui/CultSkiperPrimitives";
import { CountUpNumber, MagneticButton } from "../reactbits/ReactBitsPrimitives";
import { useMessageStore, type Selection, type EmbedPreviewPart } from "../../store/messageStore";
import { useActionStore } from "../../store/actionStore";
import { useTemplateStore } from "../../store/templateStore";
import { useGlobalStore } from "../../store/globalStore";
import { UI_THEME_CONFIG } from "../../config/uiThemeConfig";
import { SplitPane } from "./SplitPane";
import { focusMessageEditor, initializeEditorLenis, scrollToMessageEditor } from "../../utils/editorSmoothScroll";
import { applyPreviewComponentSelection } from "../../utils/previewSelection";
import { usePublishedAppLayout } from "../../hooks/usePublishedAppLayout";
import "../../styles/appLayoutRuntime.css";

const PropertyPanel = React.lazy(() =>
  import("../editor/PropertyPanel").then((module) => ({ default: module.PropertyPanel })),
);

export const StudioLayout: React.FC = () => {
  const publishedLayout = usePublishedAppLayout();
  const { layout, isDesktop, cssVariables } = publishedLayout;
  const activeLayout = isDesktop ? layout.desktop : layout.mobile;
  const [mobileView, setMobileView] = useState<"editor" | "preview">("editor");
  const mobilePaneTouched = useRef(false);
  const initialMobilePaneApplied = useRef(false);
  const editorScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!publishedLayout.isLoaded || initialMobilePaneApplied.current) return;
    if (!mobilePaneTouched.current) setMobileView(layout.mobile.defaultPane);
    initialMobilePaneApplied.current = true;
  }, [publishedLayout.isLoaded, layout.mobile.defaultPane]);

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
    mobilePaneTouched.current = true;
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

  const messages = useMessageStore((state) => state.messages);
  const data = useMessageStore((state) => state.data);
  const addMessage = useMessageStore((state) => state.addMessage);

  const displayMessages = useMemo(
    () => (messages && messages.length > 0 ? messages : [data]),
    [messages, data],
  );

  // Jakob's Law: Familiar Studio Keyboard Shortcuts (Ctrl/Cmd+S -> Backups, Ctrl/Cmd+Enter -> Dispatch)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
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
    <div
      className={UI_THEME_CONFIG.surfaces.appShell + " hoho-studio-shell"}
      style={cssVariables as React.CSSProperties}
      data-hoho-layout-fallback={publishedLayout.isFallback ? "true" : "false"}
    >
      <Header
        onOpenBackups={() => setBackupsModalOpen(true)}
        onOpenJson={() => setJsonModalOpen(true)}
        onClearAll={handleClearAll}
        onOpenSend={openBotModal}
        runtimeMotion={activeLayout.headerMotion}
      />

      {currentUser && !currentUser.hasDefaultBotAccess && !currentUser.isAdmin && (
        <div className="bg-[#f0b232]/15 border-b border-[#f0b232]/30 px-3 py-1 flex items-center justify-between text-[0.6875rem] shrink-0">
          <span className="text-[#F1F3F9] truncate">
            <strong className="text-[#f0b232]">Custom Bot Mode:</strong> Use your own Bot Profile to dispatch messages.
          </span>
          <button
            type="button"
            onClick={() => setConfigModalOpen(true)}
            className="px-2 py-0.5 rounded bg-[#f0b232] text-[#111214] font-bold hover:bg-[#f0b232]/90 transition-colors shrink-0 ml-2"
          >
            Configure Bot
          </button>
        </div>
      )}

      <main className="relative flex min-h-0 flex-1 overflow-hidden">
        <SplitPane
          initialRatio={layout.desktop.editorRatio / 100}
          panelOrder={layout.desktop.panelOrder}
          workspaceMotion={layout.desktop.workspaceMotion}
          left={
            <section
              className="hoho-runtime-panel hoho-runtime-panel--editor"
              data-hoho-motion={activeLayout.editorMotion.animation}
              data-hoho-show-toolbar={activeLayout.showToolbar ? "show" : "hide"}
              style={{
                "--hoho-motion-duration": activeLayout.editorMotion.duration,
                "--hoho-motion-delay": activeLayout.editorMotion.delay,
              } as React.CSSProperties}
            >
              <div className="hoho-runtime-panel__heading"><h2>{activeLayout.editorLabel}</h2></div>
              <div ref={editorScrollRef} data-editor-scroll-container className="hoho-runtime-editor-scroll flex-1 overflow-y-auto custom-scrollbar">
                <div data-editor-scroll-content className="space-y-3">
                  {displayMessages.map((_, idx) => <MessageEditor key={idx} index={idx} />)}
                  <CultMorphSurface
                    triggerLabel={<>Add Message (<CountUpNumber value={displayMessages.length} suffix="/10" />)</>}
                    triggerIcon={<Plus size={15} />}
                    title="Choose Message Mode"
                    disabled={displayMessages.length >= 10}
                    className="mt-2 pb-4"
                  >
                    <div className="space-y-2">
                      <button type="button" onClick={() => addMessage({ flags: 0 })} className="flex w-full items-start gap-3 rounded-lg border border-[#272D3A] bg-[#2b2d31] p-3 text-left transition-colors hover:border-[#818CF8] hover:bg-[#252B3A]">
                        <div className="shrink-0 rounded bg-[#272D3A] p-2 font-mono text-xs font-bold text-[#F1F3F9]">TXT</div>
                        <div><p className="text-sm font-bold text-white">Standard Message (Classic)</p><p className="mt-0.5 text-xs text-[#A1A8B8]">Classic message with content, embeds, attachments, and action rows.</p></div>
                      </button>
                      <button type="button" onClick={() => addMessage({ flags: 32768, components: [{ _id: Math.random().toString(36).slice(2, 10), type: 10, content: "" }] })} className="flex w-full items-start gap-3 rounded-lg border border-[#272D3A] bg-[#2b2d31] p-3 text-left transition-colors hover:border-[#818CF8] hover:bg-[#252B3A]">
                        <div className="shrink-0 rounded bg-[#818CF8]/20 p-2 font-mono text-xs font-bold text-[#949cf7]">V2</div>
                        <div><p className="text-sm font-bold text-white">Components V2 Message</p><p className="mt-0.5 text-xs text-[#A1A8B8]">Build layouts with containers, text blocks, galleries, files, separators, and action rows.</p></div>
                      </button>
                    </div>
                  </CultMorphSurface>
                </div>
              </div>
            </section>
          }
          right={
            <section
              className="hoho-runtime-panel hoho-runtime-panel--preview"
              data-hoho-motion={activeLayout.previewMotion.animation}
              style={{
                "--hoho-motion-duration": activeLayout.previewMotion.duration,
                "--hoho-motion-delay": activeLayout.previewMotion.delay,
              } as React.CSSProperties}
            >
              <div className="hoho-runtime-panel__heading"><h2>{activeLayout.previewLabel}</h2></div>
              <div className="hoho-runtime-preview-scroll flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <MessagePreview onSelectMessage={handlePreviewMessageSelect} onSelectPreviewComponent={handlePreviewComponentSelect} onSelectPreviewEmbed={handlePreviewEmbedSelect} />
              </div>
            </section>
          }
          mobileActivePane={mobileView === "editor" ? "left" : "right"}
          onMobilePaneChange={(pane) => {
            mobilePaneTouched.current = true;
            setMobileView(pane === "left" ? "editor" : "preview");
            if (pane === "left") scrollSelectedTargetIntoEditor(useMessageStore.getState().selection ?? undefined);
          }}
          className="min-h-0 min-w-0 flex-1"
        />
        <React.Suspense fallback={null}><PropertyPanel onOpenFullEditor={handleOpenFullEditor} runtimeLayout={activeLayout} /></React.Suspense>
      </main>

      {/* Fitts's Law Mobile / Tablet Bottom Navigation Bar (< 1200px) */}
      <nav
        aria-label="Mobile workspace navigation"
        className="hoho-runtime-nav min-[1200px]:hidden flex items-center backdrop-blur-md border-t shrink-0 gap-2 z-30 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        data-hoho-motion={layout.mobile.navMotion.animation}
        data-hoho-show-labels={layout.mobile.showLabels ? "show" : "hide"}
        data-hoho-tab-order={layout.mobile.tabOrder}
        style={{
          "--hoho-motion-duration": layout.mobile.navMotion.duration,
          "--hoho-motion-delay": layout.mobile.navMotion.delay,
        } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => { mobilePaneTouched.current = true; setMobileView("editor"); }}
          aria-label={layout.mobile.editorTabLabel}
          data-hoho-nav-item="editor"
          aria-pressed={mobileView === "editor"}
          className="relative flex-1 min-h-[40px] flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold text-[#b5bac1] transition-colors active:scale-[0.97] select-none"
        >
          {mobileView === "editor" && (
            <motion.span
              layoutId="mobileWorkspaceTab"
              className="hoho-runtime-nav-active absolute inset-0 rounded-lg"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <Edit3 size={14} className="relative z-10" />
          <span aria-hidden="true" className={`hoho-runtime-nav-label relative z-10 ${mobileView === "editor" ? "text-white" : ""}`}>
            {layout.mobile.editorTabLabel}
          </span>
          <span
            className={`relative z-10 text-[0.625rem] px-1.5 py-0.5 rounded bg-black/20 font-mono ${mobileView === "editor" ? "text-white" : ""}`}
          >
            <CountUpNumber value={displayMessages.length} />
          </span>
        </button>
        <button
          type="button"
          onClick={() => { mobilePaneTouched.current = true; setMobileView("preview"); }}
          aria-label={layout.mobile.previewTabLabel}
          data-hoho-nav-item="preview"
          aria-pressed={mobileView === "preview"}
          className="relative flex-1 min-h-[40px] flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold text-[#b5bac1] transition-colors active:scale-[0.97] select-none"
        >
          {mobileView === "preview" && (
            <motion.span
              layoutId="mobileWorkspaceTab"
              className="hoho-runtime-nav-active absolute inset-0 rounded-lg"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <Eye size={14} className="relative z-10" />
          <span aria-hidden="true" className={`hoho-runtime-nav-label relative z-10 ${mobileView === "preview" ? "text-white" : ""}`}>
            {layout.mobile.previewTabLabel}
          </span>
        </button>
        <MagneticButton className="shrink-0">
          <button
            type="button"
            onClick={() => openBotModal("send")}
            aria-label={layout.mobile.dispatchTabLabel}
            data-hoho-nav-item="dispatch"
            className="min-h-[40px] px-4 py-2.5 rounded-lg bg-[#248046] hover:bg-[#1a6334] text-white text-xs font-bold transition-[transform,background-color,color,box-shadow,opacity] duration-150 active:scale-[0.97] flex items-center gap-1.5 select-none shadow-md"
          >
            <Send size={13} />
            <span aria-hidden="true" className="hoho-runtime-nav-label">{layout.mobile.dispatchTabLabel}</span>
          </button>
        </MagneticButton>
      </nav>
    </div>
  );
};

export default StudioLayout;
