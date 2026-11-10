import { expect, it } from "vitest";
import cases from "../../../internal/zmkdata/cases.json";
import { fixture } from "../test/fixtures";
import { newBehavior } from "../components/AdvancedResources";
import { bindingParameters, validateBinding } from "./bindingValidation";
it.each(cases)("shares firmware parameter validation: $code (valid=$valid)", (test) => {
  const { project: p, plugin } = fixture();
  p.options.bluetoothProfiles = 3;
  p.options.pointing = true;
  p.preamble = '#define MY_KEY A\n#define MY_WRAP(k) LC(k)\n#define MY_STRING "text"\n';
  expect(
    validateBinding(test.code, p, plugin, "macro" in test && test.macro ? "macro" : "binding") ===
      "",
  ).toBe(test.valid);
});
it("requires the correct count and kind for reusable hold-taps", () => {
  const { project: p, plugin } = fixture();
  p.layout.behaviors = [{ ...newBehavior("hold-tap"), id: "zm_hold", bindings: ["&mo", "&kp"] }];
  expect(validateBinding("&zm_hold @{base} A", p, plugin)).toBe("");
  expect(validateBinding("&zm_hold LCTRL A", p, plugin)).not.toBe("");
  expect(validateBinding("&zm_hold @{base}", p, plugin)).not.toBe("");
  expect(bindingParameters("&zm_hold @{base} A", p, plugin).map((s) => s.kind)).toEqual([
    "layer",
    "keycode",
  ]);
});
it("rejects two-parameter children and recursive composition", () => {
  const { project: p, plugin } = fixture();
  expect(validateBinding("&mt LCTRL A", p, plugin, "child")).toContain("zero ou um");
  expect(validateBinding("&kp", p, plugin, "child")).toBe("");
  p.layout.behaviors = [{ ...newBehavior("tap-dance"), id: "zm_dance", bindings: ["&zm_dance"] }];
  expect(validateBinding("&zm_dance", p, plugin)).toContain("si mesmo");
});
