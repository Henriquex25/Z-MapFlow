import { tr, useLocale } from "../i18n";
import { useId } from "react";
import { useDraggable } from "@dnd-kit/core";
import { IKeyAction } from "../types/keyboard";
import { Key } from "./Key";
import { validateBinding, type BindingContext } from "../utils/bindingValidation";
import { useKeyboardStore } from "../store/useKeyboardStore";
export function DraggableKey({
  action,
  className = "",
  validationContext = "binding",
}: {
  action: IKeyAction;
  className?: string;
  validationContext?: BindingContext;
}) {
  useLocale();
  const id = useId();
  const { project, plugin } = useKeyboardStore();
  const error = project ? validateBinding(action.code, project, plugin, validationContext) : "";
  const selectAction = useKeyboardStore((s) => s.selectAction);
  const selected = useKeyboardStore((s) => s.selectedAction?.code === action.code);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${id}`,
    data: { code: action.code, action },
    disabled: !!error,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label={tr("Drag {0}", action.label || action.code)}
      aria-pressed={selected}
      title={error || tr("Click to select or drag to a destination")}
      aria-invalid={!!error}
      onClick={(event) => {
        event.stopPropagation();
        selectAction(action);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          selectAction(action);
        } else listeners?.onKeyDown?.(event);
      }}
      className={`touch-none ${error ? "invalid-action" : ""} ${isDragging ? "opacity-30" : "cursor-grab"} ${selected ? "ring-2 ring-sky-400 rounded-md" : ""} ${className}`}
    >
      <Key action={action} className={className} />
    </div>
  );
}
