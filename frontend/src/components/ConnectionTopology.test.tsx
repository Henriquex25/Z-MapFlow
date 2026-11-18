import { beforeEach, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { dongleFixture } from "../test/dongleFixture";
import { useKeyboardStore, isDirty } from "../store/useKeyboardStore";
import { useAppPreferences } from "../i18n";
import { changeHardwareVariant } from "../utils/hardwareVariant";
import { ConnectionTopology } from "./ConnectionTopology";
beforeEach(() => useAppPreferences.setState({ locale: "en" }));
it("keeps synchronization off by default and saves it as an independent, undoable option", () => {
  const session = dongleFixture();
  session.project.variantId = "dongle";
  useKeyboardStore.getState().initialize(session);
  render(<ConnectionTopology variant={session.plugin.variants[1]} />);
  const checkbox = screen.getByRole("checkbox", {
    name: "Synchronize layer and connection with the halves",
  });
  expect(checkbox).not.toBeChecked();
  expect(useKeyboardStore.getState().project!.options.peripheralStatusSync).toBeUndefined();
  fireEvent.click(checkbox);
  const s = useKeyboardStore.getState();
  expect(s.project!.options.peripheralStatusSync).toBe(true);
  expect(s.savedProject!.options.peripheralStatusSync).toBeUndefined();
  expect(isDirty(s.project, s.savedProject)).toBe(true);
  expect(screen.getByText(/heartbeat every five seconds/)).toBeInTheDocument();
  act(() => useKeyboardStore.getState().undoChanges());
  expect(checkbox).not.toBeChecked();
  // Go omits a false optional field on save; this must not leave a dirty draft.
  const explicit = structuredClone(session.project);
  explicit.options.peripheralStatusSync = false;
  expect(isDirty(explicit, session.project)).toBe(false);
});
it("disables synchronization on unsupported profiles without changing the keymap", () => {
  const { project: p, plugin } = dongleFixture();
  p.variantId = "dongle";
  p.options.peripheralStatusSync = true;
  const layout = structuredClone(p.layout);
  changeHardwareVariant(p, plugin, "test");
  expect(p.options.peripheralStatusSync).toBe(false);
  expect(p.layout).toEqual(layout);
});
it("configures native dongle battery reporting and radio interval on the central target only", () => {
  const session = dongleFixture();
  session.project.variantId = "dongle";
  useKeyboardStore.getState().initialize(session);
  render(<ConnectionTopology variant={session.plugin.variants[1]} />);
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Report peripheral batteries to Bluetooth hosts" }),
  );
  const getArgs = () => useKeyboardStore.getState().project!.buildTargets![0].cmakeArgs!;
  expect(getArgs()).toContain("-DCONFIG_ZMK_SPLIT_BLE_CENTRAL_BATTERY_LEVEL_FETCHING=y");
  expect(getArgs()).toContain("-DCONFIG_ZMK_SPLIT_BLE_CENTRAL_BATTERY_LEVEL_PROXY=y");
  fireEvent.click(screen.getByRole("checkbox", { name: "Fetch battery levels from both halves" }));
  expect(getArgs()).toContain("-DCONFIG_ZMK_SPLIT_BLE_CENTRAL_BATTERY_LEVEL_PROXY=n");
  fireEvent.change(screen.getByRole("combobox", { name: "Split Bluetooth connection interval" }), {
    target: { value: "12" },
  });
  expect(getArgs()).toContain("-DCONFIG_ZMK_SPLIT_BLE_PREF_INT=12");
  expect(useKeyboardStore.getState().project!.buildTargets!.map((t) => t.targetId)).toEqual([
    "dongle",
  ]);
  expect(useKeyboardStore.getState().savedProject!.buildTargets).toBeUndefined();
});
it("rotates only the selected peripheral OLED and clears its snippet when switching to an unsupported profile", () => {
  const session = dongleFixture();
  session.project.variantId = "dongle";
  session.project.options.display = true;
  const v = session.plugin.variants[1];
  v.features!.push("oled-rotate-180");
  useKeyboardStore.getState().initialize(session);
  render(<ConnectionTopology variant={v} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Rotate Right OLED 180°" }));
  let p = useKeyboardStore.getState().project!;
  expect(p.buildTargets?.find((t) => t.targetId === "right")?.snippets).toEqual([
    "zmapflow-oled-flip-180",
  ]);
  expect(p.buildTargets?.find((t) => t.targetId === "left")).toBeUndefined();
  expect(p.buildTargets?.find((t) => t.targetId === "dongle")).toBeUndefined();
  expect(useKeyboardStore.getState().savedProject!.buildTargets).toBeUndefined();
  const changed = structuredClone(p);
  changeHardwareVariant(changed, session.plugin, "test");
  expect(changed.buildTargets?.find((t) => t.targetId === "right")?.snippets).toEqual([]);
});
