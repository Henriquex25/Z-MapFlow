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
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { Plus, Minus, Keyboard, Save, Hammer, Download, Upload, Code } from "lucide-react";
import { api } from "./services/api";
import { content, isDirty, useKeyboardStore } from "./store/useKeyboardStore";
import type { Build, IKeyAction, Plugin, Session } from "./types/keyboard";
import { ActionTray } from "./components/ActionTray";
import { DraggableLayerTab } from "./components/DraggableLayerTab";
import { LayerContextMenu } from "./components/LayerContextMenu";
import { KeyboardLayout } from "./components/KeyboardLayout";
import { Key } from "./components/Key";
import { actionName } from "./utils/resourceActions";
import { BuildPanel } from "./components/BuildPanel";
import {
  MacroEditor,
  BehaviorEditor,
  ComboEditor,
  SettingsEditor,
} from "./components/ResourceEditor";
const tabs = ["Layout", "Macros", "Combos", "Behaviors", "Configurações"] as const;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
export default function App() {
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
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
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = compile ? await api.saveAndBuild(snapshot) : await api.save(snapshot);
      store.markSaved(saved);
      setNotice(
        compile
          ? "Configuração salva. Compilação iniciada em segundo plano."
          : "Configuração salva neste computador.",
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
          "Compilando a última configuração salva. Suas alterações atuais continuam no editor.",
        );
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  };
  const importProject = async () => {
    try {
      const s = await api.importProject();
      if (s.plugin.id) {
        await initialize(s);
        setNotice("Projeto importado. Salve para mantê-lo neste computador.");
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
      if (typeof from.originIndex === "number" && previous)
        store.updateKeyCode(from.originIndex, previous);
      store.updateKeyCode(to.keymapIndex, from.code);
    }
  };
  if (loading)
    return (
      <div className="loading-screen">
        <Keyboard size={40} className="text-sky-400" />
        <p>Carregando seu teclado…</p>
      </div>
    );
  if (!project || !plugin)
    return (
      <div className="loading-screen">
        <h1>Z-MapFlow</h1>
        <p role="alert">{error || "Não foi possível carregar o projeto."}</p>
        <div className="flex gap-3">
          <button className="btn primary" onClick={load}>
            Tentar novamente
          </button>
          <button className="btn" onClick={importProject}>
            Importar projeto
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
              Abrir template
            </button>
          )}
        </div>
        <p className="hint">
          O arquivo salvo permanece preservado até você salvar uma nova configuração.
        </p>
      </div>
    );
  const layer =
    project.layout.layers.find((l) => l.id === activeLayerId) || project.layout.layers[0];
  const layerIds = project.layout.layers.map((l) => l.id);
  const running = build?.status === "running";
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="flex items-center gap-3">
          <div className="brand-mark">
            <Keyboard size={24} />
          </div>
          <div>
            <h1>Z-MapFlow</h1>
            <div className="flex gap-2 items-center">
              <select
                className="keyboard-select"
                aria-label="Plugin do teclado"
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
                {dirty ? "Alterações não salvas" : savedProject ? "Salvo" : "Ainda não salvo"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <button
            className="btn icon-btn"
            title="Importar projeto"
            aria-label="Importar projeto"
            disabled={busy}
            onClick={() => replace(importProject)}
          >
            <Upload size={16} />
          </button>
          <button
            className="btn icon-btn"
            title="Exportar projeto"
            aria-label="Exportar projeto"
            onClick={() =>
              api
                .exportProject(project)
                .then((path) => {
                  if (path) setNotice(`Projeto exportado para ${path}`);
                })
                .catch(report)
            }
          >
            <Download size={16} />
          </button>
          <button
            className="btn"
            disabled={!dirty || busy}
            onClick={() => replace(store.undoChanges)}
          >
            Descartar
          </button>
          <button className="btn" disabled={busy} onClick={() => save()}>
            <Save size={15} /> Salvar
          </button>
          <button className="btn" disabled={busy || running || !savedProject} onClick={startBuild}>
            <Hammer size={15} /> Compilar
          </button>
          <button className="btn primary" disabled={busy || running} onClick={() => save(true)}>
            <Hammer size={15} /> Salvar e compilar
          </button>
        </div>
      </header>
      {(error || store.error) && (
        <div className="notice error" role="alert">
          <span>{error || store.error}</span>
          <button
            aria-label="Fechar erro"
            onClick={() => {
              setError("");
              store.dismissError();
            }}
          >
            ×
          </button>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button aria-label="Fechar mensagem" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      <nav className="workspace-tabs">
        {tabs
          .filter(
            (t) =>
              t === "Layout" ||
              t === "Configurações" ||
              plugin.capabilities.includes(
                t === "Macros" ? "macros" : t === "Combos" ? "combos" : "hold-tap",
              ),
          )
          .map((t) => (
            <button
              className={`tab ${tab === t ? "active" : ""}`}
              key={t}
              onClick={() => setTab(t)}
            >
              {t}
              {t === "Macros" && project.layout.macros.length
                ? ` (${project.layout.macros.length})`
                : ""}
              {t === "Combos" && project.layout.combos.length
                ? ` (${project.layout.combos.length})`
                : ""}
            </button>
          ))}
        <button
          className="btn ml-auto"
          onClick={() => api.preview(project).then(setSources).catch(report)}
        >
          <Code size={15} /> Ver configuração ZMK
        </button>
      </nav>
      {store.selectedAction && (
        <div className="notice assignment-notice" role="status">
          <span>
            <strong>{actionName(store.selectedAction, project)}</strong>
            {tab === "Layout"
              ? ` — clique nas teclas da camada “${layer.name}” para atribuir.`
              : " — clique no campo de ação que deseja preencher."}
          </span>
          <div className="flex gap-3 items-center">
            {tab !== "Layout" && (
              <button className="btn" onClick={() => setTab("Layout")}>
                Ir para o layout
              </button>
            )}
            <button className="btn" onClick={() => store.selectAction(null)}>
              Cancelar seleção
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
        <main className="editor-workspace">
          {tab === "Layout" ? (
            <>
              <div className="layer-toolbar">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  modifiers={[restrictToHorizontalAxis]}
                  onDragStart={() => setContext(null)}
                  onDragEnd={({ active, over }) => {
                    if (over && active.id !== over.id)
                      store.reorderLayers(
                        layerIds.indexOf(String(active.id)),
                        layerIds.indexOf(String(over.id)),
                      );
                  }}
                >
                  <SortableContext items={layerIds} strategy={horizontalListSortingStrategy}>
                    {project.layout.layers.map((l, i) => (
                      <DraggableLayerTab
                        key={l.id}
                        id={l.id}
                        index={i}
                        layer={l}
                        isActive={layer.id === l.id}
                        canRemove={project.layout.layers.length > 1}
                        onClick={() => store.setActiveLayer(l.id)}
                        onRemove={() => store.removeLayer(i)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContext({ x: e.clientX, y: e.clientY, index: i });
                        }}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
                <button
                  className="btn"
                  aria-label="Adicionar camada"
                  disabled={project.layout.layers.length >= 32}
                  onClick={store.addLayer}
                >
                  <Plus size={17} />
                </button>
                <input
                  className="field ml-auto max-w-44"
                  aria-label="Nome da camada"
                  value={layer.name}
                  onChange={(e) =>
                    store.edit((p) => {
                      p.layout.layers.find((l) => l.id === layer.id)!.name = e.target.value;
                    })
                  }
                />
              </div>
              <div className="keyboard-workspace">
                <div className="keyboard-toolbar">
                  <span className="hint">
                    Clique ou arraste para atribuir · Arraste entre teclas para trocar
                  </span>
                  <span className="hint">
                    Camada {project.layout.layers.findIndex((l) => l.id === layer.id)} ·{" "}
                    {layer.name}
                  </span>
                  <div className="keyboard-zoom" role="group" aria-label="Zoom do teclado">
                    <button
                      className="btn icon-btn"
                      aria-label="Diminuir teclado"
                      disabled={keyboardZoom <= 0.8}
                      onClick={() =>
                        setKeyboardZoom((z) => Math.max(0.8, Math.round((z - 0.1) * 10) / 10))
                      }
                    >
                      <Minus size={14} />
                    </button>
                    <output aria-label="Escala do teclado">
                      {Math.round(keyboardZoom * 100)}%
                    </output>
                    <button
                      className="btn icon-btn"
                      aria-label="Aumentar teclado"
                      disabled={keyboardZoom >= 1.6}
                      onClick={() =>
                        setKeyboardZoom((z) => Math.min(1.6, Math.round((z + 0.1) * 10) / 10))
                      }
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      className="btn zoom-fit"
                      aria-label="Ajustar teclado ao espaço disponível"
                      onClick={() => setKeyboardZoom(1)}
                    >
                      Ajustar
                    </button>
                  </div>
                </div>
                <KeyboardLayout plugin={plugin} layer={layer} fit zoom={keyboardZoom} />
              </div>
            </>
          ) : tab === "Macros" ? (
            <MacroEditor onAssign={assignResource} />
          ) : tab === "Combos" ? (
            <ComboEditor />
          ) : tab === "Behaviors" ? (
            <BehaviorEditor onAssign={assignResource} />
          ) : (
            <SettingsEditor />
          )}
        </main>
        <ActionTray />
        <DragOverlay dropAnimation={null}>
          {drag && <Key action={drag} className="w-14 h-14 opacity-90 ring-2 ring-sky-400" />}
        </DragOverlay>
      </DndContext>
      <BuildPanel
        build={build}
        plugins={plugins}
        currentRevision={savedProject?.revision || ""}
        onError={report}
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
            aria-label="Configuração ZMK gerada"
          >
            <div className="section-toolbar">
              <h2>Configuração ZMK gerada</h2>
              <button className="btn" autoFocus onClick={() => setSources(null)}>
                Fechar
              </button>
            </div>
            <p className="hint mb-4">
              Prévia da configuração atual. O botão Compilar utiliza a última revisão salva.
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
      {confirm && (
        <div className="modal-backdrop">
          <section
            className="modal-card small"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discard-title"
          >
            <h2 id="discard-title">Descartar alterações não salvas?</h2>
            <p className="hint my-4">
              As alterações atuais serão substituídas. Exporte ou salve o projeto para preservá-las.
            </p>
            <div className="flex justify-end gap-3">
              <button className="btn" autoFocus onClick={() => setConfirm(null)}>
                Continuar editando
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  const fn = confirm;
                  setConfirm(null);
                  fn();
                }}
              >
                Descartar e continuar
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
