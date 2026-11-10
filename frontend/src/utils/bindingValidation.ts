import { tr } from "../i18n";
import catalog from "../../../internal/zmkdata/catalog.json";
import { behaviorAction, macroAction } from "./resourceActions";
import type { Behavior, Plugin, Project } from "../types/keyboard";
import { bindingParts, normalizeBinding } from "./bindingParameters";

export type BindingContext = "binding" | "child" | "macro";
export interface ParameterSpec {
  kind: string;
  label: string;
  choices?: string[];
}
const signatures = catalog.bindings as Record<string, string[]>;
const commands = catalog.commands as Record<string, Record<string, string[]>>;
const choices = catalog.choices as Record<string, string[]>;
const baseSymbols = new Set(catalog.symbols);
const baseKeys = new Set(catalog.keycodes);
const baseFunctions = catalog.functions as Record<string, number>;
const keyFunctions = new Set([
  "LC",
  "LS",
  "LA",
  "LG",
  "RC",
  "RS",
  "RA",
  "RG",
  "LCTL",
  "LSFT",
  "LALT",
  "LGUI",
  "RCTL",
  "RSFT",
  "RALT",
  "RGUI",
  "ZMK_HID_USAGE",
  "APPLY_MODS",
  "SELECT_MODS",
  "STRIP_MODS",
]);
const labels: Record<string, string> = {
  keycode: "Key / shortcut",
  layer: "Layer",
  profile: "Bluetooth profile",
  btCommand: "Bluetooth action",
  rgbCommand: "RGB action",
  output: "Output connection",
  mouseButton: "Mouse button",
  move: "Movement",
  scroll: "Scrolling",
  backlight: "Lighting",
  backlightCommand: "Lighting action",
  percent: "Brightness (%)",
  power: "Power",
  integer: "Numeric value",
  scalar: "Parameter",
};
const symbolCache = new WeakMap<
  Project,
  { symbols: Set<string>; functions: Record<string, number> }
>();
export function userSymbols(p: Project) {
  const cached = symbolCache.get(p);
  if (cached) return cached;
  const symbols = new Set<string>(),
    functions: Record<string, number> = {};
  for (const source of [p.preamble ?? "", ...Object.values(p.headers ?? {})]) {
    const clean = source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\\\n/g, " ");
    for (const m of clean.matchAll(/^\s*#\s*define\s+([A-Za-z_]\w*)(\(([^)]*)\))?[^\n]*/gm)) {
      if (m[2] !== undefined) functions[m[1]] = m[3].split(",").filter((v) => v.trim()).length;
      else {
        const body = m[0].replace(/^\s*#\s*define\s+[A-Za-z_]\w*/, "").trim();
        if (body && !body.startsWith("//") && !/["{};]/.test(body)) symbols.add(m[1]);
      }
    }
  }
  const result = { symbols, functions };
  symbolCache.set(p, result);
  return result;
}
export function validateExpression(
  source: string,
  kind: string,
  p: Project,
  macro = false,
): string {
  if (!source.trim()) return tr("Fill in this parameter.");
  const custom = userSymbols(p),
    functions = { ...baseFunctions, ...custom.functions };
  const tokens =
    source.match(
      /0[xX][0-9a-fA-F]+[uUlL]*|\d+[uUlL]*|[A-Za-z_]\w*|<<|>>|<=|>=|==|!=|&&|\|\||[()+\-*/%~!^|&,<>]/g,
    ) ?? [];
  if (tokens.join("") !== source.replace(/\s/g, ""))
    return tr("Invalid expression: use a ZMK code or a declared expression.");
  let i = 0;
  const fail = (message: string): never => {
    throw Error(message);
  };
  const expression = (type: string): void => {
    atom(type);
    while (i < tokens.length && ![",", ")"].includes(tokens[i])) {
      if (!/^(?:<<|>>|<=|>=|==|!=|&&|\|\||[+\-*/%&|^<>])$/.test(tokens[i++]))
        fail(tr("Separate expressions with a valid operator."));
      atom(type);
    }
  };
  const atom = (type: string): void => {
    const token = tokens[i++];
    if (!token) fail(tr("Incomplete expression."));
    if (["+", "-", "~", "!"].includes(token)) {
      atom(type);
      return;
    }
    if (token === "(") {
      expression(type);
      if (tokens[i++] !== ")") fail(tr("Close the parentheses."));
      return;
    }
    if (/^\d/.test(token)) {
      if (BigInt(token.replace(/[uUlL]+$/, "")) > 0xffffffffn)
        fail(tr("The value exceeds 32 bits."));
      if (type === "modifierMask" && BigInt(token.replace(/[uUlL]+$/, "")) > 255n)
        fail(tr("Use a modifier mask from 0 to 255."));
      return;
    }
    if (!/^[A-Za-z_]\w*$/.test(token)) fail(tr("Expected a code or numeric value."));
    if (tokens[i] === "(") {
      const count = functions[token];
      if (
        count === undefined ||
        (type === "keycode" && !keyFunctions.has(token) && custom.functions[token] === undefined)
      )
        fail(tr("Unknown function: {0}.", token));
      i++;
      let actual = 0;
      if (tokens[i] !== ")") {
        do {
          if (actual > 0) i++;
          expression(
            ["LC", "LS", "LA", "LG", "RC", "RS", "RA", "RG"].includes(token) ? "keycode" : "scalar",
          );
          actual++;
        } while (tokens[i] === ",");
      }
      if (tokens[i++] !== ")" || actual !== count)
        fail(tr("{0} requires {1} arguments.", token, count));
      if (["RGB_COLOR_HSB", "RGB_COLOR_HSV", "RGB_COLOR_HSB_VAL"].includes(token)) {
        const m = source.match(/RGB_COLOR_HS[BV](?:_VAL)?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
        if (m && (Number(m[1]) > 360 || Number(m[2]) > 100 || Number(m[3]) > 100))
          fail(tr("HSB: hue from 0 to 360; saturation and brightness from 0 to 100."));
      }
      return;
    }
    if (token === "MACRO_PLACEHOLDER") {
      if (macro) return;
      fail(tr("MACRO_PLACEHOLDER can only be used inside a macro."));
    }
    if (
      !(
        type === "keycode"
          ? baseKeys
          : type === "modifierMask"
            ? new Set(catalog.symbols.filter((s) => s.startsWith("MOD_")))
            : baseSymbols
      ).has(token) &&
      !custom.symbols.has(token)
    )
      fail(tr("Unknown code: {0}. For a custom code, declare it in a header or #define.", token));
  };
  try {
    expression(kind);
    if (i !== tokens.length) fail(tr("Incomplete expression."));
    return "";
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
export const nativeArity = (compatible: string) =>
  (catalog.nativeArities as Record<string, number>)[compatible];
export function behaviorArity(b: Behavior) {
  if (b.kind === "hold-tap") return 2;
  if (
    [
      "sticky-key",
      "key-toggle",
      "toggle-layer",
      "momentary-layer",
      "to-layer",
      "mouse-move",
      "mouse-scroll",
    ].includes(b.kind)
  )
    return 1;
  return b.parameterCount ?? 0;
}
function parameterKinds(
  name: string,
  p: Project,
  plugin: Plugin | null,
  seen = new Set<string>(),
): string[] | undefined {
  if (seen.has(name)) return undefined;
  seen = new Set(seen).add(name);
  const b = p.layout.behaviors.find((b) => (b.target || b.id) === name);
  if (b) {
    if (b.target && !b.bindings.length && signatures[b.target]) return signatures[b.target];
    if (b.kind === "hold-tap" || b.kind === "sticky-key")
      return Array.from(
        { length: behaviorArity(b) },
        (_, i) =>
          parameterKinds(
            bindingParts(b.bindings[i] ?? "")[0]?.slice(1) ?? "",
            p,
            plugin,
            seen,
          )?.[0] ?? "scalar",
      );
    const equivalent: Record<string, string> = {
      "key-toggle": "kt",
      "toggle-layer": "tog",
      "momentary-layer": "mo",
      "to-layer": "to",
      "mouse-move": "mmv",
      "mouse-scroll": "msc",
    };
    if (equivalent[b.kind]) return signatures[equivalent[b.kind]];
    if (b.kind === "native") {
      const native: Record<string, string> = {
        "zmk,behavior-key-press": "kp",
        "zmk,behavior-key-toggle": "kt",
        "zmk,behavior-momentary-layer": "mo",
      };
      if (native[b.compatible ?? ""]) return signatures[native[b.compatible!]];
    }
    return Array.from({ length: behaviorArity(b) }, () => "scalar");
  }
  const macro = p.layout.macros.find((m) => m.id === name);
  if (macro) {
    const kinds = Array.from({ length: macro.parameterCount ?? 0 }, () => "scalar");
    const routes = new Map<number, number>();
    for (const step of macro.steps) {
      if (step.kind === "control") {
        const m = step.binding.match(/^&macro_param_([12])to([12])$/);
        if (m) routes.set(+m[2], +m[1]);
        continue;
      }
      if (step.kind === "wait") continue;
      const target =
        parameterKinds(bindingParts(step.binding)[0]?.slice(1) ?? "", p, plugin, seen) ?? [];
      for (const [to, from] of routes)
        if (target[to - 1])
          kinds[from - 1] = target[to - 1].endsWith("Command") ? "scalar" : target[to - 1];
      routes.clear();
    }
    return kinds;
  }
  if (signatures[name]) return signatures[name];
  const n = plugin?.bindingArities?.[name];
  return n === undefined ? undefined : Array.from({ length: n }, () => "scalar");
}
export function bindingParameters(
  code: string,
  p: Project,
  plugin: Plugin | null,
): ParameterSpec[] {
  const f = bindingParts(code),
    name = f[0]?.slice(1) ?? "";
  if (name === "rgb_ug" && /^RGB_COLOR_HS[BV]\(/.test(f[1] ?? ""))
    return [{ kind: "scalar", label: tr("HSB color") }];
  const kinds = [...(parameterKinds(name, p, plugin) ?? [])];
  if (commands[name]) {
    const extra = commands[name][f[1]];
    if (extra) kinds.push(...extra);
  }
  return kinds.map((kind, i) => ({
    kind,
    label: tr(labels[kind] ?? tr("Parameter {0}", i + 1)),
    choices: kind.endsWith("Command")
      ? Object.keys(
          commands[name] ??
            commands[kind === "btCommand" ? "bt" : kind === "backlightCommand" ? "bl" : "rgb_ug"],
        )
      : choices[kind],
  }));
}
export function validateBinding(
  code: string,
  p: Project,
  plugin: Plugin | null,
  context: BindingContext = "binding",
  seen = new Set<string>(),
  checkResources = true,
): string {
  if (code.length > 8192) return tr("Action is too long.");
  const f = bindingParts(code.trim()),
    name = f[0]?.slice(1) ?? "";
  if (!/^&[A-Za-z_]\w*$/.test(f[0] ?? "")) return tr("Use a ZMK action, for example &kp A.");
  if (seen.has(name)) return tr("A behavior cannot execute itself, directly or indirectly.");
  const kinds = parameterKinds(name, p, plugin);
  if (!kinds) return `Comportamento desconhecido: &${name}.`;
  if (context === "child" && (commands[name] || kinds.length > 1))
    return tr(
      "This base action only accepts behaviors with zero or one parameter. Use a macro for compound actions.",
    );
  const deferred = context === "child" && f.length === 1 && kinds.length === 1;
  if (["mkp", "mmv", "msc"].includes(name) && !p.options.pointing)
    return tr("Enable mouse actions in Settings.");
  let specs = bindingParameters(code, p, plugin);
  if (context === "macro" && commands[name] && f[1] === "MACRO_PLACEHOLDER")
    specs = [
      { kind: "scalar", label: tr("Command") },
      { kind: "scalar", label: tr("Parameter") },
    ];
  if (name === "rgb_ug" && /^RGB_COLOR_HS[BV]\(/.test(f[1] ?? ""))
    specs = [{ kind: "scalar", label: tr("HSB color") }];
  if (!deferred && f.length - 1 !== specs.length)
    return tr("&{0} requires {1} parameter(s); received: {2}.", name, specs.length, f.length - 1);
  for (let i = 0; !deferred && i < specs.length; i++) {
    const value = f[i + 1],
      spec = specs[i];
    if (value === "MACRO_PLACEHOLDER" && context === "macro") continue;
    if (spec.kind === "layer") {
      const normalized = normalizeBinding(code, p),
        token = bindingParts(normalized)[i + 1];
      if (!p.layout.layers.some((l) => `@{${l.id}}` === token))
        return tr("Choose an existing layer.");
    } else if (spec.kind === "profile") {
      if (!/^\d+$/.test(value) || +value >= p.options.bluetoothProfiles)
        return tr("Choose a configured Bluetooth profile.");
    } else if (spec.kind === "percent") {
      if (!/^\d+$/.test(value) || +value > 100) return tr("Brightness must be between 0 and 100%.");
    } else if (spec.kind === "integer") {
      if (!/^\d+$/.test(value) || Number(value) > 0xffffffff)
        return tr("Use an integer from 0 to 4294967295.");
    } else if (spec.choices) {
      if (!spec.choices.includes(value)) {
        // Direction/button bitfields are documented expressions, not free text.
        if (["move", "scroll", "mouseButton"].includes(spec.kind)) {
          const e = validateExpression(value, "scalar", p, context === "macro");
          if (e) return e;
        } else return tr("Choose a valid option for {0}.", spec.label.toLowerCase());
      }
    } else {
      const e = validateExpression(value, spec.kind, p, context === "macro");
      if (e) return e;
    }
  }
  if (!checkResources) return "";
  seen = new Set(seen).add(name);
  const b = p.layout.behaviors.find((b) => (b.target || b.id) === name);
  if (b) {
    for (const [key, value] of Object.entries(b.properties ?? {})) {
      const error = validateProperty(key, value, p);
      if (error) return `${b.name}: ${error}`;
    }
    if (
      b.kind === "native" &&
      nativeArity(b.compatible ?? "") !== undefined &&
      b.parameterCount !== nativeArity(b.compatible ?? "")
    )
      return tr("The parameter count must match the selected ZMK type.");
    const counts: Record<string, [number, number]> = {
      "hold-tap": [2, 2],
      "sticky-key": [b.target ? 0 : 1, b.target ? 1 : 1],
      "mod-morph": [2, 2],
      "tap-dance": [1, 256],
    };
    const range = counts[b.kind];
    if (range && (b.bindings.length < range[0] || b.bindings.length > range[1]))
      return tr(
        "{0}: configure {1} action(s).",
        b.name,
        range[0] === range[1] ? range[0] : `${range[0]} a ${range[1]}`,
      );
    if (b.kind === "mod-morph" && !b.properties?.mods)
      return tr("Choose the modifiers for the alternate behavior.");
    if (
      ["hold-tap", "tap-dance"].includes(b.kind) &&
      (b.tappingTermMs < 1 || b.tappingTermMs > 5000)
    )
      return tr("The decision time must be between 1 and 5000 ms.");
    for (const child of b.bindings) {
      const e = validateBinding(
        child,
        p,
        plugin,
        ["hold-tap", "sticky-key"].includes(b.kind) ? "child" : "binding",
        seen,
      );
      if (e) return `${b.name}: ${e}`;
    }
  }
  const macro = p.layout.macros.find((m) => m.id === name);
  if (macro) {
    if (!macro.steps.length) return tr("Add actions to the macro before assigning it.");
    for (const step of macro.steps)
      if (!["control", "wait"].includes(step.kind)) {
        const e = validateBinding(step.binding, p, plugin, "macro", seen);
        if (e) return `${macro.name}: ${e}`;
      }
  }
  return "";
}
export function keycodeChoices(p: Project) {
  return [...new Set([...catalog.keycodes, ...userSymbols(p).symbols])].sort();
}
export function parameterDefault(kind: string, p: Project) {
  return kind === "keycode"
    ? "A"
    : kind === "layer"
      ? `@{${p.layout.layers[0].id}}`
      : kind === "profile" || kind === "integer" || kind === "scalar"
        ? "0"
        : (choices[kind]?.[0] ?? "0");
}

export function projectBindingError(p: Project, plugin: Plugin | null) {
  for (const macro of p.layout.macros) {
    const error = validateBinding(macroAction(macro).code, p, plugin);
    if (error) return `${macro.name}: ${error}`;
  }
  for (const b of p.layout.behaviors) {
    const error = validateBinding(behaviorAction(b).code, p, plugin);
    if (error) return `${b.name}: ${error}`;
  }
  for (const combo of p.layout.combos) {
    const error = validateBinding(combo.binding, p, plugin);
    if (error) return `${combo.name}: ${error}`;
  }
  for (const layer of p.layout.layers) {
    for (const key of layer.keys) {
      const error = validateBinding(key.code, p, plugin);
      if (error) return tr("{0}, key {1}: {2}", layer.name, key.keymapIndex, error);
    }
    for (const s of layer.sensors) {
      for (const code of [s.codeCW, s.codeCCW, s.codeClick]) {
        const error = validateBinding(code, p, plugin);
        if (error) return `${layer.name}, ${s.label}: ${error}`;
      }
    }
  }
  return "";
}

export function validateProperty(name: string, value: string, project: Project) {
  if (!/^[a-zA-Z#][a-zA-Z0-9_#,-]*$/.test(name)) return tr("Invalid ZMK property name.");
  if (["compatible", "bindings", "#binding-cells", "display-name"].includes(name))
    return tr("Use the dedicated field for this property.");
  if (value === "/delete-property/") return "";
  if (/[;{}\n\r#]/.test(value.replace(/@\{[^}]+\}/g, "0")))
    return tr("Enter only the property value, without semicolons or child nodes.");
  const managed = ["mods", "keep-mods", "continue-list"].includes(name) || name.endsWith("-ms");
  if (managed && !/^<[\s\S]*>$/.test(value.trim()))
    return tr("Use Devicetree format, for example <200> or <MOD_LSFT>.");
  if (value === "") return "";
  const body = value.trim().replace(/^</, "").replace(/>$/, "");
  if (["mods", "keep-mods"].includes(name))
    return validateExpression(body, "modifierMask", project);
  if (name === "continue-list") {
    for (const token of bindingParts(body)) {
      const e = validateExpression(token, "keycode", project);
      if (e) return e;
    }
    return "";
  }
  if (name.endsWith("-ms")) return validateExpression(body, "scalar", project);
  return "";
}
