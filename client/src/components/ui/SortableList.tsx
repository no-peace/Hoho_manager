import React, { createContext, useContext, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
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
  renderOverlay?: (activeId: string) => React.ReactNode;
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

interface SortableListState {
  activeDragId: string | null;
  isDraggingAny: boolean;
}

const SortableHandleContext = createContext<SortableHandleContextValue | null>(null);
const SortableListStateContext = createContext<SortableListState>({
  activeDragId: null,
  isDraggingAny: false,
});

const SORT_STRATEGIES = {
  vertical: verticalListSortingStrategy,
  horizontal: horizontalListSortingStrategy,
  grid: rectSortingStrategy,
};

const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});

export const useSortableListState = (): SortableListState =>
  useContext(SortableListStateContext);

export const useIsListDragging = (): boolean =>
  useSortableListState().isDraggingAny;

export const SortableList: React.FC<SortableListProps> = ({
  items,
  onReorder,
  strategy = "vertical",
  children,
  className,
  renderOverlay,
}) => {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const modifiers = useMemo(
    () => (strategy === "vertical" ? [restrictToVerticalAxis] : undefined),
    [strategy],
  );
  const listState = useMemo(
    () => ({ activeDragId, isDraggingAny: activeDragId !== null }),
    [activeDragId],
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  };
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
    setActiveDragId(null);
  };
  const handleDragCancel = () => setActiveDragId(null);

  return (
    <SortableListStateContext.Provider value={listState}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={modifiers}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={items} strategy={SORT_STRATEGIES[strategy]}>
          <div className={className} data-list-dragging={activeDragId !== null || undefined}>
            {children}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeDragId ? (
            <div className="flex h-11 max-w-[min(280px,80vw)] items-center gap-2 overflow-hidden rounded-lg border border-[#818CF8]/60 bg-[#161A23] px-3 text-xs font-semibold text-[#F1F3F9] shadow-xl">
              <GripVertical size={14} className="shrink-0 text-[#818CF8]" />
              <span className="truncate">{renderOverlay?.(activeDragId) ?? "Moving item"}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </SortableListStateContext.Provider>
  );
};

export const SortableItem: React.FC<SortableItemProps> = ({ id, children, className }) => {
  const sortable = useSortable({ id });
  const contextValue = useMemo<SortableHandleContextValue>(
    () => ({
      attributes: sortable.attributes,
      listeners: sortable.listeners,
      setActivatorNodeRef: sortable.setActivatorNodeRef,
      isDragging: sortable.isDragging,
    }),
    [sortable.attributes, sortable.listeners, sortable.setActivatorNodeRef, sortable.isDragging],
  );

  return (
    <SortableHandleContext.Provider value={contextValue}>
      <div
        ref={sortable.setNodeRef}
        style={{
          transform: CSS.Translate.toString(sortable.transform),
          transition: sortable.transition,
        }}
        className={[
          "motion-reduce:!transition-none",
          sortable.isDragging
            ? "relative z-30 border border-dashed border-[#818CF8]/60 bg-[#818CF8]/5 opacity-35"
            : "",
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
