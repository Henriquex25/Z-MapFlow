import { useEffect, useState } from "react";
import {
    DndContext,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    Modifier,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { DraggableLayerTab } from "./components/DraggableLayerTab";
import { GetInitialLayout } from "../wailsjs/go/main/App";
import { useKeyboardStore } from "./store/useKeyboardStore";
import { SofleLayout } from "./keyboards/sofle_v2/Layout";
import { ActionTray } from "./components/ActionTray";
import { IKeyAction } from "./types/keyboard";
import { Key } from "./components/Key";
import { getKeyWidth } from "./utils/keyFormatter";
import { Plus } from "lucide-react";
import { LayerContextMenu } from "./components/LayerContextMenu";

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
        addLayer,
        removeLayer,
        resetLayer,
        reorderLayers,
    } = useKeyboardStore();

    const [activeDragAction, setActiveDragAction] = useState<IKeyAction | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
    );

    const lockToAxis: Modifier = ({ transform }) => {
        return {
            ...transform,
            y: 0,
        };
    };

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

    const layerIds = currentLayout?.layers.map((layer) => layer.name) || [];

    const handleTabDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = layerIds.indexOf(String(active.id));
            const newIndex = layerIds.indexOf(String(over.id));

            if (oldIndex !== -1 && newIndex !== -1) {
                reorderLayers(oldIndex, newIndex);
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

            <div className="flex gap-1.5 pl-2.5 shrink-0 items-end relative overflow-x-auto overflow-y-hidden pt-2">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToHorizontalAxis]}
                    onDragEnd={handleTabDragEnd}
                >
                    <SortableContext items={layerIds} strategy={horizontalListSortingStrategy}>
                        {currentLayout.layers.map((layer, index) => (
                            <DraggableLayerTab
                                key={layer.name}
                                id={layer.name}
                                index={index}
                                layer={layer}
                                isActive={activeLayerIndex === index}
                                canRemove={currentLayout.layers.length > 1}
                                onClick={() => setActiveLayer(index)}
                                onRemove={() => removeLayer(index)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setActiveLayer(index);
                                    setContextMenu({ x: e.clientX, y: e.clientY, index });
                                }}
                            />
                        ))}
                    </SortableContext>
                </DndContext>

                <button
                    onClick={addLayer}
                    className="px-4 py-2 ml-2 bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-blue-400 rounded-t-lg font-semibold transition-colors cursor-pointer text-sm mb-px shrink-0"
                >
                    <Plus size={16} />
                </button>
            </div>

            {contextMenu && (
                <LayerContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    onReset={() => resetLayer(contextMenu.index)}
                />
            )}

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
