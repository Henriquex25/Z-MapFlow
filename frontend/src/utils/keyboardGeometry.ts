import type { Plugin } from "../types/keyboard";

export const keyboardUnit = 62;
const edgeSpace = 12;

/** Include rotated key corners and a gutter for outlines/shadows in the scroll area. */
export function keyboardGeometry(plugin: Pick<Plugin, "width" | "height" | "positions">) {
  let left = 0,
    top = 0,
    right = plugin.width * keyboardUnit,
    bottom = plugin.height * keyboardUnit;
  for (const position of plugin.positions) {
    if (position.hidden) continue;
    const width = Math.max(0, position.width * keyboardUnit - 6);
    const height = Math.max(0, position.height * keyboardUnit - 6);
    const angle = (position.rotation * Math.PI) / 180;
    const halfWidth = (Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height) / 2;
    const halfHeight = (Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height) / 2;
    const x = position.x * keyboardUnit + width / 2;
    const y = position.y * keyboardUnit + height / 2;
    left = Math.min(left, x - halfWidth);
    top = Math.min(top, y - halfHeight);
    right = Math.max(right, x + halfWidth);
    bottom = Math.max(bottom, y + halfHeight);
  }
  return {
    width: right - left + edgeSpace * 2,
    height: bottom - top + edgeSpace * 2,
    offsetX: edgeSpace - left,
    offsetY: edgeSpace - top,
  };
}
