import { tr } from "../i18n";
import type { Project } from "../types/keyboard";
import { bindingParts } from "./bindingParameters";
import { formatKeyVisuals, type KeyVisuals } from "./keyFormatter";

export interface KeyPresentation {
  visuals: KeyVisuals | null;
  badge: string;
  name?: string;
  alternatives?: string[];
}
const badges: Record<string, string> = {
  kp: "KP",
  mt: "MT",
  lt: "LT",
  mo: "MO",
  sl: "SL",
  tog: "TG",
  to: "TO",
  bt: "BT",
  out: "OUT",
  sk: "SK",
  kt: "KT",
  trans: "▽",
  none: "—",
};
const kinds: Record<string, string> = {
  "hold-tap": "HT",
  "tap-dance": "TD",
  "mod-morph": "MM",
  "sticky-key": "SK",
  "caps-word": "CW",
  "key-repeat": "REP",
  "key-toggle": "KT",
  "toggle-layer": "TG",
  "momentary-layer": "MO",
  "to-layer": "TO",
  "mouse-move": "MOV",
  "mouse-scroll": "SCR",
};
export const readableName = (name: string) => name.replace(/_/g, " ");
function layerCode(code: string, p: Project | null) {
  return code.replace(/@\{([^}]+)\}/g, (_, id: string) =>
    String(p?.layout.layers.findIndex((l) => l.id === id) ?? -1),
  );
}
export function visualSummary(v: KeyVisuals | null) {
  const symbol =
    v?.main || { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" }[v?.icon ?? ""];
  const text =
    v?.modifier === "L" || v?.modifier === "R"
      ? `${v.modifier} ${v.main}`
      : [v?.modifier, symbol || v?.description]
          .filter(Boolean)
          .join(v?.modifier === "Caps" ? " " : "+");
  return text
    .replace(/\bCTRL\b/g, "Ctrl")
    .replace(/\bSHIFT\b/g, "Shift")
    .replace(/\bALT\b/g, "Alt")
    .replace(/\bGUI\b/g, "Gui");
}
export function presentKey(
  code: string,
  p: Project | null,
  seen = new Set<string>(),
): KeyPresentation {
  const parts = bindingParts(code.trim());
  const reference = parts[0]?.replace(/^&/, "") ?? "";
  const standard = () => ({
    visuals: formatKeyVisuals(layerCode(code, p)),
    badge: badges[reference] ?? reference.replace(/_/g, " ").slice(0, 4).toUpperCase(),
  });
  if (!p || seen.has(reference) || seen.size > 12) return standard();
  const macro = p.layout.macros.find((m) => m.id === reference);
  if (macro)
    return {
      visuals: { main: readableName(macro.name), description: macro.name },
      badge: "M",
      name: macro.name,
    };
  const behavior = p.layout.behaviors.find((b) => (b.target || b.id) === reference);
  if (!behavior) return standard();
  seen = new Set(seen).add(reference);
  const child = (index: number, parameter?: string) => {
    const childParts = bindingParts(behavior.bindings[index] ?? "&none");
    // A hold-tap forwards one invocation parameter to each child behavior.
    // Child arguments stored in the editor serve as assignment defaults.
    const ref = childParts[0]?.slice(1);
    const target = p.layout.behaviors.find((b) => (b.target || b.id) === ref);
    const macro = p.layout.macros.find((m) => m.id === ref);
    const ignoresParameter =
      [
        "none",
        "trans",
        "caps_word",
        "key_repeat",
        "bootloader",
        "sys_reset",
        "studio_unlock",
        "soft_off",
      ].includes(ref) ||
      (target &&
        (["caps-word", "key-repeat", "tap-dance", "mod-morph"].includes(target.kind) ||
          (target.kind === "native" && target.parameterCount === 0))) ||
      macro?.parameterCount === 0;
    return presentKey(
      parameter === undefined || ignoresParameter
        ? childParts.join(" ")
        : `${childParts[0]} ${parameter}`,
      p,
      seen,
    );
  };
  const badge = kinds[behavior.kind] ?? "BEH";
  if (behavior.kind === "hold-tap") {
    const hold = child(0, parts[1]);
    const tap = child(1, parts[2]);
    const holdText = visualSummary(hold.visuals);
    return {
      badge,
      name: behavior.name,
      visuals: {
        ...tap.visuals,
        main: tap.visuals?.main ?? "",
        modifier: holdText,
        description: tr(
          "{0}: tap {1}; hold {2}",
          behavior.name,
          visualSummary(tap.visuals),
          holdText,
        ),
      },
    };
  }
  if (behavior.kind === "tap-dance" || behavior.kind === "mod-morph") {
    const labels = behavior.bindings.map((_, i) => visualSummary(child(i).visuals));
    return {
      badge,
      name: behavior.name,
      alternatives: labels,
      visuals: { main: labels.join(" / "), description: `${behavior.name}: ${labels.join(" / ")}` },
    };
  }
  if (behavior.kind === "sticky-key") {
    const key = child(0, parts[1]);
    return {
      badge,
      name: behavior.name,
      visuals: {
        ...key.visuals,
        main: key.visuals?.main ?? "",
        modifier: "Sticky",
        description: behavior.name,
      },
    };
  }
  const builtin: Record<string, string> = {
    "caps-word": "caps_word",
    "key-repeat": "key_repeat",
    "key-toggle": "kt",
    "toggle-layer": "tog",
    "momentary-layer": "mo",
    "to-layer": "to",
    "mouse-move": "mmv",
    "mouse-scroll": "msc",
  };
  if (builtin[behavior.kind])
    return {
      badge,
      name: behavior.name,
      visuals: formatKeyVisuals(
        layerCode([`&${builtin[behavior.kind]}`, ...parts.slice(1)].join(" "), p),
      ),
    };
  return {
    badge,
    name: behavior.name,
    visuals: { main: readableName(behavior.name), description: behavior.name },
  };
}
