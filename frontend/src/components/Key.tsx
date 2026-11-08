import { IKeyAction } from "../types/keyboard";
import { displayCode, useKeyboardStore } from "../store/useKeyboardStore";
import { formatKeyVisuals, type KeyVisuals } from "../utils/keyFormatter";
import { keyIcons } from "../utils/keyIcons";

interface KeyProps {
  action: IKeyAction;
  className?: string;
  compact?: boolean;
}

export function Key({ action, className = "", compact = false }: KeyProps) {
  const project = useKeyboardStore((s) => s.project);
  const reference = action.code.split(" ")[0]?.slice(1);
  const custom =
    project?.layout.macros.find((m) => m.id === reference) ||
    project?.layout.behaviors.find((b) => b.id === reference);
  const visuals: KeyVisuals | null = custom
    ? { main: custom.name }
    : action.code
      ? formatKeyVisuals(displayCode(action.code, project))
      : null;
  const widthClass = className.includes("w-") ? "" : "w-14";
  const heightClass = className.includes("h-") ? "" : "h-14";

  const IconComponent = visuals?.icon ? keyIcons[visuals.icon] : null;
  const description =
    custom?.name ||
    visuals?.description ||
    [visuals?.modifier, visuals?.main].filter(Boolean).join(" ");
  const tooltip =
    description && description !== action.code ? `${description}\n${action.code}` : action.code;

  const iconOnly =
    compact && !!visuals?.icon && ["SHIFT", "ENTER", "BKSP", "TAB"].includes(visuals.main);
  const behavior = compact ? action.code.trim().match(/^&\S+/)?.[0] : undefined;
  return (
    <div
      title={tooltip}
      className={`keycap ${widthClass} ${heightClass} ${behavior ? "keycap-with-behavior" : ""} ${behavior && (visuals?.modifier || visuals?.shift) ? "keycap-with-secondary" : ""} ${custom ? "keycap-custom" : ""} ${className}`}
    >
      {behavior && (
        <span className="keycap-behavior" title={behavior}>
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
          <div
            className={`keycap-content ${behavior || visuals.modifier || visuals.shift ? "has-secondary" : ""}`}
          >
            {IconComponent && (
              <IconComponent size={compact && iconOnly ? 18 : 14} aria-hidden="true" />
            )}
            {visuals.main && !iconOnly && (
              <span className={`keycap-label ${visuals.main.length > 7 ? "is-long" : ""}`}>
                {visuals.main}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
