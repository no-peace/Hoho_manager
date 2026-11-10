import { Copy, Trash2, X, Sliders, Workflow } from "lucide-react";
import { useState } from "react";
//import { ButtonStyle, ComponentType } from "@dmb/shared";
import { IconButton } from "../ui/Button";
import { FlowBuilder } from "../actions/FlowBuilder";
import { COMPONENT_FORMS } from "./ComponentForms";
import { componentLabel, isInteractiveComponent } from "../../utils/componentsV2";
import { findComponent } from "../../utils/tree";
import { useMessageStore } from "../../store/messageStore";

type PanelTab = "properties" | "flow";

export const PropertyPanel = () => {
  const [activeTab, setActiveTab] = useState<PanelTab>("properties");
  const selection = useMessageStore((state) => state.selection);
  const components = useMessageStore((state) => state.data.components);
  const select = useMessageStore((state) => state.select);
  const updateComponentById = useMessageStore((state) => state.updateComponentById);
  const removeComponentById = useMessageStore((state) => state.removeComponentById);
  const duplicateComponentById = useMessageStore((state) => state.duplicateComponentById);

  if (!selection || selection.kind !== "component") return null;

  const component = findComponent(components, selection.id);
  if (!component) return null;

  const Form = COMPONENT_FORMS[component.type];
  if (!Form) return null;

  const hasFlow = isInteractiveComponent(component);

  return (
    <>
      {/* Mobile / Tablet Backdrop (< 1024px) */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] lg:hidden"
        onClick={() => select(null)}
      />

      {/* Docked Right Inspector on Desktop (lg+) | Slide-Up Bottom Sheet on Mobile/Tablet (<lg) */}
      <aside
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[82vh] flex-col rounded-t-2xl border-t border-[#111214] bg-[#232428] shadow-2xl lg:static lg:z-10 lg:max-h-none lg:w-[360px] xl:w-[400px] lg:shrink-0 lg:rounded-none lg:border-t-0 lg:border-l lg:border-[#111214] lg:shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Pill */}
        <div className="flex justify-center pt-2 pb-1 lg:hidden">
          <div className="h-1 w-10 rounded-full bg-[#4e5058]" />
        </div>

        {/* Inspector Header */}
        <div className="flex items-center justify-between border-b border-[#111214] bg-[#1e1f22] px-3.5 py-2.5 shrink-0">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#949ba4] block">
              Component Inspector
            </span>
            <h2 className="truncate text-xs font-bold text-white">
              {componentLabel(component)}
            </h2>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {component._id && (
              <>
                <IconButton
                  icon={Copy}
                  label="Duplicate Component"
                  size={14}
                  onClick={() => duplicateComponentById(component._id as string)}
                />
                <IconButton
                  icon={Trash2}
                  label="Delete Component"
                  size={14}
                  onClick={() => {
                    removeComponentById(component._id as string);
                    select(null);
                  }}
                />
              </>
            )}
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
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5 custom-scrollbar">
          {activeTab === "flow" && hasFlow ? (
            <FlowBuilder component={component} />
          ) : (
            <Form
              component={component}
              update={(patch) => component._id && updateComponentById(component._id, patch)}
            />
          )}
        </div>
      </aside>
    </>
  );
};

export default PropertyPanel;