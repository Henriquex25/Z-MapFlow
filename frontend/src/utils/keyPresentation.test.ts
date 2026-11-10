import { expect, it } from "vitest";
import { fixture } from "../test/fixtures";
import { newBehavior } from "../components/AdvancedResources";
import { presentKey } from "./keyPresentation";
import { formatKeyVisuals } from "./keyFormatter";

it("shows the tap and hold actions of a custom home-row mod without changing its source", () => {
  const p = fixture().project;
  p.layout.behaviors = [
    {
      ...newBehavior("hold-tap"),
      id: "zm_hrm",
      name: "homerow_mods_left",
      bindings: ["&kp", "&kp"],
    },
  ];
  const before = structuredClone(p);
  const result = presentKey("&zm_hrm LCTRL PT_A", p);
  expect(result.badge).toBe("HT");
  expect(result.visuals).toMatchObject({ main: "A", modifier: "L Ctrl" });
  expect(result.visuals?.description).toContain("homerow_mods_left");
  expect(p).toEqual(before);
});
it("ignores forwarded parameters for a zero-parameter hold child", () => {
  const p = fixture().project;
  p.layout.behaviors = [
    { ...newBehavior("hold-tap"), id: "zm_caps_number", bindings: ["&caps_word", "&kp"] },
  ];
  expect(presentKey("&zm_caps_number 0 N3", p).visuals).toMatchObject({
    main: "3",
    modifier: "Caps Word",
  });
});
it("shows all shortcut modifiers and recognizes long ZMK and locale aliases", () => {
  expect(formatKeyVisuals("&kp LC(LS(PT_A))")).toMatchObject({ main: "A", modifier: "CTRL+SHIFT" });
  expect(formatKeyVisuals("&kp LEFT_CONTROL")).toMatchObject({ main: "CTRL", modifier: "L" });
  expect(formatKeyVisuals("&kp PT_DOUBLE_QUOTES")).toMatchObject({ main: '"' });
  expect(formatKeyVisuals("&kp (RIGHT_ALT)")).toMatchObject({ main: "ALT", modifier: "R" });
  expect(formatKeyVisuals("&kp PT_QUESTION")).toMatchObject({ main: "?" });
  expect(formatKeyVisuals("&kp K_VOLUME_DOWN")).toMatchObject({ main: "Vol −" });
});
it("displays both tap-dance actions and readable macro names", () => {
  const p = fixture().project;
  p.layout.behaviors = [
    { ...newBehavior("tap-dance"), id: "zm_dance", bindings: ["&kp A", "&kp LC(C)"] },
  ];
  expect(presentKey("&zm_dance", p)).toMatchObject({
    alternatives: ["A", "Ctrl+C"],
    visuals: { main: "A / Ctrl+C" },
  });
  p.layout.macros = [{ id: "zm_copy", name: "Copiar_linha", tapMs: 10, waitMs: 10, steps: [] }];
  expect(presentKey("&zm_copy", p)).toMatchObject({
    badge: "M",
    visuals: { main: "Copiar linha" },
  });
});
it("resolves stable layer IDs in hold-taps without rewriting them", () => {
  const p = fixture().project;
  p.layout.layers.push({ ...structuredClone(p.layout.layers[0]), id: "nav", name: "Navegação" });
  expect(presentKey("&lt @{nav} SPACE", p).visuals).toMatchObject({
    main: "SPACE",
    modifier: "LT 1",
  });
});
