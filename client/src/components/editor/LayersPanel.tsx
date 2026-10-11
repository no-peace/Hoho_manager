import { ChevronDown, ChevronUp, Copy, Trash2 } from "lucide-react";
import type { ComponentNode } from "@dmb/shared";
import { IconButton } from "../ui/Button";
import { componentLabel } from "../../utils/componentsV2";
import { useMessageStore } from "../../store/messageStore";

interface LayerRowProps {
  component: ComponentNode;
  depth: number;
  parentId: string | null;
}

const LayerRow = ({ component, depth, parentId }: LayerRowProps) => {
  const selection = useMessageStore((state) => state.selection);
  const select = useMessageStore((state) => state.select);
  const moveComponentById = useMessageStore((state) => state.moveComponentById);
  const removeComponentById = useMessageStore((state) => state.removeComponentById);
  const duplicateComponentById = useMessageStore((state) => state.duplicateComponentById);

  const active = selection?.kind === "component" && selection.id === component._id;
  const children = component.components ?? [];

  return (
    <>
      <div
        role="treeitem"
        aria-selected={active}
        aria-level={depth + 1}
        onClick={() => component._id && select({ kind: "component", id: component._id })}
        className={[
          "group flex cursor-pointer items-center gap-1 rounded px-2 py-1.5 text-xs transition-colors",
          active ? "bg-blurple/20 text-ink-strong" : "text-ink-muted hover:bg-hover hover:text-ink",
        ].join(" ")}
        style={{ marginLeft: depth * 12 }}
      >
        <span className="truncate">{componentLabel(component)}</span>

        <span className="ml-auto flex items-center opacity-0 transition-opacity group-hover:opacity-100">
          <IconButton
            icon={ChevronUp}
            label="Move up"
            size={12}
            onClick={(event) => {
              event.stopPropagation();
              if (component._id) moveComponentById(component._id, -1, parentId);
            }}
          />
          <IconButton
            icon={ChevronDown}
            label="Move down"
            size={12}
            onClick={(event) => {
              event.stopPropagation();
              if (component._id) moveComponentById(component._id, 1, parentId);
            }}
          />
          <IconButton
            icon={Copy}
            label="Duplicate"
            size={12}
            onClick={(event) => {
              event.stopPropagation();
              if (component._id) duplicateComponentById(component._id);
            }}
          />
          <IconButton
            icon={Trash2}
            label="Delete"
            size={12}
            onClick={(event) => {
              event.stopPropagation();
              if (component._id) removeComponentById(component._id);
            }}
          />
        </span>
      </div>

      {children.map((child) => (
        <LayerRow
          key={child._id}
          component={child}
          depth={depth + 1}
          parentId={component._id ?? null}
        />
      ))}
    </>
  );
};

export const LayersPanel = () => {
  const data = useMessageStore((state) => state.data);
  const components = data.components || [];

  if (components.length === 0) {
    return (
      <p className="rounded border border-dashed border-line px-2.5 py-3 text-[11px] text-ink-faint">
        No components yet. Add one from the Component Palette in the editor.
      </p>
    );
  }

  return (
    <div role="tree" aria-label="Message components">
      {components.map((component) => (
        <LayerRow key={component._id} component={component} depth={0} parentId={null} />
      ))}
    </div>
  );
};

export default LayersPanel;