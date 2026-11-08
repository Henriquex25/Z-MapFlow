import { useDraggable, useDroppable } from "@dnd-kit/core";
import { IKeyAction } from "../types/keyboard";
import { Key } from "./Key";
import { useKeyboardStore } from "../store/useKeyboardStore";
export function DroppableKey({
  action,
  className = "",
  selected = false,
  onClick,
}: {
  action: IKeyAction;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  const selectedAction = useKeyboardStore((s) => s.selectedAction);
  const updateKeyCode = useKeyboardStore((s) => s.updateKeyCode);
  const activate =
    onClick ||
    (selectedAction ? () => updateKeyCode(action.keymapIndex, selectedAction.code) : undefined);
  const drop = useDroppable({
    id: `drop-${action.keymapIndex}`,
    data: { keymapIndex: action.keymapIndex },
    disabled: !!onClick,
  });
  const drag = useDraggable({
    id: `physical-${action.keymapIndex}`,
    data: { code: action.code, action, originIndex: action.keymapIndex },
    disabled: !!activate,
  });
  return (
    <div
      ref={(node) => {
        drop.setNodeRef(node);
        drag.setNodeRef(node);
      }}
      {...drag.attributes}
      {...drag.listeners}
      aria-disabled={undefined}
      onClick={activate}
      onKeyDown={(e) => {
        if (activate && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          activate();
        } else drag.listeners?.onKeyDown?.(e);
      }}
      aria-label={`Posição ${action.keymapIndex}: ${action.code}`}
      aria-pressed={onClick ? selected : undefined}
      className={`touch-none ${className} ${drag.isDragging ? "opacity-30" : ""} ${drop.isOver || selected ? "ring-2 ring-sky-400 rounded-md" : ""}`}
    >
      <Key action={action} className="w-full h-full" compact />
    </div>
  );
}
