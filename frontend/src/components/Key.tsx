import { IKeyAction } from "../types/keyboard";
import { formatKeyLabel } from "../utils/keyFormatter";

interface KeyProps {
    action: IKeyAction;
    className?: string;
}

export function Key({ action, className = "" }: KeyProps) {
    const displayLabel = action.code ? formatKeyLabel(action.code) : "";

    return (
        <div
            className={`w-14 h-14 bg-gray-700 rounded-md flex items-center justify-center cursor-pointer border border-gray-600 shadow-lg hover:bg-gray-600 transition-all active:border-b-0 active:translate-y-1.25 ${className}`}
        >
            <span className="text-[14px] font-bold text-gray-200 text-center px-1 truncate">{displayLabel}</span>
        </div>
    );
}
