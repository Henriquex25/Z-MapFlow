import { visualSummary } from "../utils/keyPresentation";
import { SearchableSelect, type SelectOption } from "./SearchableSelect";
import { formatKeyVisuals } from "../utils/keyFormatter";
import { localizeMessage, tr, useLocale } from "../i18n";
import { useEffect, useId, useMemo, useState } from "react";
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

// Project snapshots are immutable. Share the formatted catalog between fields
// instead of formatting hundreds of identical key labels for every parameter.
const keyCatalogs = new WeakMap<Project, Map<string, SelectOption[]>>();
function keyOptions(project: Project, locale: string) {
  let catalogs = keyCatalogs.get(project);
  if (!catalogs) keyCatalogs.set(project, (catalogs = new Map()));
  let options = catalogs.get(locale);
  if (!options) {
    options = keycodeChoices(project).map((key) => ({
      value: key,
      label: visualSummary(formatKeyVisuals(`&kp ${key}`)) || key,
      description: key,
    }));
    catalogs.set(locale, options);
  }
  return options;
}

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
  const locale = useLocale();
  const plugin = useKeyboardStore((s) => s.plugin),
    id = useId();
  const keys = useMemo(() => () => keyOptions(project, locale), [project, locale]);
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
        <div className="form-label" key={i}>
          <span>
            {spec.label}
            {specs.length > 1 ? ` ${i + 1}` : ""}
          </span>
          {spec.kind === "layer" ? (
            <SearchableSelect
              label={tr("{0} — layer {1}", label, i + 1)}
              value={normalizeBinding(candidate, project).split(/\s+/)[i + 1]}
              options={project.layout.layers.map((l) => ({ value: `@{${l.id}}`, label: l.name }))}
              onChange={(value) => apply(i, value)}
            />
          ) : spec.kind === "profile" ? (
            <SearchableSelect
              label={tr("{0} — argument {1}", label, i + 1)}
              value={draft[i] ?? "0"}
              options={Array.from({ length: project.options.bluetoothProfiles }, (_, n) => ({
                value: String(n),
                label: `${tr("Profile")} ${n + 1}`,
              }))}
              onChange={(value) => apply(i, value)}
            />
          ) : spec.choices ? (
            <SearchableSelect
              label={tr("{0} — argument {1}", label, i + 1)}
              value={draft[i] ?? ""}
              options={spec.choices.map((c) => ({ value: c, label: c }))}
              onChange={(value) => apply(i, value)}
            />
          ) : (
            <>
              {spec.kind === "keycode" && (
                <SearchableSelect
                  label={tr("{0} — choose key {1}", label, i + 1)}
                  value={draft[i] ?? ""}
                  selectedLabel={
                    visualSummary(formatKeyVisuals(`&kp ${draft[i] ?? ""}`)) || draft[i]
                  }
                  placeholder={tr("Choose a key or enter a shortcut below")}
                  options={keys}
                  onChange={(value) => apply(i, value)}
                />
              )}
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
