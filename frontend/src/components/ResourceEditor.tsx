import { AppSettings } from "./AppSettings";
import { tr, useLocale } from "../i18n";
import { useState } from "react";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { action, uid, type IKeyAction } from "../types/keyboard";
import {
  AssignmentParameters,
  MacroControl,
  NativeProperties,
  NativeSettings,
  newBehavior,
  behaviorKinds,
} from "./AdvancedResources";
import { behaviorAction, macroAction } from "../utils/resourceActions";
import { NumberField } from "./NumberField";
import { validateBinding, nativeArity } from "../utils/bindingValidation";
import { BindingDrop } from "./BindingDrop";
import { DraggableKey } from "./DraggableKey";
import { KeyboardLayout } from "./KeyboardLayout";

type AssignProps = { onAssign: (action: IKeyAction) => void };
export function MacroEditor({ onAssign }: AssignProps) {
  useLocale();
  const { project: p, edit, removeResource } = useKeyboardStore();
  if (!p) return null;
  return (
    <div className="resource-editor">
      <div className="section-toolbar">
        <div>
          <h2>Macros</h2>
          <p className="hint">
            {tr(
              "Select or drag actions from the palette to build a sequence. Then choose “Assign to keyboard”.",
            )}{" "}
          </p>
        </div>
        <button
          className="btn primary"
          onClick={() =>
            edit((p) =>
              p.layout.macros.push({
                id: uid(),
                name: tr("New macro"),
                tapMs: 20,
                waitMs: 20,
                steps: [{ kind: "tap", binding: "&kp A", durationMs: 0 }],
              }),
            )
          }
        >
          {tr("+ New macro")}{" "}
        </button>
      </div>
      {p.layout.macros.length === 0 && (
        <p className="empty">{tr("Create a macro to automate a key sequence.")}</p>
      )}
      {p.layout.macros.map((m) => (
        <article className="resource-card" key={m.id}>
          <div className="section-toolbar">
            <input
              aria-label={tr("Macro name")}
              className="field font-semibold"
              value={m.name}
              onChange={(e) =>
                edit((p) => {
                  p.layout.macros.find((x) => x.id === m.id)!.name = e.target.value;
                })
              }
            />
            <div className="flex gap-3 items-center">
              <DraggableKey action={macroAction(m)} />
              <button
                className="btn primary"
                disabled={m.steps.length === 0}
                aria-label={tr("Assign {0} to keyboard", m.name)}
                onClick={() => onAssign(macroAction(m))}
              >
                {tr("Assign to keyboard")}{" "}
              </button>
              <button className="btn danger" onClick={() => removeResource("macros", m.id)}>
                {tr("Delete")}{" "}
              </button>
            </div>
          </div>
          <AssignmentParameters
            resource={m}
            onChange={(count, parameters) =>
              edit((p) => {
                const macro = p.layout.macros.find((v) => v.id === m.id)!;
                macro.parameterCount = count;
                macro.parameters = parameters;
              })
            }
          />
          <div className="flex flex-wrap gap-4 mb-4">
            <NumberField
              label={tr("Tap time (ms)")}
              value={m.tapMs}
              max={5000}
              onChange={(n) =>
                edit((p) => {
                  p.layout.macros.find((x) => x.id === m.id)!.tapMs = n;
                })
              }
            />
            <NumberField
              label={tr("Wait time between actions (ms)")}
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
                    aria-label={tr("Step {0} type", i + 1)}
                    className="field"
                    value={step.kind}
                    onChange={(e) =>
                      edit((p) => {
                        const step = p.layout.macros.find((x) => x.id === m.id)!.steps[i];
                        step.kind = e.target.value;
                        if (step.kind === "control") step.binding = "&macro_pause_for_release";
                        else if (step.kind !== "wait" && step.binding.startsWith("&macro_"))
                          step.binding = "&kp A";
                      })
                    }
                  >
                    {[
                      ["tap", tr("Tap")],
                      ["press", tr("Press")],
                      ["release", tr("Release")],
                      ["wait", tr("Wait")],
                      ["binding", tr("Action in current mode")],
                      ["control", tr("ZMK control")],
                    ].map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                {step.kind === "control" ? (
                  <MacroControl
                    value={step.binding}
                    onChange={(binding) =>
                      edit((p) => {
                        const macro = p.layout.macros.find((x) => x.id === m.id)!;
                        macro.steps[i].binding = binding;
                        const routed = binding.match(/^&macro_param_([12])to/);
                        if (routed)
                          macro.parameterCount = Math.max(
                            macro.parameterCount ?? 0,
                            Number(routed[1]),
                          );
                      })
                    }
                  />
                ) : step.kind === "wait" ? (
                  <NumberField
                    label={tr("Wait (ms)")}
                    value={step.durationMs}
                    onChange={(n) =>
                      edit((p) => {
                        p.layout.macros.find((x) => x.id === m.id)!.steps[i].durationMs = n;
                      })
                    }
                  />
                ) : (
                  <BindingDrop
                    context="macro"
                    owner={m.id}
                    label={tr("Step {0} action", i + 1)}
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
                    aria-label={tr("Move step backward")}
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
                    {tr("Remove")}{" "}
                  </button>
                </div>
              </div>
            ))}
            <BindingDrop
              code=""
              context="macro"
              owner={m.id}
              label={tr("Add step")}
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
              {tr("+ Wait")}{" "}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
export function BehaviorEditor({ onAssign }: AssignProps) {
  useLocale();
  const { project: p, plugin, activeLayerId, edit, removeResource } = useKeyboardStore();
  const [triggerEditor, setTriggerEditor] = useState("");
  if (!p || !plugin) return null;
  const add = (kind: string) => edit((p) => p.layout.behaviors.push(newBehavior(kind)));
  return (
    <div className="resource-editor">
      <div className="section-toolbar">
        <div>
          <h2>{tr("Behaviors")}</h2>
          <p className="hint">
            {tr("Configure tap/hold actions or sequences based on tap count.")}{" "}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn primary" onClick={() => add("hold-tap")}>
            {tr("+ Tap / hold")}{" "}
          </button>
          <button className="btn primary" onClick={() => add("tap-dance")}>
            {tr("+ Tap sequence")}{" "}
          </button>
          <select
            className="field"
            aria-label={tr("Add behavior type")}
            value=""
            onChange={(e) => {
              if (e.target.value) add(e.target.value);
            }}
          >
            <option value="">{tr("+ Other behaviors")}</option>
            {Object.entries(behaviorKinds)
              .filter(([kind]) => kind !== "hold-tap" && kind !== "tap-dance")
              .map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {tr(label)}
                </option>
              ))}
          </select>
        </div>
      </div>
      {!p.layout.behaviors.length && (
        <p className="empty">
          {tr("Tap/hold presets are available in the palette. Create custom behaviors here.")}{" "}
        </p>
      )}
      {p.layout.behaviors.map((b) => (
        <article className="resource-card" key={b.id}>
          <div className="behavior-toolbar">
            <div className="behavior-identity">
              <input
                aria-label={tr("Behavior name")}
                className="field font-semibold"
                value={b.name}
                onChange={(e) =>
                  edit((p) => {
                    p.layout.behaviors.find((x) => x.id === b.id)!.name = e.target.value;
                  })
                }
              />
              <span className="badge">{tr(behaviorKinds[b.kind] ?? b.kind)}</span>
              {[
                "sticky-key",
                "caps-word",
                "key-repeat",
                "key-toggle",
                "toggle-layer",
                "momentary-layer",
                "to-layer",
                "mouse-move",
                "mouse-scroll",
              ].includes(b.kind) && (
                <select
                  className="field"
                  aria-label={tr("Base behavior")}
                  value={b.target ?? ""}
                  onChange={(e) =>
                    edit((p) => {
                      const v = p.layout.behaviors.find((v) => v.id === b.id)!;
                      v.target = e.target.value;
                      if (v.target) v.bindings = [];
                      else if (v.kind === "sticky-key") v.bindings = ["&kp LSHFT"];
                    })
                  }
                >
                  <option value="">{tr("New definition")}</option>
                  {(
                    {
                      "sticky-key": ["sk", "sl"],
                      "caps-word": ["caps_word"],
                      "key-repeat": ["key_repeat"],
                      "key-toggle": ["kt"],
                      "toggle-layer": ["tog"],
                      "momentary-layer": ["mo"],
                      "to-layer": ["to"],
                      "mouse-move": ["mmv"],
                      "mouse-scroll": ["msc"],
                    } as Record<string, string[]>
                  )[b.kind]?.map((v) => (
                    <option value={v} key={v}>
                      {tr("Customize &")}
                      {v}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="behavior-actions">
              <DraggableKey action={behaviorAction(b)} className="behavior-preview" />
              <button
                className="btn primary"
                disabled={!!validateBinding(behaviorAction(b).code, p, plugin)}
                title={
                  validateBinding(behaviorAction(b).code, p, plugin) ||
                  tr("Choose layout positions to assign this behavior")
                }
                aria-label={tr("Assign {0} to keyboard", b.name)}
                onClick={() => onAssign(behaviorAction(b))}
              >
                {tr("Assign to keyboard")}{" "}
              </button>
              <button className="btn danger" onClick={() => removeResource("behaviors", b.id)}>
                {tr("Delete")}{" "}
              </button>
            </div>
          </div>
          <p className="hint behavior-help">
            {b.kind === "hold-tap"
              ? tr("Define a hold action and a tap action. Each key can use different parameters.")
              : b.kind === "tap-dance"
                ? tr("The first action runs on one tap, the second on two taps, and so on.")
                : b.kind === "mod-morph"
                  ? tr(
                      "Define the normal action and the alternate action triggered by the selected modifiers.",
                    )
                  : tr("Configure this behavior and assign it to one or more keys.")}
          </p>
          <AssignmentParameters
            resource={b}
            onChange={(count, parameters) =>
              edit((p) => {
                const behavior = p.layout.behaviors.find((v) => v.id === b.id)!;
                behavior.parameterCount = count;
                behavior.parameters = parameters;
              })
            }
          />
          {b.kind === "native" && (
            <label className="form-label mt-3">
              {tr("ZMK compatible")}{" "}
              <input
                className="field"
                aria-label={tr("ZMK compatible")}
                value={b.compatible ?? ""}
                onChange={(e) =>
                  edit((p) => {
                    const target = p.layout.behaviors.find((v) => v.id === b.id)!;
                    target.compatible = e.target.value;
                    const count = nativeArity(e.target.value);
                    if (count !== undefined) target.parameterCount = count;
                  })
                }
              />
            </label>
          )}
          {(b.kind === "hold-tap" || b.kind === "tap-dance") && (
            <div className="flex gap-4 flex-wrap">
              <NumberField
                label={tr("Tapping term (ms)")}
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
                    min={-1}
                    max={5000}
                    value={b.quickTapMs}
                    onChange={(n) =>
                      edit((p) => {
                        p.layout.behaviors.find((x) => x.id === b.id)!.quickTapMs = n;
                      })
                    }
                  />
                  <label className="form-label">
                    {tr("Resolution")}{" "}
                    <select
                      className="field"
                      value={b.flavor}
                      onChange={(e) =>
                        edit((p) => {
                          p.layout.behaviors.find((x) => x.id === b.id)!.flavor = e.target.value;
                        })
                      }
                    >
                      {[
                        "hold-preferred",
                        "balanced",
                        "tap-preferred",
                        "tap-unless-interrupted",
                      ].map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>
          )}
          <div className="behavior-bindings mt-4">
            {b.bindings.map((binding, i) => (
              <div key={i}>
                <BindingDrop
                  label={
                    b.kind === "hold-tap"
                      ? i === 0
                        ? tr("Hold action (default for new assignments)")
                        : tr("Tap action (default for new assignments)")
                      : b.kind === "mod-morph"
                        ? i === 0
                          ? tr("Normal action")
                          : tr("Modified action")
                        : b.kind === "tap-dance"
                          ? tr("{0} tap(s)", i + 1)
                          : tr("Base action")
                  }
                  owner={b.target || b.id}
                  context={["hold-tap", "sticky-key"].includes(b.kind) ? "child" : "binding"}
                  code={binding}
                  onChange={(code) => {
                    edit((p) => {
                      p.layout.behaviors.find((x) => x.id === b.id)!.bindings[i] = code;
                    });
                  }}
                />
                {b.kind === "tap-dance" && (
                  <button
                    className="btn mt-2"
                    disabled={b.bindings.length <= 1}
                    onClick={() =>
                      edit((p) => {
                        p.layout.behaviors.find((x) => x.id === b.id)!.bindings.splice(i, 1);
                      })
                    }
                  >
                    {tr("Remove")}{" "}
                  </button>
                )}
              </div>
            ))}
            {b.kind === "tap-dance" && b.bindings.length < 256 && (
              <BindingDrop
                owner={b.target || b.id}
                label={b.kind === "tap-dance" ? tr("Add tap") : tr("Add action")}
                code=""
                onChange={(code) =>
                  edit((p) => {
                    p.layout.behaviors.find((x) => x.id === b.id)!.bindings.push(code);
                  })
                }
              />
            )}
          </div>
          {b.kind === "native" && (
            <label className="form-label mt-3">
              {tr("Devicetree child nodes")}{" "}
              <textarea
                className="field source-editor"
                aria-label={tr("Devicetree child nodes")}
                rows={3}
                value={b.children ?? ""}
                onChange={(e) =>
                  edit((p) => {
                    p.layout.behaviors.find((v) => v.id === b.id)!.children = e.target.value;
                  })
                }
              />
            </label>
          )}
          <NativeProperties
            behavior={b}
            onChange={(properties) =>
              edit((p) => {
                p.layout.behaviors.find((v) => v.id === b.id)!.properties = properties;
              })
            }
          />
          {b.kind === "hold-tap" && (
            <div className="flex flex-wrap gap-3 mt-3">
              {(
                [
                  ["retroTap", "Retro-tap"],
                  ["holdWhileUndecided", tr("Activate hold while undecided")],
                  ["holdWhileUndecidedLinger", tr("Keep hold until tap completes")],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={b[key] ?? false}
                    onChange={(e) =>
                      edit((p) => {
                        p.layout.behaviors.find((v) => v.id === b.id)![key] = e.target.checked;
                      })
                    }
                  />{" "}
                  {tr(label)}
                </label>
              ))}
            </div>
          )}
          {b.kind === "hold-tap" && (
            <div className="mt-4 space-y-3">
              <div className="flex gap-4 items-center flex-wrap">
                <NumberField
                  label={tr("Prior idle time (ms)")}
                  min={-1}
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
                  {tr("Resolve hold-trigger on release")}{" "}
                </label>
                <button
                  className="btn"
                  onClick={() => setTriggerEditor((v) => (v === b.id ? "" : b.id))}
                >
                  {tr("Hold-trigger keys (")}
                  {b.holdTriggerPositions.length})
                </button>
              </div>
              {triggerEditor === b.id && (
                <>
                  <p className="hint">
                    {tr(
                      "Select positions that resolve the hold. Select none to disable position restrictions.",
                    )}{" "}
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
              {tr(
                "Actions provide parameters when dragged. To change parameters on an existing key, assign the behavior again.",
              )}{" "}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
export function ComboEditor() {
  useLocale();
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
            {tr(
              "Select two or more keys in the layout and assign the combo action using the palette.",
            )}{" "}
          </p>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            const id = uid();
            edit((p) =>
              p.layout.combos.push({
                id,
                name: tr("New combo"),
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
          {tr("+ New combo")}{" "}
        </button>
      </div>
      {!combo ? (
        <p className="empty">{tr("Combine two or more keys to perform an action.")}</p>
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
                aria-label={tr("Combo name")}
                className="field"
                value={combo.name}
                onChange={(e) =>
                  edit((p) => {
                    p.layout.combos.find((c) => c.id === combo.id)!.name = e.target.value;
                  })
                }
              />
              <NumberField
                label={tr("Combo prior idle time (ms)")}
                min={-1}
                value={combo.requirePriorIdleMs ?? -1}
                onChange={(n) =>
                  edit((p) => {
                    p.layout.combos.find((c) => c.id === combo.id)!.requirePriorIdleMs = n;
                  })
                }
              />
              <NumberField
                label={tr("Activation window (ms)")}
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
                label={tr("Combo action")}
                code={combo.binding}
                onChange={(code) =>
                  edit((p) => {
                    p.layout.combos.find((c) => c.id === combo.id)!.binding = code;
                  })
                }
              />
              <button className="btn danger" onClick={() => removeResource("combos", combo.id)}>
                {tr("Delete")}{" "}
              </button>
            </div>
            <label className="form-label mb-4">
              {tr("Preview layer")}{" "}
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
              <span className="hint">
                {combo.positions.length} {tr("keys selected")}
              </span>
              <span className="hint">
                {combo.positions.length < 2
                  ? tr("Select at least two keys to trigger the combo.")
                  : tr("The selected keys trigger the combo action.")}
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
                {tr("Release after all keys")}{" "}
              </label>
            </div>
            <div className="flex flex-wrap gap-3 mt-4">
              <span className="hint">{tr("Layers (none selected = all):")}</span>
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
  useLocale();
  const { project: p, plugin, edit } = useKeyboardStore();
  if (!p || !plugin) return null;
  const variant = plugin.variants.find((v) => v.id === p.variantId)!;
  return (
    <div className="resource-editor">
      <h2>{tr("Settings")}</h2>
      <AppSettings />
      <div className="resource-card">
        <h3>{tr("Keyboard and firmware")}</h3>
        <label className="form-label mt-3">
          {tr("Hardware variant")}{" "}
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
                {tr(v.name)}
              </option>
            ))}
          </select>
        </label>
        <p className="hint mt-3">
          {variant.targets.map((t) => `${tr(t.name)}: ${t.board} / ${t.shield}`).join(" · ")}
        </p>
        <p className="hint">
          ZMK {(variant.zmkRevision || plugin.zmkRevision).slice(0, 12)} · {plugin.keyCount}{" "}
          {tr("positions, including encoder clicks")}{" "}
        </p>
        <p className="hint mt-2">{tr(variant.instructions)}</p>
      </div>
      <div className="resource-card">
        <h3>{tr("System layout and features")}</h3>
        <div className="flex flex-wrap items-center gap-5 mt-3">
          <label className="form-label">
            {tr("Operating system layout")}{" "}
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
              <option value="pt-br">{tr("Portuguese (Brazil) — ABNT2")}</option>
              {Object.keys(p.headers ?? {})
                .filter((name) => name !== "keys_pt_abnt2.h")
                .map((name) => (
                  <option key={name} value={`header:${name}`}>
                    Header: {name}
                  </option>
                ))}
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
              {tr("OLED status display")}{" "}
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
              {tr("Mouse and scrolling actions")}{" "}
            </label>
          )}
        </div>
        <p className="hint mt-3">
          {tr(
            "The selected layout controls the symbols offered in the palette. Configure the same layout in your operating system.",
          )}{" "}
        </p>
      </div>
      {(
        [
          ["modTap", "Mod-tap (&mt)", "hold-preferred"],
          ["layerTap", "Layer-tap (&lt)", "tap-preferred"],
        ] as const
      ).map(([key, label, flavor]) => {
        const settings = p.options[key] ?? { tappingTermMs: 200, quickTapMs: -1, flavor };
        return (
          <div className="resource-card" key={key}>
            <h3>{tr(label)}</h3>
            <div className="flex flex-wrap gap-4 mt-3">
              <NumberField
                label={tr("Tapping term — {0}", label)}
                min={1}
                max={5000}
                value={settings.tappingTermMs}
                onChange={(n) =>
                  edit((p) => {
                    p.options[key] = { ...settings, tappingTermMs: n };
                  })
                }
              />
              <NumberField
                label={`Quick tap — ${label}`}
                min={-1}
                max={5000}
                value={settings.quickTapMs}
                onChange={(n) =>
                  edit((p) => {
                    p.options[key] = { ...settings, quickTapMs: n };
                  })
                }
              />
              <label className="form-label">
                {tr("Resolution")}{" "}
                <select
                  className="field"
                  aria-label={tr("Resolution — {0}", label)}
                  value={settings.flavor}
                  onChange={(e) =>
                    edit((p) => {
                      p.options[key] = { ...settings, flavor: e.target.value };
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
        );
      })}
      <NativeSettings />
      <div className="resource-card">
        <h3>{tr("Bluetooth and power")}</h3>
        <div className="flex flex-wrap gap-5 items-center mt-3">
          <NumberField
            label={tr("Bluetooth profiles")}
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
            {tr("Automatic sleep")}{" "}
          </label>
          <NumberField
            label={tr("Sleep timeout (ms)")}
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
