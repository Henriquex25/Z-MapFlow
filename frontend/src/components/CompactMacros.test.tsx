import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { fixture } from "../test/fixtures";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { usePalettePicker } from "../store/usePalettePicker";
import { useAppPreferences } from "../i18n";
import { projectBindingError } from "../utils/bindingValidation";
import { MacroEditor, BehaviorEditor, ComboEditor } from "./ResourceEditor";
import { ActionTray } from "./ActionTray";
import { HelpTip } from "./HelpTip";

beforeEach(() => {
  useAppPreferences.setState({ locale: "en" });
  useKeyboardStore.getState().initialize(fixture());
});
it("starts new resource action slots empty and blocks assignment until the user fills them", () => {
  render(
    <DndContext>
      <MacroEditor onAssign={() => {}} />
      <BehaviorEditor onAssign={() => {}} />
      <ComboEditor />
      <ActionTray />
    </DndContext>,
  );
  fireEvent.click(screen.getByRole("button", { name: "+ New macro" }));
  const state = () => useKeyboardStore.getState();
  expect(state().project!.layout.macros[0].steps[0].binding).toBe("");
  expect(screen.getByRole("button", { name: "Assign New macro to keyboard" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Drag New macro" })).not.toBeInTheDocument();
  expect(projectBindingError(state().project!, state().plugin)).toContain("Choose an action");
  fireEvent.click(screen.getByRole("button", { name: "Show settings for New macro" }));
  fireEvent.click(screen.getByRole("button", { name: "Assign action to Step 1 action" }));
  expect(usePalettePicker.getState().collapsed).toBe(false);
  const palette = within(screen.getByRole("region", { name: "Action palette" }));
  fireEvent.click(palette.getByRole("button", { name: "Drag &kp C" }));
  expect(state().project!.layout.macros[0].steps[0].binding).toBe("&kp C");
  expect(usePalettePicker.getState().collapsed).toBe(true);
  expect(screen.getByRole("button", { name: "Assign New macro to keyboard" })).toBeEnabled();
  expect(projectBindingError(state().project!, state().plugin)).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "+ Tap / hold" }));
  expect(state().project!.layout.behaviors[0].bindings).toEqual(["", ""]);
  expect(screen.getByRole("button", { name: "Assign New tap/hold to keyboard" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "+ Tap sequence" }));
  expect(state().project!.layout.behaviors[1].bindings).toEqual([""]);
  fireEvent.click(screen.getByRole("button", { name: "+ New combo" }));
  expect(state().project!.layout.combos[0].binding).toBe("");
}, 15000);
it("shows one numbered row per step and keeps bindings in order when moving or removing a step", () => {
  useKeyboardStore.getState().edit((p) => {
    p.layout.macros = [
      {
        id: "demo",
        name: "Demo",
        tapMs: 20,
        waitMs: 20,
        steps: ["HOME", "LS(END)", "LC(C)"].map((key) => ({
          kind: "tap",
          binding: `&kp ${key}`,
          durationMs: 0,
        })),
      },
    ];
  });
  render(
    <DndContext>
      <MacroEditor onAssign={() => {}} />
    </DndContext>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Show settings for Demo" }));
  const list = within(screen.getByRole("list", { name: "Macro sequence" }));
  expect(list.getAllByRole("listitem").map((n) => n.getAttribute("aria-label"))).toEqual([
    "Step 1",
    "Step 2",
    "Step 3",
  ]);
  expect(
    within(list.getAllByRole("listitem")[0]).getByText("Edit action and parameters").parentElement,
  ).not.toHaveAttribute("open");
  fireEvent.click(list.getAllByRole("button", { name: "Move step forward" })[0]);
  expect(useKeyboardStore.getState().project!.layout.macros[0].steps.map((s) => s.binding)).toEqual(
    ["&kp LS(END)", "&kp HOME", "&kp LC(C)"],
  );
  fireEvent.click(list.getByRole("button", { name: "Remove step 2" }));
  expect(useKeyboardStore.getState().project!.layout.macros[0].steps.map((s) => s.binding)).toEqual(
    ["&kp LS(END)", "&kp LC(C)"],
  );
  expect(list.getAllByRole("listitem").map((n) => n.getAttribute("aria-label"))).toEqual([
    "Step 1",
    "Step 2",
  ]);
});
it("keeps supplementary help hidden until focus and dismisses it with Escape", () => {
  render(<HelpTip text="Tap presses and releases the selected action." />);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  const help = screen.getByRole("button", { name: "Help" });
  fireEvent.focus(help);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Tap presses and releases");
  expect(help).toHaveAttribute("aria-describedby", screen.getByRole("tooltip").id);
  fireEvent.keyDown(help, { key: "Escape" });
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});
