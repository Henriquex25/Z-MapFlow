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
