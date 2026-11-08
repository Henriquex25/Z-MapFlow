import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ILayer } from "../types/keyboard";
import { X } from "lucide-react";

interface DraggableLayerTabProps {
  id: string;
  index: number;
  layer: ILayer;
  isActive: boolean;
  canRemove: boolean;
  onClick: () => void;
  onRemove: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function DraggableLayerTab({
  id,
  layer,
  isActive,
  canRemove,
  onClick,
  onRemove,
  onContextMenu,
}: DraggableLayerTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onContextMenu={onContextMenu}
      className={`layer-tab ${isDragging ? "is-dragging" : ""} ${isActive ? "is-active" : ""}`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="layer-tab-label"
      >
        {layer.name}
      </button>

      {canRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="layer-tab-remove"
          title="Remover Camada"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
