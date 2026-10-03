import { Copy, MousePointerSquareDashed, Trash2, X } from "lucide-react";
import { useState } from "react";
import { ButtonStyle, ComponentType } from "@dmb/shared";
import { IconButton } from "../ui/Button";
import { FlowBuilder } from "../actions/FlowBuilder";
import { COMPONENT_FORMS } from "./ComponentForms";
import { componentLabel, isInteractiveComponent } from "../../utils/componentsV2";
import { findComponent } from "../../utils/tree";
import { useMessageStore } from "../../store/messageStore";

/**
 * Context-sensitive editor for whatever is selected.
 *
 * Interactive components (buttons and selects) get two tabs, mirroring
 * Discohook: **Properties** for the component's appearance and **Flow** for the
 * ordered chain of actions its click runs. Link buttons have no `custom_id`, so
 * they only show Properties.
 */

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
      "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
      active
        ? "bg-white dark:bg-[#2b2d31] text-gray-900 dark:text-white shadow-sm"
        : "text-gray-500 dark:text-[#949ba4] hover:bg-gray-200 dark:hover:bg-[#35373c] hover:text-gray-900 dark:hover:text-[#dbdee1]",
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

  if (!selection) return null;

  const component =
    selection.kind === "component" ? findComponent(components, selection.id) : null;
  const Form = component ? COMPONENT_FORMS[component.type] : undefined;

  const isLinkButton =
    component?.type === ComponentType.Button && component.style === ButtonStyle.Link;
  const hasFlow = isInteractiveComponent(component ?? undefined) && !isLinkButton;

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-gray-200 dark:border-[#404248] bg-gray-100 dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#404248] px-3 py-2.5">
        <h2 className="truncate text-xs font-semibold text-gray-900 dark:text-white">
          {component ? componentLabel(component) : "Embed"}
        </h2>

        <div className="flex items-center gap-0.5">
          {component?._id && (
            <>
              <IconButton
                icon={Copy}
                label="Duplicate"
                size={13}
                onClick={() => duplicateComponentById(component._id as string)}
              />
              <IconButton
                icon={Trash2}
                label="Delete"
                size={13}
                onClick={() => removeComponentById(component._id as string)}
              />
            </>
          )}
          <IconButton icon={X} label="Close" size={13} onClick={() => select(null)} />
        </div>
      </div>

      {component && Form && hasFlow && (
        <div className="flex gap-0.5 bg-gray-100 dark:bg-gray-800 px-3 pt-2.5">
          <TabButton
            active={activeTab === "properties"}
            onClick={() => setActiveTab("properties")}
          >
            Properties
          </TabButton>
          <TabButton active={activeTab === "flow"} onClick={() => setActiveTab("flow")}>
            Action
          </TabButton>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 custom-scrollbar">
        {component && Form ? (
          activeTab === "flow" && hasFlow ? (
            <FlowBuilder component={component} />
          ) : (
            <Form
              component={component}
              update={(patch) => component._id && updateComponentById(component._id, patch)}
            />
          )
        ) : (
          <p className="flex items-start gap-2 rounded border border-dashed border-line px-3 py-4 text-[11px] text-ink-faint">
            <MousePointerSquareDashed size={14} className="mt-0.5 shrink-0" />
            This embed is edited directly in its card on the left. Select a component in the tree
            to edit it here.
          </p>
        )}
      </div>
    </aside>
  );
};

export default PropertyPanel;
