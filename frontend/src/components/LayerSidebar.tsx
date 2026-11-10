import { tr, useLocale } from "../i18n";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { ILayer } from "../types/keyboard";
import { DraggableLayerTab } from "./DraggableLayerTab";

export function LayerSidebar({
  layers,
  activeId,
  onSelect,
  onRemove,
  onAdd,
  onReorder,
  onContextMenu,
}: {
  layers: ILayer[];
  activeId: string;
  onSelect: (id: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  onReorder: (from: number, to: number) => void;
  onContextMenu: (e: MouseEvent, index: number) => void;
}) {
  useLocale();
  const list = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const measure = () => setOverflow(el.scrollWidth > el.clientWidth + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, [layers.length]);
  useEffect(() => {
    const el = list.current;
    const active = el?.querySelector<HTMLElement>(".layer-tab.is-active");
    if (el && active) {
      const item = active.getBoundingClientRect(),
        viewport = el.getBoundingClientRect();
      if (item.left < viewport.left || item.right > viewport.right)
        el.scrollLeft += item.left - viewport.left;
    }
  }, [activeId, layers]);
  const ids = layers.map((l) => l.id);
  return (
    <aside className="layer-sidebar" aria-label={tr("Keymap layers")}>
      <div className="layer-sidebar-heading">
        <span>{tr("Layers")}</span>
        <button
          className="btn icon-btn"
          aria-label={tr("Add layer")}
          title={tr("Add layer")}
          disabled={layers.length >= 32}
          onClick={onAdd}
        >
          <Plus size={15} />
        </button>
      </div>
      <div className="layer-list" ref={list}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (over && active.id !== over.id)
              onReorder(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
          }}
        >
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            {layers.map((layer, index) => (
              <DraggableLayerTab
                key={layer.id}
                id={layer.id}
                index={index}
                layer={layer}
                isActive={layer.id === activeId}
                canRemove={layers.length > 1}
                onClick={() => onSelect(layer.id)}
                onRemove={() => onRemove(index)}
                onContextMenu={(e) => onContextMenu(e, index)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      {overflow && (
        <div className="layer-pages">
          <button
            className="btn icon-btn"
            aria-label={tr("Previous layers")}
            title={tr("Previous column")}
            onClick={() =>
              list.current?.scrollBy({ left: -list.current.clientWidth, behavior: "smooth" })
            }
          >
            <ChevronLeft size={15} />
          </button>
          <span>{tr("{0} layers", layers.length)}</span>
          <button
            className="btn icon-btn"
            aria-label={tr("Next layers")}
            title={tr("Next column")}
            onClick={() =>
              list.current?.scrollBy({ left: list.current.clientWidth, behavior: "smooth" })
            }
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </aside>
  );
}
