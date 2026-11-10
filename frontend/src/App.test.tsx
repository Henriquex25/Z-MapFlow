import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { fixture } from "./test/fixtures";
import { api } from "./services/api";
import App from "./App";
import { useKeyboardStore } from "./store/useKeyboardStore";
vi.mock("./services/api", () => ({
  api: {
    load: vi.fn(),
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
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.click(screen.getByRole("button", { name: "Importar projeto" }));
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Nome da camada" })).toHaveValue("Importado"),
  );
  expect(api.importProject).toHaveBeenCalledWith(
    imported.project.pluginId,
    imported.project.variantId,
  );
  expect(useKeyboardStore.getState().project!.layout.macros).toHaveLength(1);
  expect(useKeyboardStore.getState().savedProject).toBeNull();
  expect(screen.getByRole("button", { name: /^Posição 0:/ })).toHaveAccessibleName(
    "Posição 0: &kp Z",
  );
});

it("exports the current unsaved layout as keymap and keeps JSON export available", async () => {
  vi.mocked(api.exportKeymap).mockResolvedValue("/tmp/sofle.keymap");
  vi.mocked(api.exportProject).mockResolvedValue("/tmp/project.json");
  render(<App />);
  const name = await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.change(name, { target: { value: "Edição atual" } });
  fireEvent.click(screen.getByRole("button", { name: "Exportar keymap" }));
  await waitFor(() => expect(api.exportKeymap).toHaveBeenCalledTimes(1));
  expect(vi.mocked(api.exportKeymap).mock.calls[0][0].layout.layers[0].name).toBe("Edição atual");
  expect(api.save).not.toHaveBeenCalled();
  expect(await screen.findByText("Keymap exportado para /tmp/sofle.keymap")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Exportar projeto" }));
  await waitFor(() => expect(api.exportProject).toHaveBeenCalledTimes(1));
});

it("keeps the current layout when import fails or the file dialog is cancelled", async () => {
  vi.mocked(api.importProject).mockRejectedValueOnce(new Error("Keymap incompatível"));
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.click(screen.getByRole("button", { name: "Importar projeto" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Keymap incompatível");
  expect(screen.getByRole("textbox", { name: "Nome da camada" })).toHaveValue("Base");
  vi.mocked(api.importProject).mockResolvedValueOnce(
    {} as Awaited<ReturnType<typeof api.importProject>>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Importar projeto" }));
  await waitFor(() => expect(api.importProject).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Nome da camada" })).toHaveValue("Base");
});
it("distinguishes save, build saved, and save-and-build", async () => {
  render(<App />);
  const name = await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.change(name, { target: { value: "Edited" } });
  fireEvent.click(screen.getByRole("button", { name: "Compilar" }));
  await waitFor(() => expect(api.build).toHaveBeenCalledTimes(1));
  expect(api.save).not.toHaveBeenCalled();
  expect(api.saveAndBuild).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
  expect(vi.mocked(api.save).mock.calls[0][0].layout.layers[0].name).toBe("Edited");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Salvar e compilar" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Salvar e compilar" }));
  await waitFor(() => expect(api.saveAndBuild).toHaveBeenCalledTimes(1));
});
it("presents a recoverable loading error instead of an infinite spinner", async () => {
  vi.mocked(api.load).mockRejectedValueOnce(new Error("Arquivo inválido"));
  render(<App />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Arquivo inválido");
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByRole("textbox", { name: "Nome da camada" })).toHaveValue("Base");
});

it("shows meaningful mouse actions and assigns their original bindings", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  const palette = within(screen.getByRole("region", { name: "Paleta de ações" }));
  fireEvent.click(palette.getByRole("button", { name: "Mouse" }));
  expect(palette.getByRole("heading", { name: "Botões" })).toBeVisible();
  expect(palette.getByRole("heading", { name: "Movimento" })).toBeVisible();
  expect(palette.getByRole("heading", { name: "Rolagem" })).toBeVisible();
  const rightClick = palette.getByRole("button", { name: "Arrastar &mkp RCLK" });
  expect(rightClick).toHaveTextContent("Dir.");
  expect(rightClick).not.toHaveTextContent("&mkp");
  expect(
    within(rightClick).getByTitle(/Clique do botão direito do mouse\s+&mkp RCLK/),
  ).toBeVisible();
  fireEvent.click(rightClick);
  fireEvent.click(screen.getByRole("button", { name: /^Posição 0:/ }));
  expect(useKeyboardStore.getState().project!.layout.layers[0].keys[0].code).toBe("&mkp RCLK");
  const scroll = palette.getByRole("button", { name: "Arrastar &msc SCRL_DOWN" });
  expect(scroll).toHaveTextContent("Rolar");
  expect(within(scroll).getByTitle(/Rolar para baixo\s+&msc SCRL_DOWN/)).toBeVisible();
  fireEvent.click(scroll);
  fireEvent.click(screen.getByRole("button", { name: /^Posição 1:/ }));
  expect(useKeyboardStore.getState().project!.layout.layers[0].keys[1].code).toBe("&msc SCRL_DOWN");
});

it("opens tap/hold at the controls and preserves modifier codes behind friendly names", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  const region = screen.getByRole("region", { name: "Paleta de ações" });
  const body = region.querySelector<HTMLElement>(".palette-body")!;
  body.scrollTop = 80;
  fireEvent.click(within(region).getByRole("button", { name: "Tap/hold" }));
  expect(body.scrollTop).toBe(0);
  const modifier = screen.getByRole("combobox", { name: "Ação ao segurar" });
  expect(within(modifier).getByRole("option", { name: "Ctrl direito" })).toHaveValue("RCTRL");
  fireEvent.change(modifier, { target: { value: "RCTRL" } });
  fireEvent.click(within(region).getByRole("button", { name: "Arrastar &mt RCTRL TAB" }));
  fireEvent.click(screen.getByRole("button", { name: /^Posição 0:/ }));
  expect(useKeyboardStore.getState().project!.layout.layers[0].keys[0].code).toBe("&mt RCTRL TAB");
});

it("enables discard before the first save and restores the latest saved revision after saving", async () => {
  const session = fixture();
  session.hasSaved = false;
  session.project.revision = "";
  session.project.savedAt = "";
  vi.mocked(api.load).mockResolvedValue(session);
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  expect(screen.getByText("Ainda não salvo")).toBeVisible();
  expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Compilar" })).toBeDisabled();
  const palette = within(screen.getByRole("region", { name: "Paleta de ações" }));
  fireEvent.click(palette.getByRole("button", { name: "Arrastar &kp C" }));
  fireEvent.click(screen.getByRole("button", { name: /^Posição 0:/ }));
  expect(screen.getByText("Alterações não salvas")).toBeVisible();
  expect(screen.getByRole("button", { name: "Descartar" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
  fireEvent.click(screen.getByRole("button", { name: "Descartar e continuar" }));
  expect(screen.getByRole("button", { name: /^Posição 0:/ })).toHaveAttribute(
    "aria-label",
    "Posição 0: &kp A",
  );
  expect(within(screen.getByRole("button", { name: /^Posição 0:/ })).getByText("KP")).toBeVisible();
  expect(screen.getByText("Ainda não salvo")).toBeVisible();
  expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled();
  expect(api.save).not.toHaveBeenCalled();
  expect(useKeyboardStore.getState().savedProject).toBeNull();

  fireEvent.change(screen.getByRole("textbox", { name: "Nome da camada" }), {
    target: { value: "Primeiro salvo" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(screen.getByText("Salvo")).toBeVisible());
  fireEvent.change(screen.getByRole("textbox", { name: "Nome da camada" }), {
    target: { value: "Outra edição" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
  fireEvent.click(screen.getByRole("button", { name: "Descartar e continuar" }));
  expect(screen.getByRole("textbox", { name: "Nome da camada" })).toHaveValue("Primeiro salvo");
  expect(screen.getByRole("button", { name: "Descartar" })).toBeDisabled();
  expect(api.save).toHaveBeenCalledTimes(1);
}, 10000);

const palette = () => within(screen.getByRole("region", { name: "Paleta de ações" }));
const selectKey = (code: string) =>
  fireEvent.click(palette().getByRole("button", { name: `Arrastar ${code}` }));
const getProject = () => useKeyboardStore.getState().project!;

it("creates a macro, fills its steps, assigns it to keys on different layers, and saves everything", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.click(screen.getByRole("button", { name: "Macros" }));
  fireEvent.click(screen.getByRole("button", { name: "+ Nova macro" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Nome da macro" }), {
    target: { value: "Minha sequência" },
  });
  selectKey("&kp B");
  fireEvent.click(screen.getByRole("button", { name: "Atribuir ação a Ação do passo 1" }));
  selectKey("&kp C");
  fireEvent.click(screen.getByRole("button", { name: "Atribuir ação a Adicionar passo" }));
  expect(getProject().layout.macros[0].steps.map((step) => step.binding)).toEqual([
    "&kp B",
    "&kp C",
  ]);

  fireEvent.click(screen.getByRole("button", { name: "Atribuir Minha sequência ao teclado" }));
  expect(screen.getByRole("textbox", { name: "Nome da camada" })).toHaveValue("Base");
  const code = `&${getProject().layout.macros[0].id}`;
  fireEvent.click(screen.getByRole("button", { name: /^Posição 0:/ }));
  expect(screen.getByRole("button", { name: /^Posição 0:/ })).toHaveTextContent("Minha sequência");
  fireEvent.click(screen.getByRole("button", { name: "Adicionar camada" }));
  fireEvent.click(screen.getByRole("button", { name: /^Posição 1:/ }));
  expect(getProject().layout.layers[0].keys[0].code).toBe(code);
  expect(getProject().layout.layers[1].keys.map((k) => k.code)).toEqual(["&trans", code]);
  expect(useKeyboardStore.getState().savedProject!.layout.macros).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
  const saved = vi.mocked(api.save).mock.calls[0][0];
  expect(saved.layout.macros[0].name).toBe("Minha sequência");
  expect(saved.layout.layers[1].keys[1].code).toBe(code);
});

it("creates and assigns hold-tap and tap-dance behaviors with the configured actions", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.click(screen.getByRole("button", { name: "Comportamentos" }));
  fireEvent.click(screen.getByRole("button", { name: "+ Toque / segurar" }));
  fireEvent.click(palette().getByRole("button", { name: "Modificadores" }));
  selectKey("&kp LSHFT");
  fireEvent.click(
    screen.getByRole("button", {
      name: "Atribuir ação a Ação ao segurar (padrão para atribuição)",
    }),
  );
  fireEvent.click(palette().getByRole("button", { name: "Teclas" }));
  selectKey("&kp B");
  fireEvent.click(
    screen.getByRole("button", { name: "Atribuir ação a Ação ao tocar (padrão para atribuição)" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Atribuir Novo toque/segurar ao teclado" }));
  fireEvent.click(screen.getByRole("button", { name: /^Posição 0:/ }));
  const holdTap = getProject().layout.behaviors[0];
  expect(holdTap.bindings).toEqual(["&kp LSHFT", "&kp B"]);
  expect(getProject().layout.layers[0].keys[0].code).toBe(`&${holdTap.id} LSHFT B`);

  fireEvent.click(screen.getByRole("button", { name: "Comportamentos" }));
  fireEvent.click(screen.getByRole("button", { name: "+ Sequência de toques" }));
  selectKey("&kp F1");
  fireEvent.click(screen.getByRole("button", { name: "Atribuir ação a Adicionar toque" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Atribuir Nova sequência de toques ao teclado" }),
  );
  fireEvent.click(screen.getByRole("button", { name: /^Posição 1:/ }));
  const dance = getProject().layout.behaviors[1];
  expect(dance.bindings).toEqual(["&kp A", "&kp B", "&kp F1"]);
  expect(getProject().layout.layers[0].keys[1].code).toBe(`&${dance.id}`);
});

it("creates a combo that triggers a macro without remapping the trigger keys", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.click(screen.getByRole("button", { name: "Macros" }));
  fireEvent.click(screen.getByRole("button", { name: "+ Nova macro" }));
  fireEvent.click(screen.getByRole("button", { name: "Arrastar Nova macro" }));
  fireEvent.click(screen.getByRole("button", { name: "Combos" }));
  fireEvent.click(screen.getByRole("button", { name: "+ Novo combo" }));
  expect(screen.getByText("Selecione pelo menos duas teclas para ativar o combo.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /^Posição 0:/ }));
  fireEvent.click(screen.getByRole("button", { name: /^Posição 1:/ }));
  fireEvent.click(screen.getByRole("button", { name: "Atribuir ação a Ação do combo" }));
  const combo = getProject().layout.combos[0];
  expect(combo.positions).toEqual([0, 1]);
  expect(combo.binding).toBe(`&${getProject().layout.macros[0].id}`);
  expect(getProject().layout.layers[0].keys.map((k) => k.code)).toEqual(["&kp A", "&kp B"]);
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
  expect(vi.mocked(api.save).mock.calls[0][0].layout.combos[0]).toEqual(combo);
});

it("selects and assigns actions using the keyboard, and cancels selection with Escape", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.keyDown(palette().getByRole("button", { name: "Arrastar &kp C" }), { key: "Enter" });
  fireEvent.keyDown(screen.getByRole("button", { name: /^Posição 0:/ }), { key: "Enter" });
  expect(getProject().layout.layers[0].keys[0].code).toBe("&kp C");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(useKeyboardStore.getState().selectedAction).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^Posição 1:/ }));
  expect(getProject().layout.layers[0].keys[1].code).toBe("&kp B");
});

it("assigns a macro to encoder rotation and click while keeping its physical binding synchronized", async () => {
  const s = fixture();
  const sensor = {
    id: "encoder_left",
    label: "Encoder esquerdo",
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
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.click(screen.getByRole("button", { name: "Macros" }));
  fireEvent.click(screen.getByRole("button", { name: "+ Nova macro" }));
  fireEvent.click(screen.getByRole("button", { name: "Atribuir Nova macro ao teclado" }));
  fireEvent.click(screen.getByRole("button", { name: /^encoder_left CW:/ }));
  fireEvent.click(screen.getByRole("button", { name: /^encoder_left CLK:/ }));
  const code = `&${getProject().layout.macros[0].id}`;
  expect(getProject().layout.layers[0].sensors[0].codeCW).toBe(code);
  expect(getProject().layout.layers[0].sensors[0].codeCCW).toBe("&kp D");
  expect(getProject().layout.layers[0].keys[2].code).toBe(code);
  expect(screen.getByRole("button", { name: /^encoder_left CLK:/ })).toHaveTextContent(
    "Nova macro",
  );
  expect(useKeyboardStore.getState().savedProject!.layout.layers[0].keys[2].code).toBe("&kp E");
});

it("accepts zero-parameter behavior composition for hold actions", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.click(screen.getByRole("button", { name: "Comportamentos" }));
  fireEvent.click(screen.getByRole("button", { name: "+ Toque / segurar" }));
  fireEvent.click(palette().getByRole("button", { name: "Recursos" }));
  selectKey("&trans");
  fireEvent.click(
    screen.getByRole("button", {
      name: "Atribuir ação a Ação ao segurar (padrão para atribuição)",
    }),
  );
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(getProject().layout.behaviors[0].bindings[0]).toBe("&trans");
});

it("edits native mod-tap and layer-tap settings independently", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Resolução — Mod-tap (&mt)" }), {
    target: { value: "balanced" },
  });
  expect(getProject().options.modTap!.flavor).toBe("balanced");
  expect(getProject().options.layerTap!.flavor).toBe("tap-preferred");
  fireEvent.change(screen.getByRole("spinbutton", { name: "Tempo de toque — Layer-tap (&lt)" }), {
    target: { value: "310" },
  });
  expect(getProject().options.layerTap!.tappingTermMs).toBe(310);
  expect(getProject().options.modTap!.tappingTermMs).toBe(200);
});

it("creates mod-morphs and edits a key binding without replacing its reusable definition", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.click(screen.getByRole("button", { name: "Comportamentos" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Adicionar tipo de comportamento" }), {
    target: { value: "mod-morph" },
  });
  const morph = getProject().layout.behaviors[0];
  expect(morph.properties!.mods).toContain("MOD_LSFT");
  fireEvent.click(screen.getByRole("button", { name: `Atribuir ${morph.name} ao teclado` }));
  fireEvent.click(screen.getByRole("button", { name: /^Posição 0:/ }));
  expect(getProject().layout.layers[0].keys[0].code).toBe(`&${morph.id}`);
  fireEvent.keyDown(window, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: /^Posição 0:/ }));
  const dialog = within(screen.getByRole("dialog", { name: "Editar binding da tecla" }));
  fireEvent.click(dialog.getByText("Código ZMK avançado"));
  fireEvent.change(dialog.getByRole("textbox", { name: "Binding ZMK: Ação da tecla" }), {
    target: { value: "&kp LC(A)" },
  });
  fireEvent.keyDown(dialog.getByRole("textbox", { name: "Binding ZMK: Ação da tecla" }), {
    key: "Enter",
  });
  expect(getProject().layout.layers[0].keys[0].code).toBe("&kp LC(A)");
  expect(getProject().layout.behaviors[0].id).toBe(morph.id);
  fireEvent.click(dialog.getByRole("button", { name: "Concluir" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("creates parameter routing and release continuation controls and assigns macro arguments", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.click(screen.getByRole("button", { name: "Macros" }));
  fireEvent.click(screen.getByRole("button", { name: "+ Nova macro" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Tipo do passo 1" }), {
    target: { value: "control" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Controle da macro" }), {
    target: { value: "&macro_param_1to1" },
  });
  expect(getProject().layout.macros[0].parameterCount).toBe(1);
  const add = within(screen.getByRole("group", { name: "Adicionar passo" }));
  fireEvent.click(add.getByText("Código ZMK avançado"));
  fireEvent.change(add.getByRole("textbox", { name: "Binding ZMK: Adicionar passo" }), {
    target: { value: "&kp MACRO_PLACEHOLDER" },
  });
  fireEvent.keyDown(add.getByRole("textbox", { name: "Binding ZMK: Adicionar passo" }), {
    key: "Enter",
  });
  fireEvent.click(screen.getByRole("button", { name: "+ Espera" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Tipo do passo 3" }), {
    target: { value: "control" },
  });
  fireEvent.click(screen.getByText("Parâmetros para novas atribuições"));
  fireEvent.change(
    screen.getByRole("combobox", { name: "Parâmetros para novas atribuições — argumento 1" }),
    {
      target: { value: "ESC" },
    },
  );
  const macro = getProject().layout.macros[0];
  expect(macro.steps[2].binding).toBe("&macro_pause_for_release");
  fireEvent.click(screen.getByRole("button", { name: "Atribuir Nova macro ao teclado" }));
  fireEvent.click(screen.getByRole("button", { name: /^Posição 0:/ }));
  expect(getProject().layout.layers[0].keys[0].code).toBe(`&${macro.id} ESC`);
});

it("creates conditional layers with references to the actual project layers", async () => {
  const session = fixture();
  const base = session.project.layout.layers[0];
  for (const id of ["lower", "raise", "adjust"])
    session.project.layout.layers.push({ ...structuredClone(base), id, name: id });
  vi.mocked(api.load).mockResolvedValue(session);
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.click(screen.getByRole("button", { name: "Camadas condicionais" }));
  fireEvent.click(screen.getByRole("button", { name: "+ Nova regra" }));
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
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.click(screen.getByRole("button", { name: "Configurações" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "Tempo do toque (ms)" }), {
    target: { value: "11" },
  });
  fireEvent.change(screen.getByRole("spinbutton", { name: "Acionamentos por rotação" }), {
    target: { value: "18" },
  });
  expect(getProject().layout.layers[0].sensors[0].tapMs).toBe(11);
  expect(getProject().layout.layers.every((l) => l.sensors[0].triggersPerRotation === 18)).toBe(
    true,
  );
  fireEvent.click(screen.getByRole("button", { name: "+ Cadeia de apontamento" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Listener do dispositivo" }), {
    target: { value: "mmv_input_listener" },
  });
  fireEvent.click(screen.getByRole("button", { name: "+ Converter em rolagem" }));
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
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.click(screen.getByRole("button", { name: "Importar projeto" }));
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Nome da camada" })).toHaveValue("Importado do ZMK"),
  );
  expect(screen.getByRole("region", { name: "Paleta de ações" })).toBeVisible();
  expect(getProject().layout.behaviors[0].bindings).toEqual([]);
  expect(imported.project.layout.behaviors[0].bindings).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Recursos" }));
  expect(screen.getByRole("button", { name: "Arrastar Caps Word importado" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(api.save).toHaveBeenCalled());
  expect(vi.mocked(api.save).mock.calls[0][0].layout.behaviors[0].bindings).toEqual([]);
});

it("keeps project actions in the right sidebar with accessible names and tooltips", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  const actions = within(screen.getByRole("complementary", { name: "Ações do projeto" }));
  for (const name of [
    "Importar projeto",
    "Exportar projeto",
    "Exportar keymap",
    "Descartar",
    "Salvar",
    "Compilar",
    "Salvar e compilar",
  ]) {
    const button = actions.getByRole("button", { name });
    expect(button).toHaveAttribute("title");
    expect(button.textContent).toBe("");
  }
  expect(screen.getByRole("complementary", { name: "Camadas do keymap" })).toBeVisible();
  fireEvent.click(actions.getByRole("button", { name: "Salvar" }));
  await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
});

it("keeps invalid raw code out of the project and blocks save until corrected", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.click(screen.getByRole("button", { name: /^Posição 0:/ }));
  const dialog = within(screen.getByRole("dialog", { name: "Editar binding da tecla" }));
  fireEvent.click(dialog.getByText("Código ZMK avançado"));
  const raw = dialog.getByRole("textbox", { name: "Binding ZMK: Ação da tecla" });
  fireEvent.change(raw, { target: { value: "fdsfsd" } });
  fireEvent.blur(raw);
  expect(raw).toHaveAttribute("aria-invalid", "true");
  expect(getProject().layout.layers[0].keys[0].code).toBe("&kp A");
  expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  expect(dialog.getByRole("button", { name: "Concluir" })).toBeDisabled();
  fireEvent.change(raw, { target: { value: "&kp LC(A)" } });
  fireEvent.keyDown(raw, { key: "Enter" });
  expect(getProject().layout.layers[0].keys[0].code).toBe("&kp LC(A)");
  expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
  expect(api.save).not.toHaveBeenCalled();
  fireEvent.change(raw, { target: { value: "&kp INVALID" } });
  fireEvent.click(dialog.getByRole("button", { name: "Descartar rascunho" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(getProject().layout.layers[0].keys[0].code).toBe("&kp LC(A)");
  expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
});

it("validates a single keycode argument before changing the mapping", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.click(screen.getByRole("button", { name: /^Posição 0:/ }));
  const input = screen.getByRole("combobox", { name: "Ação da tecla — argumento 1" });
  fireEvent.change(input, { target: { value: "A B" } });
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(getProject().layout.layers[0].keys[0].code).toBe("&kp A");
  fireEvent.change(input, { target: { value: "LCTRL" } });
  expect(input).toHaveAttribute("aria-invalid", "false");
  expect(getProject().layout.layers[0].keys[0].code).toBe("&kp LCTRL");
});

it("expands a collapsed palette when a search is entered", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.click(screen.getByRole("button", { name: "Recolher paleta" }));
  expect(screen.getByRole("button", { name: "Expandir paleta" })).toBeVisible();
  fireEvent.change(screen.getByRole("textbox", { name: "Buscar ações" }), {
    target: { value: "F1" },
  });
  expect(screen.getByRole("button", { name: "Recolher paleta" })).toBeVisible();
  expect(palette().getByRole("button", { name: "Arrastar &kp F1" })).toBeVisible();
});

it("refuses an incompatible hold child before assigning it", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.click(screen.getByRole("button", { name: "Comportamentos" }));
  fireEvent.click(screen.getByRole("button", { name: "+ Toque / segurar" }));
  fireEvent.click(palette().getByRole("button", { name: "Tap/hold" }));
  fireEvent.click(palette().getByRole("button", { name: "Arrastar &mt LCTRL TAB" }));
  const target = screen.getByRole("button", {
    name: "Atribuir ação a Ação ao segurar (padrão para atribuição)",
  });
  expect(target).toBeDisabled();
  expect(target).toHaveAttribute("title", expect.stringContaining("zero ou um"));
  expect(getProject().layout.behaviors[0].bindings).toEqual(["&kp LCTRL", "&kp ESC"]);
});

it("marks an existing invalid mapping red and prevents saving it", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  act(() =>
    useKeyboardStore.getState().edit((p) => {
      p.layout.layers[0].keys[0].code = "&kp FDSFSD";
    }),
  );
  expect(screen.getByRole("button", { name: "Posição 0: &kp FDSFSD" })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
});

it("keeps the last valid macro control duration and prevents saving an invalid draft", async () => {
  render(<App />);
  await screen.findByRole("textbox", { name: "Nome da camada" });
  fireEvent.click(screen.getByRole("button", { name: "Macros" }));
  fireEvent.click(screen.getByRole("button", { name: "+ Nova macro" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Tipo do passo 1" }), {
    target: { value: "control" },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Controle da macro" }), {
    target: { value: "&macro_wait_time" },
  });
  const duration = screen.getByRole("spinbutton", { name: "Tempo do controle (ms)" });
  fireEvent.change(duration, { target: { value: "60001" } });
  expect(duration).toHaveAttribute("aria-invalid", "true");
  expect(getProject().layout.macros[0].steps[0].binding).toBe("&macro_wait_time 20");
  expect(screen.getByRole("button", { name: "Salvar" })).toBeDisabled();
  fireEvent.change(duration, { target: { value: "35" } });
  expect(getProject().layout.macros[0].steps[0].binding).toBe("&macro_wait_time 35");
  expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
});
