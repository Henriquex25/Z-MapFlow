import { create } from "zustand";
import { IKeyboardLayout } from "../types/keyboard";

interface KeyboardState {
    currentLayout: IKeyboardLayout | null;
    savedLayout: IKeyboardLayout | null;
    activeLayerIndex: number;

    initializeLayout: (layout: IKeyboardLayout) => void;
    updateLayout: (newLayout: IKeyboardLayout) => void;
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
