import { localizeMessage, tr, useLocale } from "../i18n";
import { useEffect, useId, useState } from "react";
import type { Project } from "../types/keyboard";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { bindingParts, normalizeBinding } from "../utils/bindingParameters";
import {
  bindingParameters,
  keycodeChoices,
  parameterDefault,
  validateBinding,
  type BindingContext,
} from "../utils/bindingValidation";
import { useDraftError } from "../utils/useDraftError";

export function BindingArguments({
  code,
  project,
  label,
  onChange,
  context = "binding",
}: {
  code: string;
  project: Project;
  label: string;
  onChange: (code: string) => void;
  context?: BindingContext;
}) {
  useLocale();
  const plugin = useKeyboardStore((s) => s.plugin),
    id = useId();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [draft, setDraft] = useState(bindingParts(code).slice(1));
  useEffect(() => setDraft(bindingParts(code).slice(1)), [code]);
  const parts = bindingParts(code),
    specs = bindingParameters(code, project, plugin);
  const candidate = [parts[0], ...draft].join(" ");
  const error =
    draft.join(" ") !== parts.slice(1).join(" ")
      ? validateBinding(candidate, project, plugin, context, new Set(), false)
      : "";
  useDraftError(error);
  const apply = (index: number, value: string) => {
    let values = [...draft];
    values[index] = value;
    if (index === 0 && specs[0]?.kind.endsWith("Command")) {
      const next = bindingParameters(`${parts[0]} ${value}`, project, plugin);
      values = next.map((s, i) => (i === 0 ? value : parameterDefault(s.kind, project)));
    }
    setDraft(values);
    const next = [parts[0], ...values].join(" ");
    if (!validateBinding(next, project, plugin, context, new Set(), false))
      onChange(normalizeBinding(next, project));
  };
  if (!specs.length) return null;
  return (
    <div className="binding-arguments">
      {specs.map((spec, i) => (
        <label className="form-label" key={i}>
          {spec.label}
          {specs.length > 1 ? ` ${i + 1}` : ""}
          {spec.kind === "layer" ? (
            <select
              className="field"
              aria-label={tr("{0} — layer {1}", label, i + 1)}
              value={normalizeBinding(candidate, project).split(/\s+/)[i + 1]}
              onChange={(e) => apply(i, e.target.value)}
            >
              {project.layout.layers.map((l) => (
                <option key={l.id} value={`@{${l.id}}`}>
                  {l.name}
                </option>
              ))}
            </select>
          ) : spec.kind === "profile" ? (
            <select
              className="field"
              aria-label={tr("{0} — argument {1}", label, i + 1)}
              value={draft[i] ?? "0"}
              onChange={(e) => apply(i, e.target.value)}
            >
              {Array.from({ length: project.options.bluetoothProfiles }, (_, n) => (
                <option key={n} value={n}>
                  {tr("Profile")} {n + 1}
                </option>
              ))}
            </select>
          ) : spec.choices ? (
            <select
              className="field"
              aria-label={tr("{0} — argument {1}", label, i + 1)}
              value={draft[i] ?? ""}
              onChange={(e) => apply(i, e.target.value)}
            >
              {spec.choices.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={["integer", "percent"].includes(spec.kind) ? "number" : "text"}
              min={spec.kind === "percent" ? 0 : undefined}
              max={spec.kind === "percent" ? 100 : undefined}
              className={`field ${error ? "invalid-field" : ""}`}
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
              aria-label={tr("{0} — argument {1}", label, i + 1)}
              value={draft[i] ?? ""}
              list={spec.kind === "keycode" ? `${id}-keys` : undefined}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setShowSuggestions(false)}
              spellCheck={false}
              placeholder={
                spec.kind === "keycode" ? "A, LCTRL, LC(A)…" : tr("Number or ZMK expression")
              }
              onChange={(e) => apply(i, e.target.value)}
            />
          )}
        </label>
      ))}
      {showSuggestions && (
        <datalist id={`${id}-keys`}>
          {keycodeChoices(project).map((k) => (
            <option value={k} key={k} />
          ))}
        </datalist>
      )}
      {error && (
        <p className="binding-error" id={`${id}-error`} role="alert">
          {localizeMessage(error)}
        </p>
      )}
    </div>
  );
}
