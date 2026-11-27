import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, it, expect, vi } from "vitest";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { SettingsEditor } from "./ResourceEditor";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { useAppPreferences } from "../i18n";
import { fixture } from "../test/fixtures";
import { api } from "../services/api";
vi.mock("../services/api", () => ({
  api: {
    listDiagnosticPorts: vi.fn(),
    getDiagnostics: vi.fn(),
    startDiagnostics: vi.fn(),
    stopDiagnostics: vi.fn(),
    clearDiagnostics: vi.fn(),
    exportDiagnostics: vi.fn(),
  },
}));
let state = { port: "COM42", running: false, text: "", error: "", truncated: false };
beforeEach(() => {
  vi.clearAllMocks();
  useAppPreferences.setState({ locale: "en" });
  const f = fixture();
  f.project.buildTargets = [
    { targetId: "left", snippets: ["studio-rpc-usb-uart"], cmakeArgs: ["-DCONFIG_ZMK_STUDIO=y"] },
  ];
  useKeyboardStore.getState().initialize(f);
  state = { port: "COM42", running: false, text: "", error: "", truncated: false };
  vi.mocked(api.listDiagnosticPorts).mockResolvedValue(["COM42"]);
  vi.mocked(api.getDiagnostics).mockImplementation(async () => ({ ...state }));
  vi.mocked(api.startDiagnostics).mockImplementation(async () => {
    state.running = true;
    state.text = "Connected\n";
  });
  vi.mocked(api.stopDiagnostics).mockImplementation(async () => {
    state.running = false;
  });
  vi.mocked(api.clearDiagnostics).mockImplementation(async () => {
    state.text = "";
  });
  vi.mocked(api.exportDiagnostics).mockResolvedValue("");
});
it("captures, stops, clears and distinguishes canceled export from success", async () => {
  render(<DiagnosticsPanel />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Start capture" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Start capture" }));
  await screen.findByText("Capturing — COM42");
  expect(api.startDiagnostics).toHaveBeenCalledWith("COM42");
  expect(screen.getByLabelText("Firmware log output")).toHaveTextContent("Connected");
  fireEvent.click(screen.getByRole("button", { name: "Export firmware logs" }));
  await waitFor(() => expect(api.exportDiagnostics).toHaveBeenCalled());
  expect(screen.queryByText("Firmware logs exported.")).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "Stop capture" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Stop capture" }));
  await screen.findByText("Capture stopped");
  fireEvent.click(screen.getByRole("button", { name: "Clear logs" }));
  await screen.findByText("Waiting for serial output…");
});
it("changes only the selected target snippet and preserves advanced flags and saved project", async () => {
  render(<DiagnosticsPanel />);
  const before = structuredClone(useKeyboardStore.getState().savedProject);
  fireEvent.click(screen.getByRole("checkbox", { name: "USB logs — Left" }));
  let p = useKeyboardStore.getState().project!;
  expect(p.buildTargets![0].snippets).toEqual(["studio-rpc-usb-uart", "zmk-usb-logging"]);
  expect(p.buildTargets![0].cmakeArgs).toEqual(["-DCONFIG_ZMK_STUDIO=y"]);
  expect(useKeyboardStore.getState().savedProject).toEqual(before);
  fireEvent.click(screen.getByRole("checkbox", { name: "USB logs — Left" }));
  expect(useKeyboardStore.getState().project!.buildTargets![0].snippets).toEqual([
    "studio-rpc-usb-uart",
  ]);
});
it("keeps application preferences separate and supports keyboard navigation between settings tabs", async () => {
  render(<SettingsEditor />);
  expect(screen.queryByLabelText("Interface language")).not.toBeInTheDocument();
  const before = structuredClone(useKeyboardStore.getState().project);
  fireEvent.keyDown(screen.getByRole("tab", { name: "Keyboard and firmware" }), {
    key: "ArrowRight",
  });
  expect(screen.getByRole("tab", { name: "Application" })).toHaveAttribute("aria-selected", "true");
  fireEvent.change(screen.getByLabelText("Interface language"), { target: { value: "pt-BR" } });
  expect(useKeyboardStore.getState().project).toEqual(before);
  fireEvent.click(screen.getByRole("tab", { name: "Diagnóstico" }));
  expect(await screen.findByRole("heading", { name: "Logs USB do firmware" })).toBeVisible();
});
it("shows capture errors while retaining the exported text", async () => {
  state.error = "device disconnected";
  state.text = "last packet";
  state.truncated = true;
  render(<DiagnosticsPanel />);
  expect(await screen.findByText("Capture ended: device disconnected")).toBeVisible();
  expect(screen.getByLabelText("Firmware log output")).toHaveTextContent("last packet");
  expect(screen.getByRole("button", { name: "Export firmware logs" })).toBeEnabled();
});

it("does not claim to switch off logging controlled by an advanced flag", async () => {
  useKeyboardStore.getState().edit((p) => {
    p.extraConfig = "CONFIG_ZMK_USB_LOGGING=y";
  });
  render(<DiagnosticsPanel />);
  expect(screen.getByRole("checkbox", { name: "USB logs — Left" })).toBeDisabled();
  expect(screen.getByText(/Manual CONFIG_ZMK_USB_LOGGING flags are present/)).toBeVisible();
  expect(useKeyboardStore.getState().project!.extraConfig).toBe("CONFIG_ZMK_USB_LOGGING=y");
});
