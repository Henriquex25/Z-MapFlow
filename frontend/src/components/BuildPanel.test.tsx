import { dongleFixture } from "../test/dongleFixture";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    onFlashProgress: vi.fn(() => () => {}),
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

it("keeps the opened flash wizard bound to its original build when another result arrives", async () => {
  const { plugin, build } = dongleFixture();
  const props = { build, plugins: [plugin], currentRevision: "saved", onError: vi.fn() };
  const view = render(<BuildPanel {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Flash firmware" }));
  const dialog = screen.getByRole("dialog");
  view.rerender(
    <BuildPanel
      {...props}
      build={{ ...build, id: "new-build", revision: "new-revision" }}
      plugins={[]}
    />,
  );
  expect(within(dialog).getByText(/Revision saved/)).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole("button", { name: "Left" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Next step" }));
  await waitFor(() =>
    expect(within(dialog).getByRole("button", { name: "Next step" })).toBeEnabled(),
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Next step" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Send firmware — Left" }));
  await within(dialog).findByText("File sent — Left");
  expect(api.flash).toHaveBeenCalledWith(build.id, "left", "/test/UF2");
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
  expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Send firmware" })).not.toBeInTheDocument();
  async function review() {
    const next = screen.getByRole("button", { name: "Next step" });
    await waitFor(() => expect(next).toBeEnabled());
    fireEvent.click(next);
  }
  fireEvent.click(screen.getByRole("button", { name: "Left" }));
  await review(); // Select half → connect.
  await review(); // Detect volume → review.
  vi.mocked(api.flash).mockRejectedValueOnce(new Error("Reconecte o volume"));
  fireEvent.click(screen.getByRole("button", { name: "Send firmware — Left" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Reconecte o volume");
  fireEvent.click(screen.getByRole("button", { name: "Reconnect and retry" }));
  await review();
  fireEvent.click(screen.getByRole("button", { name: "Send firmware — Left" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("File sent"));
  expect(api.flash).toHaveBeenLastCalledWith("123", "left", "/test/UF2");
  fireEvent.click(screen.getByRole("button", { name: "Flash next half" }));
  fireEvent.click(screen.getByRole("button", { name: "Right" }));
  await review();
  await review();
  fireEvent.click(screen.getByRole("button", { name: "Send firmware — Right" }));
  await waitFor(() => expect(api.flash).toHaveBeenLastCalledWith("123", "right", "/test/UF2"));
  expect(await screen.findByRole("button", { name: "Finish" })).toBeEnabled();
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

it("uses plugin target names for additional firmware build stages", async () => {
  const s = dongleFixture();
  const target = s.plugin.variants[1].targets[0];
  target.id = "receiver_custom";
  const build = { ...s.build, status: "running", stage: "receiver_custom" };
  render(
    <BuildPanel build={build} plugins={[s.plugin]} currentRevision="saved" onError={vi.fn()} />,
  );
  expect(screen.getByText("Building USB dongle")).toBeInTheDocument();
});
