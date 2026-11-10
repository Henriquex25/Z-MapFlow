import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { fixture } from "../test/fixtures";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { FirmwareSettings } from "./FirmwareSettings";
import { ActionTray } from "./ActionTray";
import { api } from "../services/api";
vi.mock("../services/api", () => ({ api: { importHeaders: vi.fn() } }));
beforeEach(() => {
  const s = fixture();
  s.plugin.variants[0].targets[0].role = "central";
  useKeyboardStore.getState().initialize(s);
});
it("configures Studio USB for the central target through the UI", () => {
  render(<FirmwareSettings />);
  fireEvent.click(screen.getByRole("button", { name: /^Enable Studio over USB/ }));
  const p = useKeyboardStore.getState().project!;
  expect(p.buildTargets?.[0].snippets).toContain("studio-rpc-usb-uart");
  expect(p.buildTargets?.[0].cmakeArgs).toContain("-DCONFIG_ZMK_STUDIO=y");
  expect(useKeyboardStore.getState().initialProject!.buildTargets).toBeUndefined();
});
it("imports a language with dependencies and exposes its aliases in the palette", async () => {
  vi.mocked(api.importHeaders).mockResolvedValue({
    name: "keys_es.h",
    files: {
      "keys_es.h": '#include "common.h"\n#define ES_NTIL SEMI\n',
      "common.h": "#pragma once\n#define ES_EXCL LS(N1)\n",
    },
  } as Awaited<ReturnType<typeof api.importHeaders>>);
  render(
    <>
      <FirmwareSettings />
      <ActionTray />
    </>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Import .h header" }));
  await screen.findByText("keys_es.h · 1 aliases");
  expect(useKeyboardStore.getState().project!.preamble).toContain('#include "keys_es.h"');
  expect(useKeyboardStore.getState().project!.preamble).not.toContain('#include "common.h"');
  fireEvent.click(screen.getByRole("button", { name: "Languages" }));
  const palette = within(screen.getByRole("region", { name: "Action palette" }));
  expect(palette.getByRole("button", { name: "Drag ES_NTIL" })).toBeVisible();
});
it("adds an arbitrary common flag while keeping the saved snapshot immutable", () => {
  render(<FirmwareSettings />);
  fireEvent.change(screen.getAllByRole("textbox", { name: "New Kconfig flag" })[0], {
    target: { value: "CONFIG_ZMK_STUDIO" },
  });
  fireEvent.click(screen.getAllByRole("button", { name: "Add flag" })[0]);
  expect(useKeyboardStore.getState().project!.extraConfig).toContain("CONFIG_ZMK_STUDIO=y");
  expect(useKeyboardStore.getState().initialProject!.extraConfig).toBeUndefined();
});

it("keeps separators while typing multiple snippets and CMake arguments", () => {
  render(<FirmwareSettings />);
  const snippets = screen.getAllByRole("textbox", { name: "Snippets (space-separated)" })[0];
  fireEvent.change(snippets, { target: { value: "studio-rpc-usb-uart " } });
  expect(snippets).toHaveValue("studio-rpc-usb-uart ");
  fireEvent.change(snippets, { target: { value: "studio-rpc-usb-uart usb-logging" } });
  const args = screen.getAllByRole("textbox", { name: "CMake arguments (one per line)" })[0];
  fireEvent.change(args, { target: { value: "-DCONFIG_ZMK_STUDIO=y\n" } });
  expect(args).toHaveValue("-DCONFIG_ZMK_STUDIO=y\n");
  fireEvent.change(args, { target: { value: "-DCONFIG_ZMK_STUDIO=y\n-DCONFIG_ZMK_USB=y" } });
  expect(useKeyboardStore.getState().project!.buildTargets?.[0]).toMatchObject({
    snippets: ["studio-rpc-usb-uart", "usb-logging"],
    cmakeArgs: ["-DCONFIG_ZMK_STUDIO=y", "-DCONFIG_ZMK_USB=y"],
  });
});
it("allows spaces inside quoted Kconfig strings", () => {
  useKeyboardStore.getState().edit((p) => {
    p.extraConfig = 'CONFIG_TEST_LABEL="Meu"';
  });
  render(<FirmwareSettings />);
  const value = screen.getByRole("textbox", { name: "Value of CONFIG_TEST_LABEL" });
  fireEvent.change(value, { target: { value: '"Meu ' } });
  expect(value).toHaveValue('"Meu ');
  fireEvent.change(value, { target: { value: '"Meu teclado"' } });
  expect(useKeyboardStore.getState().project!.extraConfig).toBe('CONFIG_TEST_LABEL="Meu teclado"');
});
