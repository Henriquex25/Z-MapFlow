import { usePalettePicker, choosePaletteAction } from "../store/usePalettePicker";
import { ResourceVisibility } from "../utils/resourceVisibility";
import { tr, useLocale } from "../i18n";
import { useId, useContext, useMemo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { IKeyAction } from "../types/keyboard";
import { Key } from "./Key";
import { validateBinding, type BindingContext } from "../utils/bindingValidation";
import { useKeyboardStore } from "../store/useKeyboardStore";
export function DraggableKey({
  action,
  className = "",
  validationContext = "binding",
  palette = false,
  onChoose,
}: {
  action: IKeyAction;
  className?: string;
  validationContext?: BindingContext;
  palette?: boolean;
  onChoose?: () => void;
}) {
  const locale = useLocale();
  const visible = useContext(ResourceVisibility);
  const id = useId();
  const project = useKeyboardStore((s) => s.project);
  const plugin = useKeyboardStore((s) => s.plugin);
  const target = usePalettePicker((s) => s.target);
  const bindingError = useMemo(
    () =>
      project
        ? validateBinding(
            action.code,
            project,
            plugin,
            palette && target ? target.context : validationContext,
          )
        : "",
    [action.code, project, plugin, validationContext, locale, palette, target],
  );
  const error = palette && target ? target.error(action.code) : bindingError;
  const selectAction = useKeyboardStore((s) => s.selectAction);
  const selected = useKeyboardStore((s) => s.selectedAction?.code === action.code);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${id}`,
    data: { code: action.code, action },
    disabled: !!error || !visible,
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
        if (error) return;
        if (onChoose) onChoose();
        else if (!palette || !choosePaletteAction(action.code)) selectAction(action);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          if (error) return;
          if (onChoose) onChoose();
          else if (!palette || !choosePaletteAction(action.code)) selectAction(action);
        } else listeners?.onKeyDown?.(event);
      }}
      className={`touch-none ${error ? "invalid-action" : ""} ${isDragging ? "opacity-30" : "cursor-grab"} ${selected ? "ring-2 ring-sky-400 rounded-md" : ""} ${className}`}
    >
      <Key action={action} className={className} />
    </div>
  );
}
