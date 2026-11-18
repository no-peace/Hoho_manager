import { Copy, Trash2, X, Sliders, Workflow } from "lucide-react";
import { useState, useEffect } from "react";
import { ButtonStyle, ComponentType } from "@dmb/shared";
import { IconButton } from "../ui/Button";
import { FlowBuilder } from "../actions/FlowBuilder";
import { COMPONENT_FORMS } from "./ComponentForms";
import { EmbedEditor } from "./EmbedEditor";
import { componentLabel, isInteractiveComponent } from "../../utils/componentsV2";
import { findComponent, findFirstComponentByType } from "../../utils/tree";
import { EDITOR_MODES } from "../../utils/constants";
import { useMessageStore, type Selection } from "../../store/messageStore";
import { UI_THEME_CONFIG } from "../../config/uiThemeConfig";

type PanelTab = "properties" | "flow";

export const PropertyPanel = ({
  onOpenFullEditor,
}: {
  onOpenFullEditor?: (selection?: Selection) => void;
} = {}) => {
  const [activeTab, setActiveTab] = useState<PanelTab>("properties");
  const selection = useMessageStore((state) => state.selection);
  const activeMessageIndex = useMessageStore((state) => state.activeMessageIndex ?? 0);
  // Subscribe only to the message currently represented by the inspector.
  // Editing another message no longer rerenders this panel just because the
  // messages array received a new reference.
  const messageData = useMessageStore((state) => {
    const targetMessageIndex =
      state.selection?.kind === "message"
        ? state.selection.index
        : state.activeMessageIndex ?? 0;
    return state.messages?.[targetMessageIndex] ?? state.data;
  });
  const isV2Message =
    Boolean((messageData.flags ?? 0) & (1 << 15)) ||
    (messageData as any).mode === EDITOR_MODES.V2;
  const primaryTextDisplay = isV2Message
    ? findFirstComponentByType(messageData.components, ComponentType.TextDisplay)
    : undefined;
  const components = messageData.components || [];
  const select = useMessageStore((state) => state.select);
  const setContent = useMessageStore((state) => state.setContent);
  const setActiveMessageIndex = useMessageStore((state) => state.setActiveMessageIndex);
  const addComponent = useMessageStore((state) => state.addComponent);
  const updateComponentById = useMessageStore((state) => state.updateComponentById);
  const removeComponentById = useMessageStore((state) => state.removeComponentById);
  const duplicateComponentById = useMessageStore((state) => state.duplicateComponentById);

  useEffect(() => {
    setActiveTab("properties");
    if (!selection || selection.kind !== "component") return;
    const frame = window.requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>("[data-component-inspector-body]");
      const field = panel?.querySelector<HTMLElement>(
        "textarea:not([disabled]), input:not([disabled]):not([type=checkbox]):not([type=radio]), [contenteditable=true]",
      );
      if (!field) return;
      field.focus({ preventScroll: true });
      if (field instanceof HTMLTextAreaElement || (field instanceof HTMLInputElement && ["text", "search", "url", "tel", "password"].includes(field.type))) {
        const end = field.value.length;
        field.setSelectionRange(end, end);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selection, activeMessageIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") select(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [select]);

  if (selection?.kind === "message") {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-[#0B0D12]/55 backdrop-blur-[1px] min-[1200px]:hidden"
          onClick={() => select(null)}
        />
        <aside
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82dvh] flex-col rounded-t-[12px] border-t border-[#272D3A] bg-[#161A23] shadow-2xl min-[1200px]:hidden"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex justify-center pt-2 pb-1">
            <div className="h-1 w-10 rounded-full bg-[#252B3A]" />
          </div>
          <div className={UI_THEME_CONFIG.surfaces.inspectorHeader}>
            <div className="min-w-0 flex-1">
              <span className="mb-0.5 block text-[0.625rem] font-bold uppercase leading-4 tracking-[0.08em] text-[#A1A8B8]">Properties</span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#A1A8B8] block">Message Quick Edit</span>
              <h2 className="truncate text-base font-bold text-white">Message {selection.index + 1}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onOpenFullEditor?.(selection)} className="rounded-md border border-[#272D3A] bg-[#1D2230] px-2.5 py-1.5 text-[0.6875rem] font-semibold text-[#F1F3F9] hover:border-[#818CF8]/60 hover:bg-[#252B3A]">Open Full Editor</button>
              <IconButton icon={X} label="Close Message Editor" size={15} onClick={() => select(null)} />
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto p-3.5" data-message-quick-editor>
            <label htmlFor="preview-message-content" className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#A1A8B8]">
              {isV2Message ? "Text Display content" : "Message content"}
              {isV2Message && <span className="rounded border border-[#818CF8]/30 bg-[#818CF8]/10 px-1.5 py-0.5 text-[0.625rem] font-semibold text-[#A5B4FC]">Components V2 Text Block</span>}
            </label>
            <textarea
              id="preview-message-content"
              value={isV2Message ? (primaryTextDisplay?.content ?? "") : (messageData.content ?? "")}
              onChange={(event) => {
                if (selection.index !== activeMessageIndex) {
                  setActiveMessageIndex(selection.index);
                  select({ kind: "message", index: selection.index });
                }
                if (!isV2Message) {
                  setContent(event.target.value);
                  return;
                }
                if (primaryTextDisplay?._id) {
                  updateComponentById(primaryTextDisplay._id, { content: event.target.value });
                  return;
                }
                addComponent(ComponentType.TextDisplay);
                const createdSelection = useMessageStore.getState().selection;
                if (createdSelection?.kind === "component") {
                  updateComponentById(createdSelection.id, { content: event.target.value });
                  select({ kind: "message", index: selection.index });
                }
              }}
              placeholder="Write your message..."
              rows={6}
              className="w-full min-h-32 resize-y rounded-lg border border-[#303746] bg-[#0F1219] p-3 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-[#687184] focus:border-[#818CF8] focus:ring-2 focus:ring-[#818CF8]/20"
            />
            <p className="mt-2 text-[0.6875rem] text-[#8D96A8]">Changes update the preview immediately. Use the Editor tab for embeds, components and advanced settings.</p>
          </div>
        </aside>
      </>
    );
  }

  if (selection?.kind === "embed") {
    const embedIndex = (messageData.embeds ?? []).findIndex((embed) => embed._id === selection.id);
    const embed = embedIndex >= 0 ? messageData.embeds?.[embedIndex] : undefined;
    if (!embed) return null;

    const partLabel = selection.part
      ? selection.part.charAt(0).toUpperCase() + selection.part.slice(1)
      : "Embed";

    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-[#0B0D12]/55 backdrop-blur-[1px] min-[1200px]:hidden"
          onClick={() => select(null)}
        />
        <aside
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82dvh] flex-col rounded-t-[12px] border-t border-[#272D3A] bg-[#161A23] shadow-2xl min-[1200px]:inset-y-14 min-[1200px]:bottom-0 min-[1200px]:left-auto min-[1200px]:right-0 min-[1200px]:z-[60] min-[1200px]:h-[calc(100%-3.5rem)] min-[1200px]:max-h-none min-[1200px]:w-[min(440px,42vw)] min-[1200px]:rounded-none min-[1200px]:rounded-l-xl min-[1200px]:border-l min-[1200px]:border-t-0 min-[1200px]:shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex justify-center pt-2 pb-1 min-[1200px]:hidden">
            <div className="h-1 w-10 rounded-full bg-[#252B3A]" />
          </div>
          <div className={UI_THEME_CONFIG.surfaces.inspectorHeader}>
            <div className="min-w-0 flex-1">
              <span className="mb-0.5 block text-[0.625rem] font-bold uppercase leading-4 tracking-[0.08em] text-[#A1A8B8]">Properties</span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#A1A8B8] block">Embed Inspector</span>
              <h2 className="truncate text-base font-bold text-white">
                {partLabel}{embed.title ? ` · ${embed.title}` : ` · Embed ${embedIndex + 1}`}
              </h2>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onOpenFullEditor?.(selection)}
                className="rounded-md border border-[#272D3A] bg-[#1D2230] px-2.5 py-1.5 text-[0.6875rem] font-semibold text-[#F1F3F9] hover:border-[#818CF8]/60 hover:bg-[#252B3A] min-[1200px]:hidden"
              >
                Open Full Editor
              </button>
              <IconButton icon={X} label="Close Embed Inspector" size={15} onClick={() => select(null)} />
            </div>
          </div>
          <div data-embed-inspector-body className="min-h-0 overflow-y-auto p-3.5">
            <EmbedEditor embed={embed} index={embedIndex} />
          </div>
        </aside>
      </>
    );
  }

  if (!selection || selection.kind !== "component") return null;

  const component = findComponent(components, selection.id);
  if (!component) return null;

  const Form = COMPONENT_FORMS[component.type];
  if (!Form) return null;

  const componentId = (component._id || selection.id) as string;
  const isLinkButton =
    component.type === ComponentType.Button &&
    component.style === ButtonStyle.Link;
  const hasFlow = isInteractiveComponent(component) && !isLinkButton;

  return (
    <>
      {/* Mobile / Tablet Backdrop (< 1280px) */}
      <div
        className="fixed inset-0 z-40 bg-[#0B0D12]/55 backdrop-blur-[1px] min-[1200px]:hidden"
        onClick={() => select(null)}
      />

      {/* Floating desktop inspector; mobile bottom sheet overlay */}
      <aside
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82dvh] flex-col rounded-t-[12px] border-t border-[#272D3A] bg-[#161A23] shadow-2xl min-[1200px]:inset-y-14 min-[1200px]:bottom-0 min-[1200px]:left-auto min-[1200px]:right-0 min-[1200px]:z-[60] min-[1200px]:h-[calc(100%-3.5rem)] min-[1200px]:max-h-none min-[1200px]:w-[min(440px,42vw)] min-[1200px]:rounded-none min-[1200px]:rounded-l-xl min-[1200px]:border-l min-[1200px]:border-t-0 min-[1200px]:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Pill */}
        <div className="flex justify-center pt-2 pb-1 min-[1200px]:hidden">
          <div className="h-1 w-10 rounded-full bg-[#252B3A]" />
        </div>

        {/* Inspector Header */}
        <div className={UI_THEME_CONFIG.surfaces.inspectorHeader}>
          <div className="min-w-0 flex-1">
            <span className="mb-0.5 block text-[0.625rem] font-bold uppercase leading-4 tracking-[0.08em] text-[#A1A8B8]">Properties</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#A1A8B8] block">
              Component Inspector
            </span>
            <h2 className="truncate text-base font-bold text-white">
              {componentLabel(component)}
            </h2>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onOpenFullEditor?.(selection)}
              className="rounded-md border border-[#272D3A] bg-[#1D2230] px-2.5 py-1.5 text-[0.6875rem] font-semibold text-[#F1F3F9] hover:border-[#818CF8]/60 hover:bg-[#252B3A] min-[1200px]:hidden"
            >
              Open Full Editor
            </button>
            <IconButton
              icon={Copy}
              label="Duplicate Component"
              size={14}
              onClick={() => duplicateComponentById(componentId)}
            />
            <IconButton
              icon={Trash2}
              label="Delete Component"
              size={14}
              onClick={() => {
                removeComponentById(componentId);
                select(null);
              }}
            />
            <IconButton icon={X} label="Close Inspector" size={15} onClick={() => select(null)} />
          </div>
        </div>

        {/* Properties / Action Flow Tabs */}
        {hasFlow && (
          <div className="mx-3.5 mt-3 flex gap-1 rounded-lg border border-[#272D3A] bg-[#272D3A] p-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("properties")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "properties"
                  ? "bg-[#818CF8] text-white shadow-sm"
                  : "text-[#A1A8B8] hover:bg-[#161A23] hover:text-[#F1F3F9]"
              }`}
            >
              <Sliders size={12} />
              <span>Properties</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("flow")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "flow"
                  ? "bg-[#818CF8] text-white shadow-sm"
                  : "text-[#A1A8B8] hover:bg-[#161A23] hover:text-[#F1F3F9]"
              }`}
            >
              <Workflow size={12} />
              <span>Actions Flow</span>
            </button>
          </div>
        )}

        {/* Inspector Body */}
        <div data-component-inspector-body className={UI_THEME_CONFIG.surfaces.inspectorBody}>
          {activeTab === "flow" && hasFlow ? (
            <FlowBuilder component={component} />
          ) : (
            <Form
              component={component}
              update={(patch) => updateComponentById(componentId, patch)}
            />
          )}
        </div>
      </aside>
    </>
  );
};

export default PropertyPanel;