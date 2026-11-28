import { usePaletteTarget, usePalettePicker } from "../store/usePalettePicker";
import { SearchableSelect } from "./SearchableSelect";
import { ResourceVisibility } from "../utils/resourceVisibility";
import { bindingChoices } from "../utils/bindingChoices";
import { bindingParts } from "../utils/bindingParameters";
import { localizeMessage, tr, useLocale } from "../i18n";
import { BindingArguments } from "./BindingArguments";
import { useId, useRef, useState, useEffect, useMemo, useContext } from "react";
import { useDroppable, useDndContext } from "@dnd-kit/core";
import { displayCode, useKeyboardStore } from "../store/useKeyboardStore";
import { Key } from "./Key";
import { Plus, Pencil } from "lucide-react";
import { actionName } from "../utils/resourceActions";
import { DraggableKey } from "./DraggableKey";
import { action } from "../types/keyboard";
import { normalizeBinding } from "../utils/bindingParameters";
import { validateBinding, type BindingContext } from "../utils/bindingValidation";
import { useDraftError } from "../utils/useDraftError";
export function BindingDrop({
  code,
  onChange,
  label = tr("Drop an action here"),
  compact = false,
  condensed = false,
  context = "binding",
  owner,
  keysOnly = false,
}: {
  code: string;
  onChange: (code: string) => void;
  label?: string;
  compact?: boolean;
  condensed?: boolean;
  context?: BindingContext;
  owner?: string;
  keysOnly?: boolean;
}) {
  const locale = useLocale();
  const visible = useContext(ResourceVisibility);
  const id = useId(),
    [raw, setRaw] = useState(code),
    { active } = useDndContext();
  useEffect(() => setRaw(code), [code]);
  const p = useKeyboardStore((s) => s.project);
  const plugin = useKeyboardStore((s) => s.plugin);
  const selectedAction = useKeyboardStore((s) => s.selectedAction);
  const choices = useMemo(
    () => (p ? bindingChoices(p, plugin, context, owner) : []),
    [p, plugin, context, owner, locale],
  );
  const errorFor = (value: string) => {
    if (keysOnly && (bindingParts(value)[0] !== "&kp" || bindingParts(value).length !== 2))
      return tr("This parameter accepts a key or shortcut, not a complete behavior.");
    const alias = p?.layout.behaviors.find((b) => b.id === owner)?.target;
    return p
      ? validateBinding(
          value,
          p,
          plugin,
          context,
          new Set([owner, alias].filter((v): v is string => !!v)),
        )
      : "";
  };
  const error = raw !== code ? errorFor(raw) : "";
  useDraftError(error);
  const assign = (value: string) => {
    const error = errorFor(value);
    if (error) {
      useKeyboardStore.setState({ error });
      return;
    }
    onChange(p ? normalizeBinding(value, p) : value);
    usePalettePicker.getState().clear();
  };
  const picker = usePaletteTarget({
    label,
    mode: keysOnly ? "keycode" : "binding",
    context,
    error: errorFor,
    pick: assign,
  });
  const container = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (picker.active) container.current?.scrollIntoView?.({ block: "nearest" });
  }, [picker.active]);
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
    disabled: !visible,
    data: { acceptBinding: picker.pick },
  });
  const editor = (
    <>
      {p && !compact && (
        <div className="form-label binding-behavior-select">
          <span>{tr("Behavior")}</span>
          <SearchableSelect
            label={tr("{0} — behavior", label)}
            value={
              choices.find((a) => bindingParts(a.code)[0] === bindingParts(code)[0])?.code ??
              bindingParts(code)[0] ??
              ""
            }
            placeholder={tr("Choose an action")}
            options={choices.map((a) => ({
              value: a.code,
              label: a.label,
              group: tr(a.group),
              disabled: !!a.error,
              description: a.error || undefined,
              searchText: a.code,
            }))}
            onChange={(value) => {
              const choice = choices.find((a) => a.code === value);
              if (choice && !choice.error) assign(choice.code);
            }}
          />
        </div>
      )}
      {p && code && !compact && (
        <BindingArguments
          code={code}
          project={p}
          label={tr(label)}
          context={context}
          onChange={assign}
        />
      )}
      <details className="binding-raw">
        <summary>{tr("Advanced ZMK code")}</summary>
        <textarea
          className={`field ${error ? "invalid-field" : ""}`}
          rows={2}
          aria-label={tr("ZMK binding: {0}", label)}
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
            {localizeMessage(error)}
          </p>
        )}
        <button className="btn" disabled={!!error || raw === code} onClick={commitRaw}>
          {tr("Apply code")}{" "}
        </button>
      </details>
    </>
  );
  return (
    <div
      ref={(node) => {
        container.current = node;
        setNodeRef(node);
      }}
      role="group"
      aria-label={tr(label)}
      className={`binding-drop ${compact ? "is-compact" : ""} ${condensed ? "is-condensed" : ""} ${isOver ? (candidateError ? "is-invalid" : "is-over") : ""} ${error ? "is-invalid" : ""} ${picker.active ? "is-active" : ""}`}
    >
      <button
        type="button"
        className={`binding-select ${condensed ? "binding-slot" : ""}`}
        disabled={!visible}
        aria-label={tr("Assign action to {0}", label)}
        title={candidateError || tr("Click to choose, or drop an action here.")}
        onClick={() => {
          if (selectedAction && !candidateError) {
            picker.pick(selectedAction.code);
            useKeyboardStore.getState().selectAction(null);
          } else picker.activate();
        }}
      >
        {condensed ? (
          <>
            {code ? (
              <Key action={action(code)} compact />
            ) : (
              <span className="empty-key-slot">
                <Plus size={20} aria-hidden="true" />
              </span>
            )}
            <span>{code ? actionName(action(code), p) : tr(label)}</span>
          </>
        ) : (
          <>
            {!code && (
              <span className="empty-key-slot">
                <Plus size={20} aria-hidden="true" />
              </span>
            )}
            <span className="text-xs text-slate-300">{tr(label)}</span>
          </>
        )}
      </button>
      {code && !condensed && (
        <DraggableKey
          validationContext={context}
          onChoose={picker.activate}
          action={{ ...action(code), label: displayCode(code, p) }}
          className={compact ? "palette-action" : ""}
        />
      )}
      {condensed ? (
        <details className="binding-editor-options">
          <summary
            aria-label={tr("Edit action and parameters")}
            title={tr("Edit action and parameters")}
          >
            <Pencil size={16} aria-hidden="true" />
            <span className="sr-only">{tr("Edit action and parameters")}</span>
          </summary>
          <div className="binding-editor-fields">{editor}</div>
        </details>
      ) : (
        editor
      )}
      {(isOver || !!selectedAction) && candidateError && (
        <p className="binding-error" role="alert">
          {localizeMessage(candidateError)}
        </p>
      )}
    </div>
  );
}
