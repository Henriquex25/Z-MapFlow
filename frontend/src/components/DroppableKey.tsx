import { tr, useLocale } from "../i18n";
import { useDraggable, useDroppable, useDndContext } from "@dnd-kit/core";
import { validateBinding } from "../utils/bindingValidation";
import { IKeyAction } from "../types/keyboard";
import { Key } from "./Key";
import { useKeyboardStore } from "../store/useKeyboardStore";
export function DroppableKey({
  action,
  className = "",
  selected = false,
  onClick,
  onEdit,
}: {
  action: IKeyAction;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
}) {
  useLocale();
  const { project, plugin } = useKeyboardStore();
  const { active } = useDndContext();
  const currentError = project ? validateBinding(action.code, project, plugin) : "";
  const selectedAction = useKeyboardStore((s) => s.selectedAction);
  const updateKeyCode = useKeyboardStore((s) => s.updateKeyCode);
  const activate =
    onClick ||
    (selectedAction ? () => updateKeyCode(action.keymapIndex, selectedAction.code) : onEdit);
  const drop = useDroppable({
    id: `drop-${action.keymapIndex}`,
    data: { keymapIndex: action.keymapIndex },
    disabled: !!onClick,
  });
  const drag = useDraggable({
    id: `physical-${action.keymapIndex}`,
    data: { code: action.code, action, originIndex: action.keymapIndex },
    disabled: !!onClick || !!selectedAction,
  });
  const candidate = active?.data.current?.code ?? selectedAction?.code;
  const candidateError = project && candidate ? validateBinding(candidate, project, plugin) : "";
  const error = currentError || (drop.isOver ? candidateError : "");
  return (
    <div
      ref={(node) => {
        drop.setNodeRef(node);
        drag.setNodeRef(node);
      }}
      {...drag.attributes}
      {...drag.listeners}
      aria-disabled={undefined}
      aria-invalid={!!error}
      title={error || undefined}
      onClick={activate}
      onKeyDown={(e) => {
        if (activate && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          activate();
        } else drag.listeners?.onKeyDown?.(e);
      }}
      aria-label={tr("Position {0}: {1}", action.keymapIndex, action.code)}
      aria-pressed={onClick ? selected : undefined}
      className={`layout-key touch-none ${error ? "invalid-action" : ""} ${className} ${drag.isDragging ? "opacity-30" : ""} ${drop.isOver || selected ? "ring-2 ring-sky-400 rounded-md" : ""}`}
    >
      <Key action={action} className="w-full h-full" compact />
    </div>
  );
}
