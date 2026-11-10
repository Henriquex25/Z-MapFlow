import { StrictMode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { UpdateDialog } from "./UpdateDialog";
import { api } from "../services/api";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { fixture } from "../test/fixtures";
import type { updates } from "../../wailsjs/go/models";
vi.mock("../services/api", () => ({
  api: {
    checkUpdates: vi.fn(),
    updateProgress: vi.fn(),
    installUpdate: vi.fn(),
    status: vi.fn(),
    save: vi.fn(),
  },
}));
const available = {
  currentVersion: "1.0.0",
  latestVersion: "1.1.0",
  available: true,
  supported: true,
  releaseUrl: "https://github.com/Henriquex25/Z-MapFlow/releases/tag/v1.1.0",
  notes: "Correções",
  message: "",
} as updates.Info;
beforeEach(() => {
  vi.clearAllMocks();
  useKeyboardStore.getState().initialize(fixture());
  vi.mocked(api.checkUpdates).mockResolvedValue(available);
  vi.mocked(api.status).mockResolvedValue(null);
  vi.mocked(api.installUpdate).mockResolvedValue();
  vi.mocked(api.updateProgress).mockResolvedValue({
    stage: "downloading",
    downloaded: 1,
    total: 10,
  } as updates.Progress);
  vi.mocked(api.save).mockImplementation(async (p) => ({ ...p, revision: "new" }));
});
it("checks once on startup even under StrictMode and lets the user dismiss", async () => {
  render(
    <StrictMode>
      <UpdateDialog />
    </StrictMode>,
  );
  expect(await screen.findByRole("dialog")).toHaveTextContent("1.1.0");
  expect(api.checkUpdates).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Not now" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(api.installUpdate).not.toHaveBeenCalled();
});
it("saves pending edits before installing the selected release", async () => {
  useKeyboardStore.getState().edit((p) => {
    p.layout.layers[0].name = "Edited";
  });
  render(<UpdateDialog />);
  fireEvent.click(await screen.findByRole("button", { name: "Save and update" }));
  await waitFor(() => expect(api.installUpdate).toHaveBeenCalledWith("1.1.0"));
  expect(api.save).toHaveBeenCalledTimes(1);
  expect(vi.mocked(api.save).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(api.installUpdate).mock.invocationCallOrder[0],
  );
  expect(useKeyboardStore.getState().savedProject?.layout.layers[0].name).toBe("Edited");
  expect(screen.getByRole("button", { name: "Not now" })).toBeDisabled();
});
it("keeps the editor open when saving fails", async () => {
  useKeyboardStore.getState().edit((p) => {
    p.layout.layers[0].name = "Edited";
  });
  vi.mocked(api.save).mockRejectedValue(new Error("Disco cheio"));
  render(<UpdateDialog />);
  fireEvent.click(await screen.findByRole("button", { name: "Save and update" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Disco cheio");
  expect(api.installUpdate).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Not now" })).toBeEnabled();
});
it("prevents updating during a firmware build", async () => {
  vi.mocked(api.status).mockResolvedValue({ status: "running" } as Awaited<
    ReturnType<typeof api.status>
  >);
  render(<UpdateDialog />);
  fireEvent.click(await screen.findByRole("button", { name: "Update" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("firmware build");
  expect(api.installUpdate).not.toHaveBeenCalled();
});
it("blocks invalid drafts before saving or updating", async () => {
  useKeyboardStore.getState().setDraftError("test", "Tecla inválida");
  render(<UpdateDialog />);
  expect(await screen.findByRole("button", { name: "Update" })).toBeDisabled();
  expect(api.save).not.toHaveBeenCalled();
  act(() => useKeyboardStore.getState().setDraftError("test", ""));
  expect(screen.getByRole("button", { name: "Update" })).toBeEnabled();
});
it("reports integrity failures and allows another attempt", async () => {
  vi.mocked(api.installUpdate).mockRejectedValue(new Error("integridade não confirmada"));
  render(<UpdateDialog />);
  fireEvent.click(await screen.findByRole("button", { name: "Update" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("integridade");
  expect(screen.getByRole("button", { name: "Update" })).toBeEnabled();
});
it("keeps the editor available if the update service is unavailable", async () => {
  vi.mocked(api.checkUpdates).mockRejectedValue(new Error("Offline"));
  render(<UpdateDialog />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Check for updates" })).toHaveTextContent(
      "Could not",
    ),
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("saves an imported project even when it has no edits since import", async () => {
  const imported = fixture();
  imported.hasSaved = false;
  useKeyboardStore.getState().initialize(imported);
  render(<UpdateDialog />);
  fireEvent.click(await screen.findByRole("button", { name: "Save and update" }));
  await waitFor(() => expect(api.installUpdate).toHaveBeenCalledTimes(1));
  expect(api.save).toHaveBeenCalledTimes(1);
});
