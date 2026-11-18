import { expect, it } from "vitest";
import { fixture } from "../test/fixtures";
import { bindingChoices } from "./bindingChoices";
it("offers executable actions with feature gates, excluding sensor-only and unavailable transports", () => {
  const { project, plugin } = fixture();
  plugin.actions = [{ name: "A preset", code: "&kp A" }];
  const choices = () => bindingChoices(project, plugin, "binding");
  expect(choices().filter((c) => c.code === "&kp A")).toHaveLength(1);
  expect(choices().find((c) => c.code === "&kp A")!.label).toContain("Key press");
  expect(choices().find((c) => c.code.startsWith("&inc_dec_kp"))).toBeUndefined();
  expect(choices().find((c) => c.code.startsWith("&rgb_ug"))!.error).not.toBe("");
  project.options.rgbUnderglow = true;
  expect(choices().find((c) => c.code.startsWith("&rgb_ug"))!.error).toBe("");
  plugin.capabilities = [];
  expect(choices().some((c) => c.code.startsWith("&bt ") || c.code.startsWith("&out "))).toBe(
    false,
  );
});
it("honors feature flags configured per central target", () => {
  const { project, plugin } = fixture();
  plugin.variants[0].targets[0].role = "central";
  project.buildTargets = [{ targetId: "left", cmakeArgs: ["-DCONFIG_ZMK_STUDIO=y"] }];
  expect(
    bindingChoices(project, plugin, "binding").find((c) => c.code === "&studio_unlock")!.error,
  ).toBe("");
});
