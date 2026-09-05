import { ISensorAction, IKeyAction } from "../types/keyboard";
import { DroppableKey } from "./DroppableKey";
import { Key } from "./Key";
import { Sensor } from "./Sensor";

export interface HalfLayout {
    offsets: number[];
    thumbRowStartIndex?: number;
    keys: IKeyAction[];
}

interface KeyboardBuilderProps {
    left: HalfLayout;
    right: HalfLayout;
    sensors?: ISensorAction[];
}

const offsetMap: Record<number, string> = {
    0: "mt-0",
    1: "mt-4",
    2: "mt-8",
    3: "mt-10",
    4: "mt-12",
    5: "mt-16",
    6: "mt-20",
};

export function KeyboardBuilder({ left, right, sensors }: KeyboardBuilderProps) {
    const renderHalf = (config: HalfLayout) => {
        return config.offsets.map((offsetValue, colIndex) => {
            const colKeys = config.keys.filter((k) => k.col === colIndex);

            return (
                <div key={`col-${colIndex}`} className={`flex flex-col gap-2 ${offsetMap[offsetValue] || "mt-0"}`}>
                    {colKeys.map((action) => {
                        const isThumb =
                            config.thumbRowStartIndex !== undefined && action.row >= config.thumbRowStartIndex;

                        return (
                            <DroppableKey key={action.keymapIndex} action={action} className={isThumb ? "mt-6" : ""} />
                        );
                    })}
                </div>
            );
        });
    };

    return (
        <div className="flex flex-col w-full h-full p-8 overflow-y-auto items-center">
            <div className="flex gap-24 items-start justify-center mt-4 shrink-0">
                <div className="flex gap-2">{renderHalf(left)}</div>
                <div className="flex gap-2">{renderHalf(right)}</div>
            </div>

            {sensors && sensors.length > 0 && (
                <div className="pt-8 w-full max-w-4xl flex justify-center gap-24 px-12">
                    {sensors.map((sensor) => (
                        <Sensor key={sensor.id} sensor={sensor} />
                    ))}
                </div>
            )}
        </div>
    );
}
