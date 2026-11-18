import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { fixture } from "../test/fixtures";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { useAppPreferences } from "../i18n";
import { ActionTray } from "./ActionTray";
import { DroppableKey } from "./DroppableKey";
import { KeyboardLanguageSelect } from "./KeyboardLanguageSelect";
import { api } from "../services/api";
import { validateBinding } from "../utils/bindingValidation";

vi.mock("../services/api", () => ({
  api: { importHeaders: vi.fn(), findLanguageHeaders: vi.fn() },
}));
beforeEach(() => {
  vi.clearAllMocks();
  useAppPreferences.setState({ locale: "en" });
  useKeyboardStore.getState().initialize(fixture());
});
function AssignedKey() {
  const key = useKeyboardStore((s) => s.project!.layout.layers[0].keys[0]);
  return <DroppableKey action={key} />;
}

it("selects bundled ABNT2, assigns cedilla, and preserves its binding when switching back to US", () => {
  render(
    <>
      <AssignedKey />
      <ActionTray />
    </>,
  );
  const original = structuredClone(useKeyboardStore.getState().savedProject);
  expect(screen.queryByRole("combobox", { name: "Keyboard language" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Languages" }));
  useKeyboardStore
    .getState()
    .selectAction({ keymapIndex: -1, row: 0, col: 0, code: "&kp A", label: "" });
  fireEvent.change(screen.getByRole("combobox", { name: "Keyboard language" }), {
    target: { value: "pt-br" },
  });
  expect(useKeyboardStore.getState().selectedAction).toBeNull();
  const key = screen.getByRole("button", { name: "Drag PT_C_CEDILLA" });
  expect(key).toHaveTextContent("Ç");
  expect(screen.getByRole("button", { name: "Drag PT_DEGREE" })).toHaveTextContent("°");
  expect(key).toHaveAttribute("aria-invalid", "false");
  fireEvent.click(key);
  fireEvent.click(screen.getByRole("button", { name: "Position 0: &kp A" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Keyboard language" }), {
    target: { value: "us" },
  });
  const state = useKeyboardStore.getState();
  expect(state.project!.layout.layers[0].keys[0].code).toBe("&kp PT_C_CEDILLA");
  expect(validateBinding("&kp PT_C_CEDILLA", state.project!, state.plugin)).toBe("");
  expect(state.project!.preamble).toContain('#include "keys_pt_abnt2.h"');
  expect(state.savedProject).toEqual(original);
  expect(screen.getByRole("button", { name: "Languages" })).toHaveClass("active");
});

it("imports another language from the palette, displays an annotated character and searches by it", async () => {
  vi.mocked(api.importHeaders).mockResolvedValue({
    name: "keys_es.h",
    files: {
      "keys_es.h": '#include "common.h"\n/* ñ */\n#define ES_NTIL SEMI\n',
      "common.h": "#define ES_EXCL LS(N1)\n",
    },
  });
  render(<ActionTray />);
  fireEvent.click(screen.getByRole("button", { name: "Languages" }));
  fireEvent.click(screen.getByRole("button", { name: "Find languages" }));
  expect(api.findLanguageHeaders).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Add language (.h)" }));
  const key = await screen.findByRole("button", { name: "Drag ES_NTIL" });
  expect(key).toHaveTextContent("ñ");
  expect(key).toHaveAttribute("aria-invalid", "false");
  expect(screen.getByRole("combobox", { name: "Keyboard language" })).toHaveValue(
    "header:keys_es.h",
  );
  expect(screen.getByRole("button", { name: "Drag ES_EXCL" })).toBeVisible();
  fireEvent.change(screen.getByRole("textbox", { name: "Search actions" }), {
    target: { value: "ñ" },
  });
  expect(screen.getByRole("button", { name: "Drag ES_NTIL" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Drag ES_NTIL" }));
  expect(useKeyboardStore.getState().selectedAction?.code).toBe("&kp ES_NTIL");
  fireEvent.change(screen.getByRole("combobox", { name: "Keyboard language" }), {
    target: { value: "us" },
  });
  expect(screen.getByRole("textbox", { name: "Search actions" })).toHaveValue("");
  expect(screen.getByRole("button", { name: "Languages" })).toHaveClass("active");
});

it("keeps Settings and palette language selectors synchronized without changing the interface language", () => {
  render(
    <>
      <KeyboardLanguageSelect label="Operating system layout" />
      <ActionTray />
    </>,
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Operating system layout" }), {
    target: { value: "pt-br" },
  });
  expect(screen.queryByRole("combobox", { name: "Keyboard language" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Languages" }));
  expect(screen.getByRole("combobox", { name: "Keyboard language" })).toHaveValue("pt-br");
  expect(screen.getByRole("button", { name: "Drag PT_C_CEDILLA" })).toBeVisible();
  expect(useAppPreferences.getState().locale).toBe("en");
});

it("leaves the project unchanged if a header import is cancelled or conflicts", async () => {
  useKeyboardStore.getState().edit((p) => {
    p.headers = { "keys_es.h": "#define ES_NTIL SEMI\n" };
  });
  const before = structuredClone(useKeyboardStore.getState().project);
  render(<ActionTray />);
  fireEvent.click(screen.getByRole("button", { name: "Languages" }));
  const importButton = screen.getByRole("button", { name: "Add language (.h)" });
  vi.mocked(api.importHeaders).mockResolvedValueOnce({ name: "", files: {} });
  fireEvent.click(importButton);
  await waitFor(() => expect(importButton).toBeEnabled());
  expect(useKeyboardStore.getState().project).toEqual(before);
  vi.mocked(api.importHeaders).mockResolvedValueOnce({
    name: "keys_es.h",
    files: { "keys_es.h": "#define ES_NTIL A\n" },
  });
  fireEvent.click(importButton);
  await waitFor(() => expect(importButton).toBeEnabled());
  expect(useKeyboardStore.getState().project).toEqual(before);
  expect(useKeyboardStore.getState().error).toContain("already exist");
});

it("uses the selected header's dependencies without mixing in another language", () => {
  useKeyboardStore.getState().edit((p) => {
    p.headers = {
      "keys_es.h": '#include "common.h"\n#define ES_NTIL SEMI\n',
      "common.h": "#define ES_EXCL LS(N1)\n",
      "keys_fr.h": "#define FR_EACUTE N2\n",
    };
    p.options.locale = "header:keys_es.h";
  });
  render(<ActionTray />);
  fireEvent.click(screen.getByRole("button", { name: "Languages" }));
  const palette = within(screen.getByRole("region", { name: "Action palette" }));
  expect(palette.getByRole("button", { name: "Drag ES_EXCL" })).toBeVisible();
  expect(palette.queryByRole("button", { name: "Drag FR_EACUTE" })).not.toBeInTheDocument();
});

it("hides Bluetooth actions and prevents assignments on a USB-only keyboard", () => {
  const session = fixture();
  session.plugin.capabilities = [];
  useKeyboardStore.getState().initialize(session);
  render(<ActionTray />);
  expect(screen.queryByRole("button", { name: "Bluetooth" })).not.toBeInTheDocument();
  expect(validateBinding("&bt BT_CLR", session.project, session.plugin)).toContain(
    "does not support Bluetooth",
  );
  useKeyboardStore.getState().updateKeyCode(0, "&bt BT_CLR");
  expect(useKeyboardStore.getState().project!.layout.layers[0].keys[0].code).toBe("&kp A");
  fireEvent.change(screen.getByRole("textbox", { name: "Search actions" }), {
    target: { value: "BT_CLR" },
  });
  expect(screen.queryByRole("button", { name: "Drag &bt BT_CLR" })).not.toBeInTheDocument();
});
