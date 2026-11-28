import { DndContext, useDndContext } from "@dnd-kit/core";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, it, expect } from "vitest";
import { BindingDrop } from "./BindingDrop";
import { ActionTray } from "./ActionTray";
import { MacroEditor } from "./ResourceEditor";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { usePalettePicker } from "../store/usePalettePicker";
import { useAppPreferences } from "../i18n";
import { fixture } from "../test/fixtures";
import { selectOption } from "../test/selectOption";
let drops: ReturnType<typeof useDndContext>["droppableContainers"];
function Probe() {
  drops = useDndContext().droppableContainers;
  return null;
}
beforeEach(() => {
  useAppPreferences.setState({ locale: "en" });
  const s = fixture();
  s.project.layout.macros = [
    {
      id: "copy",
      name: "Copy",
      tapMs: 20,
      waitMs: 20,
      steps: [{ kind: "tap", binding: "&kp C", durationMs: 0 }],
    },
    {
      id: "other",
      name: "Other",
      tapMs: 20,
      waitMs: 20,
      steps: [{ kind: "tap", binding: "&kp V", durationMs: 0 }],
    },
  ];
  s.project.layout.layers.push({
    ...structuredClone(s.project.layout.layers[0]),
    id: "nav",
    name: "Navigation",
  });
  useKeyboardStore.getState().initialize(s);
});
function Field({
  code = "&kp A",
  context = "binding",
  owner,
}: {
  code?: string;
  context?: "binding" | "child" | "macro";
  owner?: string;
}) {
  useKeyboardStore((s) => s.project);
  const p = useKeyboardStore.getState().project!;
  return (
    <BindingDrop
      label="Test action"
      context={context}
      owner={owner}
      code={p.layout.layers[0].keys[0].code}
      onChange={(value) =>
        useKeyboardStore.getState().edit((p) => {
          p.layout.layers[0].keys[0].code = value;
        })
      }
    />
  );
}
function mount(code = "&kp A", context: "binding" | "child" | "macro" = "binding", owner?: string) {
  useKeyboardStore.getState().edit((p) => {
    p.layout.layers[0].keys[0].code = code;
  });
  return render(
    <DndContext>
      <Probe />
      <Field context={context} owner={owner} />
      <ActionTray />
    </DndContext>,
  );
}
const palette = () => within(screen.getByRole("region", { name: "Action palette" }));
const value = () => useKeyboardStore.getState().project!.layout.layers[0].keys[0].code;
it("opens a collapsed palette from a key slot, filters tabs, and fills only that argument on click", () => {
  usePalettePicker.setState({ collapsed: true });
  mount("&mt LCTRL A");
  fireEvent.click(
    screen.getByRole("button", { name: "Choose Test action — choose key 2 from palette" }),
  );
  expect(usePalettePicker.getState().collapsed).toBe(false);
  expect(palette().queryByRole("button", { name: "Bluetooth" })).not.toBeInTheDocument();
  expect(palette().queryByRole("button", { name: "Macros in palette" })).not.toBeInTheDocument();
  fireEvent.click(palette().getByRole("button", { name: "Drag &kp C" }));
  expect(value()).toBe("&mt LCTRL C");
  expect(usePalettePicker.getState().target).toBeNull();
  expect(usePalettePicker.getState().collapsed).toBe(true);
});
it("accepts only valid key drops and retains the last binding on incompatible input", () => {
  mount();
  const slot = drops.getEnabled().find((d) => String(d.id).startsWith("parameter-"))!;
  act(() => slot.data.current!.acceptBinding("&bootloader"));
  expect(value()).toBe("&kp A");
  expect(usePalettePicker.getState().collapsed).toBe(false);
  act(() => slot.data.current!.acceptBinding("&kp LC(C)"));
  expect(value()).toBe("&kp LC(C)");
  expect(usePalettePicker.getState().collapsed).toBe(true);
});
it("offers actual layers rather than key or macro bindings for a layer argument", () => {
  mount("&lt @{base} A");
  fireEvent.click(
    screen.getByRole("button", { name: "Choose Test action — layer 1 from palette" }),
  );
  expect(palette().getByRole("button", { name: "Parameters" })).toBeVisible();
  expect(palette().queryByRole("button", { name: "Keys" })).not.toBeInTheDocument();
  fireEvent.click(palette().getByRole("button", { name: "Drag Navigation" }));
  expect(value()).toBe("&lt @{nav} A");
});
it("limits Bluetooth command/profile options and resets command-dependent argument counts", () => {
  mount("&bt BT_SEL 0");
  fireEvent.click(
    screen.getByRole("button", { name: "Choose Test action — argument 1 from palette" }),
  );
  fireEvent.click(palette().getByRole("button", { name: "Drag BT_CLR" }));
  expect(value()).toBe("&bt BT_CLR");
  expect(
    screen.queryByRole("button", { name: "Choose Test action — argument 2 from palette" }),
  ).not.toBeInTheDocument();
});
it("offers other macros for a complete binding while excluding direct self-reference", () => {
  mount("&kp A", "macro", "copy");
  fireEvent.click(screen.getByRole("button", { name: "Assign action to Test action" }));
  fireEvent.click(palette().getByRole("button", { name: "Macros in palette" }));
  expect(palette().queryByRole("button", { name: "Drag Copy" })).not.toBeInTheDocument();
  fireEvent.click(palette().getByRole("button", { name: "Drag Other" }));
  expect(value()).toBe("&other");
});
it("places add-step controls before aligned step cards and separates execution mode from behavior", () => {
  render(
    <DndContext>
      <MacroEditor onAssign={() => {}} />
      <ActionTray />
    </DndContext>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Show settings for Copy" }));
  const add = screen.getByRole("group", { name: "Add step" });
  const step = screen.getByRole("group", { name: "Step 1 action" });
  expect(add.compareDocumentPosition(step) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  selectOption("Step 1 type", "press");
  expect(useKeyboardStore.getState().project!.layout.macros[0].steps[0]).toMatchObject({
    kind: "press",
    binding: "&kp C",
  });
  fireEvent.click(within(step).getByText("Edit action and parameters"));
  fireEvent.click(
    screen.getByRole("button", { name: "Choose Step 1 action — choose key 1 from palette" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Hide settings for Copy" }));
  expect(usePalettePicker.getState().target).toBeNull();
});
