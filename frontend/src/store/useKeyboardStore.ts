import { create } from "zustand";
import type { Project, Plugin, Session, ILayer, IKeyAction } from "../types/keyboard";
import { uid } from "../types/keyboard";

const clone = <T>(v: T): T => structuredClone(v);
const canonical = (source: Project): Project => {
  const p = clone(source);
  p.layout.macros ??= [];
  p.layout.combos ??= [];
  p.layout.behaviors ??= [];
  p.layout.layers.forEach((l) => {
    l.sensors ??= [];
  });
  p.layout.behaviors.forEach((b) => {
    b.holdTriggerPositions ??= [];
  });
  p.layout.combos.forEach((c) => {
    c.layerIds ??= [];
  });
  return p;
};
export const layerReference = (id: string) => `@{${id}}`;
export const content = (p: Project) => JSON.stringify({ ...p, revision: "", savedAt: "" });
export const isDirty = (p: Project | null, saved: Project | null) =>
  !!p && (!saved || content(p) !== content(saved));
export function displayCode(code: string, p: Project | null) {
  return code.replace(/@\{([a-z][a-z0-9_]*)\}/g, (_, id: string) => {
    const index = p?.layout.layers.findIndex((l) => l.id === id) ?? -1;
    return index < 0 ? "?" : String(index);
  });
}
interface State {
  project: Project | null;
  savedProject: Project | null;
  initialProject: Project | null;
  template: Project | null;
  plugin: Plugin | null;
  activeLayerId: string;
  error: string;
  selectedAction: IKeyAction | null;
  selectAction: (action: IKeyAction | null) => void;
  initialize: (s: Session) => void;
  markSaved: (p: Project) => void;
  edit: (fn: (draft: Project) => void) => void;
  updateKeyCode: (index: number, code: string) => void;
  updateSensorCode: (id: string, direction: "cw" | "ccw" | "click", code: string) => void;
  setActiveLayer: (id: string) => void;
  undoChanges: () => void;
  addLayer: () => void;
  removeLayer: (index: number) => void;
  resetLayer: (index: number) => void;
  clearLayer: (index: number) => void;
  reorderLayers: (start: number, end: number) => void;
  removeResource: (kind: "macros" | "combos" | "behaviors", id: string) => void;
  dismissError: () => void;
}
function codes(p: Project): string[] {
  return [
    ...p.layout.layers.flatMap((l) => [
      ...l.keys.map((k) => k.code),
      ...l.sensors.flatMap((s) => [s.codeCW, s.codeCCW, s.codeClick]),
    ]),
    ...p.layout.macros.flatMap((m) => m.steps.map((s) => s.binding)),
    ...p.layout.combos.map((c) => c.binding),
    ...p.layout.behaviors.flatMap((b) => b.bindings),
  ];
}
function syncClick(layer: ILayer, index: number, code: string) {
  const key = layer.keys.find((k) => k.keymapIndex === index);
  if (key) key.code = code;
  const sensor = layer.sensors.find((s) => s.clickKeymapIndex === index);
  if (sensor) sensor.codeClick = code;
}
export const useKeyboardStore = create<State>((set, get) => ({
  project: null,
  savedProject: null,
  initialProject: null,
  template: null,
  plugin: null,
  activeLayerId: "",
  error: "",
  selectedAction: null,
  selectAction: (action) => set({ selectedAction: action ? clone(action) : null }),
  initialize: (s) =>
    set({
      project: canonical(s.project),
      savedProject: s.hasSaved ? canonical(s.project) : null,
      initialProject: canonical(s.project),
      template: null,
      plugin: clone(s.plugin),
      activeLayerId: s.project.layout.layers[0].id,
      error: "",
      selectedAction: null,
    }),
  // Updating the saved snapshot must not discard edits made while a save was in flight.
  markSaved: (p) =>
    set((s) => ({
      savedProject: canonical(p),
      project: s.project ? { ...s.project, revision: p.revision, savedAt: p.savedAt } : clone(p),
    })),
  edit: (fn) => {
    const p = get().project;
    if (!p) return;
    const draft = clone(p);
    fn(draft);
    set({ project: draft, error: "" });
  },
  updateKeyCode: (index, code) =>
    get().edit((p) => {
      const l = p.layout.layers.find((l) => l.id === get().activeLayerId);
      if (l) syncClick(l, index, code);
    }),
  updateSensorCode: (id, direction, code) =>
    get().edit((p) => {
      const l = p.layout.layers.find((l) => l.id === get().activeLayerId);
      const s = l?.sensors.find((s) => s.id === id);
      if (!l || !s) return;
      if (direction === "click") syncClick(l, s.clickKeymapIndex, code);
      else if (direction === "cw") s.codeCW = code;
      else s.codeCCW = code;
    }),
  setActiveLayer: (id) => {
    if (get().project?.layout.layers.some((l) => l.id === id)) set({ activeLayerId: id });
  },
  undoChanges: () => {
    const s = get();
    const baseline = s.savedProject ?? s.initialProject;
    if (!baseline) return;
    const restored = clone(baseline);
    set({
      project: restored,
      activeLayerId: restored.layout.layers.some((l) => l.id === s.activeLayerId)
        ? s.activeLayerId
        : restored.layout.layers[0].id,
      error: "",
      selectedAction: null,
    });
  },
  addLayer: () => {
    const s = get();
    if (!s.project || s.project.layout.layers.length >= 32) return;
    const id = uid("layer");
    s.edit((p) => {
      const l = clone(p.layout.layers[0]);
      l.id = id;
      l.name = `Camada ${p.layout.layers.length}`;
      l.keys.forEach((k) => (k.code = "&trans"));
      l.sensors.forEach((s) => {
        s.codeCW = "&trans";
        s.codeCCW = "&trans";
        s.codeClick = "&trans";
      });
      p.layout.layers.push(l);
    });
    set({ activeLayerId: id });
  },
  removeLayer: (index) => {
    const s = get();
    const p = s.project;
    const layer = p?.layout.layers[index];
    if (!p || !layer || p.layout.layers.length <= 1) return;
    const other = clone(p);
    other.layout.layers.splice(index, 1);
    if (
      codes(other).some((c) => c.includes(layerReference(layer.id))) ||
      other.layout.combos.some((c) => c.layerIds.includes(layer.id))
    ) {
      set({
        error: `A camada “${layer.name}” é usada por outras ações ou combos. Remova essas referências antes de excluí-la.`,
      });
      return;
    }
    s.edit((d) => {
      d.layout.layers.splice(index, 1);
    });
    if (s.selectedAction?.code.includes(layerReference(layer.id))) set({ selectedAction: null });
    if (s.activeLayerId === layer.id)
      set({ activeLayerId: other.layout.layers[Math.max(0, index - 1)].id });
  },
  resetLayer: (index) => {
    const s = get();
    const current = s.project?.layout.layers[index];
    if (!current) return;
    const original = s.template?.layout.layers.find((l) => l.id === current.id);
    if (original)
      s.edit((p) => {
        p.layout.layers[index] = {
          ...clone(original),
          id: current.id,
          name: current.name,
        };
      });
    else s.clearLayer(index);
  },
  clearLayer: (index) =>
    get().edit((p) => {
      const l = p.layout.layers[index];
      if (!l) return;
      l.keys.forEach((k) => (k.code = "&trans"));
      l.sensors.forEach((s) => {
        s.codeCW = "&trans";
        s.codeCCW = "&trans";
        s.codeClick = "&trans";
      });
    }),
  reorderLayers: (start, end) =>
    get().edit((p) => {
      if (start < 0 || end < 0 || start >= p.layout.layers.length || end >= p.layout.layers.length)
        return;
      const [l] = p.layout.layers.splice(start, 1);
      p.layout.layers.splice(end, 0, l);
    }),
  removeResource: (kind, id) => {
    const s = get();
    if (!s.project) return;
    const p = clone(s.project);
    if (kind === "macros") p.layout.macros = p.layout.macros.filter((v) => v.id !== id);
    else if (kind === "combos") p.layout.combos = p.layout.combos.filter((v) => v.id !== id);
    else p.layout.behaviors = p.layout.behaviors.filter((v) => v.id !== id);
    if (kind !== "combos" && codes(p).some((c) => c.split(/\s+/)[0] === `&${id}`)) {
      set({
        error: "Este recurso está em uso. Remova as ações que o referenciam antes de excluí-lo.",
      });
      return;
    }
    set({
      project: p,
      selectedAction: s.selectedAction?.code.split(/\s+/)[0] === `&${id}` ? null : s.selectedAction,
    });
  },
  dismissError: () => set({ error: "" }),
}));
