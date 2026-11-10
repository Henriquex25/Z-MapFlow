import { tr, useLocale } from "../i18n";
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
  index,
  layer,
  isActive,
  canRemove,
  onClick,
  onRemove,
  onContextMenu,
}: DraggableLayerTabProps) {
  useLocale();
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
      aria-label={tr("Reorder layer {0}", layer.name)}
      onContextMenu={onContextMenu}
      className={`layer-tab ${isDragging ? "is-dragging" : ""} ${isActive ? "is-active" : ""}`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="layer-tab-label"
        aria-label={layer.name}
        aria-current={isActive ? "true" : undefined}
        title={layer.name}
      >
        <span className="layer-index" aria-hidden="true">
          {index}
        </span>
        <span className="layer-name-text">{layer.name}</span>
      </button>

      {canRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="layer-tab-remove"
          title={tr("Remove layer")}
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
