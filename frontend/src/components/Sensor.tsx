import { ISensorAction } from "../types/keyboard";

interface SensorProps {
    sensor: ISensorAction;
}

export function Sensor({ sensor }: SensorProps) {
    return (
        <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-gray-400 font-semibold">{sensor.label}</span>
            <div className="w-18 h-18 rounded-full bg-gray-800 border-2 border-gray-700 flex flex-col overflow-hidden cursor-pointer hover:border-gray-500 transition-colors shadow-lg">
                <div className="flex-1 flex items-center justify-center bg-gray-700 hover:bg-gray-600 border-b border-gray-800 text-[9px] font-bold text-gray-300">
                    CCW
                </div>

                <div className="flex-1 flex items-center justify-center bg-gray-600 hover:bg-gray-500 border-b border-gray-800 shadow-inner">
                    <span className="text-[10px] font-bold text-blue-300">CLK</span>
                </div>

                <div className="flex-1 flex items-center justify-center bg-gray-700 hover:bg-gray-600 text-[9px] font-bold text-gray-300">
                    CW
                </div>
            </div>
        </div>
    );
}
