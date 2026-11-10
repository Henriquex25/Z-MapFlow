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
  "hold-tap": "Toque ou segurar (hold-tap)",
  "tap-dance": "Sequência de toques (tap-dance)",
  "mod-morph": "Ação por modificador",
  "sticky-key": "Modificador temporário",
  "caps-word": "Palavra em maiúsculas",
  "key-repeat": "Repetir tecla",
  "key-toggle": "Alternar tecla",
  "toggle-layer": "Alternar camada",
  "momentary-layer": "Camada enquanto segura",
  "to-layer": "Mudar camada",
  "mouse-move": "Mover ponteiro",
  "mouse-scroll": "Rolar",
  native: "Comportamento de módulo ZMK",
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
        ? "Novo toque/segurar"
        : kind === "tap-dance"
          ? "Nova sequência de toques"
          : `Novo ${behaviorKinds[kind]}`,
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
  "&macro_tap": "Modo: tocar",
  "&macro_press": "Modo: pressionar",
  "&macro_release": "Modo: soltar",
  "&macro_pause_for_release": "Continuar quando soltar a macro",
  "&macro_wait_time": "Alterar intervalo entre ações",
  "&macro_tap_time": "Alterar duração do toque",
  "&macro_param_1to1": "Parâmetro 1 → argumento 1",
  "&macro_param_1to2": "Parâmetro 1 → argumento 2",
  "&macro_param_2to1": "Parâmetro 2 → argumento 1",
  "&macro_param_2to2": "Parâmetro 2 → argumento 2",
};
export function MacroControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [name, amount] = value.split(/\s+/);
  const timed = name === "&macro_tap_time" || name === "&macro_wait_time";
  return (
    <div className="flex flex-col gap-2">
      <select
        className="field"
        aria-label="Controle da macro"
        value={name in controls ? name : "&macro_pause_for_release"}
        onChange={(e) => onChange(e.target.value + (e.target.value.endsWith("_time") ? " 20" : ""))}
      >
        {Object.entries(controls).map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
      {timed && (
        <NumberField
          label="Tempo do controle (ms)"
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
      <summary>Parâmetros para novas atribuições</summary>
      <p className="hint">
        Cada tecla mantém seus próprios argumentos. Clique na tecla do layout para editar os valores
        já atribuídos.
      </p>
      <div className="flex flex-wrap gap-3 mt-2">
        {editable && (
          <label>
            Quantidade de parâmetros
            <select
              className="field"
              aria-label="Quantidade de parâmetros"
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
            label="Parâmetros para novas atribuições"
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
      label: "Modificadores que ativam a ação alternativa",
      kind: "text",
      fallback: "<(MOD_LSFT|MOD_RSFT)>",
    },
    { name: "keep-mods", label: "Modificadores mantidos", kind: "text", fallback: "<0>" },
  ],
  "sticky-key": [
    { name: "release-after-ms", label: "Liberar após (ms)", kind: "number", fallback: 1000 },
    { name: "quick-release", label: "Liberar ao pressionar a próxima tecla", kind: "boolean" },
    { name: "lazy", label: "Ativar junto à próxima tecla", kind: "boolean" },
    {
      name: "ignore-modifiers",
      label: "Combinar modificadores sticky",
      kind: "boolean",
      fallback: true,
    },
  ],
  "caps-word": [
    {
      name: "continue-list",
      label: "Teclas que mantêm Caps Word ativo",
      kind: "text",
      fallback: "<UNDERSCORE BACKSPACE DELETE>",
    },
    { name: "mods", label: "Modificadores aplicados", kind: "text", fallback: "<MOD_LSFT>" },
  ],
  "key-repeat": [
    {
      name: "usage-pages",
      label: "Páginas HID repetidas",
      kind: "text",
      fallback: "<HID_USAGE_KEY>",
    },
  ],
  "key-toggle": [
    {
      name: "toggle-mode",
      label: "Modo",
      kind: "select",
      fallback: "flip",
      choices: ["flip", "on", "off"],
    },
  ],
  "toggle-layer": [
    {
      name: "toggle-mode",
      label: "Modo",
      kind: "select",
      fallback: "flip",
      choices: ["flip", "on", "off"],
    },
    { name: "locking", label: "Manter camada bloqueada", kind: "boolean" },
  ],
};
const mouseFields: PropertyField[] = [
  { name: "delay-ms", label: "Atraso inicial (ms)", kind: "number", fallback: 0 },
  {
    name: "time-to-max-speed-ms",
    label: "Tempo até velocidade máxima (ms)",
    kind: "number",
    fallback: 0,
  },
  { name: "acceleration-exponent", label: "Expoente de aceleração", kind: "number", fallback: 1 },
  { name: "trigger-period-ms", label: "Intervalo de movimento (ms)", kind: "number", fallback: 16 },
];
fields["mouse-move"] = mouseFields;
fields["mouse-scroll"] = mouseFields;
fields["momentary-layer"] = [
  { name: "locking", label: "Manter camada bloqueada", kind: "boolean" },
];
fields["to-layer"] = fields["momentary-layer"];

export function NativeProperties({
  behavior,
  onChange,
}: {
  behavior: Behavior;
  onChange: (properties: Record<string, string>) => void;
}) {
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
                  {f.label}
                </>
              ) : (
                <>
                  {f.label}
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
        <summary>Propriedades ZMK adicionais</summary>
        <p className="hint">
          Use valores Devicetree, como &lt;200&gt;, &lt;MOD_LSFT&gt; ou "on". Uma propriedade sem
          valor é booleana.
        </p>
        {Object.entries(props).map(([name, value]) => (
          <div className="flex gap-2 mt-2 items-center" key={name}>
            <code>{name}</code>
            <ValidatedProperty
              name={name}
              ariaLabel={`Propriedade ${name}`}
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
              Remover propriedade
            </button>
          </div>
        ))}
        <div className="flex gap-2 mt-2">
          <input
            className="field"
            aria-label="Nome da propriedade ZMK"
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
            Adicionar propriedade
          </button>
        </div>
      </details>
    </div>
  );
}

export function ConditionalLayersEditor() {
  const { project: p, edit } = useKeyboardStore();
  if (!p) return null;
  return (
    <div className="resource-editor">
      <div className="section-toolbar">
        <div>
          <h2>Camadas condicionais</h2>
          <p className="hint">
            Ative uma camada quando todas as condições estiverem ativas. Coloque o destino depois
            das camadas de condição.
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
          + Nova regra
        </button>
      </div>
      {p.layout.layers.length < 3 && (
        <p className="hint">Adicione ao menos três camadas para criar uma regra.</p>
      )}
      {p.layout.conditionalLayers?.map((c) => (
        <article className="resource-card" key={c.id}>
          <div className="section-toolbar">
            <input
              className="field"
              aria-label="Nome da regra condicional"
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
              Excluir regra
            </button>
          </div>
          <p>Quando todas estas camadas estiverem ativas:</p>
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
            Ativar camada
            <select
              className="field"
              aria-label="Camada de destino condicional"
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
  const { project: p, edit, activeLayerId } = useKeyboardStore();
  if (!p) return null;
  const layer = p.layout.layers.find((l) => l.id === activeLayerId) ?? p.layout.layers[0];
  return (
    <>
      <FirmwareSettings />
      <InputProcessorsEditor />
      <div className="resource-card">
        <h3>Iluminação e desligamento</h3>
        <p className="hint">
          Ative recursos presentes no seu hardware antes de atribuir suas ações na paleta Recursos.
        </p>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ["rgbUnderglow", "RGB underglow"],
              ["backlight", "Backlight"],
              ["softOff", "Desligamento por tecla (soft off)"],
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
              {label}
            </label>
          ))}
        </div>
      </div>
      <div className="resource-card">
        <h3>Encoders — {layer.name}</h3>
        <div className="flex flex-wrap gap-5">
          {layer.sensors.map((s) => (
            <div key={s.id}>
              <p>{s.label}</p>
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
                Herdar rotações das camadas inferiores
              </label>
              <label className="form-label">
                Tempo do toque (ms)
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
                Acionamentos por rotação
                <input
                  className="field"
                  type="number"
                  min={1}
                  placeholder="Padrão do hardware"
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
        <h3>Configuração ZMK avançada</h3>
        <p className="hint">
          Preserve configurações de módulos, input processors e hardware. Use @{"{id_da_camada}"}{" "}
          para referências de camada em trechos adicionais. Os campos abaixo integram o projeto
          salvo e os arquivos gerados.
        </p>
        {(
          [
            ["preamble", "Defines antes dos headers"],
            ["extraDts", "Devicetree adicional"],
            ["extraConfig", "Kconfig adicional (.conf)"],
          ] as const
        ).map(([key, label]) => (
          <label className="form-label mt-3" key={key}>
            {label}
            <textarea
              className="field source-editor"
              aria-label={label}
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
  const { project: p, edit } = useKeyboardStore();
  if (!p) return null;
  return (
    <div className="resource-card">
      <div className="section-toolbar">
        <h3>Input processors</h3>
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
          + Cadeia de apontamento
        </button>
      </div>
      <p className="hint">
        Ajuste movimento, rolagem e transformações por dispositivo. Informe o listener definido pelo
        hardware e mantenha a ordem de processamento desejada.
      </p>
      {p.layout.inputProcessors?.map((c) => (
        <article className="resource-card mt-3" key={c.id}>
          <label className="form-label">
            Listener do dispositivo
            <input
              className="field"
              aria-label="Listener do dispositivo"
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
            Processadores (um binding por linha)
            <textarea
              className="field source-editor"
              aria-label="Bindings dos input processors"
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
              + Converter em rolagem
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
              Mover para cima
            </button>
            <button
              className="btn danger"
              onClick={() =>
                edit((p) => {
                  p.layout.inputProcessors = p.layout.inputProcessors!.filter((v) => v.id !== c.id);
                })
              }
            >
              Excluir cadeia
            </button>
          </div>
          <p className="hint mt-3">Camadas ativas (nenhuma = padrão do dispositivo)</p>
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
            Continuar nas próximas cadeias desta camada
          </label>
        </article>
      ))}
    </div>
  );
}
