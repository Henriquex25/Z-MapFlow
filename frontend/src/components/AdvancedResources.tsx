import { tr, useLocale } from "../i18n";
import { NumberField } from "./NumberField";
import { ValidatedProperty } from "./ValidatedProperty";
import { FirmwareSettings } from "./FirmwareSettings";
import { useState } from "react";
import { useKeyboardStore, layerReference } from "../store/useKeyboardStore";
import { bindingParts } from "../utils/bindingParameters";
import { nativeArity } from "../utils/bindingValidation";
import { BindingArguments } from "./BindingArguments";
import { behaviorAction, macroAction } from "../utils/resourceActions";
import { uid, type Behavior, type Macro } from "../types/keyboard";

export const behaviorKinds: Record<string, string> = {
  "hold-tap": "Tap or hold (hold-tap)",
  "tap-dance": "Tap sequence (tap-dance)",
  "mod-morph": "Modifier-based action",
  "sticky-key": "Sticky modifier",
  "caps-word": "Caps Word",
  "key-repeat": "Repeat key",
  "key-toggle": "Toggle key",
  "toggle-layer": "Toggle layer",
  "momentary-layer": "Momentary layer",
  "to-layer": "Switch layer",
  "mouse-move": "Move pointer",
  "mouse-scroll": "Scroll",
  native: "ZMK module behavior",
};
export function newBehavior(kind: string): Behavior {
  const bindings =
    kind === "hold-tap"
      ? ["&kp LCTRL", "&kp ESC"]
      : kind === "tap-dance" || kind === "mod-morph"
        ? ["&kp A", "&kp B"]
        : kind === "sticky-key"
          ? ["&kp LSHFT"]
          : [];
  return {
    id: uid(),
    name:
      kind === "hold-tap"
        ? tr("New tap/hold")
        : kind === "tap-dance"
          ? tr("New tap sequence")
          : tr("New {0}", tr(behaviorKinds[kind] ?? kind)),
    kind,
    bindings,
    tappingTermMs: 200,
    quickTapMs: -1,
    flavor: "balanced",
    requirePriorIdleMs: -1,
    holdTriggerPositions: [],
    holdTriggerOnRelease: false,
    properties:
      kind === "mod-morph"
        ? { mods: "<(MOD_LSFT|MOD_RSFT)>" }
        : kind === "sticky-key"
          ? { "release-after-ms": "<1000>", "ignore-modifiers": "" }
          : kind === "mouse-move"
            ? {
                "x-input-code": "<INPUT_REL_X>",
                "y-input-code": "<INPUT_REL_Y>",
                "time-to-max-speed-ms": "<300>",
              }
            : kind === "mouse-scroll"
              ? {
                  "x-input-code": "<INPUT_REL_HWHEEL>",
                  "y-input-code": "<INPUT_REL_WHEEL>",
                  "time-to-max-speed-ms": "<300>",
                  "acceleration-exponent": "<0>",
                }
              : {},
    parameterCount: kind === "native" ? 1 : undefined,
    compatible: kind === "native" ? "zmk,behavior-key-press" : undefined,
  };
}

const controls: Record<string, string> = {
  "&macro_tap": "Mode: tap",
  "&macro_press": "Mode: press",
  "&macro_release": "Mode: release",
  "&macro_pause_for_release": "Continue when the macro is released",
  "&macro_wait_time": "Change interval between actions",
  "&macro_tap_time": "Change tap duration",
  "&macro_param_1to1": "Parameter 1 → argument 1",
  "&macro_param_1to2": "Parameter 1 → argument 2",
  "&macro_param_2to1": "Parameter 2 → argument 1",
  "&macro_param_2to2": "Parameter 2 → argument 2",
};
export function MacroControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  useLocale();
  const [name, amount] = value.split(/\s+/);
  const timed = name === "&macro_tap_time" || name === "&macro_wait_time";
  return (
    <div className="flex flex-col gap-2">
      <select
        className="field"
        aria-label={tr("Macro control")}
        value={name in controls ? name : "&macro_pause_for_release"}
        onChange={(e) => onChange(e.target.value + (e.target.value.endsWith("_time") ? " 20" : ""))}
      >
        {Object.entries(controls).map(([v, label]) => (
          <option key={v} value={v}>
            {tr(label)}
          </option>
        ))}
      </select>
      {timed && (
        <NumberField
          label={tr("Control duration (ms)")}
          value={Number(amount || 0)}
          onChange={(ms) => onChange(`${name} ${ms}`)}
        />
      )}
    </div>
  );
}

export function AssignmentParameters({
  resource,
  onChange,
}: {
  resource: Macro | Behavior;
  onChange: (count: number, values: string[]) => void;
}) {
  useLocale();
  const project = useKeyboardStore((s) => s.project);
  const isBehavior = "kind" in resource;
  const knownCount =
    isBehavior && resource.kind === "native" ? nativeArity(resource.compatible ?? "") : undefined;
  const count =
    knownCount ??
    (isBehavior
      ? resource.kind === "hold-tap"
        ? 2
        : [
              "sticky-key",
              "key-toggle",
              "toggle-layer",
              "momentary-layer",
              "to-layer",
              "mouse-move",
              "mouse-scroll",
            ].includes(resource.kind)
          ? 1
          : (resource.parameterCount ?? 0)
      : (resource.parameterCount ?? 0));
  const editable = !isBehavior || (resource.kind === "native" && knownCount === undefined);
  return (
    <details className="mt-3">
      <summary>{tr("Parameters for new assignments")}</summary>
      <p className="hint">
        {tr(
          "Each key keeps its own arguments. Click a key in the layout to edit values already assigned to it.",
        )}{" "}
      </p>
      <div className="flex flex-wrap gap-3 mt-2">
        {editable && (
          <label>
            {tr("Parameter count")}{" "}
            <select
              className="field"
              aria-label={tr("Parameter count")}
              value={count}
              onChange={(e) => onChange(Number(e.target.value), resource.parameters ?? [])}
            >
              {[0, 1, 2].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        {project && count > 0 && (
          <BindingArguments
            code={isBehavior ? behaviorAction(resource).code : macroAction(resource).code}
            project={project}
            label={tr("Parameters for new assignments")}
            onChange={(code) => onChange(count, bindingParts(code).slice(1))}
          />
        )}
      </div>
    </details>
  );
}

type PropertyField = {
  name: string;
  label: string;
  kind: "number" | "boolean" | "text" | "select";
  fallback?: string | number | boolean;
  choices?: string[];
};
const fields: Record<string, PropertyField[]> = {
  "mod-morph": [
    {
      name: "mods",
      label: "Modifiers that activate the alternate action",
      kind: "text",
      fallback: "<(MOD_LSFT|MOD_RSFT)>",
    },
    { name: "keep-mods", label: "Retained modifiers", kind: "text", fallback: "<0>" },
  ],
  "sticky-key": [
    { name: "release-after-ms", label: "Release after (ms)", kind: "number", fallback: 1000 },
    { name: "quick-release", label: "Release when the next key is pressed", kind: "boolean" },
    { name: "lazy", label: "Activate with the next key", kind: "boolean" },
    {
      name: "ignore-modifiers",
      label: "Combine sticky modifiers",
      kind: "boolean",
      fallback: true,
    },
  ],
  "caps-word": [
    {
      name: "continue-list",
      label: "Keys that keep Caps Word active",
      kind: "text",
      fallback: "<UNDERSCORE BACKSPACE DELETE>",
    },
    { name: "mods", label: "Applied modifiers", kind: "text", fallback: "<MOD_LSFT>" },
  ],
  "key-repeat": [
    {
      name: "usage-pages",
      label: "Repeated HID usage pages",
      kind: "text",
      fallback: "<HID_USAGE_KEY>",
    },
  ],
  "key-toggle": [
    {
      name: "toggle-mode",
      label: "Mode",
      kind: "select",
      fallback: "flip",
      choices: ["flip", "on", "off"],
    },
  ],
  "toggle-layer": [
    {
      name: "toggle-mode",
      label: "Mode",
      kind: "select",
      fallback: "flip",
      choices: ["flip", "on", "off"],
    },
    { name: "locking", label: "Keep layer locked", kind: "boolean" },
  ],
};
const mouseFields: PropertyField[] = [
  { name: "delay-ms", label: "Initial delay (ms)", kind: "number", fallback: 0 },
  {
    name: "time-to-max-speed-ms",
    label: "Time to maximum speed (ms)",
    kind: "number",
    fallback: 0,
  },
  { name: "acceleration-exponent", label: "Acceleration exponent", kind: "number", fallback: 1 },
  { name: "trigger-period-ms", label: "Movement interval (ms)", kind: "number", fallback: 16 },
];
fields["mouse-move"] = mouseFields;
fields["mouse-scroll"] = mouseFields;
fields["momentary-layer"] = [{ name: "locking", label: "Keep layer locked", kind: "boolean" }];
fields["to-layer"] = fields["momentary-layer"];

export function NativeProperties({
  behavior,
  onChange,
}: {
  behavior: Behavior;
  onChange: (properties: Record<string, string>) => void;
}) {
  useLocale();
  const [extraName, setExtraName] = useState("");
  const supportsLocking =
    useKeyboardStore((s) =>
      s.plugin?.variants
        .find((v) => v.id === s.project?.variantId)
        ?.features?.includes("layer-locking"),
    ) ?? false;
  const props = behavior.properties ?? {};
  const set = (name: string, value: string) => onChange({ ...props, [name]: value });
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-4">
        {(fields[behavior.kind] ?? [])
          .filter((f) => f.name !== "locking" || supportsLocking)
          .map((f) => (
            <label key={f.name} className="form-label">
              {f.kind === "boolean" ? (
                <>
                  <input
                    type="checkbox"
                    checked={
                      props[f.name] === "/delete-property/"
                        ? false
                        : f.name in props ||
                          (f.name === "ignore-modifiers" && behavior.target === "sk") ||
                          (f.name === "quick-release" && behavior.target === "sl")
                    }
                    onChange={(e) => set(f.name, e.target.checked ? "" : "/delete-property/")}
                  />{" "}
                  {tr(f.label)}
                </>
              ) : (
                <>
                  {tr(f.label)}
                  {f.kind === "select" ? (
                    <select
                      className="field"
                      value={props[f.name]?.replaceAll('"', "") ?? String(f.fallback)}
                      onChange={(e) => set(f.name, JSON.stringify(e.target.value))}
                    >
                      {f.choices?.map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <ValidatedProperty
                      name={f.name}
                      number={f.kind === "number"}
                      value={
                        f.kind === "number"
                          ? (props[f.name]?.replace(/[<>()]/g, "") ?? Number(f.fallback))
                          : (props[f.name] ?? String(f.fallback ?? ""))
                      }
                      onChange={(value) => set(f.name, value)}
                    />
                  )}
                </>
              )}
            </label>
          ))}
      </div>
      <details className="mt-3">
        <summary>{tr("Additional ZMK properties")}</summary>
        <p className="hint">
          {tr(
            'Use Devicetree values such as <200>, <MOD_LSFT> or "on". A property without a value is boolean.',
          )}{" "}
        </p>
        {Object.entries(props).map(([name, value]) => (
          <div className="flex gap-2 mt-2 items-center" key={name}>
            <code>{name}</code>
            <ValidatedProperty
              name={name}
              ariaLabel={tr("Property {0}", name)}
              value={value}
              onChange={(value) => set(name, value)}
            />
            <button
              className="btn"
              onClick={() => {
                const next = { ...props };
                delete next[name];
                onChange(next);
              }}
            >
              {tr("Remove property")}{" "}
            </button>
          </div>
        ))}
        <div className="flex gap-2 mt-2">
          <input
            className="field"
            aria-label={tr("ZMK property name")}
            value={extraName}
            onChange={(e) => setExtraName(e.target.value)}
            placeholder="release-after-ms"
          />
          <button
            className="btn"
            disabled={!extraName.trim()}
            onClick={() => {
              set(extraName.trim(), "");
              setExtraName("");
            }}
          >
            {tr("Add property")}{" "}
          </button>
        </div>
      </details>
    </div>
  );
}

export function ConditionalLayersEditor() {
  useLocale();
  const { project: p, edit } = useKeyboardStore();
  if (!p) return null;
  return (
    <div className="resource-editor">
      <div className="section-toolbar">
        <div>
          <h2>{tr("Conditional layers")}</h2>
          <p className="hint">
            {tr(
              "Activate a layer when all conditions are active. Place the target after the condition layers.",
            )}{" "}
          </p>
        </div>
        <button
          className="btn primary"
          disabled={p.layout.layers.length < 3}
          onClick={() =>
            edit((p) => {
              (p.layout.conditionalLayers ??= []).push({
                id: uid(),
                name: "Lower + Raise → Adjust",
                ifLayerIds: p.layout.layers.slice(-3, -1).map((l) => l.id),
                thenLayerId: p.layout.layers.at(-1)!.id,
              });
            })
          }
        >
          {tr("+ New rule")}{" "}
        </button>
      </div>
      {p.layout.layers.length < 3 && (
        <p className="hint">{tr("Add at least three layers to create a rule.")}</p>
      )}
      {p.layout.conditionalLayers?.map((c) => (
        <article className="resource-card" key={c.id}>
          <div className="section-toolbar">
            <input
              className="field"
              aria-label={tr("Conditional rule name")}
              value={c.name}
              onChange={(e) =>
                edit((p) => {
                  p.layout.conditionalLayers!.find((r) => r.id === c.id)!.name = e.target.value;
                })
              }
            />
            <button
              className="btn danger"
              onClick={() =>
                edit((p) => {
                  p.layout.conditionalLayers = p.layout.conditionalLayers!.filter(
                    (r) => r.id !== c.id,
                  );
                })
              }
            >
              {tr("Delete rule")}{" "}
            </button>
          </div>
          <p>{tr("When all these layers are active:")}</p>
          <div className="flex flex-wrap gap-3">
            {p.layout.layers
              .filter((l) => l.id !== c.thenLayerId)
              .map((l) => (
                <label key={l.id}>
                  <input
                    type="checkbox"
                    checked={c.ifLayerIds.includes(l.id)}
                    onChange={(e) =>
                      edit((p) => {
                        const rule = p.layout.conditionalLayers!.find((r) => r.id === c.id)!;
                        rule.ifLayerIds = e.target.checked
                          ? [...rule.ifLayerIds, l.id]
                          : rule.ifLayerIds.filter((id) => id !== l.id);
                      })
                    }
                  />{" "}
                  {l.name}
                </label>
              ))}
          </div>
          <label className="form-label mt-3">
            {tr("Activate layer")}{" "}
            <select
              className="field"
              aria-label={tr("Conditional target layer")}
              value={c.thenLayerId}
              onChange={(e) =>
                edit((p) => {
                  p.layout.conditionalLayers!.find((r) => r.id === c.id)!.thenLayerId =
                    e.target.value;
                })
              }
            >
              {p.layout.layers.map((l) => (
                <option value={l.id} key={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </article>
      ))}
    </div>
  );
}

export function NativeSettings() {
  useLocale();
  const { project: p, edit, activeLayerId } = useKeyboardStore();
  if (!p) return null;
  const layer = p.layout.layers.find((l) => l.id === activeLayerId) ?? p.layout.layers[0];
  return (
    <>
      <FirmwareSettings />
      <InputProcessorsEditor />
      <div className="resource-card">
        <h3>{tr("Lighting and power off")}</h3>
        <p className="hint">
          {tr(
            "Enable features supported by your hardware before assigning their actions from the Resources palette.",
          )}{" "}
        </p>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ["rgbUnderglow", "RGB underglow"],
              ["backlight", "Backlight"],
              ["softOff", tr("Power off key (soft off)")],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={p.options[key] ?? false}
                onChange={(e) =>
                  edit((p) => {
                    p.options[key] = e.target.checked;
                  })
                }
              />{" "}
              {tr(label)}
            </label>
          ))}
        </div>
      </div>
      <div className="resource-card">
        <h3>
          {tr("Encoders —")} {layer.name}
        </h3>
        <div className="flex flex-wrap gap-5">
          {layer.sensors.map((s) => (
            <div key={s.id}>
              <p>{tr(s.label)}</p>
              <label>
                <input
                  type="checkbox"
                  checked={s.inherited ?? false}
                  onChange={(e) =>
                    edit((p) => {
                      p.layout.layers
                        .find((l) => l.id === layer.id)!
                        .sensors.find((v) => v.id === s.id)!.inherited = e.target.checked;
                    })
                  }
                />{" "}
                {tr("Inherit rotation actions from lower layers")}{" "}
              </label>
              <label className="form-label">
                {tr("Tap duration (ms)")}{" "}
                <input
                  className="field"
                  type="number"
                  min={0}
                  value={s.tapMs ?? 5}
                  onChange={(e) =>
                    edit((p) => {
                      p.layout.layers
                        .find((l) => l.id === layer.id)!
                        .sensors.find((v) => v.id === s.id)!.tapMs = Number(e.target.value);
                    })
                  }
                />
              </label>
              <label className="form-label">
                {tr("Triggers per rotation")}{" "}
                <input
                  className="field"
                  type="number"
                  min={1}
                  placeholder={tr("Hardware default")}
                  value={s.triggersPerRotation || ""}
                  onChange={(e) =>
                    edit((p) => {
                      for (const l of p.layout.layers) {
                        const sensor = l.sensors.find((v) => v.id === s.id);
                        if (sensor) sensor.triggersPerRotation = Number(e.target.value);
                      }
                    })
                  }
                />
              </label>
            </div>
          ))}
        </div>
      </div>
      <div className="resource-card">
        <h3>{tr("Advanced ZMK configuration")}</h3>
        <p className="hint">
          {tr("Preserve module, input processor and hardware settings. Use @")}
          {tr("{layer_id}")}{" "}
          {tr(
            "for layer references in additional sections. The fields below are included in the saved project and generated files.",
          )}{" "}
        </p>
        {(
          [
            ["preamble", tr("Defines before headers")],
            ["extraDts", tr("Additional Devicetree")],
            ["extraConfig", tr("Additional Kconfig (.conf)")],
          ] as const
        ).map(([key, label]) => (
          <label className="form-label mt-3" key={key}>
            {tr(label)}
            <textarea
              className="field source-editor"
              aria-label={tr(label)}
              rows={5}
              value={p[key] ?? ""}
              onChange={(e) =>
                edit((p) => {
                  p[key] = e.target.value;
                })
              }
            />
          </label>
        ))}
      </div>
    </>
  );
}

export function InputProcessorsEditor() {
  useLocale();
  const { project: p, edit } = useKeyboardStore();
  if (!p) return null;
  return (
    <div className="resource-card">
      <div className="section-toolbar">
        <h3>{tr("Input processors")}</h3>
        <button
          className="btn"
          onClick={() =>
            edit((p) => {
              (p.layout.inputProcessors ??= []).push({
                id: uid(),
                listener: "trackpad_listener",
                layerIds: [],
                bindings: ["&zip_xy_scaler 3 2"],
                processNext: false,
              });
            })
          }
        >
          {tr("+ Input processing chain")}{" "}
        </button>
      </div>
      <p className="hint">
        {tr(
          "Configure movement, scrolling and transformations per device. Enter the listener defined by your hardware and keep the desired processing order.",
        )}{" "}
      </p>
      {p.layout.inputProcessors?.map((c) => (
        <article className="resource-card mt-3" key={c.id}>
          <label className="form-label">
            {tr("Device listener")}{" "}
            <input
              className="field"
              aria-label={tr("Device listener")}
              value={c.listener}
              onChange={(e) =>
                edit((p) => {
                  p.layout.inputProcessors!.find((v) => v.id === c.id)!.listener =
                    e.target.value.replace(/^&/, "");
                })
              }
            />
          </label>
          <label className="form-label mt-2">
            {tr("Processors (one binding per line)")}{" "}
            <textarea
              className="field source-editor"
              aria-label={tr("Input processor bindings")}
              value={c.bindings.join("\n")}
              onChange={(e) =>
                edit((p) => {
                  p.layout.inputProcessors!.find((v) => v.id === c.id)!.bindings = e.target.value
                    .split("\n")
                    .filter((s) => s.trim())
                    .map((s) => s.trim());
                })
              }
            />
          </label>
          <div className="flex gap-2 mt-2">
            <button
              className="btn"
              onClick={() =>
                edit((p) => {
                  p.layout
                    .inputProcessors!.find((v) => v.id === c.id)!
                    .bindings.push("&zip_xy_to_scroll_mapper");
                })
              }
            >
              {tr("+ Convert to scrolling")}{" "}
            </button>
            <button
              className="btn"
              onClick={() =>
                edit((p) => {
                  const chains = p.layout.inputProcessors!;
                  const i = chains.findIndex((v) => v.id === c.id);
                  if (i > 0) [chains[i - 1], chains[i]] = [chains[i], chains[i - 1]];
                })
              }
            >
              {tr("Move up")}{" "}
            </button>
            <button
              className="btn danger"
              onClick={() =>
                edit((p) => {
                  p.layout.inputProcessors = p.layout.inputProcessors!.filter((v) => v.id !== c.id);
                })
              }
            >
              {tr("Delete chain")}{" "}
            </button>
          </div>
          <p className="hint mt-3">{tr("Active layers (none = device default)")}</p>
          <div className="flex flex-wrap gap-3">
            {p.layout.layers.map((l) => (
              <label key={l.id}>
                <input
                  type="checkbox"
                  checked={c.layerIds.includes(l.id)}
                  onChange={(e) =>
                    edit((p) => {
                      const chain = p.layout.inputProcessors!.find((v) => v.id === c.id)!;
                      chain.layerIds = e.target.checked
                        ? [...chain.layerIds, l.id]
                        : chain.layerIds.filter((id) => id !== l.id);
                    })
                  }
                />{" "}
                {l.name}
              </label>
            ))}
          </div>
          <label className="mt-2 block">
            <input
              type="checkbox"
              checked={c.processNext}
              onChange={(e) =>
                edit((p) => {
                  p.layout.inputProcessors!.find((v) => v.id === c.id)!.processNext =
                    e.target.checked;
                })
              }
            />{" "}
            {tr("Continue through the next chains in this layer")}{" "}
          </label>
        </article>
      ))}
    </div>
  );
}
