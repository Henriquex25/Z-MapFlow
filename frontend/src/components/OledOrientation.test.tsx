import { DndContext } from "@dnd-kit/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { SettingsEditor } from "./ResourceEditor";
import { OledOrientation } from "./OledOrientation";
import { dongleFixture } from "../test/dongleFixture";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { useAppPreferences } from "../i18n";
import { changeHardwareVariant, hardwareConfigError } from "../utils/hardwareVariant";
import { OLED_ROTATION_SNIPPET } from "../utils/oledRotation";

beforeEach(() => useAppPreferences.setState({ locale: "en" }));
function setup() {
  const session = dongleFixture();
  session.plugin.capabilities.push("display");
  for (const v of session.plugin.variants) v.features = [...(v.features ?? []), "oled-rotate-180"];
  session.project.options.display = true;
  return session;
}
it("offers independent rotation for the central half and peripheral in general display settings", () => {
  const session = setup();
  useKeyboardStore.getState().initialize(session);
  render(
    <DndContext>
      <SettingsEditor />
    </DndContext>,
  );
  expect(screen.queryByRole("heading", { name: "Dongle options" })).not.toBeInTheDocument();
  const left = screen.getByRole("checkbox", { name: "Rotate Left OLED 180°" });
  const right = screen.getByRole("checkbox", { name: "Rotate Right OLED 180°" });
  expect(left).not.toBeChecked();
  expect(right).not.toBeChecked();
  fireEvent.click(left);
  fireEvent.click(right);
  const state = useKeyboardStore.getState();
  expect(state.project!.buildTargets?.map((t) => [t.targetId, t.snippets])).toEqual([
    ["left", [OLED_ROTATION_SNIPPET]],
    ["right", [OLED_ROTATION_SNIPPET]],
  ]);
  expect(hardwareConfigError(state.project!, session.plugin)).toBe("");
  expect(state.savedProject!.buildTargets).toBeUndefined();
  fireEvent.click(screen.getByRole("checkbox", { name: "OLED status display" }));
  expect(left).toBeDisabled();
  expect(right).toBeDisabled();
  expect(right).toBeChecked();
});
it("preserves orientation when switching between half-central and dongle profiles", () => {
  const { project: p, plugin } = setup();
  p.buildTargets = [{ targetId: "right", snippets: ["other", OLED_ROTATION_SNIPPET] }];
  const original = structuredClone(p.layout);
  changeHardwareVariant(p, plugin, "dongle");
  expect(hardwareConfigError(p, plugin)).toBe("");
  changeHardwareVariant(p, plugin, "test");
  expect(p.buildTargets![0].snippets).toEqual(["other", OLED_ROTATION_SNIPPET]);
  expect(p.layout).toEqual(original);
  plugin.variants[1].features = [];
  changeHardwareVariant(p, plugin, "dongle");
  expect(p.buildTargets![0].snippets).toEqual(["other"]);
});
it("never offers or accepts rotation for a screenless dongle or reset image", () => {
  const session = setup();
  session.project.variantId = "dongle";
  useKeyboardStore.getState().initialize(session);
  render(<OledOrientation variant={session.plugin.variants[1]} />);
  expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  expect(screen.queryByRole("checkbox", { name: /USB dongle|Reset/ })).not.toBeInTheDocument();
  for (const targetId of ["dongle", "settings_reset"]) {
    const invalid = {
      ...session.project,
      buildTargets: [{ targetId, snippets: [OLED_ROTATION_SNIPPET] }],
    };
    expect(hardwareConfigError(invalid, session.plugin)).toContain(
      "supported keyboard display target",
    );
  }
  act(() => useAppPreferences.setState({ locale: "pt-BR" }));
  expect(screen.getByRole("checkbox", { name: "Girar OLED Direita em 180°" })).toBeVisible();
});
