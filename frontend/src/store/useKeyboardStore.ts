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

    saveChanges: () => {
        const { currentLayout } = get();
        if (currentLayout) {
            set({ savedLayout: currentLayout });
        }
    },
}));
