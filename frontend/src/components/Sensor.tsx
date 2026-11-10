import { tr, useLocale } from "../i18n";
import { useDroppable, useDndContext } from "@dnd-kit/core";
import { validateBinding } from "../utils/bindingValidation";
import { ISensorAction } from "../types/keyboard";
import { displayCode, useKeyboardStore } from "../store/useKeyboardStore";
import { presentKey, visualSummary } from "../utils/keyPresentation";
import { RotateCcw, RotateCw, MousePointer2 } from "lucide-react";
import { keyIcons } from "../utils/keyIcons";

interface DropZoneProps {
  id: string;
  sensorId: string;
  direction: "ccw" | "click" | "cw";
  code: string;
  label: string;
}

function SensorDropZone({ id, sensorId, direction, code, label }: DropZoneProps) {
  useLocale();
  const { isOver, setNodeRef } = useDroppable({
    id: id,
    data: {
      isSensor: true,
      sensorId: sensorId,
      direction: direction,
    },
  });

  const { active } = useDndContext();
  const plugin = useKeyboardStore((s) => s.plugin);
  const project = useKeyboardStore((s) => s.project);
  const selectedAction = useKeyboardStore((s) => s.selectedAction);
  const updateSensorCode = useKeyboardStore((s) => s.updateSensorCode);
  const reference = code.split(/\s+/)[0]?.slice(1);
  const custom =
    project?.layout.macros.find((m) => m.id === reference) ||
    project?.layout.behaviors.find((b) => b.id === reference);
  const visuals = presentKey(code, project).visuals;
  const DirectionIcon =
    direction === "cw" ? RotateCw : direction === "ccw" ? RotateCcw : MousePointer2;
  const IconComponent = visuals?.icon ? keyIcons[visuals.icon] : null;

  const candidate = active?.data.current?.code ?? selectedAction?.code;
  const error = project
    ? validateBinding(code, project, plugin) ||
      (isOver && candidate ? validateBinding(candidate, project, plugin) : "")
    : "";
  return (
    <button
      type="button"
      aria-label={`${sensorId} ${label}: ${custom?.name || displayCode(code, project)}`}
      ref={setNodeRef}
      onClick={() => {
        if (selectedAction) updateSensorCode(sensorId, direction, selectedAction.code);
      }}
      aria-invalid={!!error}
      className={`encoder-zone ${error ? "invalid-action" : ""} ${isOver ? "is-over" : ""}`}
      title={error || `${label} — ${custom?.name || displayCode(code, project)}`}
    >
      <DirectionIcon size={14} className="encoder-direction" aria-hidden="true" />
      <span className="encoder-binding">
        {IconComponent && <IconComponent size={13} aria-hidden="true" />}
        {visuals?.main && <span>{visualSummary(visuals)}</span>}
      </span>
    </button>
  );
}

interface SensorProps {
  sensor: ISensorAction;
}

export function Sensor({ sensor }: SensorProps) {
  useLocale();
  return (
    <div className="encoder">
      <span className="encoder-label">{tr(sensor.label)}</span>
      <div className="encoder-controls">
        <SensorDropZone
          id={`${sensor.id}-ccw`}
          sensorId={sensor.id}
          direction="ccw"
          code={sensor.codeCCW}
          label="CCW"
        />

        <SensorDropZone
          id={`${sensor.id}-click`}
          sensorId={sensor.id}
          direction="click"
          code={sensor.codeClick}
          label="CLK"
        />

        <SensorDropZone
          id={`${sensor.id}-cw`}
          sensorId={sensor.id}
          direction="cw"
          code={sensor.codeCW}
          label="CW"
        />
      </div>
    </div>
  );
}
