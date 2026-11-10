import { useAppPreferences } from "./i18n";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { fixture } from "./test/fixtures";
import { api } from "./services/api";
import App from "./App";
import { useKeyboardStore } from "./store/useKeyboardStore";
vi.mock("./services/api", () => ({
  api: {
    load: vi.fn(),
    appInfo: vi.fn(),
    plugins: vi.fn(),
    newProject: vi.fn(),
    status: vi.fn(),
    listBuilds: vi.fn(),
    save: vi.fn(),
    saveAndBuild: vi.fn(),
    build: vi.fn(),
    importProject: vi.fn(),
    exportProject: vi.fn(),
    exportKeymap: vi.fn(),
  },
}));
beforeEach(() => {
  useAppPreferences.setState({ locale: "en" });
  vi.mocked(api.appInfo).mockResolvedValue({ version: "7.8.9", commit: "test" });
  useKeyboardStore.setState({
    project: null,
    savedProject: null,
    initialProject: null,
    plugin: null,
    activeLayerId: "",
    template: null,
    error: "",
  });
  vi.clearAllMocks();
  const s = fixture();
  s.plugin.capabilities = ["layers", "macros", "combos", "hold-tap", "tap-dance"];
  vi.mocked(api.load).mockResolvedValue(s);
  vi.mocked(api.plugins).mockResolvedValue([s.plugin]);
  vi.mocked(api.newProject).mockResolvedValue(s);
  vi.mocked(api.status).mockResolvedValue(null);
  vi.mocked(api.listBuilds).mockResolvedValue([]);
  vi.mocked(api.save).mockImplementation(async (p) => ({
    ...p,
    revision: "saved2",
  }));
  vi.mocked(api.saveAndBuild).mockImplementation(async (p) => ({
    ...p,
    revision: "saved2",
  }));
});

it("imports into the selected hardware and replaces all editable resources", async () => {
  const imported = fixture();
  imported.hasSaved = false;
  imported.project.layout.layers[0].name = "Importado";
  imported.project.layout.layers[0].keys[0].code = "&kp Z";
  imported.project.layout.macros = [
    {
      id: "zm_imported",
      name: "Importada",
      tapMs: 10,
      waitMs: 10,
      steps: [{ kind: "tap", binding: "&kp A", durationMs: 0 }],
    },
  ];
  vi.mocked(api.importProject).mockResolvedValue(imported);
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: "Import project" }));
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Layer name" })).toHaveValue("Importado"),
  );
  expect(api.importProject).toHaveBeenCalledWith(
    imported.project.pluginId,
    imported.project.variantId,
  );
  expect(useKeyboardStore.getState().project!.layout.macros).toHaveLength(1);
  expect(useKeyboardStore.getState().savedProject).toBeNull();
  expect(screen.getByRole("button", { name: /^Position 0:/ })).toHaveAccessibleName(
    "Position 0: &kp Z",
  );
});

it("exports the current unsaved layout as keymap and keeps JSON export available", async () => {
  vi.mocked(api.exportKeymap).mockResolvedValue("/tmp/sofle.keymap");
  vi.mocked(api.exportProject).mockResolvedValue("/tmp/project.json");
  render(<App />);
  const name = await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.change(name, { target: { value: "Edição atual" } });
  fireEvent.click(screen.getByRole("button", { name: "Export keymap" }));
  await waitFor(() => expect(api.exportKeymap).toHaveBeenCalledTimes(1));
  expect(vi.mocked(api.exportKeymap).mock.calls[0][0].layout.layers[0].name).toBe("Edição atual");
  expect(api.save).not.toHaveBeenCalled();
  expect(await screen.findByText("Keymap exported to /tmp/sofle.keymap")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Export project" }));
  await waitFor(() => expect(api.exportProject).toHaveBeenCalledTimes(1));
});

it("keeps the current layout when import fails or the file dialog is cancelled", async () => {
  vi.mocked(api.importProject).mockRejectedValueOnce(new Error("Keymap incompatível"));
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: "Import project" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Keymap incompatível");
  expect(screen.getByRole("textbox", { name: "Layer name" })).toHaveValue("Base");
  vi.mocked(api.importProject).mockResolvedValueOnce(
    {} as Awaited<ReturnType<typeof api.importProject>>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Import project" }));
  await waitFor(() => expect(api.importProject).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Layer name" })).toHaveValue("Base");
});
it("distinguishes save, build saved, and save-and-build", async () => {
  render(<App />);
  const name = await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.change(name, { target: { value: "Edited" } });
  fireEvent.click(screen.getByRole("button", { name: "Build" }));
  await waitFor(() => expect(api.build).toHaveBeenCalledTimes(1));
  expect(api.save).not.toHaveBeenCalled();
  expect(api.saveAndBuild).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
  expect(vi.mocked(api.save).mock.calls[0][0].layout.layers[0].name).toBe("Edited");
  await waitFor(() => expect(screen.getByRole("button", { name: "Save and build" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Save and build" }));
  await waitFor(() => expect(api.saveAndBuild).toHaveBeenCalledTimes(1));
});
it("presents a recoverable loading error instead of an infinite spinner", async () => {
  vi.mocked(api.load).mockRejectedValueOnce(new Error("Arquivo inválido"));
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Arquivo inválido");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("textbox", { name: "Layer name" })).toHaveValue("Base");
});

it("shows meaningful mouse actions and assigns their original bindings", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  const palette = within(screen.getByRole("region", { name: "Action palette" }));
  fireEvent.click(palette.getByRole("button", { name: "Mouse" }));
  expect(palette.getByRole("heading", { name: "Buttons" })).toBeVisible();
  expect(palette.getByRole("heading", { name: "Movement" })).toBeVisible();
  expect(palette.getByRole("heading", { name: "Scrolling" })).toBeVisible();
  const rightClick = palette.getByRole("button", { name: "Drag &mkp RCLK" });
  expect(rightClick).toHaveTextContent("Right");
  expect(rightClick).not.toHaveTextContent("&mkp");
  expect(within(rightClick).getByTitle(/Mouse right button click\s+&mkp RCLK/)).toBeVisible();
  fireEvent.click(rightClick);
  fireEvent.click(screen.getByRole("button", { name: /^Position 0:/ }));
  expect(useKeyboardStore.getState().project!.layout.layers[0].keys[0].code).toBe("&mkp RCLK");
  const scroll = palette.getByRole("button", { name: "Drag &msc SCRL_DOWN" });
  expect(scroll).toHaveTextContent("Scroll");
  expect(within(scroll).getByTitle(/Scroll down\s+&msc SCRL_DOWN/)).toBeVisible();
  fireEvent.click(scroll);
  fireEvent.click(screen.getByRole("button", { name: /^Position 1:/ }));
  expect(useKeyboardStore.getState().project!.layout.layers[0].keys[1].code).toBe("&msc SCRL_DOWN");
});

it("opens tap/hold at the controls and preserves modifier codes behind friendly names", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  const region = screen.getByRole("region", { name: "Action palette" });
  const body = region.querySelector<HTMLElement>(".palette-body")!;
  body.scrollTop = 80;
  fireEvent.click(within(region).getByRole("button", { name: "Tap/hold" }));
  expect(body.scrollTop).toBe(0);
  const modifier = screen.getByRole("combobox", { name: "Hold action" });
  expect(within(modifier).getByRole("option", { name: "Right Ctrl" })).toHaveValue("RCTRL");
  fireEvent.change(modifier, { target: { value: "RCTRL" } });
  fireEvent.click(within(region).getByRole("button", { name: "Drag &mt RCTRL TAB" }));
  fireEvent.click(screen.getByRole("button", { name: /^Position 0:/ }));
  expect(useKeyboardStore.getState().project!.layout.layers[0].keys[0].code).toBe("&mt RCTRL TAB");
});

it("enables discard before the first save and restores the latest saved revision after saving", async () => {
  const session = fixture();
  session.hasSaved = false;
  session.project.revision = "";
  session.project.savedAt = "";
  vi.mocked(api.load).mockResolvedValue(session);
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  expect(screen.getByText("Not saved yet")).toBeVisible();
  expect(screen.getByRole("button", { name: "Discard" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Build" })).toBeDisabled();
  const palette = within(screen.getByRole("region", { name: "Action palette" }));
  fireEvent.click(palette.getByRole("button", { name: "Drag &kp C" }));
  fireEvent.click(screen.getByRole("button", { name: /^Position 0:/ }));
  expect(screen.getByText("Unsaved changes")).toBeVisible();
  expect(screen.getByRole("button", { name: "Discard" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard and continue" }));
  expect(screen.getByRole("button", { name: /^Position 0:/ })).toHaveAttribute(
    "aria-label",
    "Position 0: &kp A",
  );
  expect(
    within(screen.getByRole("button", { name: /^Position 0:/ })).getByText("KP"),
  ).toBeVisible();
  expect(screen.getByText("Not saved yet")).toBeVisible();
  expect(screen.getByRole("button", { name: "Discard" })).toBeDisabled();
  expect(api.save).not.toHaveBeenCalled();
  expect(useKeyboardStore.getState().savedProject).toBeNull();

  fireEvent.change(screen.getByRole("textbox", { name: "Layer name" }), {
    target: { value: "Primeiro salvo" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.getByText("Saved")).toBeVisible());
  fireEvent.change(screen.getByRole("textbox", { name: "Layer name" }), {
    target: { value: "Outra edição" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard and continue" }));
  expect(screen.getByRole("textbox", { name: "Layer name" })).toHaveValue("Primeiro salvo");
  expect(screen.getByRole("button", { name: "Discard" })).toBeDisabled();
  expect(api.save).toHaveBeenCalledTimes(1);
}, 10000);

const palette = () => within(screen.getByRole("region", { name: "Action palette" }));
const selectKey = (code: string) =>
  fireEvent.click(palette().getByRole("button", { name: `Drag ${code}` }));
const getProject = () => useKeyboardStore.getState().project!;

it("creates a macro, fills its steps, assigns it to keys on different layers, and saves everything", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: "Macros" }));
  fireEvent.click(screen.getByRole("button", { name: "+ New macro" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Macro name" }), {
    target: { value: "Minha sequência" },
  });
  selectKey("&kp B");
  fireEvent.click(screen.getByRole("button", { name: "Assign action to Step 1 action" }));
  selectKey("&kp C");
  fireEvent.click(screen.getByRole("button", { name: "Assign action to Add step" }));
  expect(getProject().layout.macros[0].steps.map((step) => step.binding)).toEqual([
    "&kp B",
    "&kp C",
  ]);

  fireEvent.click(screen.getByRole("button", { name: "Assign Minha sequência to keyboard" }));
  expect(screen.getByRole("textbox", { name: "Layer name" })).toHaveValue("Base");
  const code = `&${getProject().layout.macros[0].id}`;
  fireEvent.click(screen.getByRole("button", { name: /^Position 0:/ }));
  expect(screen.getByRole("button", { name: /^Position 0:/ })).toHaveTextContent("Minha sequência");
  fireEvent.click(screen.getByRole("button", { name: "Add layer" }));
  fireEvent.click(screen.getByRole("button", { name: /^Position 1:/ }));
  expect(getProject().layout.layers[0].keys[0].code).toBe(code);
  expect(getProject().layout.layers[1].keys.map((k) => k.code)).toEqual(["&trans", code]);
  expect(useKeyboardStore.getState().savedProject!.layout.macros).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
  const saved = vi.mocked(api.save).mock.calls[0][0];
  expect(saved.layout.macros[0].name).toBe("Minha sequência");
  expect(saved.layout.layers[1].keys[1].code).toBe(code);
});

it("creates and assigns hold-tap and tap-dance behaviors with the configured actions", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: "Behaviors" }));
  fireEvent.click(screen.getByRole("button", { name: "+ Tap / hold" }));
  fireEvent.click(palette().getByRole("button", { name: "Modifiers" }));
  selectKey("&kp LSHFT");
  fireEvent.click(
    screen.getByRole("button", {
      name: "Assign action to Hold action (default for new assignments)",
    }),
  );
  fireEvent.click(palette().getByRole("button", { name: "Keys" }));
  selectKey("&kp B");
  fireEvent.click(
    screen.getByRole("button", {
      name: "Assign action to Tap action (default for new assignments)",
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Assign New tap/hold to keyboard" }));
  fireEvent.click(screen.getByRole("button", { name: /^Position 0:/ }));
  const holdTap = getProject().layout.behaviors[0];
  expect(holdTap.bindings).toEqual(["&kp LSHFT", "&kp B"]);
  expect(getProject().layout.layers[0].keys[0].code).toBe(`&${holdTap.id} LSHFT B`);

  fireEvent.click(screen.getByRole("button", { name: "Behaviors" }));
  fireEvent.click(screen.getByRole("button", { name: "+ Tap sequence" }));
  selectKey("&kp F1");
  fireEvent.click(screen.getByRole("button", { name: "Assign action to Add tap" }));
  fireEvent.click(screen.getByRole("button", { name: "Assign New tap sequence to keyboard" }));
  fireEvent.click(screen.getByRole("button", { name: /^Position 1:/ }));
  const dance = getProject().layout.behaviors[1];
  expect(dance.bindings).toEqual(["&kp A", "&kp B", "&kp F1"]);
  expect(getProject().layout.layers[0].keys[1].code).toBe(`&${dance.id}`);
});

it("creates a combo that triggers a macro without remapping the trigger keys", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: "Macros" }));
  fireEvent.click(screen.getByRole("button", { name: "+ New macro" }));
  fireEvent.click(screen.getByRole("button", { name: "Drag New macro" }));
  fireEvent.click(screen.getByRole("button", { name: "Combos" }));
  fireEvent.click(screen.getByRole("button", { name: "+ New combo" }));
  expect(screen.getByText("Select at least two keys to trigger the combo.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /^Position 0:/ }));
  fireEvent.click(screen.getByRole("button", { name: /^Position 1:/ }));
  fireEvent.click(screen.getByRole("button", { name: "Assign action to Combo action" }));
  const combo = getProject().layout.combos[0];
  expect(combo.positions).toEqual([0, 1]);
  expect(combo.binding).toBe(`&${getProject().layout.macros[0].id}`);
  expect(getProject().layout.layers[0].keys.map((k) => k.code)).toEqual(["&kp A", "&kp B"]);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
  expect(vi.mocked(api.save).mock.calls[0][0].layout.combos[0]).toEqual(combo);
});

it("selects and assigns actions using the keyboard, and cancels selection with Escape", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.keyDown(palette().getByRole("button", { name: "Drag &kp C" }), { key: "Enter" });
  fireEvent.keyDown(screen.getByRole("button", { name: /^Position 0:/ }), { key: "Enter" });
  expect(getProject().layout.layers[0].keys[0].code).toBe("&kp C");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(useKeyboardStore.getState().selectedAction).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^Position 1:/ }));
  expect(getProject().layout.layers[0].keys[1].code).toBe("&kp B");
});

it("assigns a macro to encoder rotation and click while keeping its physical binding synchronized", async () => {
  const s = fixture();
  const sensor = {
    id: "encoder_left",
    label: "Left encoder",
    codeCW: "&kp C",
    codeCCW: "&kp D",
    codeClick: "&kp E",
    clickKeymapIndex: 2,
  };
  s.plugin.capabilities = ["macros", "encoders"];
  s.plugin.sensors = [sensor];
  s.plugin.keyCount = 3;
  s.plugin.positions.push({
    id: "encoder",
    keymapIndex: 2,
    x: 2,
    y: 0,
    rotation: 0,
    width: 1.6,
    height: 1.8,
    sensorId: sensor.id,
  });
  s.project.layout.layers[0].keys.push({
    keymapIndex: 2,
    row: 0,
    col: 2,
    code: sensor.codeClick,
    label: "E",
  });
  s.project.layout.layers[0].sensors = [sensor];
  vi.mocked(api.load).mockResolvedValue(s);
  vi.mocked(api.newProject).mockResolvedValue(s);
  vi.mocked(api.plugins).mockResolvedValue([s.plugin]);
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: "Macros" }));
  fireEvent.click(screen.getByRole("button", { name: "+ New macro" }));
  fireEvent.click(screen.getByRole("button", { name: "Assign New macro to keyboard" }));
  fireEvent.click(screen.getByRole("button", { name: /^encoder_left CW:/ }));
  fireEvent.click(screen.getByRole("button", { name: /^encoder_left CLK:/ }));
  const code = `&${getProject().layout.macros[0].id}`;
  expect(getProject().layout.layers[0].sensors[0].codeCW).toBe(code);
  expect(getProject().layout.layers[0].sensors[0].codeCCW).toBe("&kp D");
  expect(getProject().layout.layers[0].keys[2].code).toBe(code);
  expect(screen.getByRole("button", { name: /^encoder_left CLK:/ })).toHaveTextContent("New macro");
  expect(useKeyboardStore.getState().savedProject!.layout.layers[0].keys[2].code).toBe("&kp E");
});

it("accepts zero-parameter behavior composition for hold actions", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: "Behaviors" }));
  fireEvent.click(screen.getByRole("button", { name: "+ Tap / hold" }));
  fireEvent.click(palette().getByRole("button", { name: "Resources" }));
  selectKey("&trans");
  fireEvent.click(
    screen.getByRole("button", {
      name: "Assign action to Hold action (default for new assignments)",
    }),
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(getProject().layout.behaviors[0].bindings[0]).toBe("&trans");
});

it("edits native mod-tap and layer-tap settings independently", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Resolution — Mod-tap (&mt)" }), {
    target: { value: "balanced" },
  });
  expect(getProject().options.modTap!.flavor).toBe("balanced");
  expect(getProject().options.layerTap!.flavor).toBe("tap-preferred");
  fireEvent.change(screen.getByRole("spinbutton", { name: "Tapping term — Layer-tap (&lt)" }), {
    target: { value: "310" },
  });
  expect(getProject().options.layerTap!.tappingTermMs).toBe(310);
  expect(getProject().options.modTap!.tappingTermMs).toBe(200);
});

it("creates mod-morphs and edits a key binding without replacing its reusable definition", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: "Behaviors" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Add behavior type" }), {
    target: { value: "mod-morph" },
  });
  const morph = getProject().layout.behaviors[0];
  expect(morph.properties!.mods).toContain("MOD_LSFT");
  fireEvent.click(screen.getByRole("button", { name: `Assign ${morph.name} to keyboard` }));
  fireEvent.click(screen.getByRole("button", { name: /^Position 0:/ }));
  expect(getProject().layout.layers[0].keys[0].code).toBe(`&${morph.id}`);
  fireEvent.keyDown(window, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: /^Position 0:/ }));
  const dialog = within(screen.getByRole("dialog", { name: "Edit key binding" }));
  fireEvent.click(dialog.getByText("Advanced ZMK code"));
  fireEvent.change(dialog.getByRole("textbox", { name: "ZMK binding: Key action" }), {
    target: { value: "&kp LC(A)" },
  });
  fireEvent.keyDown(dialog.getByRole("textbox", { name: "ZMK binding: Key action" }), {
    key: "Enter",
  });
  expect(getProject().layout.layers[0].keys[0].code).toBe("&kp LC(A)");
  expect(getProject().layout.behaviors[0].id).toBe(morph.id);
  fireEvent.click(dialog.getByRole("button", { name: "Done" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("creates parameter routing and release continuation controls and assigns macro arguments", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: "Macros" }));
  fireEvent.click(screen.getByRole("button", { name: "+ New macro" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Step 1 type" }), {
    target: { value: "control" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Macro control" }), {
    target: { value: "&macro_param_1to1" },
  });
  expect(getProject().layout.macros[0].parameterCount).toBe(1);
  const add = within(screen.getByRole("group", { name: "Add step" }));
  fireEvent.click(add.getByText("Advanced ZMK code"));
  fireEvent.change(add.getByRole("textbox", { name: "ZMK binding: Add step" }), {
    target: { value: "&kp MACRO_PLACEHOLDER" },
  });
  fireEvent.keyDown(add.getByRole("textbox", { name: "ZMK binding: Add step" }), {
    key: "Enter",
  });
  fireEvent.click(screen.getByRole("button", { name: "+ Wait" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Step 3 type" }), {
    target: { value: "control" },
  });
  fireEvent.click(screen.getByText("Parameters for new assignments"));
  fireEvent.change(
    screen.getByRole("combobox", { name: "Parameters for new assignments — argument 1" }),
    {
      target: { value: "ESC" },
    },
  );
  const macro = getProject().layout.macros[0];
  expect(macro.steps[2].binding).toBe("&macro_pause_for_release");
  fireEvent.click(screen.getByRole("button", { name: "Assign New macro to keyboard" }));
  fireEvent.click(screen.getByRole("button", { name: /^Position 0:/ }));
  expect(getProject().layout.layers[0].keys[0].code).toBe(`&${macro.id} ESC`);
});

it("creates conditional layers with references to the actual project layers", async () => {
  const session = fixture();
  const base = session.project.layout.layers[0];
  for (const id of ["lower", "raise", "adjust"])
    session.project.layout.layers.push({ ...structuredClone(base), id, name: id });
  vi.mocked(api.load).mockResolvedValue(session);
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: "Conditional layers" }));
  fireEvent.click(screen.getByRole("button", { name: "+ New rule" }));
  const rule = getProject().layout.conditionalLayers![0];
  expect(rule.ifLayerIds).toEqual(["lower", "raise"]);
  expect(rule.thenLayerId).toBe("adjust");
});

it("configures encoder timings, hardware resolution and native pointing chains", async () => {
  const session = fixture();
  const sensor = {
    id: "encoder",
    label: "Encoder",
    codeCW: "&kp A",
    codeCCW: "&kp B",
    codeClick: "&kp A",
    clickKeymapIndex: 0,
  };
  session.project.layout.layers[0].sensors = [sensor];
  session.project.layout.layers.push({
    ...structuredClone(session.project.layout.layers[0]),
    id: "nav",
    name: "Nav",
  });
  vi.mocked(api.load).mockResolvedValue(session);
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "Tap duration (ms)" }), {
    target: { value: "11" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Triggers per rotation" }), {
    target: { value: "18" },
  });
  expect(getProject().layout.layers[0].sensors[0].tapMs).toBe(11);
  expect(getProject().layout.layers.every((l) => l.sensors[0].triggersPerRotation === 18)).toBe(
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "+ Input processing chain" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Device listener" }), {
    target: { value: "mmv_input_listener" },
  });
  fireEvent.click(screen.getByRole("button", { name: "+ Convert to scrolling" }));
  expect(getProject().layout.inputProcessors![0].bindings).toEqual([
    "&zip_xy_scaler 3 2",
    "&zip_xy_to_scroll_mapper",
  ]);
  expect(getProject().layout.inputProcessors![0].listener).toBe("mmv_input_listener");
  fireEvent.click(screen.getByRole("checkbox", { name: "RGB underglow" }));
  expect(getProject().options.rgbUnderglow).toBe(true);
});

it("imports native behaviors whose empty Go slices arrive as null without blanking the editor", async () => {
  const imported = fixture();
  imported.hasSaved = false;
  imported.project.layout.layers[0].name = "Importado do ZMK";
  // This is the JSON shape returned by Wails for a native caps-word override.
  imported.project.layout.behaviors = JSON.parse(
    JSON.stringify([
      {
        id: "zm_native_caps",
        name: "Caps Word importado",
        kind: "caps-word",
        target: "caps_word",
        bindings: null,
        holdTriggerPositions: null,
        tappingTermMs: 0,
        quickTapMs: 0,
        flavor: "",
        requirePriorIdleMs: 0,
        holdTriggerOnRelease: false,
      },
    ]),
  );
  vi.mocked(api.importProject).mockResolvedValue(imported);
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: "Import project" }));
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Layer name" })).toHaveValue("Importado do ZMK"),
  );
  expect(screen.getByRole("region", { name: "Action palette" })).toBeVisible();
  expect(getProject().layout.behaviors[0].bindings).toEqual([]);
  expect(imported.project.layout.behaviors[0].bindings).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Resources" }));
  expect(screen.getByRole("button", { name: "Drag Caps Word importado" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(api.save).toHaveBeenCalled());
  expect(vi.mocked(api.save).mock.calls[0][0].layout.behaviors[0].bindings).toEqual([]);
});

it("keeps project actions in the right sidebar with accessible names and tooltips", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  const actions = within(screen.getByRole("complementary", { name: "Project actions" }));
  for (const name of [
    "Import project",
    "Export project",
    "Export keymap",
    "Discard",
    "Save",
    "Build",
    "Save and build",
  ]) {
    const button = actions.getByRole("button", { name });
    expect(button).toHaveAttribute("title");
    expect(button.textContent).toBe("");
  }
  expect(screen.getByRole("complementary", { name: "Keymap layers" })).toBeVisible();
  fireEvent.click(actions.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
});

it("keeps invalid raw code out of the project and blocks save until corrected", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: /^Position 0:/ }));
  const dialog = within(screen.getByRole("dialog", { name: "Edit key binding" }));
  fireEvent.click(dialog.getByText("Advanced ZMK code"));
  const raw = dialog.getByRole("textbox", { name: "ZMK binding: Key action" });
  fireEvent.change(raw, { target: { value: "fdsfsd" } });
  fireEvent.blur(raw);
  expect(raw).toHaveAttribute("aria-invalid", "true");
  expect(getProject().layout.layers[0].keys[0].code).toBe("&kp A");
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(dialog.getByRole("button", { name: "Done" })).toBeDisabled();
  fireEvent.change(raw, { target: { value: "&kp LC(A)" } });
  fireEvent.keyDown(raw, { key: "Enter" });
  expect(getProject().layout.layers[0].keys[0].code).toBe("&kp LC(A)");
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  expect(api.save).not.toHaveBeenCalled();
  fireEvent.change(raw, { target: { value: "&kp INVALID" } });
  fireEvent.click(dialog.getByRole("button", { name: "Discard draft" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(getProject().layout.layers[0].keys[0].code).toBe("&kp LC(A)");
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
});

it("validates a single keycode argument before changing the mapping", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: /^Position 0:/ }));
  const input = screen.getByRole("combobox", { name: "Key action — argument 1" });
  fireEvent.change(input, { target: { value: "A B" } });
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(getProject().layout.layers[0].keys[0].code).toBe("&kp A");
  fireEvent.change(input, { target: { value: "LCTRL" } });
  expect(input).toHaveAttribute("aria-invalid", "false");
  expect(getProject().layout.layers[0].keys[0].code).toBe("&kp LCTRL");
});

it("expands a collapsed palette when a search is entered", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: "Collapse palette" }));
  expect(screen.getByRole("button", { name: "Expand palette" })).toBeVisible();
  fireEvent.change(screen.getByRole("textbox", { name: "Search actions" }), {
    target: { value: "F1" },
  });
  expect(screen.getByRole("button", { name: "Collapse palette" })).toBeVisible();
  expect(palette().getByRole("button", { name: "Drag &kp F1" })).toBeVisible();
});

it("refuses an incompatible hold child before assigning it", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: "Behaviors" }));
  fireEvent.click(screen.getByRole("button", { name: "+ Tap / hold" }));
  fireEvent.click(palette().getByRole("button", { name: "Tap/hold" }));
  fireEvent.click(palette().getByRole("button", { name: "Drag &mt LCTRL TAB" }));
  const target = screen.getByRole("button", {
    name: "Assign action to Hold action (default for new assignments)",
  });
  expect(target).toBeDisabled();
  expect(target).toHaveAttribute("title", expect.stringContaining("zero or one"));
  expect(getProject().layout.behaviors[0].bindings).toEqual(["&kp LCTRL", "&kp ESC"]);
});

it("marks an existing invalid mapping red and prevents saving it", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  act(() =>
    useKeyboardStore.getState().edit((p) => {
      p.layout.layers[0].keys[0].code = "&kp FDSFSD";
    }),
  );
  expect(screen.getByRole("button", { name: "Position 0: &kp FDSFSD" })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
});

it("keeps the last valid macro control duration and prevents saving an invalid draft", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: "Macros" }));
  fireEvent.click(screen.getByRole("button", { name: "+ New macro" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Step 1 type" }), {
    target: { value: "control" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Macro control" }), {
    target: { value: "&macro_wait_time" },
  });
  const duration = screen.getByRole("spinbutton", { name: "Control duration (ms)" });
  fireEvent.change(duration, { target: { value: "60001" } });
  expect(duration).toHaveAttribute("aria-invalid", "true");
  expect(getProject().layout.macros[0].steps[0].binding).toBe("&macro_wait_time 20");
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  fireEvent.change(duration, { target: { value: "35" } });
  expect(getProject().layout.macros[0].steps[0].binding).toBe("&macro_wait_time 35");
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
});

it("switches the entire editor language without editing the firmware project", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(screen.getByRole("combobox", { name: "Interface language" })).toHaveValue("en");
  const original = structuredClone(getProject());
  const saved = structuredClone(useKeyboardStore.getState().savedProject);
  fireEvent.change(screen.getByRole("combobox", { name: "Interface language" }), {
    target: { value: "pt-BR" },
  });
  expect(screen.getByRole("heading", { name: "Configurações" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Comportamentos" })).toBeVisible();
  expect(screen.getByRole("combobox", { name: "Idioma da interface" })).toHaveValue("pt-BR");
  expect(await screen.findByLabelText("Versão do aplicativo")).toHaveTextContent("v7.8.9");
  expect(getProject()).toEqual(original);
  expect(useKeyboardStore.getState().savedProject).toEqual(saved);
  expect(JSON.parse(localStorage.getItem("z-mapflow.preferences")!).state.locale).toBe("pt-BR");
  fireEvent.change(screen.getByRole("combobox", { name: "Idioma da interface" }), {
    target: { value: "en" },
  });
  expect(screen.getByRole("heading", { name: "Settings" })).toBeVisible();
  expect(getProject().options.locale).toBe(original.options.locale);
  expect(api.save).not.toHaveBeenCalled();
});

it("preserves user-created names and bindings when switching languages", async () => {
  const session = fixture();
  session.project.layout.layers[0].name = "Minha camada ç — Save";
  session.project.layout.macros = [
    {
      id: "zm_user",
      name: "Salvar não é Save",
      tapMs: 20,
      waitMs: 20,
      steps: [{ kind: "tap", binding: "&kp A", durationMs: 0 }],
    },
  ];
  vi.mocked(api.load).mockResolvedValue(session);
  render(<App />);
  await screen.findByRole("textbox", { name: "Layer name" });
  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  const original = structuredClone(getProject());
  fireEvent.change(screen.getByRole("combobox", { name: "Interface language" }), {
    target: { value: "pt-BR" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Layout" }));
  expect(screen.getByRole("textbox", { name: "Nome da camada" })).toHaveValue(
    "Minha camada ç — Save",
  );
  expect(getProject()).toEqual(original);
});
