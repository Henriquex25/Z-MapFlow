import { useState } from "react";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { action, uid, type IKeyAction } from "../types/keyboard";
import { behaviorAction } from "../utils/resourceActions";
import { BindingDrop } from "./BindingDrop";
import { DraggableKey } from "./DraggableKey";
import { KeyboardLayout } from "./KeyboardLayout";

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 60000,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="form-label">
      {label}
      <input
        className="field w-28"
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
type AssignProps = { onAssign: (action: IKeyAction) => void };
export function MacroEditor({ onAssign }: AssignProps) {
  const { project: p, edit, removeResource } = useKeyboardStore();
  if (!p) return null;
  return (
    <div className="resource-editor">
      <div className="section-toolbar">
        <div>
          <h2>Macros</h2>
          <p className="hint">
            Selecione ou arraste ações da paleta para montar a sequência. Depois use “Atribuir ao
            teclado”.
          </p>
        </div>
        <button
          className="btn primary"
          onClick={() =>
            edit((p) =>
              p.layout.macros.push({
                id: uid(),
                name: "Nova macro",
                tapMs: 20,
                waitMs: 20,
                steps: [{ kind: "tap", binding: "&kp A", durationMs: 0 }],
              }),
            )
          }
        >
          + Nova macro
        </button>
      </div>
      {p.layout.macros.length === 0 && (
        <p className="empty">Crie uma macro para automatizar uma sequência de teclas.</p>
      )}
      {p.layout.macros.map((m) => (
        <article className="resource-card" key={m.id}>
          <div className="section-toolbar">
            <input
              aria-label="Nome da macro"
              className="field font-semibold"
              value={m.name}
              onChange={(e) =>
                edit((p) => {
                  p.layout.macros.find((x) => x.id === m.id)!.name = e.target.value;
                })
              }
            />
            <div className="flex gap-3 items-center">
              <DraggableKey action={{ ...action(`&${m.id}`), label: m.name }} />
              <button
                className="btn primary"
                disabled={m.steps.length === 0}
                aria-label={`Atribuir ${m.name} ao teclado`}
                onClick={() => onAssign({ ...action(`&${m.id}`), label: m.name })}
              >
                Atribuir ao teclado
              </button>
              <button className="btn danger" onClick={() => removeResource("macros", m.id)}>
                Excluir
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 mb-4">
            <NumberField
              label="Duração do toque (ms)"
              value={m.tapMs}
              max={5000}
              onChange={(n) =>
                edit((p) => {
                  p.layout.macros.find((x) => x.id === m.id)!.tapMs = n;
                })
              }
            />
            <NumberField
              label="Intervalo entre ações (ms)"
              value={m.waitMs}
              max={5000}
              onChange={(n) =>
                edit((p) => {
                  p.layout.macros.find((x) => x.id === m.id)!.waitMs = n;
                })
              }
            />
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            {m.steps.map((step, i) => (
              <div key={i} className="step-card">
                <div className="flex gap-2 items-center">
                  <span className="hint">{i + 1}</span>
                  <select
                    aria-label={`Tipo do passo ${i + 1}`}
                    className="field"
                    value={step.kind}
                    onChange={(e) =>
                      edit((p) => {
                        p.layout.macros.find((x) => x.id === m.id)!.steps[i].kind = e.target.value;
                      })
                    }
                  >
                    {[
                      ["tap", "Tocar"],
                      ["press", "Pressionar"],
                      ["release", "Soltar"],
                      ["wait", "Esperar"],
                    ].map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                {step.kind === "wait" ? (
                  <NumberField
                    label="Espera (ms)"
                    value={step.durationMs}
                    onChange={(n) =>
                      edit((p) => {
                        p.layout.macros.find((x) => x.id === m.id)!.steps[i].durationMs = n;
                      })
                    }
                  />
                ) : (
                  <BindingDrop
                    label={`Ação do passo ${i + 1}`}
                    code={step.binding}
                    onChange={(code) =>
                      edit((p) => {
                        p.layout.macros.find((x) => x.id === m.id)!.steps[i].binding = code;
                      })
                    }
                  />
                )}
                <div className="flex gap-2">
                  <button
                    className="btn"
                    disabled={i === 0}
                    aria-label="Mover passo para trás"
                    onClick={() =>
                      edit((p) => {
                        const steps = p.layout.macros.find((x) => x.id === m.id)!.steps;
                        [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]];
                      })
                    }
                  >
                    ←
                  </button>
                  <button
                    className="btn danger"
                    onClick={() =>
                      edit((p) => {
                        p.layout.macros.find((x) => x.id === m.id)!.steps.splice(i, 1);
                      })
                    }
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
            <BindingDrop
              code=""
              label="Adicionar passo"
              onChange={(code) =>
                edit((p) => {
                  p.layout.macros
                    .find((x) => x.id === m.id)!
                    .steps.push({ kind: "tap", binding: code, durationMs: 0 });
                })
              }
            />
            <button
              className="btn"
              onClick={() =>
                edit((p) => {
                  p.layout.macros
                    .find((x) => x.id === m.id)!
                    .steps.push({
                      kind: "wait",
                      binding: "&none",
                      durationMs: 100,
                    });
                })
              }
            >
              + Espera
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
export function BehaviorEditor({ onAssign }: AssignProps) {
  const { project: p, plugin, activeLayerId, edit, removeResource } = useKeyboardStore();
  const [triggerEditor, setTriggerEditor] = useState("");
  if (!p || !plugin) return null;
  const add = (kind: string) =>
    edit((p) =>
      p.layout.behaviors.push({
        id: uid(),
        name: kind === "hold-tap" ? "Novo hold-tap" : "Novo tap-dance",
        kind,
        requirePriorIdleMs: 0,
        holdTriggerPositions: [],
        holdTriggerOnRelease: false,
        bindings: kind === "hold-tap" ? ["&kp LCTRL", "&kp ESC"] : ["&kp A", "&kp B"],
        tappingTermMs: 200,
        quickTapMs: 0,
        flavor: "balanced",
      }),
    );
  return (
    <div className="resource-editor">
      <div className="section-toolbar">
        <div>
          <h2>Behaviors</h2>
          <p className="hint">
            Configure ações de toque/pressão ou sequências por número de toques.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn primary" onClick={() => add("hold-tap")}>
            + Hold-tap
          </button>
          <button className="btn primary" onClick={() => add("tap-dance")}>
            + Tap-dance
          </button>
        </div>
      </div>
      {!p.layout.behaviors.length && (
        <p className="empty">
          Os presets de tap/hold continuam disponíveis na paleta. Crie aqui comportamentos
          personalizados.
        </p>
      )}
      {p.layout.behaviors.map((b) => (
        <article className="resource-card" key={b.id}>
          <div className="section-toolbar">
            <input
              aria-label="Nome do behavior"
              className="field font-semibold"
              value={b.name}
              onChange={(e) =>
                edit((p) => {
                  p.layout.behaviors.find((x) => x.id === b.id)!.name = e.target.value;
                })
              }
            />
            <span className="badge">{b.kind}</span>
            <DraggableKey action={behaviorAction(b)} />
            <button
              className="btn primary"
              disabled={b.bindings.length === 0}
              aria-label={`Atribuir ${b.name} ao teclado`}
              onClick={() => onAssign(behaviorAction(b))}
            >
              Atribuir ao teclado
            </button>
            <button className="btn danger" onClick={() => removeResource("behaviors", b.id)}>
              Excluir
            </button>
          </div>
          <div className="flex gap-4 flex-wrap">
            <NumberField
              label="Tempo de toque (ms)"
              min={1}
              max={5000}
              value={b.tappingTermMs}
              onChange={(n) =>
                edit((p) => {
                  p.layout.behaviors.find((x) => x.id === b.id)!.tappingTermMs = n;
                })
              }
            />
            {b.kind === "hold-tap" && (
              <>
                <NumberField
                  label="Quick tap (ms)"
                  max={5000}
                  value={b.quickTapMs}
                  onChange={(n) =>
                    edit((p) => {
                      p.layout.behaviors.find((x) => x.id === b.id)!.quickTapMs = n;
                    })
                  }
                />
                <label className="form-label">
                  Resolução
                  <select
                    className="field"
                    value={b.flavor}
                    onChange={(e) =>
                      edit((p) => {
                        p.layout.behaviors.find((x) => x.id === b.id)!.flavor = e.target.value;
                      })
                    }
                  >
                    {["hold-preferred", "balanced", "tap-preferred", "tap-unless-interrupted"].map(
                      (f) => (
                        <option key={f}>{f}</option>
                      ),
                    )}
                  </select>
                </label>
              </>
            )}
          </div>
          <div className="flex gap-3 flex-wrap mt-4">
            {b.bindings.map((binding, i) => (
              <div key={i}>
                <BindingDrop
                  label={
                    b.kind === "hold-tap"
                      ? i === 0
                        ? "Segurar: tecla/modificador ou MO"
                        : "Tocar: tecla"
                      : `${i + 1} toque(s)`
                  }
                  code={binding}
                  onChange={(code) => {
                    if (
                      b.kind === "hold-tap" &&
                      !(i === 0 ? /^&(kp|mo) \S+$/.test(code) : /^&kp \S+$/.test(code))
                    ) {
                      useKeyboardStore.setState({
                        error:
                          i === 0
                            ? "Para segurar, selecione uma tecla, modificador ou ação MO de camada."
                            : "Para tocar, selecione uma ação de tecla.",
                      });
                      return;
                    }
                    edit((p) => {
                      p.layout.behaviors.find((x) => x.id === b.id)!.bindings[i] = code;
                    });
                  }}
                />
                {b.kind === "tap-dance" && (
                  <button
                    className="btn mt-2"
                    onClick={() =>
                      edit((p) => {
                        p.layout.behaviors.find((x) => x.id === b.id)!.bindings.splice(i, 1);
                      })
                    }
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}
            {b.kind === "tap-dance" && (
              <BindingDrop
                label="Adicionar toque"
                code=""
                onChange={(code) =>
                  edit((p) => {
                    p.layout.behaviors.find((x) => x.id === b.id)!.bindings.push(code);
                  })
                }
              />
            )}
          </div>
          {b.kind === "hold-tap" && (
            <div className="mt-4 space-y-3">
              <div className="flex gap-4 items-center flex-wrap">
                <NumberField
                  label="Inatividade anterior (ms)"
                  max={5000}
                  value={b.requirePriorIdleMs}
                  onChange={(n) =>
                    edit((p) => {
                      p.layout.behaviors.find((x) => x.id === b.id)!.requirePriorIdleMs = n;
                    })
                  }
                />
                <label>
                  <input
                    type="checkbox"
                    checked={b.holdTriggerOnRelease}
                    onChange={(e) =>
                      edit((p) => {
                        p.layout.behaviors.find((x) => x.id === b.id)!.holdTriggerOnRelease =
                          e.target.checked;
                      })
                    }
                  />{" "}
                  Decidir hold-trigger ao soltar
                </label>
                <button
                  className="btn"
                  onClick={() => setTriggerEditor((v) => (v === b.id ? "" : b.id))}
                >
                  Teclas que ativam hold ({b.holdTriggerPositions.length})
                </button>
              </div>
              {triggerEditor === b.id && (
                <>
                  <p className="hint">
                    Selecione as posições que resolvem o hold. Nenhuma selecionada desativa a
                    restrição por posição.
                  </p>
                  <KeyboardLayout
                    plugin={plugin}
                    layer={
                      p.layout.layers.find((l) => l.id === activeLayerId) || p.layout.layers[0]
                    }
                    selection={b.holdTriggerPositions}
                    onSelect={(index) =>
                      edit((p) => {
                        const b2 = p.layout.behaviors.find((x) => x.id === b.id)!;
                        b2.holdTriggerPositions = b2.holdTriggerPositions.includes(index)
                          ? b2.holdTriggerPositions.filter((i) => i !== index)
                          : [...b2.holdTriggerPositions, index];
                      })
                    }
                  />
                </>
              )}
            </div>
          )}
          {b.kind === "hold-tap" && (
            <p className="hint mt-3">
              As ações definem os parâmetros ao arrastar. Para alterar os parâmetros de uma tecla já
              mapeada, arraste o behavior novamente.
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
export function ComboEditor() {
  const {
    project: p,
    plugin,
    activeLayerId,
    edit,
    removeResource,
    setActiveLayer,
  } = useKeyboardStore();
  const [selected, setSelected] = useState("");
  if (!p || !plugin) return null;
  const combo = p.layout.combos.find((c) => c.id === selected) || p.layout.combos[0];
  return (
    <div className="resource-editor">
      <div className="section-toolbar">
        <div>
          <h2>Combos</h2>
          <p className="hint">
            Selecione duas ou mais teclas no desenho e atribua a ação do combo usando a paleta.
          </p>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            const id = uid();
            edit((p) =>
              p.layout.combos.push({
                id,
                name: "Novo combo",
                positions: [],
                binding: "&kp ESC",
                layerIds: [],
                timeoutMs: 50,
                slowRelease: false,
              }),
            );
            setSelected(id);
          }}
        >
          + Novo combo
        </button>
      </div>
      {!combo ? (
        <p className="empty">Combine duas ou mais teclas para executar uma ação.</p>
      ) : (
        <>
          <div className="flex gap-3 mb-4 flex-wrap">
            {p.layout.combos.map((c) => (
              <button
                className={`btn ${combo.id === c.id ? "primary" : ""}`}
                key={c.id}
                onClick={() => setSelected(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <article className="resource-card">
            <div className="section-toolbar">
              <input
                aria-label="Nome do combo"
                className="field"
                value={combo.name}
                onChange={(e) =>
                  edit((p) => {
                    p.layout.combos.find((c) => c.id === combo.id)!.name = e.target.value;
                  })
                }
              />
              <NumberField
                label="Janela de ativação (ms)"
                min={1}
                max={5000}
                value={combo.timeoutMs}
                onChange={(n) =>
                  edit((p) => {
                    p.layout.combos.find((c) => c.id === combo.id)!.timeoutMs = n;
                  })
                }
              />
              <BindingDrop
                label="Ação do combo"
                code={combo.binding}
                onChange={(code) =>
                  edit((p) => {
                    p.layout.combos.find((c) => c.id === combo.id)!.binding = code;
                  })
                }
              />
              <button className="btn danger" onClick={() => removeResource("combos", combo.id)}>
                Excluir
              </button>
            </div>
            <label className="form-label mb-4">
              Visualizar camada
              <select
                className="field w-fit"
                value={activeLayerId}
                onChange={(e) => setActiveLayer(e.target.value)}
              >
                {p.layout.layers.map((layer, index) => (
                  <option key={layer.id} value={layer.id}>
                    {index}: {layer.name}
                  </option>
                ))}
              </select>
            </label>
            <KeyboardLayout
              plugin={plugin}
              layer={p.layout.layers.find((l) => l.id === activeLayerId) || p.layout.layers[0]}
              selection={combo.positions}
              onSelect={(index) =>
                edit((p) => {
                  const c = p.layout.combos.find((c) => c.id === combo.id)!;
                  c.positions = c.positions.includes(index)
                    ? c.positions.filter((i) => i !== index)
                    : [...c.positions, index];
                })
              }
            />
            <div className="flex flex-wrap gap-4 items-center">
              <span className="hint">{combo.positions.length} teclas selecionadas</span>
              <span className="hint">
                {combo.positions.length < 2
                  ? "Selecione pelo menos duas teclas para ativar o combo."
                  : "As teclas selecionadas ativam a ação do combo."}
              </span>
              <label>
                <input
                  type="checkbox"
                  checked={combo.slowRelease}
                  onChange={(e) =>
                    edit((p) => {
                      p.layout.combos.find((c) => c.id === combo.id)!.slowRelease =
                        e.target.checked;
                    })
                  }
                />{" "}
                Soltar após todas as teclas
              </label>
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <span className="hint">Camadas (nenhuma marcada = todas):</span>
              {p.layout.layers.map((l) => (
                <label key={l.id}>
                  <input
                    type="checkbox"
                    checked={combo.layerIds.includes(l.id)}
                    onChange={() =>
                      edit((p) => {
                        const c = p.layout.combos.find((c) => c.id === combo.id)!;
                        c.layerIds = c.layerIds.includes(l.id)
                          ? c.layerIds.filter((id) => id !== l.id)
                          : [...c.layerIds, l.id];
                      })
                    }
                  />{" "}
                  {l.name}
                </label>
              ))}
            </div>
          </article>
        </>
      )}
    </div>
  );
}
export function SettingsEditor() {
  const { project: p, plugin, edit } = useKeyboardStore();
  if (!p || !plugin) return null;
  const variant = plugin.variants.find((v) => v.id === p.variantId)!;
  return (
    <div className="resource-editor">
      <h2>Configurações</h2>
      <div className="resource-card">
        <h3>Teclado e firmware</h3>
        <label className="form-label mt-3">
          Variante de hardware
          <select
            className="field"
            value={p.variantId}
            onChange={(e) =>
              edit((p) => {
                p.variantId = e.target.value;
              })
            }
          >
            {plugin.variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <p className="hint mt-3">
          {variant.targets.map((t) => `${t.name}: ${t.board} / ${t.shield}`).join(" · ")}
        </p>
        <p className="hint">
          ZMK {(variant.zmkRevision || plugin.zmkRevision).slice(0, 12)} · {plugin.keyCount}{" "}
          posições, incluindo cliques dos encoders
        </p>
        <p className="hint mt-2">{variant.instructions}</p>
      </div>
      <div className="resource-card">
        <h3>Layout do sistema e recursos</h3>
        <div className="flex flex-wrap items-center gap-5 mt-3">
          <label className="form-label">
            Layout do sistema operacional
            <select
              className="field"
              value={p.options.locale}
              onChange={(e) =>
                edit((p) => {
                  p.options.locale = e.target.value;
                })
              }
            >
              <option value="us">US / ANSI</option>
              <option value="pt-br">Português (Brasil) — ABNT2</option>
            </select>
          </label>
          {plugin.capabilities.includes("display") && (
            <label>
              <input
                type="checkbox"
                checked={p.options.display}
                onChange={(e) =>
                  edit((p) => {
                    p.options.display = e.target.checked;
                  })
                }
              />{" "}
              OLED com status
            </label>
          )}
          {plugin.capabilities.includes("pointing") && (
            <label>
              <input
                type="checkbox"
                checked={p.options.pointing}
                onChange={(e) =>
                  edit((p) => {
                    p.options.pointing = e.target.checked;
                  })
                }
              />{" "}
              Ações de mouse e rolagem
            </label>
          )}
        </div>
        <p className="hint mt-3">
          O layout selecionado define os símbolos oferecidos pela paleta. Configure o mesmo layout
          no sistema operacional.
        </p>
      </div>
      <div className="resource-card">
        <h3>Tap / hold padrão</h3>
        <div className="flex flex-wrap gap-4 mt-3">
          <NumberField
            label="Tempo de toque (ms)"
            min={1}
            max={5000}
            value={p.options.tappingTermMs}
            onChange={(n) =>
              edit((p) => {
                p.options.tappingTermMs = n;
              })
            }
          />
          <NumberField
            label="Quick tap (ms)"
            max={5000}
            value={p.options.quickTapMs}
            onChange={(n) =>
              edit((p) => {
                p.options.quickTapMs = n;
              })
            }
          />
          <label className="form-label">
            Resolução
            <select
              className="field"
              value={p.options.flavor}
              onChange={(e) =>
                edit((p) => {
                  p.options.flavor = e.target.value;
                })
              }
            >
              {["hold-preferred", "balanced", "tap-preferred", "tap-unless-interrupted"].map(
                (v) => (
                  <option key={v}>{v}</option>
                ),
              )}
            </select>
          </label>
        </div>
      </div>
      <div className="resource-card">
        <h3>Bluetooth e energia</h3>
        <div className="flex flex-wrap gap-5 items-center mt-3">
          <NumberField
            label="Perfis Bluetooth"
            min={1}
            max={5}
            value={p.options.bluetoothProfiles}
            onChange={(n) =>
              edit((p) => {
                p.options.bluetoothProfiles = n;
              })
            }
          />
          <label>
            <input
              type="checkbox"
              checked={p.options.sleep}
              onChange={(e) =>
                edit((p) => {
                  p.options.sleep = e.target.checked;
                })
              }
            />{" "}
            Repouso automático
          </label>
          <NumberField
            label="Inatividade para repouso (ms)"
            min={1000}
            max={86400000}
            value={p.options.sleepTimeoutMs}
            onChange={(n) =>
              edit((p) => {
                p.options.sleepTimeoutMs = n;
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
