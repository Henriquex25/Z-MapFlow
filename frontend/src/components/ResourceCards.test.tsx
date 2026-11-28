import { selectOption } from "../test/selectOption";
import { DndContext, useDndContext } from "@dnd-kit/core";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { ActionTray } from "./ActionTray";
import { ComboEditor, MacroEditor } from "./ResourceEditor";
import { ConditionalLayersEditor, newBehavior } from "./AdvancedResources";
import { fixture } from "../test/fixtures";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { useAppPreferences } from "../i18n";

beforeEach(() => {
  useAppPreferences.setState({ locale: "en" });
  const session = fixture();
  session.plugin.actions = [{ name: "Special F13", code: "&kp F13" }];
  const p = session.project;
  p.layout.layers.push(
    { ...structuredClone(p.layout.layers[0]), id: "nav", name: "Navigation" },
    { ...structuredClone(p.layout.layers[0]), id: "adjust", name: "Adjust" },
  );
  p.layout.macros = [
    {
      id: "copy",
      name: "Copy",
      tapMs: 20,
      waitMs: 20,
      steps: [{ kind: "tap", binding: "&kp LC(C)", durationMs: 0 }],
    },
  ];
  p.layout.behaviors = [{ ...newBehavior("tap-dance"), id: "dance", name: "Tap navigation" }];
  p.layout.combos = ["First", "Second"].map((name, i) => ({
    id: `combo${i}`,
    name,
    positions: [0, 1],
    binding: "&kp ESC",
    timeoutMs: 50,
    slowRelease: false,
    layerIds: [],
  }));
  p.layout.conditionalLayers = [
    { id: "rule", name: "Adjust rule", ifLayerIds: ["base", "nav"], thenLayerId: "adjust" },
  ];
  useKeyboardStore.getState().initialize(session);
});
let enabledDropCount = () => -1;
function DropProbe() {
  const { droppableContainers } = useDndContext();
  enabledDropCount = () => droppableContainers.getEnabled().length;
  return null;
}
const combo = () =>
  render(
    <DndContext>
      <DropProbe />
      <ComboEditor />
      <ActionTray />
    </DndContext>,
  );
it("collapses combos independently and lets a combo choose any key, macro, custom behavior or parameterless action", () => {
  combo();
  expect(
    screen.queryByRole("combobox", { name: "Combo action — behavior" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show settings for First" }));
  const behavior = screen.getByRole("combobox", { name: "Combo action — behavior" });
  const key = screen.getByRole("button", {
    name: /Choose Combo action — choose key 1 from palette/,
  });
  fireEvent.click(key);
  const palette = within(screen.getByRole("region", { name: "Action palette" }));
  fireEvent.click(palette.getByRole("button", { name: "Drag &kp C" }));
  expect(useKeyboardStore.getState().project!.layout.combos[0].binding).toBe("&kp C");
  selectOption("Combo action — behavior", "&kp F13");
  expect(useKeyboardStore.getState().project!.layout.combos[0].binding).toBe("&kp F13");
  selectOption("Combo action — behavior", "&copy");
  expect(useKeyboardStore.getState().project!.layout.combos[0].binding).toBe("&copy");
  expect(
    screen.queryByRole("textbox", { name: "Combo action — argument 1" }),
  ).not.toBeInTheDocument();
  selectOption("Combo action — behavior", "&dance");
  expect(useKeyboardStore.getState().project!.layout.combos[0].binding).toBe("&dance");
  selectOption("Combo action — behavior", "&bootloader");
  expect(useKeyboardStore.getState().project!.layout.combos[0].binding).toBe("&bootloader");
  expect(screen.queryByRole("combobox", { name: /choose key/ })).not.toBeInTheDocument();
  selectOption("Combo action — behavior", "&lt @{base} A");
  expect(
    screen.getByRole("button", { name: /Choose Combo action — layer 1 from palette/ }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: /Choose Combo action — choose key 2 from palette/ }),
  ).toBeVisible();
  fireEvent.click(screen.getByRole("checkbox", { name: "Navigation" }));
  expect(enabledDropCount()).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: "Hide settings for First" }));
  expect(enabledDropCount()).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Show settings for Second" }));
  expect(screen.getByRole("button", { name: "Show settings for First" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  expect(useKeyboardStore.getState().project!.layout.combos[0].layerIds).toEqual(["nav"]);
  expect(useKeyboardStore.getState().savedProject!.layout.combos[0].binding).toBe("&kp ESC");
}, 15000);
it("keeps invalid combo drafts open and never replaces the last valid binding", () => {
  combo();
  fireEvent.click(screen.getByRole("button", { name: "Show settings for First" }));
  const input = screen.getByRole("textbox", { name: "Combo action — argument 1" });
  fireEvent.change(input, { target: { value: "fdsfsd" } });
  fireEvent.click(screen.getByRole("button", { name: "Hide settings for First" }));
  expect(input).toHaveFocus();
  expect(useKeyboardStore.getState().project!.layout.combos[0].binding).toBe("&kp ESC");
});
it("keeps macro actions on the collapsed header and conditional rules independently editable", () => {
  render(
    <DndContext>
      <MacroEditor onAssign={() => {}} />
      <ConditionalLayersEditor />
    </DndContext>,
  );
  expect(screen.getByRole("button", { name: "Assign Copy to keyboard" })).toBeVisible();
  expect(screen.queryByRole("spinbutton", { name: "Tap time (ms)" })).not.toBeInTheDocument();
  expect(
    screen.queryByRole("combobox", { name: "Conditional target layer" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show settings for Copy" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "Tap time (ms)" }), {
    target: { value: "45" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Show settings for Adjust rule" }));
  const article = within(screen.getAllByRole("article")[1]);
  expect(article.getByRole("checkbox", { name: "Navigation" })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Hide settings for Copy" }));
  expect(article.getByRole("combobox", { name: "Conditional target layer" })).toBeVisible();
  expect(useKeyboardStore.getState().project!.layout.macros[0].tapMs).toBe(45);
});
