import { useDroppable } from "@dnd-kit/core";
import { ISensorAction } from "../types/keyboard";
import { displayCode, useKeyboardStore } from "../store/useKeyboardStore";
import { formatKeyVisuals } from "../utils/keyFormatter";
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
  const { isOver, setNodeRef } = useDroppable({
    id: id,
    data: {
      isSensor: true,
      sensorId: sensorId,
      direction: direction,
    },
  });

  const project = useKeyboardStore((s) => s.project);
  const selectedAction = useKeyboardStore((s) => s.selectedAction);
  const updateSensorCode = useKeyboardStore((s) => s.updateSensorCode);
  const reference = code.split(/\s+/)[0]?.slice(1);
  const custom =
    project?.layout.macros.find((m) => m.id === reference) ||
    project?.layout.behaviors.find((b) => b.id === reference);
  const visuals = custom
    ? { main: custom.name }
    : code
      ? formatKeyVisuals(displayCode(code, project))
      : null;
  const DirectionIcon =
    direction === "cw" ? RotateCw : direction === "ccw" ? RotateCcw : MousePointer2;
  const IconComponent = visuals?.icon ? keyIcons[visuals.icon] : null;

  return (
    <button
      type="button"
      aria-label={`${sensorId} ${label}: ${custom?.name || displayCode(code, project)}`}
      ref={setNodeRef}
      onClick={() => {
        if (selectedAction) updateSensorCode(sensorId, direction, selectedAction.code);
      }}
      className={`encoder-zone ${isOver ? "is-over" : ""}`}
      title={`${label} — ${custom?.name || displayCode(code, project)}`}
    >
      <DirectionIcon size={14} className="encoder-direction" aria-hidden="true" />
      <span className="encoder-binding">
        {IconComponent && <IconComponent size={13} aria-hidden="true" />}
        {visuals?.main && <span>{visuals.main}</span>}
      </span>
    </button>
  );
}

interface SensorProps {
  sensor: ISensorAction;
}

export function Sensor({ sensor }: SensorProps) {
  return (
    <div className="encoder">
      <span className="encoder-label">{sensor.label}</span>
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
