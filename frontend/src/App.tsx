import appIcon from "../../build/appicon.png";
import { AppVersion } from "./components/AppVersion";
import { localizeMessage, tr, useLocale } from "./i18n";
import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  Plus,
  Minus,
  Keyboard,
  Save,
  Hammer,
  Download,
  Upload,
  Code,
  ListOrdered,
  Combine,
  Zap,
  Layers,
  Settings,
  RotateCcw,
  FileDown,
  SaveAll,
} from "lucide-react";
import { WorkspaceSplit } from "./components/WorkspaceSplit";
import { api } from "./services/api";
import { projectBindingError, validateBinding } from "./utils/bindingValidation";
import { content, isDirty, useKeyboardStore } from "./store/useKeyboardStore";
import type { Build, IKeyAction, Plugin, Session } from "./types/keyboard";
import { ActionTray } from "./components/ActionTray";
import { LayerSidebar } from "./components/LayerSidebar";
import { LayerContextMenu } from "./components/LayerContextMenu";
import { KeyboardLayout } from "./components/KeyboardLayout";
import { Key } from "./components/Key";
import { actionName } from "./utils/resourceActions";
import { ConditionalLayersEditor } from "./components/AdvancedResources";
import { BindingDrop } from "./components/BindingDrop";
import { BuildPanel } from "./components/BuildPanel";
import {
  MacroEditor,
  BehaviorEditor,
  ComboEditor,
  SettingsEditor,
} from "./components/ResourceEditor";
const tabs = ["Layout", "Macros", "Combos", "Behaviors", "Conditional layers", "Settings"] as const;
const tabIcons = {
  Layout: Keyboard,
  Macros: ListOrdered,
  Combos: Combine,
  Behaviors: Zap,
  "Conditional layers": Layers,
  Settings: Settings,
};
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
export default function App() {
  useLocale();
  const store = useKeyboardStore();
  const { project, savedProject, initialProject, plugin, activeLayerId } = store;
  const [keyboardZoom, setKeyboardZoom] = useState(1);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Layout");
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [build, setBuild] = useState<Build | null>(null);
  const [drag, setDrag] = useState<IKeyAction | null>(null);
  const [context, setContext] = useState<{
    x: number;
    y: number;
    index: number;
  } | null>(null);
  const [sources, setSources] = useState<{ name: string; content: string }[] | null>(null);
  const [confirm, setConfirm] = useState<(() => void) | null>(null);
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const pendingErrors = Object.values(store.draftErrors);
  const projectError = project ? projectBindingError(project, plugin) : "";
  const cannotSave = pendingErrors.length > 0 || !!projectError;
  const dirty = isDirty(project, savedProject ?? initialProject);
  const report = useCallback((e: unknown) => setError(message(e)), []);
  const initialize = async (session: Session) => {
    store.initialize(session);
    try {
      const initial = await api.newProject(session.plugin.id);
      useKeyboardStore.setState({ template: initial.project });
    } catch (e) {
      report(e);
    }
  };
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setPlugins(await api.plugins());
      await initialize(await api.load());
    } catch (e) {
      report(e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    let alive = true,
      pending = false;
    const poll = async () => {
      if (pending) return;
      pending = true;
      try {
        const b = await api.status();
        if (alive) setBuild(b);
      } catch (e) {
        if (alive) report(e);
      } finally {
        pending = false;
      }
    };
    poll();
    const timer = setInterval(poll, 1200);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [report]);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const save = async (compile = false) => {
    const snapshot = useKeyboardStore.getState().project;
    if (!snapshot || busy) return;
    const invalid =
      Object.values(useKeyboardStore.getState().draftErrors)[0] ||
      projectBindingError(snapshot, useKeyboardStore.getState().plugin);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = compile ? await api.saveAndBuild(snapshot) : await api.save(snapshot);
      store.markSaved(saved);
      setNotice(
        compile
          ? tr("Configuration saved. Firmware build started in the background.")
          : tr("Configuration saved on this computer."),
      );
      if (compile) setBuild(await api.status());
    } catch (e) {
      report(e); /* A build preparation failure may follow a successful save. */
      try {
        const disk = await api.load();
        if (disk.hasSaved && content(disk.project) === content(snapshot))
          store.markSaved(disk.project);
      } catch {
        /* Keep the editor intact if disk is unavailable. */
      }
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save(event.shiftKey);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [busy]);
  const startBuild = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setBuild(await api.build());
      if (dirty)
        setNotice(
          tr("Building the last saved configuration. Your current changes remain in the editor."),
        );
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  };
  const importProject = async () => {
    setError("");
    setNotice("");
    try {
      const s = await api.importProject(project?.pluginId, project?.variantId);
      if (s.plugin?.id) {
        await initialize(s);
        setTab("Layout");
        setNotice(tr("Project imported. Save it to keep it on this computer."));
      }
    } catch (e) {
      report(e);
    }
  };
  const replace = (fn: () => void) => {
    if (dirty) setConfirm(() => fn);
    else fn();
  };
  const assignResource = (action: IKeyAction) => {
    store.selectAction(action);
    setTab("Layout");
    setNotice("");
  };
  useEffect(() => {
    const cancelSelection = (event: KeyboardEvent) => {
      if (event.key === "Escape") useKeyboardStore.getState().selectAction(null);
    };
    window.addEventListener("keydown", cancelSelection);
    return () => window.removeEventListener("keydown", cancelSelection);
  }, []);
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDrag(null);
    if (!over) return;
    const from = active.data.current,
      to = over.data.current;
    if (!from?.code || !to) return;
    const state = useKeyboardStore.getState();
    if (!state.project) return;
    if (typeof to.acceptBinding !== "function") {
      const invalid = validateBinding(from.code, state.project, state.plugin);
      if (invalid) {
        useKeyboardStore.setState({ error: invalid });
        return;
      }
    }
    if (typeof to.acceptBinding === "function") {
      to.acceptBinding(from.code);
      return;
    }
    if (to.isSensor) {
      store.updateSensorCode(to.sensorId, to.direction, from.code);
      return;
    }
    if (typeof to.keymapIndex === "number") {
      const state = useKeyboardStore.getState();
      const l = state.project?.layout.layers.find((l) => l.id === state.activeLayerId);
      const previous = l?.keys.find((k) => k.keymapIndex === to.keymapIndex)?.code;
      if (typeof from.originIndex === "number" && previous) {
        const invalid = state.project ? validateBinding(previous, state.project, state.plugin) : "";
        if (invalid) {
          useKeyboardStore.setState({ error: invalid });
          return;
        }
        store.updateKeyCode(from.originIndex, previous);
      }
      store.updateKeyCode(to.keymapIndex, from.code);
    }
  };
  if (loading)
    return (
      <div className="loading-screen">
        <Keyboard size={40} className="text-sky-400" />
        <p>{tr("Loading your keyboard…")}</p>
      </div>
    );
  if (!project || !plugin)
    return (
      <div className="loading-screen">
        <h1>Z-MapFlow</h1>
        <AppVersion />
        <p role="alert">{localizeMessage(error || tr("Could not load the project."))}</p>
        <div className="flex gap-3">
          <button className="btn primary" onClick={load}>
            {tr("Try again")}{" "}
          </button>
          <button className="btn" onClick={importProject}>
            {tr("Import project")}{" "}
          </button>
          {plugins[0] && (
            <button
              className="btn"
              onClick={async () => {
                try {
                  await initialize(await api.newProject(plugins[0].id));
                  setError("");
                } catch (e) {
                  report(e);
                }
              }}
            >
              {tr("Open template")}{" "}
            </button>
          )}
        </div>
        <p className="hint">
          {tr("Your saved file is preserved until you save a new configuration.")}{" "}
        </p>
      </div>
    );
  const layer =
    project.layout.layers.find((l) => l.id === activeLayerId) || project.layout.layers[0];
  const running = build?.status === "running";
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <img className="brand-mark" src={appIcon} alt="" aria-hidden="true" />
          <h1>Z-MapFlow</h1>
          <AppVersion />
          <div className="project-identity">
            <select
              className="keyboard-select"
              aria-label={tr("Keyboard plugin")}
              disabled={busy}
              value={plugin.id}
              onChange={(e) => {
                const id = e.target.value;
                replace(() => {
                  api.newProject(id).then(initialize).catch(report);
                });
              }}
            >
              {plugins.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <span className={`save-state ${dirty || !savedProject ? "unsaved" : ""}`}>
              {dirty ? tr("Unsaved changes") : savedProject ? tr("Saved") : tr("Not saved yet")}
            </span>
          </div>
        </div>
      </header>
      {(error || store.error) && (
        <div className="notice error" role="alert">
          <span>{localizeMessage(error || store.error)}</span>
          <button
            aria-label={tr("Dismiss error")}
            onClick={() => {
              setError("");
              store.dismissError();
            }}
          >
            ×
          </button>
        </div>
      )}

      {store.selectedAction && (
        <div className="notice assignment-notice" role="status">
          <span>
            <strong>{actionName(store.selectedAction, project)}</strong>
            {tab === "Layout"
              ? tr("— click keys in the “{0}” layer to assign it.", layer.name)
              : tr("— click the action field you want to fill.")}
          </span>
          <div className="flex gap-3 items-center">
            {tab !== "Layout" && (
              <button className="btn" onClick={() => setTab("Layout")}>
                {tr("Go to layout")}{" "}
              </button>
            )}
            <button className="btn" onClick={() => store.selectAction(null)}>
              {tr("Cancel selection")}{" "}
            </button>
          </div>
        </div>
      )}
      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => {
          store.selectAction(null);
          setDrag(e.active.data.current?.action || null);
        }}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDrag(null)}
      >
        <div className="workspace-frame">
          <nav className="workspace-tabs" aria-label={tr("Project resources")}>
            {tabs
              .filter(
                (t) =>
                  t === "Layout" ||
                  t === "Settings" ||
                  (t === "Conditional layers" &&
                    (plugin.capabilities.includes("layers") || project.layout.layers.length > 1)) ||
                  plugin.capabilities.includes(
                    t === "Macros" ? "macros" : t === "Combos" ? "combos" : "hold-tap",
                  ),
              )
              .map((t) => {
                const Icon = tabIcons[t];
                const count =
                  t === "Macros"
                    ? project.layout.macros.length
                    : t === "Combos"
                      ? project.layout.combos.length
                      : 0;
                return (
                  <button
                    className={`workspace-tab ${tab === t ? "active" : ""}`}
                    aria-label={tr(t)}
                    title={tr(t)}
                    aria-current={tab === t ? "page" : undefined}
                    key={t}
                    onClick={() => setTab(t)}
                  >
                    <Icon size={19} aria-hidden="true" />
                    <span className="workspace-tab-label">{tr(t)}</span>
                    {count > 0 && (
                      <span className="workspace-tab-count" aria-hidden="true">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
          </nav>
          <WorkspaceSplit palette={<ActionTray />}>
            <main className="editor-workspace">
              {tab === "Layout" ? (
                <>
                  <div className="layout-editor">
                    <LayerSidebar
                      layers={project.layout.layers}
                      activeId={layer.id}
                      onSelect={store.setActiveLayer}
                      onRemove={store.removeLayer}
                      onAdd={store.addLayer}
                      onReorder={store.reorderLayers}
                      onContextMenu={(e, index) => {
                        e.preventDefault();
                        setContext({ x: e.clientX, y: e.clientY, index });
                      }}
                    />
                    <div className="layout-stage">
                      <div className="layer-toolbar">
                        <input
                          className="field layer-name"
                          title={tr("Rename active layer")}
                          aria-label={tr("Layer name")}
                          value={layer.name}
                          onChange={(e) =>
                            store.edit((p) => {
                              p.layout.layers.find((l) => l.id === layer.id)!.name = e.target.value;
                            })
                          }
                        />
                        <div
                          className="keyboard-zoom"
                          role="group"
                          aria-label={tr("Keyboard zoom")}
                        >
                          <button
                            className="btn icon-btn"
                            aria-label={tr("Zoom out")}
                            disabled={keyboardZoom <= 0.8}
                            onClick={() =>
                              setKeyboardZoom((z) => Math.max(0.8, Math.round((z - 0.1) * 10) / 10))
                            }
                          >
                            <Minus size={14} />
                          </button>
                          <output aria-label={tr("Keyboard scale")}>
                            {Math.round(keyboardZoom * 100)}%
                          </output>
                          <button
                            className="btn icon-btn"
                            aria-label={tr("Zoom in")}
                            disabled={keyboardZoom >= 1.6}
                            onClick={() =>
                              setKeyboardZoom((z) => Math.min(1.6, Math.round((z + 0.1) * 10) / 10))
                            }
                          >
                            <Plus size={14} />
                          </button>
                          <button
                            className="btn zoom-fit"
                            aria-label={tr("Fit keyboard to available space")}
                            onClick={() => setKeyboardZoom(1)}
                          >
                            {tr("Fit")}{" "}
                          </button>
                        </div>
                      </div>
                      <div
                        className="keyboard-workspace"
                        title={tr("Click or drag to assign · Drag between keys to swap")}
                      >
                        <KeyboardLayout
                          plugin={plugin}
                          layer={layer}
                          fit
                          zoom={keyboardZoom}
                          onEdit={setEditingKey}
                        />
                      </div>
                    </div>
                  </div>
                </>
              ) : tab === "Macros" ? (
                <MacroEditor onAssign={assignResource} />
              ) : tab === "Combos" ? (
                <ComboEditor />
              ) : tab === "Behaviors" ? (
                <BehaviorEditor onAssign={assignResource} />
              ) : tab === "Conditional layers" ? (
                <ConditionalLayersEditor />
              ) : (
                <SettingsEditor />
              )}
            </main>
          </WorkspaceSplit>
          <aside className="action-sidebar" aria-label={tr("Project actions")}>
            <button
              className="btn icon-btn"
              title={tr("Import a JSON project or ZMK keymap (.keymap)")}
              aria-label={tr("Import project")}
              disabled={busy}
              onClick={() => replace(importProject)}
            >
              <Upload size={16} />
            </button>
            <button
              className="btn icon-btn"
              title={tr("Export JSON project")}
              aria-label={tr("Export project")}
              onClick={() =>
                api
                  .exportProject(project)
                  .then((path) => {
                    if (path) setNotice(tr("Project exported to {0}", path));
                  })
                  .catch(report)
              }
            >
              <Download size={16} />
            </button>
            <button
              className="btn icon-btn"
              title={tr("Export ZMK keymap (.keymap)")}
              aria-label={tr("Export keymap")}
              onClick={() =>
                api
                  .exportKeymap(project)
                  .then((path) => {
                    if (path) setNotice(tr("Keymap exported to {0}", path));
                  })
                  .catch(report)
              }
            >
              <FileDown size={17} />
            </button>
            <button
              className="btn icon-btn"
              aria-label={tr("Discard")}
              title={tr("Discard changes")}
              disabled={!dirty || busy}
              onClick={() => replace(store.undoChanges)}
            >
              <RotateCcw size={15} />
            </button>
            <button
              className="btn icon-btn"
              aria-label={tr("Save")}
              title={pendingErrors[0] || projectError || tr("Save (Ctrl+S)")}
              disabled={busy || cannotSave}
              onClick={() => save()}
            >
              <Save size={15} />
            </button>
            <button
              className="btn icon-btn"
              aria-label={tr("Build")}
              title={tr("Build the last saved configuration")}
              disabled={busy || running || !savedProject || cannotSave}
              onClick={startBuild}
            >
              <Hammer size={15} />
            </button>
            <button
              className="btn icon-btn primary"
              aria-label={tr("Save and build")}
              title={
                pendingErrors[0] ||
                projectError ||
                tr("Save current changes and build (Ctrl+Shift+S)")
              }
              disabled={busy || running || cannotSave}
              onClick={() => save(true)}
            >
              <SaveAll size={18} />
            </button>
            <button
              className="btn icon-btn"
              aria-label={tr("View ZMK configuration")}
              title={tr("View ZMK configuration")}
              onClick={() => api.preview(project).then(setSources).catch(report)}
            >
              <Code size={15} />
            </button>
          </aside>
        </div>
        <DragOverlay dropAnimation={null}>
          {drag && <Key action={drag} className="w-14 h-14 opacity-90 ring-2 ring-sky-400" />}
        </DragOverlay>
      </DndContext>
      <BuildPanel
        build={build}
        plugins={plugins}
        currentRevision={savedProject?.revision || ""}
        onError={report}
        notice={localizeMessage(notice)}
        onDismissNotice={() => setNotice("")}
      />
      {context && (
        <LayerContextMenu
          x={context.x}
          y={context.y}
          onClose={() => setContext(null)}
          onReset={() => store.resetLayer(context.index)}
          onClear={() => store.clearLayer(context.index)}
        />
      )}
      {sources && (
        <div className="modal-backdrop">
          <section
            className="modal-card wide"
            role="dialog"
            aria-modal="true"
            aria-label={tr("Generated ZMK configuration")}
          >
            <div className="section-toolbar">
              <h2>{tr("Generated ZMK configuration")}</h2>
              <button className="btn" autoFocus onClick={() => setSources(null)}>
                {tr("Close")}{" "}
              </button>
            </div>
            <p className="hint mb-4">
              {tr("Preview of the current configuration. Build uses the last saved revision.")}{" "}
            </p>
            {sources.map((f) => (
              <details key={f.name} open>
                <summary>{f.name}</summary>
                <pre className="source-code">{f.content}</pre>
              </details>
            ))}
          </section>
        </div>
      )}
      {editingKey !== null && (
        <div className="modal-backdrop">
          <section
            className="modal-card binding-modal"
            role="dialog"
            aria-modal="true"
            aria-label={tr("Edit key binding")}
          >
            <div className="section-toolbar">
              <h2>
                {tr("Key")} {editingKey} — {layer.name}
              </h2>
              <button
                className="btn"
                disabled={pendingErrors.length > 0}
                onClick={() => setEditingKey(null)}
              >
                {tr("Done")}{" "}
              </button>
            </div>
            <p className="hint">
              {tr(
                "Adjust this key’s action and parameters. Each use of a macro or behavior can have different arguments.",
              )}{" "}
            </p>
            {pendingErrors.length > 0 && (
              <button className="btn binding-cancel" onClick={() => setEditingKey(null)}>
                {tr("Discard draft")}{" "}
              </button>
            )}
            <BindingDrop
              label={tr("Key action")}
              code={layer.keys.find((k) => k.keymapIndex === editingKey)?.code ?? "&none"}
              onChange={(code) => store.updateKeyCode(editingKey, code)}
            />
          </section>
        </div>
      )}
      {confirm && (
        <div className="modal-backdrop">
          <section
            className="modal-card small"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discard-title"
          >
            <h2 id="discard-title">{tr("Discard unsaved changes?")}</h2>
            <p className="hint my-4">
              {tr(
                "Your current changes will be replaced. Export or save the project to keep them.",
              )}{" "}
            </p>
            <div className="flex justify-end gap-3">
              <button className="btn" autoFocus onClick={() => setConfirm(null)}>
                {tr("Keep editing")}{" "}
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  const fn = confirm;
                  setConfirm(null);
                  fn();
                }}
              >
                {tr("Discard and continue")}{" "}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
