import { useDndContext, useDroppable } from "@dnd-kit/core";
import { useEffect, useRef } from "react";
import { Key } from "./Key";
import { action, type IKeyAction } from "../types/keyboard";
import { tr } from "../i18n";
import { usePaletteTarget, type PaletteTarget } from "../store/usePalettePicker";

export function ParameterSlot({
  code,
  label,
  mode = "keycode",
  context = "binding",
  errorFor,
  onPick,
  options,
}: {
  code: string;
  label: string;
  mode?: PaletteTarget["mode"];
  context?: PaletteTarget["context"];
  errorFor: (code: string) => string;
  onPick: (code: string) => void;
  options?: () => IKeyAction[];
}) {
  const { active, activate, id, visible, pick } = usePaletteTarget({
    label,
    mode,
    context,
    error: errorFor,
    pick: onPick,
    options,
  });
  const node = useRef<HTMLButtonElement | null>(null);
  const { active: drag } = useDndContext();
  const error = drag?.data.current?.code ? errorFor(drag.data.current.code) : "";
  const { setNodeRef, isOver } = useDroppable({
    id: `parameter-${id}`,
    disabled: !visible,
    data: {
      acceptBinding: (value: string) => {
        if (!errorFor(value)) pick(value);
      },
    },
  });
  useEffect(() => {
    if (active) node.current?.scrollIntoView?.({ block: "nearest" });
  }, [active]);
  return (
    <button
      type="button"
      ref={(element) => {
        node.current = element;
        setNodeRef(element);
      }}
      className={`parameter-slot ${active ? "is-active" : ""} ${isOver ? (error ? "is-invalid" : "is-over") : ""}`}
      aria-label={tr("Choose {0} from palette", label)}
      aria-pressed={active}
      title={isOver && error ? error : tr("Click to open compatible actions, or drop one here")}
      onClick={activate}
    >
      <Key action={action(code)} compact />
      <span>
        {active ? tr("Choose below") : tr(mode === "keycode" ? "Choose key" : "Choose parameter")}
      </span>
    </button>
  );
}
