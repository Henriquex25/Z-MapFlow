import { DndContext } from "@dnd-kit/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { fixture } from "../test/fixtures";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { KeyboardLayout } from "./KeyboardLayout";
import { projectBindingError } from "../utils/bindingValidation";

beforeEach(() => useKeyboardStore.getState().initialize(fixture()));

it("keeps unpopulated binding slots out of the layout and position picker", () => {
  const session = fixture();
  session.plugin.positions[1].hidden = true;
  const select = vi.fn();
  const { container } = render(
    <DndContext>
      <KeyboardLayout
        plugin={session.plugin}
        layer={session.project.layout.layers[0]}
        onSelect={select}
      />
    </DndContext>,
  );
  expect(container.querySelectorAll(".keyboard-canvas .layout-key")).toHaveLength(1);
  fireEvent.click(container.querySelector(".keyboard-canvas .layout-key")!);
  expect(select).toHaveBeenCalledWith(0);
  expect(session.project.layout.layers[0].keys).toHaveLength(2);
});

it("edits standalone encoder rotation without offering a nonexistent click", () => {
  const session = fixture();
  const sensor = {
    id: "encoder",
    label: "Optional encoder",
    clickKeymapIndex: -1,
    codeClick: "",
    codeCW: "&kp C_VOL_UP",
    codeCCW: "&kp C_VOL_DN",
  };
  session.plugin.sensors = [sensor];
  session.project.layout.layers[0].sensors = [sensor];
  session.plugin.positions.push({
    ...session.plugin.positions[0],
    id: "rotation",
    keymapIndex: -1,
    sensorId: "encoder",
    x: 2,
  });
  useKeyboardStore.getState().initialize(session);
  const { rerender } = render(
    <DndContext>
      <KeyboardLayout plugin={session.plugin} layer={session.project.layout.layers[0]} />
    </DndContext>,
  );
  expect(screen.getByRole("button", { name: /encoder CW:/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /encoder CCW:/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /encoder CLK:/ })).not.toBeInTheDocument();
  useKeyboardStore.getState().updateSensorCode("encoder", "cw", "&kp PG_UP");
  expect(useKeyboardStore.getState().project!.layout.layers[0].sensors[0].codeCW).toBe("&kp PG_UP");
  useKeyboardStore.getState().updateSensorCode("encoder", "click", "&kp B");
  expect(useKeyboardStore.getState().project!.layout.layers[0].sensors[0].codeClick).toBe("");
  expect(projectBindingError(useKeyboardStore.getState().project!, session.plugin)).toBe("");
  const select = vi.fn();
  rerender(
    <DndContext>
      <KeyboardLayout
        plugin={session.plugin}
        layer={session.project.layout.layers[0]}
        onSelect={select}
      />
    </DndContext>,
  );
  expect(screen.queryByRole("button", { name: /encoder CW:/ })).not.toBeInTheDocument();
});
