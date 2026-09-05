import { useDroppable } from "@dnd-kit/core";
import { IKeyAction } from "../types/keyboard";
import { Key } from "./Key";

interface DroppableKeyProps {
    action: IKeyAction;
    className?: string;
}

export function DroppableKey({ action, className = "" }: DroppableKeyProps) {
    const { isOver, setNodeRef } = useDroppable({
        id: `drop-${action.keymapIndex}`,
        data: { keymapIndex: action.keymapIndex },
    });

    return (
        <div
            ref={setNodeRef}
            className={`${className} transition-transform ${isOver ? "scale-110 z-10 relative" : ""}`}
        >
            <Key action={action} className={isOver ? "border-blue-500! bg-gray-600! border-b-blue-700!" : ""} />
        </div>
    );
}
