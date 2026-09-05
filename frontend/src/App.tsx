import { useEffect, useState } from "react";
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay } from "@dnd-kit/core";
import { GetInitialLayout } from "../wailsjs/go/main/App";
import { useKeyboardStore } from "./store/useKeyboardStore";
import { SofleLayout } from "./keyboards/sofle_v2/Layout";
import { ActionTray } from "./components/ActionTray";
import { IKeyAction } from "./types/keyboard";
import { Key } from "./components/Key";
import { getKeyWidth } from "./utils/keyFormatter";

export default function App() {
    const {
        currentLayout,
        activeLayerIndex,
        initializeLayout,
        setActiveLayer,
        undoChanges,
        saveChanges,
        updateKeyCode,
        updateSensorCode,
    } = useKeyboardStore();

    const [activeDragAction, setActiveDragAction] = useState<IKeyAction | null>(null);

    useEffect(() => {
        const fetchLayout = async () => {
            try {
                const initialLayout = await GetInitialLayout();
                initializeLayout(initialLayout);
            } catch (error) {
                console.error(error);
            }
        };
        fetchLayout();
    }, [initializeLayout]);

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        if (active.data.current) {
            setActiveDragAction(active.data.current.action as IKeyAction);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveDragAction(null);
        const { active, over } = event;

        if (over && active.data.current && over.data.current) {
            const newCode = active.data.current.code;

            if (over.data.current.isSensor) {
                const { sensorId, direction } = over.data.current;
                updateSensorCode(sensorId, direction, newCode);
            } else {
                const targetKeymapIndex = over.data.current.keymapIndex;
                updateKeyCode(targetKeymapIndex, newCode);
            }
        }
    };

    if (!currentLayout || currentLayout.layers.length === 0) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p className="text-xl animate-pulse">Loading layout...</p>
            </div>
        );
    }

    const activeLayer = currentLayout.layers[activeLayerIndex];

    return (
        <div className="flex flex-col h-screen px-5 py-4">
            <header className="flex justify-between items-center mb-2.5 border-b border-gray-700 pb-4 shrink-0">
                <h1 className="text-2xl font-bold text-blue-400">Z-MapFlow</h1>

                <div className="flex gap-4">
                    <button
                        onClick={undoChanges}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors cursor-pointer"
                    >
                        Undo Changes
                    </button>
                    <button
                        onClick={saveChanges}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-semibold transition-colors cursor-pointer"
                    >
                        Save Layout
                    </button>
                    <button className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-sm font-semibold transition-colors cursor-pointer">
                        Build Firmware
                    </button>
                </div>
            </header>

            <div className="flex gap-2 pl-2.5 shrink-0">
                {currentLayout.layers.map((layer, index) => (
                    <button
                        key={index}
                        onClick={() => setActiveLayer(index)}
                        className={`px-6 py-2 rounded-t-lg font-semibold transition-colors cursor-pointer ${
                            activeLayerIndex === index
                                ? "bg-gray-800 text-blue-400 border-t-2 border-blue-400"
                                : "bg-gray-900 text-gray-500 hover:bg-gray-800"
                        }`}
                    >
                        {layer.name}
                    </button>
                ))}
            </div>

            <main className="flex-1 flex flex-col min-h-0 bg-gray-900 rounded-xl border border-gray-700 shadow-inner relative">
                <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <div className="flex-1 overflow-auto flex items-start justify-center">
                        <SofleLayout layer={activeLayer} />
                    </div>

                    <ActionTray />

                    <DragOverlay dropAnimation={null}>
                        {activeDragAction ? (
                            <Key
                                action={activeDragAction}
                                className={`opacity-90 scale-110 shadow-2xl cursor-grabbing border-blue-400! ${getKeyWidth(activeDragAction.code)}`}
                            />
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </main>
        </div>
    );
}
