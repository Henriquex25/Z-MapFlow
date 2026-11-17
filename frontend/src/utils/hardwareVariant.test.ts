import { expect, it } from "vitest";
import { dongleFixture } from "../test/dongleFixture";
import { changeHardwareVariant, hardwareConfigError } from "./hardwareVariant";
import { enableStudioUSB } from "./firmwareSettings";

it("preserves keymap data and moves the Studio USB preset to the new central", () => {
  const { project: p, plugin } = dongleFixture();
  const layout = structuredClone(p.layout);
  enableStudioUSB(p, "left");
  p.buildTargets![0].cmakeArgs!.push("-DCONFIG_ZMK_USB_LOGGING=y");
  changeHardwareVariant(p, plugin, "dongle");
  expect(p.layout).toEqual(layout);
  expect(p.buildTargets!.find((t) => t.targetId === "left")!.cmakeArgs).toContain(
    "-DCONFIG_ZMK_USB_LOGGING=y",
  );
  expect(p.buildTargets!.find((t) => t.targetId === "left")!.cmakeArgs).not.toContain(
    "-DCONFIG_ZMK_STUDIO=y",
  );
  expect(p.buildTargets!.find((t) => t.targetId === "dongle")!.snippets).toContain(
    "studio-rpc-usb-uart",
  );
  expect(hardwareConfigError(p, plugin)).toBe("");
  changeHardwareVariant(p, plugin, "test");
  expect(p.buildTargets!.some((t) => t.targetId === "dongle")).toBe(false);
  expect(p.buildTargets!.find((t) => t.targetId === "left")!.cmakeArgs).toContain(
    "-DCONFIG_ZMK_STUDIO=y",
  );
  expect(p.layout).toEqual(layout);
});
it("removes redundant imported profile flags on switching back and reports contradictory flags", () => {
  const { project: p, plugin } = dongleFixture();
  p.variantId = "dongle";
  p.buildTargets = [{ targetId: "left", cmakeArgs: ["-DCONFIG_ZMK_SPLIT_ROLE_CENTRAL:BOOL=y"] }];
  expect(hardwareConfigError(p, plugin)).toContain("CONFIG_ZMK_SPLIT_ROLE_CENTRAL=n");
  p.buildTargets[0].cmakeArgs = ["-DCONFIG_ZMK_SPLIT_ROLE_CENTRAL=n", "-DCONFIG_CUSTOM=y"];
  changeHardwareVariant(p, plugin, "test");
  expect(p.buildTargets[0].cmakeArgs).toEqual(["-DCONFIG_CUSTOM=y"]);
});

it("moves an imported global Studio configuration with its USB snippet", () => {
  const { project: p, plugin } = dongleFixture();
  p.extraConfig = "CONFIG_ZMK_STUDIO=y";
  p.buildTargets = [{ targetId: "left", snippets: ["studio-rpc-usb-uart"], cmakeArgs: [] }];
  changeHardwareVariant(p, plugin, "dongle");
  expect(p.extraConfig).not.toContain("CONFIG_ZMK_STUDIO=y");
  expect(p.buildTargets.find((s) => s.targetId === "left")!.snippets).not.toContain(
    "studio-rpc-usb-uart",
  );
  expect(p.buildTargets.find((s) => s.targetId === "dongle")!.cmakeArgs).toContain(
    "-DCONFIG_ZMK_STUDIO=y",
  );
});

it("rejects status-sync Kconfig overrides that could desynchronize devices", () => {
  const { project: p, plugin } = dongleFixture();
  p.variantId = "dongle";
  p.extraConfig = "CONFIG_ZMAPFLOW_STATUS_SYNC=y";
  expect(hardwareConfigError(p, plugin)).toContain("use the synchronization option");
  p.extraConfig = "";
  p.buildTargets = [{ targetId: "left", cmakeArgs: ["-DCONFIG_ZMAPFLOW_STATUS_SYNC=y"] }];
  expect(hardwareConfigError(p, plugin)).toContain("use the synchronization option");
});
