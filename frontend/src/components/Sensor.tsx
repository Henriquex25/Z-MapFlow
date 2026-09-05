import { useDroppable } from "@dnd-kit/core";
import { ISensorAction } from "../types/keyboard";
import { formatKeyLabel } from "../utils/keyFormatter";

interface DropZoneProps {
    id: string;
    sensorId: string;
    direction: "ccw" | "click" | "cw";
    code: string;
    label: string;
    className: string;
}

function SensorDropZone({ id, sensorId, direction, code, label, className }: DropZoneProps) {
    const { isOver, setNodeRef } = useDroppable({
        id: id,
        data: {
            isSensor: true,
            sensorId: sensorId,
            direction: direction,
        },
    });

    const displayCode = code ? formatKeyLabel(code) : "";
    const highlight = isOver ? "!bg-blue-500 !text-white ring-2 ring-blue-400 z-10" : "";

    return (
        <div
            ref={setNodeRef}
            className={`${className} ${highlight} transition-colors relative flex items-center justify-center flex-1`}
        >
            <span className="absolute top-0.5 text-[7px] text-gray-400 opacity-60 font-bold">{label}</span>
            <span className="text-[9px] font-bold truncate px-1 mt-2 text-gray-200">{displayCode}</span>
        </div>
    );
}

interface SensorProps {
    sensor: ISensorAction;
}

export function Sensor({ sensor }: SensorProps) {
    return (
        <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-gray-400 font-semibold">{sensor.label}</span>
            <div className="w-22 h-22 rounded-full bg-gray-800 border-2 border-gray-700 flex flex-col overflow-hidden shadow-lg">
                <SensorDropZone
                    id={`${sensor.id}-ccw`}
                    sensorId={sensor.id}
                    direction="ccw"
                    code={sensor.codeCCW}
                    label="CCW"
                    className="bg-gray-700 hover:bg-gray-600 border-b border-gray-800"
                />

                <SensorDropZone
                    id={`${sensor.id}-click`}
                    sensorId={sensor.id}
                    direction="click"
                    code={sensor.codeClick}
                    label="CLK"
                    className="bg-gray-600 hover:bg-gray-500 border-b border-gray-800 shadow-inner"
                />

                <SensorDropZone
                    id={`${sensor.id}-cw`}
                    sensorId={sensor.id}
                    direction="cw"
                    code={sensor.codeCW}
                    label="CW"
                    className="bg-gray-700 hover:bg-gray-600"
                />
            </div>
        </div>
    );
}
