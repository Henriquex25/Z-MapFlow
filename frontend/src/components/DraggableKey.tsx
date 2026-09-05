import { useDraggable } from "@dnd-kit/core";
import { IKeyAction } from "../types/keyboard";
import { Key } from "./Key";

interface DraggableKeyProps {
    action: IKeyAction;
    className?: string;
}

export function DraggableKey({ action, className = "" }: DraggableKeyProps) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `drag-${action.code}`,
        data: { code: action.code, action: action },
    });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`touch-none ${isDragging ? "opacity-30" : "cursor-grab hover:scale-105 transition-transform"} ${className}`}
        >
            <Key action={action} className={className} />
        </div>
    );
}
