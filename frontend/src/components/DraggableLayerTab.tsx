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
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

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
            className={`flex items-center rounded-t-lg select-none cursor-grab active:cursor-grabbing touch-none ${
                isDragging ? "opacity-90 shadow-xl bg-gray-800" : ""
            } ${
                isActive && !isDragging
                    ? "bg-gray-800 text-blue-400 border-t-2 border-blue-400"
                    : "bg-gray-900 text-gray-500 hover:bg-gray-800"
            }`}
        >
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
                className="px-5 py-2 font-semibold cursor-pointer outline-none pointer-events-auto"
            >
                {layer.name}
            </button>

            {canRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="px-3 py-2 text-gray-500 hover:bg-red-500/20 hover:text-red-400 cursor-pointer transition-colors outline-none pointer-events-auto"
                    title="Remover Camada"
                >
                    <X size={16} />
                </button>
            )}
        </div>
    );
}
