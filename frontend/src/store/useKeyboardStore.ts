import { create } from "zustand";
import { IKeyboardLayout } from "../types/keyboard";

interface KeyboardState {
    currentLayout: IKeyboardLayout | null;
    savedLayout: IKeyboardLayout | null;
    activeLayerIndex: number;

    initializeLayout: (layout: IKeyboardLayout) => void;
    updateLayout: (newLayout: IKeyboardLayout) => void;
    updateKeyCode: (keymapIndex: number, newCode: string) => void;
    updateSensorCode: (sensorId: string, direction: "cw" | "ccw" | "click", newCode: string) => void;
    setActiveLayer: (index: number) => void;
    undoChanges: () => void;
    saveChanges: () => void;
    addLayer: () => void;
    removeLayer: (index: number) => void;
    resetLayer: (index: number) => void;
    reorderLayers: (startIndex: number, endIndex: number) => void;
}

export const useKeyboardStore = create<KeyboardState>((set, get) => ({
    currentLayout: null,
    savedLayout: null,
    activeLayerIndex: 0,

    initializeLayout: (layout) =>
        set({
            currentLayout: layout,
            savedLayout: layout,
            activeLayerIndex: 0,
        }),

    updateLayout: (newLayout) =>
        set({
            currentLayout: newLayout,
        }),

    updateKeyCode: (keymapIndex, newCode) => {
        const { currentLayout, activeLayerIndex } = get();
        if (!currentLayout) return;

        const newLayout = { ...currentLayout };
        const currentLayer = newLayout.layers[activeLayerIndex];

        const keyIndex = currentLayer.keys.findIndex((k) => k.keymapIndex === keymapIndex);
        if (keyIndex !== -1) {
            currentLayer.keys[keyIndex] = { ...currentLayer.keys[keyIndex], code: newCode };
        }

        set({ currentLayout: newLayout });
    },

    updateSensorCode: (sensorId, direction, newCode) => {
        const { currentLayout, activeLayerIndex } = get();
        if (!currentLayout) return;

        const newLayout = { ...currentLayout };
        const currentLayer = newLayout.layers[activeLayerIndex];

        const sensorIndex = currentLayer.sensors.findIndex((s) => s.id === sensorId);
        if (sensorIndex !== -1) {
            const updatedSensor = { ...currentLayer.sensors[sensorIndex] };

            if (direction === "cw") updatedSensor.codeCW = newCode;
            if (direction === "ccw") updatedSensor.codeCCW = newCode;

            if (direction === "click") {
                updatedSensor.codeClick = newCode;

                const keyIndex = currentLayer.keys.findIndex((k) => k.keymapIndex === updatedSensor.clickKeymapIndex);
                if (keyIndex !== -1) {
                    currentLayer.keys[keyIndex] = { ...currentLayer.keys[keyIndex], code: newCode };
                }
            }

            currentLayer.sensors[sensorIndex] = updatedSensor;
        }

        set({ currentLayout: newLayout });
    },

    addLayer: () =>
        set((state) => {
            if (!state.currentLayout) return state;

            const baseLayer = state.currentLayout.layers[0];

            const newLayer = {
                name: `Layer ${state.currentLayout.layers.length}`,
                keys: baseLayer.keys.map((k) => ({ ...k, code: "&trans" })),
                sensors: baseLayer.sensors.map((s) => ({
                    ...s,
                    codeCW: "&trans",
                    codeCCW: "&trans",
                    codeClick: "&trans",
                })),
            };

            return {
                currentLayout: {
                    ...state.currentLayout,
                    layers: [...state.currentLayout.layers, newLayer],
                },
                activeLayerIndex: state.currentLayout.layers.length,
            };
        }),

    removeLayer: (index: number) =>
        set((state) => {
            if (!state.currentLayout || state.currentLayout.layers.length <= 1) return state;

            const newLayers = state.currentLayout.layers.filter((_, i) => i !== index);

            let newActiveIndex = state.activeLayerIndex;
            if (state.activeLayerIndex === index) {
                newActiveIndex = Math.max(0, index - 1);
            } else if (state.activeLayerIndex > index) {
                newActiveIndex -= 1;
            }

            const renamedLayers = newLayers.map((layer, i) => ({
                ...layer,
                name: layer.name.startsWith("Layer") ? `Layer ${i}` : layer.name,
            }));

            return {
                currentLayout: {
                    ...state.currentLayout,
                    layers: renamedLayers,
                },
                activeLayerIndex: newActiveIndex,
            };
        }),

    resetLayer: (index: number) =>
        set((state) => {
            if (!state.currentLayout || state.currentLayout.layers.length <= index) return state;

            const updatedLayers = state.currentLayout.layers.map((layer, i) => {
                if (i === index) {
                    return {
                        ...layer,
                        keys: layer.keys.map((k) => ({ ...k, code: "&trans" })),
                        sensors: layer.sensors.map((s) => ({
                            ...s,
                            codeCW: "&trans",
                            codeCCW: "&trans",
                            codeClick: "&trans",
                        })),
                    };
                }
                return layer;
            });

            return {
                currentLayout: {
                    ...state.currentLayout,
                    layers: updatedLayers,
                },
            };
        }),

    setActiveLayer: (index) =>
        set({
            activeLayerIndex: index,
        }),

    undoChanges: () => {
        const { savedLayout } = get();
        if (savedLayout) {
            set({ currentLayout: savedLayout });
        }
    },

    reorderLayers: (startIndex: number, endIndex: number) =>
        set((state) => {
            if (!state.currentLayout) return state;

            const layers = [...state.currentLayout.layers];
            const [removed] = layers.splice(startIndex, 1);
            layers.splice(endIndex, 0, removed);

            let newActiveIndex = state.activeLayerIndex;
            if (state.activeLayerIndex === startIndex) {
                newActiveIndex = endIndex;
            } else if (state.activeLayerIndex > startIndex && state.activeLayerIndex <= endIndex) {
                newActiveIndex -= 1;
            } else if (state.activeLayerIndex < startIndex && state.activeLayerIndex >= endIndex) {
                newActiveIndex += 1;
            }

            return {
                currentLayout: {
                    ...state.currentLayout,
                    layers,
                },
                activeLayerIndex: newActiveIndex,
            };
        }),

    saveChanges: () => {
        const { currentLayout } = get();
        if (currentLayout) {
            set({ savedLayout: currentLayout });
        }
    },
}));
