import {
  action,
  type Behavior,
  type IKeyAction,
  type Project,
  type Macro,
} from "../types/keyboard";
import { formatKeyVisuals } from "./keyFormatter";

export function actionName(selected: IKeyAction, project: Project | null) {
  const id = selected.code.split(/\s+/)[0]?.slice(1);
  const custom =
    project?.layout.macros.find((m) => m.id === id) ||
    project?.layout.behaviors.find((b) => b.id === id);
  if (custom) return custom.name;
  if (selected.label && !selected.label.startsWith("&")) return selected.label;
  if (selected.code === "&none") return "Sem ação";
  if (selected.code === "&trans") return "Transparente";
  const visual = formatKeyVisuals(selected.code);
  return [visual?.modifier, visual?.main].filter(Boolean).join(" · ") || selected.code;
}

export function behaviorAction(behavior: Behavior) {
  const count =
    behavior.kind === "hold-tap"
      ? 2
      : [
            "sticky-key",
            "key-toggle",
            "toggle-layer",
            "momentary-layer",
            "to-layer",
            "mouse-move",
            "mouse-scroll",
          ].includes(behavior.kind)
        ? 1
        : (behavior.parameterCount ?? 0);
  const defaults = behavior.bindings.map(
    (binding) => binding.trim().split(/\s+/).slice(1).join(" ") || "0",
  );
  const parameters = Array.from(
    { length: count },
    (_, i) => behavior.parameters?.[i] ?? defaults[i] ?? "0",
  );
  const code = [`&${behavior.target || behavior.id}`, ...parameters].join(" ");
  return { ...action(code), label: behavior.name };
}

export function macroAction(macro: Macro) {
  const parameters = Array.from(
    { length: macro.parameterCount ?? 0 },
    (_, i) => macro.parameters?.[i] ?? "0",
  );
  return { ...action([`&${macro.id}`, ...parameters].join(" ")), label: macro.name };
}
