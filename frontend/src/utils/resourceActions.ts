import { action, type Behavior, type IKeyAction, type Project } from "../types/keyboard";
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
  const parameters = behavior.bindings.map((binding) =>
    binding.trim().split(/\s+/).slice(1).join(" "),
  );
  const code =
    behavior.kind === "hold-tap" ? `&${behavior.id} ${parameters.join(" ")}` : `&${behavior.id}`;
  return { ...action(code), label: behavior.name };
}
