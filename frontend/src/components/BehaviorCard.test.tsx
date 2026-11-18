import { DndContext } from "@dnd-kit/core";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { BehaviorEditor } from "./ResourceEditor";
import { BehaviorCard } from "./BehaviorCard";
import { newBehavior } from "./AdvancedResources";
import { fixture } from "../test/fixtures";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { useAppPreferences } from "../i18n";

beforeEach(() => {
  useAppPreferences.setState({ locale: "en" });
  const session = fixture();
  session.project.layout.behaviors = [
    { ...newBehavior("hold-tap"), name: "Home row mods" },
    { ...newBehavior("tap-dance"), name: "Navigation" },
  ];
  useKeyboardStore.getState().initialize(session);
});
const editor = (onAssign = vi.fn()) =>
  render(
    <DndContext>
      <BehaviorEditor onAssign={onAssign} />
    </DndContext>,
  );

it("starts all behaviors collapsed and keeps the complete toolbar available", () => {
  const onAssign = vi.fn();
  editor(onAssign);
  expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  expect(screen.getAllByRole("textbox", { name: "Behavior name" })).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Assign Home row mods to keyboard" })).toBeVisible();
  const first = within(screen.getAllByRole("article")[0]);
  fireEvent.change(first.getByRole("textbox", { name: "Behavior name" }), {
    target: { value: "Home modifiers" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Assign Home modifiers to keyboard" }));
  expect(onAssign).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Show settings for Home modifiers" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  fireEvent.click(first.getByRole("button", { name: "Delete" }));
  expect(useKeyboardStore.getState().project!.layout.behaviors.map((b) => b.name)).toEqual([
    "Navigation",
  ]);
});

it("expands each behavior independently and retains applied edits after collapsing", () => {
  editor();
  fireEvent.click(screen.getByRole("button", { name: "Show settings for Home row mods" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "Tapping term (ms)" }), {
    target: { value: "240" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Show settings for Navigation" }));
  expect(screen.getAllByRole("spinbutton", { name: "Tapping term (ms)" })).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Hide settings for Home row mods" }));
  expect(screen.getAllByRole("spinbutton", { name: "Tapping term (ms)" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Show settings for Home row mods" }));
  expect(screen.getAllByRole("spinbutton", { name: "Tapping term (ms)" })[0]).toHaveValue(240);
  expect(useKeyboardStore.getState().savedProject!.layout.behaviors[0].tappingTermMs).toBe(200);
});

it("keeps invalid drafts visible instead of allowing collapse to bypass validation", () => {
  editor();
  fireEvent.click(screen.getByRole("button", { name: "Show settings for Home row mods" }));
  const input = screen.getByRole("spinbutton", { name: "Tapping term (ms)" });
  fireEvent.change(input, { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Hide settings for Home row mods" }));
  expect(input).toBeVisible();
  expect(input).toHaveFocus();
  expect(Object.values(useKeyboardStore.getState().draftErrors)).not.toHaveLength(0);
  fireEvent.change(input, { target: { value: "250" } });
  fireEvent.click(screen.getByRole("button", { name: "Hide settings for Home row mods" }));
  expect(screen.getByRole("button", { name: "Show settings for Home row mods" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

it("localizes disclosure controls and leaves behavior names untouched", () => {
  editor();
  act(() => useAppPreferences.getState().setLocale("pt-BR"));
  expect(
    screen.getByRole("button", { name: "Mostrar configurações de Home row mods" }),
  ).toHaveAttribute("aria-expanded", "false");
});

it("reverses an in-progress disclosure from its current height and releases content after closing", () => {
  const animations: { cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null }[] = [];
  const original = Object.getOwnPropertyDescriptor(Element.prototype, "animate");
  const animate = vi.fn(() => {
    const animation = { cancel: vi.fn(), onfinish: null as (() => void) | null };
    animations.push(animation);
    return animation;
  });
  Object.defineProperty(Element.prototype, "animate", { configurable: true, value: animate });
  const rect = vi
    .spyOn(Element.prototype, "getBoundingClientRect")
    .mockReturnValue({ height: 75 } as DOMRect);
  try {
    render(
      <BehaviorCard name="Test" toolbar={<input aria-label="Name" />}>
        <input aria-label="Setting" />
      </BehaviorCard>,
    );
    const header = screen.getByRole("textbox", { name: "Name" });
    fireEvent.click(screen.getByRole("button", { name: "Show settings for Test" }));
    expect(animate).toHaveBeenLastCalledWith(
      [{ height: "75px" }, { height: "75px" }],
      expect.objectContaining({ duration: 180 }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Hide settings for Test" }));
    expect(animations[0].cancel).toHaveBeenCalled();
    expect(animate).toHaveBeenLastCalledWith(
      [{ height: "75px" }, { height: "0px" }],
      expect.anything(),
    );
    expect(screen.queryByRole("textbox", { name: "Setting" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Setting")).toBeInTheDocument();
    act(() => animations[1].onfinish?.());
    expect(screen.queryByLabelText("Setting")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toBe(header);
  } finally {
    rect.mockRestore();
    if (original) Object.defineProperty(Element.prototype, "animate", original);
    else Reflect.deleteProperty(Element.prototype, "animate");
  }
});
