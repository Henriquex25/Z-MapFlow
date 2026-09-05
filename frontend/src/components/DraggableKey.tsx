import { useDraggable } from "@dnd-kit/core";
import { IKeyAction } from "../types/keyboard";
import { Key } from "./Key";

interface DraggableKeyProps {
    action: IKeyAction;
}

export function DraggableKey({ action }: DraggableKeyProps) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `drag-${action.code}`,
        data: { code: action.code, action: action },
    });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={`touch-none ${isDragging ? "opacity-30" : "cursor-grab hover:scale-105 transition-transform"}`}
        >
            <Key action={action} />
        </div>
    );
}
