import { useId } from "react";
import { useDroppable } from "@dnd-kit/core";
import { displayCode, useKeyboardStore } from "../store/useKeyboardStore";
import { DraggableKey } from "./DraggableKey";
import { action } from "../types/keyboard";
import { actionName } from "../utils/resourceActions";
export function BindingDrop({
  code,
  onChange,
  label = "Solte uma ação aqui",
  compact = false,
}: {
  code: string;
  onChange: (code: string) => void;
  label?: string;
  compact?: boolean;
}) {
  const id = useId();
  const p = useKeyboardStore((s) => s.project);
  const selectedAction = useKeyboardStore((s) => s.selectedAction);
  const { setNodeRef, isOver } = useDroppable({
    id: `binding-${id}`,
    data: { acceptBinding: onChange },
  });
  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={label}
      className={`binding-drop ${compact ? "is-compact" : ""} ${isOver ? "is-over" : ""}`}
    >
      <button
        type="button"
        className="binding-select"
        disabled={!selectedAction}
        aria-label={`Atribuir ação a ${label}`}
        onClick={() => {
          if (selectedAction) onChange(selectedAction.code);
        }}
      >
        <span className="text-xs text-slate-300">{label}</span>
        {!compact && (
          <span className="text-xs text-slate-500">
            {selectedAction
              ? `Usar ${actionName(selectedAction, p)}`
              : "Clique numa ação da paleta ou arraste"}
          </span>
        )}
      </button>
      {code ? (
        <DraggableKey
          action={{ ...action(code), label: displayCode(code, p) }}
          className={compact ? "palette-action" : ""}
        />
      ) : null}
    </div>
  );
}
