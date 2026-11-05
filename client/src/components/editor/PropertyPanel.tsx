import { Copy, Trash2, X } from "lucide-react";
import { useState } from "react";
import { ButtonStyle, ComponentType } from "@dmb/shared";
import { IconButton } from "../ui/Button";
import { FlowBuilder } from "../actions/FlowBuilder";
import { COMPONENT_FORMS } from "./ComponentForms";
import { componentLabel, isInteractiveComponent } from "../../utils/componentsV2";
import { findComponent } from "../../utils/tree";
import { useMessageStore } from "../../store/messageStore";

type PanelTab = "properties" | "flow";

const TabButton = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={[
      "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
      active
        ? "bg-[#5865f2] text-white shadow-sm"
        : "text-[#949ba4] hover:bg-[#35373c] hover:text-[#dbdee1]",
    ].join(" ")}
  >
    {children}
  </button>
);

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
  // Only open for interactive components (Buttons & Select Menus); all other V2 components are edited inline on the left
  if (!component || !isInteractiveComponent(component)) return null;

  const Form = COMPONENT_FORMS[component.type];
  if (!Form) return null;

  const isLinkButton =
    component.type === ComponentType.Button && component.style === ButtonStyle.Link;
  const hasFlow = !isLinkButton;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-[1px]"
      onClick={() => select(null)}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[#1e1f22] bg-[#2b2d31] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#1e1f22] bg-[#232428] px-4 py-3">
          <h2 className="truncate text-xs font-bold uppercase tracking-wider text-white">
            Edit {componentLabel(component)}
          </h2>

          <div className="flex items-center gap-1">
            {component._id && (
              <>
                <IconButton
                  icon={Copy}
                  label="Duplicate"
                  size={14}
                  onClick={() => duplicateComponentById(component._id as string)}
                />
                <IconButton
                  icon={Trash2}
                  label="Delete"
                  size={14}
                  onClick={() => {
                    removeComponentById(component._id as string);
                    select(null);
                  }}
                />
              </>
            )}
            <IconButton icon={X} label="Close" size={15} onClick={() => select(null)} />
          </div>
        </div>

        {/* Properties / Flow Tabs */}
        {hasFlow && (
          <div className="mx-4 mt-3 flex gap-1 rounded-lg border border-[#111214] bg-[#1e1f22] p-1">
            <TabButton
              active={activeTab === "properties"}
              onClick={() => setActiveTab("properties")}
            >
              Properties
            </TabButton>
            <TabButton active={activeTab === "flow"} onClick={() => setActiveTab("flow")}>
              Flow (Actions)
            </TabButton>
          </div>
        )}

        {/* Modal Body */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 custom-scrollbar">
          {activeTab === "flow" && hasFlow ? (
            <FlowBuilder component={component} />
          ) : (
            <Form
              component={component}
              update={(patch) => component._id && updateComponentById(component._id, patch)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default PropertyPanel;