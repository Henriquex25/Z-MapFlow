import type { Plugin } from "../types/keyboard";

export const OLED_ROTATION_SNIPPET = "zmapflow-oled-flip-180";

export function oledRotationTargets(variant: Plugin["variants"][number] | undefined) {
  if (!variant?.features?.includes("oled-rotate-180")) return [];
  return variant.targets.filter((target) => !target.kind || target.kind === "keyboard");
}
