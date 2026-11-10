import { BindingArguments } from "./BindingArguments";
import { useId, useState, useEffect } from "react";
import { useDroppable, useDndContext } from "@dnd-kit/core";
import { displayCode, useKeyboardStore } from "../store/useKeyboardStore";
import { DraggableKey } from "./DraggableKey";
import { action } from "../types/keyboard";
import { normalizeBinding } from "../utils/bindingParameters";
import { actionName } from "../utils/resourceActions";
import { validateBinding, type BindingContext } from "../utils/bindingValidation";
import { useDraftError } from "../utils/useDraftError";
export function BindingDrop({
  code,
  onChange,
  label = "Solte uma ação aqui",
  compact = false,
  context = "binding",
  owner,
}: {
  code: string;
  onChange: (code: string) => void;
  label?: string;
  compact?: boolean;
  context?: BindingContext;
  owner?: string;
}) {
  const id = useId(),
    [raw, setRaw] = useState(code),
    { active } = useDndContext();
  useEffect(() => setRaw(code), [code]);
  const { project: p, plugin, selectedAction } = useKeyboardStore();
  const errorFor = (value: string) =>
    p ? validateBinding(value, p, plugin, context, new Set(owner ? [owner] : [])) : "";
  const error = raw !== code ? errorFor(raw) : "";
  useDraftError(error);
  const assign = (value: string) => {
    const error = errorFor(value);
    if (error) {
      useKeyboardStore.setState({ error });
      return;
    }
    onChange(p ? normalizeBinding(value, p) : value);
  };
  const commitRaw = () => {
    if (raw.trim() && raw.trim() !== code && !errorFor(raw)) {
      assign(raw.trim());
      if (!code) setRaw("");
    }
  };
  const candidate = active?.data.current?.code ?? selectedAction?.code;
  const candidateError = candidate ? errorFor(candidate) : "";
  const { setNodeRef, isOver } = useDroppable({
    id: `binding-${id}`,
    data: { acceptBinding: assign },
  });
  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={label}
      className={`binding-drop ${compact ? "is-compact" : ""} ${isOver ? (candidateError ? "is-invalid" : "is-over") : ""} ${error ? "is-invalid" : ""}`}
    >
      <button
        type="button"
        className="binding-select"
        disabled={!selectedAction || !!candidateError}
        aria-label={`Atribuir ação a ${label}`}
        title={candidateError || undefined}
        onClick={() => {
          if (selectedAction) assign(selectedAction.code);
        }}
      >
        <span className="text-xs text-slate-300">{label}</span>
        {!compact && (
          <span className="hint">
            {selectedAction
              ? `Usar ${actionName(selectedAction, p)}`
              : "Escolha uma ação na paleta ou arraste para cá"}
          </span>
        )}
      </button>
      {code && (
        <DraggableKey
          validationContext={context}
          action={{ ...action(code), label: displayCode(code, p) }}
          className={compact ? "palette-action" : ""}
        />
      )}
      {p && code && !compact && (
        <BindingArguments
          code={code}
          project={p}
          label={label}
          context={context}
          onChange={assign}
        />
      )}
      <details className="binding-raw">
        <summary>Código ZMK avançado</summary>
        <textarea
          className={`field ${error ? "invalid-field" : ""}`}
          rows={2}
          aria-label={`Binding ZMK: ${label}`}
          aria-invalid={!!error}
          value={raw}
          placeholder="&kp LC(A)"
          onChange={(e) => setRaw(e.target.value)}
          onBlur={commitRaw}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitRaw();
            }
          }}
        />
        {error && (
          <p className="binding-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn" disabled={!!error || raw === code} onClick={commitRaw}>
          Aplicar código
        </button>
      </details>
      {(isOver || !!selectedAction) && candidateError && (
        <p className="binding-error" role="alert">
          {candidateError}
        </p>
      )}
    </div>
  );
}
