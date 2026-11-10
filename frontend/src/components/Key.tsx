import { IKeyAction } from "../types/keyboard";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { type KeyVisuals } from "../utils/keyFormatter";
import { presentKey, readableName } from "../utils/keyPresentation";
import { keyIcons } from "../utils/keyIcons";

interface KeyProps {
  action: IKeyAction;
  className?: string;
  compact?: boolean;
}

export function Key({ action, className = "", compact = false }: KeyProps) {
  const project = useKeyboardStore((s) => s.project);
  const presentation = presentKey(action.code, project);
  const custom = presentation.name;
  const visuals: KeyVisuals | null =
    !compact && custom
      ? { main: readableName(action.label || custom), description: custom }
      : presentation.visuals;
  const alternatives = compact ? presentation.alternatives : undefined;
  const widthClass = className.includes("w-") ? "" : "w-14";
  const heightClass = className.includes("h-") ? "" : "h-14";

  const IconComponent = visuals?.icon ? keyIcons[visuals.icon] : null;
  const description =
    visuals?.description || custom || [visuals?.modifier, visuals?.main].filter(Boolean).join(" ");
  const tooltip =
    description && description !== action.code ? `${description}\n${action.code}` : action.code;

  const iconOnly =
    compact && !!visuals?.icon && ["SHIFT", "ENTER", "BKSP", "TAB"].includes(visuals.main);
  const behavior = compact ? presentation.badge : undefined;
  return (
    <div
      title={tooltip}
      className={`keycap ${compact ? "keycap-layout" : ""} ${widthClass} ${heightClass} ${behavior ? "keycap-with-behavior" : ""} ${behavior && (visuals?.modifier || visuals?.shift) ? "keycap-with-secondary" : ""} ${custom ? "keycap-custom" : ""} ${className}`}
    >
      {behavior && (
        <span className="keycap-behavior" title={action.code.split(/\s+/)[0]}>
          {behavior}
        </span>
      )}
      {visuals && (
        <>
          {(visuals.modifier || visuals.shift) && (
            <span className={visuals.modifier ? "keycap-modifier" : "keycap-shift"}>
              {visuals.modifier || visuals.shift}
            </span>
          )}
          {alternatives ? (
            <div className="keycap-alternatives">
              {alternatives.map((text, i) => (
                <span className={text.length > 9 ? "is-dense" : ""} key={i}>
                  {text}
                </span>
              ))}
            </div>
          ) : (
            <div
              className={`keycap-content ${behavior || visuals.modifier || visuals.shift ? "has-secondary" : ""}`}
            >
              {IconComponent && (
                <IconComponent size={compact && iconOnly ? 18 : 14} aria-hidden="true" />
              )}
              {visuals.main && !iconOnly && (
                <span
                  className={`keycap-label ${visuals.main.length > 14 ? "is-long" : ""} ${visuals.main.length <= 2 ? "is-short" : ""}`}
                >
                  {visuals.main}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
