import React, { createContext, useContext } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

type SortStrategy = "vertical" | "horizontal" | "grid";

interface SortableListProps {
  items: string[];
  onReorder: (activeId: string, overId: string) => void;
  strategy?: SortStrategy;
  children: React.ReactNode;
  className?: string;
}

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

interface SortableHandleContextValue {
  attributes: ReturnType<typeof useSortable>["attributes"];
  listeners: ReturnType<typeof useSortable>["listeners"];
  setActivatorNodeRef: ReturnType<typeof useSortable>["setActivatorNodeRef"];
  isDragging: boolean;
}

const SortableHandleContext = createContext<SortableHandleContextValue | null>(null);

const SORT_STRATEGIES = {
  vertical: verticalListSortingStrategy,
  horizontal: horizontalListSortingStrategy,
  grid: rectSortingStrategy,
};

export const SortableList: React.FC<SortableListProps> = ({
  items,
  onReorder,
  strategy = "vertical",
  children,
  className,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={SORT_STRATEGIES[strategy]}>
        <div className={className}>{children}</div>
      </SortableContext>
    </DndContext>
  );
};

export const SortableItem: React.FC<SortableItemProps> = ({ id, children, className }) => {
  const sortable = useSortable({ id });
  const contextValue: SortableHandleContextValue = {
    attributes: sortable.attributes,
    listeners: sortable.listeners,
    setActivatorNodeRef: sortable.setActivatorNodeRef,
    isDragging: sortable.isDragging,
  };

  return (
    <SortableHandleContext.Provider value={contextValue}>
      <div
        ref={sortable.setNodeRef}
        style={{
          transform: CSS.Transform.toString(sortable.transform),
          transition: sortable.transition,
        }}
        className={[
          "motion-reduce:!transition-none",
          sortable.isDragging ? "relative z-30 opacity-80 shadow-xl ring-2 ring-[#818CF8]/70" : "",
          className ?? "",
        ].join(" ")}
      >
        {children}
      </div>
    </SortableHandleContext.Provider>
  );
};

export const DragHandle: React.FC<{ label?: string; className?: string }> = ({
  label = "Drag to reorder",
  className,
}) => {
  const sortable = useContext(SortableHandleContext);
  if (!sortable) return null;

  return (
    <button
      ref={sortable.setActivatorNodeRef}
      type="button"
      aria-label={label}
      {...sortable.attributes}
      {...sortable.listeners}
      className={[
        "inline-flex min-h-7 min-w-7 touch-none cursor-grab items-center justify-center rounded text-[#A1A8B8] transition-colors hover:bg-[#252B3A] hover:text-white active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#818CF8]",
        className ?? "",
      ].join(" ")}
    >
      <GripVertical size={14} />
    </button>
  );
};
