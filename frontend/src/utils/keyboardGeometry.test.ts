import { it, expect } from "vitest";
import { fixture } from "../test/fixtures";
import { keyboardGeometry, keyboardUnit } from "./keyboardGeometry";

it("reserves scrollable space beyond every rotated corner, including negative coordinates", () => {
  const plugin = fixture().plugin;
  plugin.width = 1;
  plugin.height = 1;
  plugin.positions = [
    { ...plugin.positions[0], x: -0.3, y: -0.4, height: 1.5, rotation: 30 },
    { ...plugin.positions[0], x: 1, y: 1, height: 1.5, rotation: -30 },
  ];
  const original = structuredClone(plugin.positions);
  const bounds = keyboardGeometry(plugin);
  for (const p of plugin.positions) {
    const width = p.width * keyboardUnit - 6,
      height = p.height * keyboardUnit - 6;
    for (const dx of [-width / 2, width / 2])
      for (const dy of [-height / 2, height / 2]) {
        const a = (p.rotation * Math.PI) / 180;
        const x =
          p.x * keyboardUnit + width / 2 + bounds.offsetX + dx * Math.cos(a) - dy * Math.sin(a);
        const y =
          p.y * keyboardUnit + height / 2 + bounds.offsetY + dx * Math.sin(a) + dy * Math.cos(a);
        expect(x).toBeGreaterThanOrEqual(11.99);
        expect(y).toBeGreaterThanOrEqual(11.99);
        expect(bounds.width - x).toBeGreaterThanOrEqual(11.99);
        expect(bounds.height - y).toBeGreaterThanOrEqual(11.99);
      }
  }
  expect(plugin.positions).toEqual(original);
});
it("ignores hidden positions and retains the plugin's declared canvas size", () => {
  const plugin = fixture().plugin;
  plugin.positions.push({ ...plugin.positions[0], hidden: true, x: 100, y: 100 });
  expect(keyboardGeometry(plugin)).toMatchObject({
    width: plugin.width * keyboardUnit + 24,
    height: plugin.height * keyboardUnit + 24,
  });
});
