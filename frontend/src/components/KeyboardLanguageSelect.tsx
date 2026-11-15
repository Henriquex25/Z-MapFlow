import { Languages } from "lucide-react";
import { tr, useLocale } from "../i18n";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { abnt2HeaderName, setKeyboardLanguage } from "../utils/keyboardLanguage";

export function KeyboardLanguageSelect({
  compact = false,
  label = "Keyboard language",
  onChange,
}: {
  compact?: boolean;
  label?: string;
  onChange?: (locale: string) => void;
}) {
  useLocale();
  const project = useKeyboardStore((s) => s.project);
  if (!project) return null;
  return (
    <label className={compact ? "palette-language-select" : "form-label"} title={tr(label)}>
      {compact && <Languages size={16} aria-hidden="true" />}
      <span className={compact ? "sr-only" : ""}>{tr(label)}</span>
      <select
        className="field"
        aria-label={tr(label)}
        value={project.options.locale}
        onChange={(event) => {
          const locale = event.target.value;
          useKeyboardStore.getState().edit((p) => setKeyboardLanguage(p, locale));
          useKeyboardStore.getState().selectAction(null);
          onChange?.(locale);
        }}
      >
        <option value="us">US / ANSI</option>
        <option value="pt-br">{tr("Portuguese (Brazil) — ABNT2")}</option>
        {Object.keys(project.headers ?? {})
          .filter((name) => name !== abnt2HeaderName)
          .map((name) => (
            <option key={name} value={`header:${name}`}>
              {tr("Header: {0}", name)}
            </option>
          ))}
      </select>
    </label>
  );
}
