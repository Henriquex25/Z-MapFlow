import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { BuildPanel } from "./BuildPanel";
import { fixture } from "../test/fixtures";
import { api } from "../services/api";
import type { Build } from "../types/keyboard";
vi.mock("../services/api", () => ({
  api: {
    listBuilds: vi.fn(),
    volumes: vi.fn(),
    flash: vi.fn(),
    selectVolume: vi.fn(),
    exportFirmware: vi.fn(),
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.listBuilds).mockResolvedValue([]);
  vi.mocked(api.volumes).mockResolvedValue([{ path: "/test/UF2", name: "UF2", board: "Test" }]);
  vi.mocked(api.flash).mockResolvedValue({ status: "sent", detail: "" });
});
it("requires the connected half, allows retry, and selects the corresponding artifact", async () => {
  const s = fixture();
  s.plugin.variants[0].targets.push({
    id: "right",
    name: "Right",
    board: "test",
    shield: "test_right",
    artifact: "right.uf2",
  });
  const build: Build = {
    id: "123",
    revision: "saved1",
    pluginId: "test",
    variantId: "test",
    status: "success",
    stage: "finished",
    startedAt: "2026-10-28",
    finishedAt: "2026-10-28",
    error: "",
    logs: [],
    artifacts: [
      { targetId: "left", name: "left.uf2", size: 512, sha256: "test" },
      { targetId: "right", name: "right.uf2", size: 512, sha256: "test" },
    ],
  };
  render(
    <BuildPanel build={build} plugins={[s.plugin]} currentRevision="saved1" onError={vi.fn()} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Flash firmware" }));
  const send = await screen.findByRole("button", { name: "Send firmware" });
  expect(send).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Left" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Send firmware — Left" })).toBeEnabled(),
  );
  vi.mocked(api.flash).mockRejectedValueOnce(new Error("Reconecte o volume"));
  fireEvent.click(screen.getByRole("button", { name: "Send firmware — Left" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Reconecte o volume");
  fireEvent.click(screen.getByRole("button", { name: "Send firmware — Left" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("File sent"));
  expect(api.flash).toHaveBeenLastCalledWith("123", "left", "/test/UF2");
  fireEvent.click(screen.getByRole("button", { name: "Right" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Send firmware — Right" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Send firmware — Right" }));
  await waitFor(() => expect(api.flash).toHaveBeenLastCalledWith("123", "right", "/test/UF2"));
});

it.each(["/tmp/firmwares", ""])(
  "only shows a success toast after exporting files: %s",
  async (destination) => {
    vi.mocked(api.exportFirmware).mockResolvedValue(destination);
    const build = {
      id: "export-test",
      revision: "saved1",
      pluginId: "test",
      variantId: "test",
      status: "success",
      stage: "finished",
      startedAt: "2026-10-28",
      finishedAt: "2026-10-28",
      error: "",
      logs: [],
      artifacts: [],
    } as Build;
    render(
      <BuildPanel
        build={build}
        plugins={[fixture().plugin]}
        currentRevision="saved1"
        onError={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Export firmware" }));
    await waitFor(() => expect(api.exportFirmware).toHaveBeenCalledWith("export-test"));
    if (destination) {
      expect(await screen.findByRole("status")).toHaveTextContent(
        "Firmware successfully exported to /tmp/firmwares",
      );
      fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
      expect(screen.queryByText(/Firmware successfully exported/)).not.toBeInTheDocument();
    } else {
      expect(screen.queryByText(/Firmware successfully exported/)).not.toBeInTheDocument();
    }
  },
);
