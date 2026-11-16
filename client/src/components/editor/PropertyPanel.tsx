import { Copy, Trash2, X, Sliders, Workflow } from "lucide-react";
import { useState, useEffect } from "react";
import { ButtonStyle, ComponentType } from "@dmb/shared";
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
  const selection = useMessageStore((state) => state.selection);
  const components = useMessageStore((state) => state.data.components);
  const select = useMessageStore((state) => state.select);
  const updateComponentById = useMessageStore((state) => state.updateComponentById);
  const removeComponentById = useMessageStore((state) => state.removeComponentById);
  const duplicateComponentById = useMessageStore((state) => state.duplicateComponentById);

  useEffect(() => {
    setActiveTab("properties");
  }, [selection?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") select(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [select]);

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
        className={UI_THEME_CONFIG.surfaces.inspectorBackdrop}
        onClick={() => select(null)}
      />

      {/* Docked Right Inspector on Desktop (lg+) | Slide-Up Bottom Sheet on Mobile/Tablet (<lg) */}
      <aside
        className={UI_THEME_CONFIG.surfaces.inspectorPanel}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Pill */}
        <div className="flex justify-center pt-2 pb-1 min-[1200px]:hidden">
          <div className="h-1 w-10 rounded-full bg-[#4e5058]" />
        </div>

        {/* Inspector Header */}
        <div className={UI_THEME_CONFIG.surfaces.inspectorHeader}>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#949ba4] block">
              Component Inspector
            </span>
            <h2 className="truncate text-base font-bold text-white">
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

        {/* Properties / Action Flow Tabs */}
        {hasFlow && (
          <div className="mx-3.5 mt-3 flex gap-1 rounded-lg border border-[#111214] bg-[#1e1f22] p-1 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab("properties")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "properties"
                  ? "bg-[#5865f2] text-white shadow-sm"
                  : "text-[#949ba4] hover:bg-[#2b2d31] hover:text-[#dbdee1]"
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
                  ? "bg-[#5865f2] text-white shadow-sm"
                  : "text-[#949ba4] hover:bg-[#2b2d31] hover:text-[#dbdee1]"
              }`}
            >
              <Workflow size={12} />
              <span>Actions Flow</span>
            </button>
          </div>
        )}

        {/* Inspector Body */}
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