import { create } from "zustand";
import { createContext, useContext, useEffect, useId, useMemo, useRef } from "react";
import type { IKeyAction } from "../types/keyboard";
import type { BindingContext } from "../utils/bindingValidation";
import { ResourceVisibility } from "../utils/resourceVisibility";
import { useKeyboardStore } from "./useKeyboardStore";

export const PaletteOrigin = createContext(false);
export type PaletteTarget = {
  id: string;
  label: string;
  mode: "binding" | "keycode" | "values";
  context: BindingContext;
  preserveTab: boolean;
  error: (code: string) => string;
  pick: (code: string) => void;
  options?: () => IKeyAction[];
};
type State = {
  collapsed: boolean;
  target: PaletteTarget | null;
  setCollapsed: (value: boolean) => void;
  open: (target: PaletteTarget) => void;
  clear: () => void;
};
export const usePalettePicker = create<State>((set) => ({
  collapsed: false,
  target: null,
  setCollapsed: (collapsed) => set({ collapsed }),
  open: (target) => set({ target, collapsed: false }),
  clear: () => set({ target: null }),
}));
export function choosePaletteAction(code: string) {
  const target = usePalettePicker.getState().target;
  if (!target) return false;
  const error = target.error(code);
  if (error) {
    useKeyboardStore.setState({ error });
    return true;
  }
  target.pick(code);
  return true;
}
export function usePaletteTarget(input: Omit<PaletteTarget, "id" | "preserveTab">) {
  const id = useId(),
    visible = useContext(ResourceVisibility),
    preserveTab = useContext(PaletteOrigin);
  const latest = useRef(input);
  latest.current = input;
  const target = useMemo<PaletteTarget>(
    () => ({
      id,
      label: input.label,
      mode: input.mode,
      context: input.context,
      preserveTab,
      error: (code) => latest.current.error(code),
      pick: (code) => {
        latest.current.pick(code);
        if (usePalettePicker.getState().target?.id === id) usePalettePicker.getState().clear();
      },
      options: input.options ? () => latest.current.options?.() ?? [] : undefined,
    }),
    [id, input.label, input.mode, input.context, preserveTab, !!input.options],
  );
  useEffect(() => {
    if (!visible && usePalettePicker.getState().target?.id === id)
      usePalettePicker.getState().clear();
    return () => {
      if (usePalettePicker.getState().target?.id === id) usePalettePicker.getState().clear();
    };
  }, [id, visible, target]);
  const active = usePalettePicker((s) => s.target?.id === id);
  const activate = () => {
    if (!visible) return;
    useKeyboardStore.getState().selectAction(null);
    usePalettePicker.getState().open(target);
  };
  return { active, activate, id, visible, pick: target.pick };
}
