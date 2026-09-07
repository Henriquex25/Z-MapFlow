import { useEffect, useRef } from "react";

interface LayerContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onReset: () => void;
}

export function LayerContextMenu({ x, y, onClose, onReset }: LayerContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            style={{ top: y, left: x }}
            className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 w-44 text-xs font-semibold"
        >
            <button
                onClick={() => {
                    onReset();
                    onClose();
                }}
                className="w-full text-left px-4 py-2 text-red-400 hover:bg-gray-700/60 transition-colors cursor-pointer flex items-center gap-2"
            >
                🔄 Reset to Default
            </button>
        </div>
    );
}
