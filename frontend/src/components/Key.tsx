import { IKeyAction } from "../types/keyboard";
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

interface KeyProps {
    action: IKeyAction;
    className?: string;
}

export function Key({ action, className = "" }: KeyProps) {
    const visuals = action.code ? formatKeyVisuals(action.code) : null;
    const widthClass = className.includes("w-") ? "" : "w-14";
    const heightClass = className.includes("h-") ? "" : "h-14";

    const IconComponent = visuals?.icon ? IconMap[visuals.icon] : null;

    return (
        <div
            title={action.code}
            className={`${widthClass} ${heightClass} bg-gray-700 rounded-md flex flex-col p-1 cursor-pointer border border-gray-600 shadow-lg hover:bg-gray-600 transition-all active:border-b-0 active:translate-y-1.25 overflow-hidden ${className}`}
        >
            {visuals ? (
                visuals.modifier ? (
                    <div className="flex flex-col justify-between h-full w-full py-0.5">
                        <span className="text-[9px] font-bold text-sky-400 text-center leading-none truncate px-0.5">
                            {visuals.modifier}
                        </span>
                        <div className="flex items-center justify-center w-full gap-1 my-auto">
                            {IconComponent && <IconComponent size={12} className="text-gray-300 shrink-0" />}
                            {visuals.main && (
                                <span className="text-xs font-bold text-gray-200 truncate">{visuals.main}</span>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        {visuals.shift && (
                            <span className="text-[10px] font-bold text-gray-400 self-start leading-none mb-auto pl-0.5 pt-0.5">
                                {visuals.shift}
                            </span>
                        )}

                        <div
                            className={`flex items-center justify-center w-full h-full gap-1 ${visuals.shift ? "mt-auto pb-0.5" : ""}`}
                        >
                            {IconComponent && <IconComponent size={14} className="text-gray-300 shrink-0" />}
                            {visuals.main && (
                                <span
                                    className={`font-bold text-gray-200 truncate ${visuals.shift ? "text-xs" : "text-sm"}`}
                                >
                                    {visuals.main}
                                </span>
                            )}
                        </div>
                    </>
                )
            ) : null}
        </div>
    );
}
