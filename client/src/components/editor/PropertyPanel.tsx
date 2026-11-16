import { Copy, Trash2, X, Sliders, Workflow, MousePointerClick, Layers, Hash } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { ButtonStyle, ComponentType } from "@dmb/shared";
import { useActionStore } from "../../store/actionStore";
import { IconButton } from "../ui/Button";
import { FlowBuilder } from "../actions/FlowBuilder";
import { COMPONENT_FORMS } from "./ComponentForms";
import { componentLabel, isInteractiveComponent } from "../../utils/componentsV2";
import { findComponent } from "../../utils/tree";
import { useMessageStore } from "../../store/messageStore";
import { UI_THEME_CONFIG } from "../../config/uiThemeConfig";

type PanelTab = "properties" | "flow";

export const PropertyPanel = () => {
  const [activeTab, setActiveTab] = useState<PanelTab>("properties");
  const pendingFlowSelectionRef = useRef<string | null>(null);
  const selection = useMessageStore((state) => state.selection);
  const messageData = useMessageStore((state) => state.data);
  const components = messageData.components;\n  const flows = useActionStore((state) => state.flows);
  const select = useMessageStore((state) => state.select);
  const updateComponentById = useMessageStore((state) => state.updateComponentById);
  const removeComponentById = useMessageStore((state) => state.removeComponentById);
  const duplicateComponentById = useMessageStore((state) => state.duplicateComponentById);

  useEffect(() => {
    const handleOpenFlow = (event: Event) => {
      const detail = (event as CustomEvent<{ componentId?: string }>).detail;
      if (!detail?.componentId) return;
      pendingFlowSelectionRef.current = detail.componentId;
      setActiveTab("flow");
    };
    window.addEventListener("hoho:open-component-flow", handleOpenFlow);
    return () => window.removeEventListener("hoho:open-component-flow", handleOpenFlow);
  }, []);

  useEffect(() => {
    if (pendingFlowSelectionRef.current === selection?.id) {
      pendingFlowSelectionRef.current = null;
      setActiveTab("flow");
      return;
    }
    setActiveTab("properties");
  }, [selection?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") select(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [select]);

  const attachedActions = components.filter((item) => Boolean(item.custom_id && flows[item.custom_id])).length;
  const stats = [
    { label: "Characters", value: messageData.content?.length ?? 0, icon: Hash },
    { label: "Embeds", value: messageData.embeds?.length ?? 0, icon: Layers },
    { label: "V2 Blocks", value: components.length, icon: Layers },
    { label: "Attached Actions", value: attachedActions, icon: Workflow },
  ];

  const emptyInspector = (
    <aside className="hidden min-[1200px]:flex min-w-0 w-[440px] shrink-0 flex-col border-l border-[#272D3A] bg-[#161A23]">
      <div className="border-b border-[#202531] bg-[#10131A] px-4 py-3">
        <span className="text-[11px] font-medium text-[#A1A8B8]">INSPECTOR</span>
        <h2 className="mt-0.5 text-[15px] font-semibold text-[#F1F3F9]">No selection</h2>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-[10px] border border-dashed border-[#272D3A] bg-[#161A23]/50 p-5 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#818CF8]/10 text-[#A5B4FC]">
            <MousePointerClick size={18} />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-[#F1F3F9]">Select a component</h3>
          <p className="mt-1 text-xs leading-relaxed text-[#A1A8B8]">
            Click a block in the editor or live Discord preview to inspect and edit its properties here.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2 text-left">
            {stats.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-[8px] border border-[#272D3A] bg-[#1D2230] p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] text-[#6F788A]"><Icon size={11} />{label}</div>
                <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#F1F3F9]">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );

  if (!selection || selection.kind !== "component") return emptyInspector;

  const component = findComponent(components, selection.id);
  if (!component) return emptyInspector;

  const Form = COMPONENT_FORMS[component.type];
  if (!Form) return emptyInspector;

  const componentId = (component._id || selection.id) as string;
  const isLinkButton =
    component.type === ComponentType.Button &&
    component.style === ButtonStyle.Link;
  const hasFlow = isInteractiveComponent(component) && !isLinkButton;

  return (
    <>
      <div
        className={UI_THEME_CONFIG.surfaces.inspectorBackdrop}
        onClick={() => select(null)}
      />

      <aside
        className={UI_THEME_CONFIG.surfaces.inspectorPanel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 pb-1 min-[1200px]:hidden">
          <div className="h-1 w-10 rounded-full bg-[#343C4E]" />
        </div>

        <div className={`${UI_THEME_CONFIG.surfaces.inspectorHeader} sticky top-0 z-10`}>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-medium text-[#A1A8B8] block">
              Component Inspector
            </span>
            <h2 className="truncate text-[15px] font-semibold text-[#F1F3F9]">
              {componentLabel(component)}
            </h2>
          </div>

          <div className="flex items-center gap-1 shrink-0">
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

        {hasFlow && (
          <div className="mx-3.5 mt-3 flex gap-1 rounded-[8px] border border-[#272D3A] bg-[#1D2230] p-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("properties")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "properties"
                  ? "bg-[#818CF8]/15 text-[#F1F3F9] border border-[#818CF8]/25"
                  : "text-[#A1A8B8] hover:bg-[#252B3A] hover:text-[#F1F3F9]"
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

        <div className={UI_THEME_CONFIG.surfaces.inspectorBody}>
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