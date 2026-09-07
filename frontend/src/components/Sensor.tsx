import { useDroppable } from "@dnd-kit/core";
import { ISensorAction } from "../types/keyboard";
import { formatKeyVisuals } from "../utils/keyFormatter";
import {
    Delete,
    CornerDownLeft,
    ArrowBigUp,
    ArrowUp,
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    Command,
    Option,
    VolumeX,
    Play,
    Bluetooth,
    Menu,
    Layers,
    ChevronsDown,
    ArrowRightToLine,
} from "lucide-react";

const IconMap: Record<string, React.ElementType> = {
    Delete: Delete,
    CornerDownLeft: CornerDownLeft,
    ArrowBigUp: ArrowBigUp,
    ArrowUp: ArrowUp,
    ArrowDown: ArrowDown,
    ArrowLeft: ArrowLeft,
    ArrowRight: ArrowRight,
    Command: Command,
    Option: Option,
    VolumeX: VolumeX,
    Play: Play,
    Bluetooth: Bluetooth,
    Menu: Menu,
    Layers: Layers,
    ChevronsDown: ChevronsDown,
    ArrowRightToLine: ArrowRightToLine,
};

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

    const visuals = code ? formatKeyVisuals(code) : null;
    const highlight = isOver ? "!bg-blue-500 !text-white ring-2 ring-blue-400 z-10" : "";
    const IconComponent = visuals?.icon ? IconMap[visuals.icon] : null;

    return (
        <div
            ref={setNodeRef}
            className={`${className} ${highlight} transition-colors relative flex items-center justify-center flex-1`}
        >
            <span className="absolute top-0.5 text-[7px] text-gray-400 opacity-60 font-bold">{label}</span>

            <div className="mt-3 flex items-center justify-center gap-1 px-1 w-full overflow-hidden">
                {IconComponent && <IconComponent size={10} className="text-gray-300 shrink-0" />}
                {visuals?.main && <span className="text-[9px] font-bold truncate text-gray-200">{visuals.main}</span>}
            </div>
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
            <div className="w-24 h-24 rounded-full bg-gray-800 border-2 border-gray-700 flex flex-col overflow-hidden shadow-lg">
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
