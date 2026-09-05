import { useEffect } from "react";
import { GetInitialLayout } from "../wailsjs/go/main/App";
import { useKeyboardStore } from "./store/useKeyboardStore";
import { SofleLayout } from "./keyboards/sofle_v2/Layout";

export default function App() {
    const { currentLayout, activeLayerIndex, initializeLayout, setActiveLayer, undoChanges, saveChanges } =
        useKeyboardStore();

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

    if (!currentLayout || currentLayout.layers.length === 0) {
        return (
            <div className="flex items-center justify-center h-screen">
                <p className="text-xl animate-pulse">Loading layout...</p>
            </div>
        );
    }

    const activeLayer = currentLayout.layers[activeLayerIndex];

    return (
        <div className="flex flex-col h-screen p-6">
            <header className="flex justify-between items-center mb-6 border-b border-gray-700 pb-4">
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

            <div className="flex gap-2 pl-2.5">
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

            <main className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 bg-gray-900 rounded-xl border border-gray-700 shadow-inner overflow-auto flex items-start justify-center">
                    <SofleLayout layer={activeLayer} />
                </div>
            </main>
        </div>
    );
}
