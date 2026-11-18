import { targetFlag } from "./targetSettings";
import catalog from "../../../internal/zmkdata/catalog.json";
import type { Plugin, Project } from "../types/keyboard";
import {
  bindingParameters,
  parameterDefault,
  validateBinding,
  type BindingContext,
} from "./bindingValidation";
import { behaviorAction, macroAction } from "./resourceActions";
import { tr } from "../i18n";

const names: Record<string, string> = {
  kp: "Key press",
  kt: "Key toggle",
  mt: "Modifier / tap",
  lt: "Layer / tap",
  mo: "Momentary layer",
  to: "Go to layer",
  tog: "Toggle layer",
  sl: "Sticky layer",
  sk: "Sticky key",
  bt: "Bluetooth",
  out: "Output connection",
  mkp: "Mouse button",
  mmv: "Movement",
  msc: "Scrolling",
  rgb_ug: "RGB underglow",
  bl: "Backlight",
  ext_power: "External power",
  none: "No action",
  trans: "Transparent",
  bootloader: "Enter bootloader",
  caps_word: "Caps Word",
  key_repeat: "Repeat last key",
  sys_reset: "Restart device",
  studio_unlock: "Unlock ZMK Studio",
  soft_off: "Power off",
  gresc: "Grave / Escape",
};
export function bindingChoices(
  p: Project,
  plugin: Plugin | null,
  context: BindingContext,
  owner?: string,
) {
  const central = plugin?.variants
    .find((v) => v.id === p.variantId)
    ?.targets.find((t) => t.role === "central" || t.role === "standalone");
  const enabled = (name: string, option = false) =>
    option || targetFlag(p, central?.id ?? "", name, "n") === "y";
  const available: Record<string, boolean> = {
    rgb_ug: enabled("CONFIG_ZMK_RGB_UNDERGLOW", !!p.options.rgbUnderglow),
    bl: enabled("CONFIG_ZMK_BACKLIGHT", !!p.options.backlight),
    soft_off: enabled("CONFIG_ZMK_PM_SOFT_OFF", !!p.options.softOff),
    studio_unlock: enabled("CONFIG_ZMK_STUDIO"),
  };
  const native = Object.keys({ ...catalog.bindings, ...plugin?.bindingArities })
    .filter(
      (name) =>
        !p.layout.behaviors.some((b) => b.target === name) &&
        name !== "inc_dec_kp" &&
        (!plugin || plugin.capabilities.includes("bluetooth") || !["bt", "out"].includes(name)),
    )
    .map((name) => {
      let code = `&${name}`;
      const defaults = (source: string) =>
        bindingParameters(source, p, plugin).map(
          (spec) => spec.choices?.[0] ?? parameterDefault(spec.kind, p),
        );
      code = [code, ...defaults(code)].join(" ");
      // Command behaviors can add arguments after the command itself.
      code = [`&${name}`, ...defaults(code)].join(" ");
      return {
        code,
        label: `${tr(names[name] ?? name)} (&${name})`,
        group: "Built-in actions",
        error:
          available[name] === false
            ? tr("Enable this feature in Settings before choosing its action.")
            : "",
      };
    });
  const custom = [
    ...p.layout.macros.map((m) => ({ ...macroAction(m), group: "Macros" })),
    ...p.layout.behaviors.map((b) => ({ ...behaviorAction(b), group: "Behaviors" })),
    ...(plugin?.actions ?? []).map((a) => ({
      code: a.code,
      label: a.name,
      group: "Keyboard actions",
    })),
  ];
  const unavailable = new Map(native.map((a) => [a.code, a.error]));
  const unique = [...native, ...custom].filter(
    (a, index, all) => all.findIndex((b) => b.code === a.code) === index,
  );
  return unique.map((a) => ({
    ...a,
    error:
      unavailable.get(a.code) ||
      validateBinding(a.code, p, plugin, context, new Set(owner ? [owner] : [])),
  }));
}
