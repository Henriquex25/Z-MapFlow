import { ParameterSlot } from "./ParameterSlot";
import { action } from "../types/keyboard";
import { localizeMessage, tr, useLocale } from "../i18n";
import { useEffect, useId, useState } from "react";
import type { Project } from "../types/keyboard";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { bindingParts, normalizeBinding } from "../utils/bindingParameters";
import {
  bindingParameters,
  parameterDefault,
  validateBinding,
  validateExpression,
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
  const nextValues = (index: number, value: string) => {
    let values = [...draft];
    values[index] = value;
    if (index === 0 && specs[0]?.kind.endsWith("Command")) {
      values = bindingParameters(`${parts[0]} ${value}`, project, plugin).map((s, i) =>
        i === 0 ? value : parameterDefault(s.kind, project),
      );
    }
    return values;
  };
  const withValue = (index: number, value: string) =>
    [parts[0], ...nextValues(index, value)].join(" ");
  const apply = (index: number, value: string) => {
    const values = nextValues(index, value);
    const next = [parts[0], ...values].join(" ");
    setDraft(values);
    if (!validateBinding(next, project, plugin, context, new Set(), false))
      onChange(normalizeBinding(next, project));
  };
  if (!specs.length) return null;
  return (
    <div className="binding-arguments">
      {specs.map((spec, i) => (
        <div className="form-label" key={i}>
          <span>
            {spec.label}
            {specs.length > 1 ? ` ${i + 1}` : ""}
          </span>
          {spec.kind === "layer" ? (
            <ParameterSlot
              code={`&mo ${normalizeBinding(candidate, project).split(/\s+/)[i + 1]}`}
              label={tr("{0} — layer {1}", label, i + 1)}
              mode="values"
              context={context}
              options={() =>
                project.layout.layers.map((l) => ({ ...action(`&mo @{${l.id}}`), label: l.name }))
              }
              errorFor={(value) => {
                const parts = bindingParts(value);
                return parts[0] === "&mo" &&
                  parts.length === 2 &&
                  project.layout.layers.some((l) => `@{${l.id}}` === parts[1])
                  ? ""
                  : tr("Choose a layer from the palette.");
              }}
              onPick={(value) => apply(i, bindingParts(value)[1])}
            />
          ) : spec.kind === "profile" || spec.choices ? (
            <ParameterSlot
              code={code}
              label={tr("{0} — argument {1}", label, i + 1)}
              mode="values"
              context={context}
              options={() =>
                (spec.kind === "profile"
                  ? Array.from({ length: project.options.bluetoothProfiles }, (_, n) => ({
                      value: String(n),
                      label: `${tr("Profile")} ${n + 1}`,
                    }))
                  : spec.choices!.map((value) => ({ value, label: value }))
                ).map((choice) => ({ ...action(withValue(i, choice.value)), label: choice.label }))
              }
              errorFor={(value) => {
                const permitted =
                  spec.kind === "profile"
                    ? Array.from({ length: project.options.bluetoothProfiles }, (_, n) => String(n))
                    : spec.choices!;
                return permitted.some((v) => withValue(i, v) === value)
                  ? validateBinding(value, project, plugin, context, new Set(), false)
                  : tr("Choose a compatible parameter from the palette.");
              }}
              onPick={(value) => apply(i, bindingParts(value)[i + 1])}
            />
          ) : (
            <>
              {spec.kind === "keycode" && (
                <ParameterSlot
                  code={`&kp ${draft[i] ?? ""}`}
                  label={tr("{0} — choose key {1}", label, i + 1)}
                  context={context}
                  errorFor={(value) => {
                    const parts = bindingParts(value);
                    return parts[0] !== "&kp" || parts.length !== 2
                      ? tr("This parameter accepts a key or shortcut, not a complete behavior.")
                      : validateExpression(parts[1], "keycode", project, context === "macro");
                  }}
                  onPick={(value) => apply(i, bindingParts(value)[1])}
                />
              )}
              <details className="parameter-advanced" open={spec.kind !== "keycode"}>
                <summary>{tr("Advanced parameter")}</summary>
                <input
                  type={["integer", "percent"].includes(spec.kind) ? "number" : "text"}
                  min={spec.kind === "percent" ? 0 : undefined}
                  max={spec.kind === "percent" ? 100 : undefined}
                  className={`field ${error ? "invalid-field" : ""}`}
                  aria-invalid={!!error}
                  aria-describedby={error ? `${id}-error` : undefined}
                  aria-label={tr("{0} — argument {1}", label, i + 1)}
                  value={draft[i] ?? ""}
                  spellCheck={false}
                  placeholder={
                    spec.kind === "keycode" ? "A, LCTRL, LC(A)…" : tr("Number or ZMK expression")
                  }
                  onChange={(e) => apply(i, e.target.value)}
                />
              </details>
            </>
          )}
        </div>
      ))}
      {error && (
        <p className="binding-error" id={`${id}-error`} role="alert">
          {localizeMessage(error)}
        </p>
      )}
    </div>
  );
}
