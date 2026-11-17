import { dongleFixture } from "../test/dongleFixture";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FlashModal } from "./FlashModal";
import { fixture } from "../test/fixtures";
import { api } from "../services/api";
import { useAppPreferences } from "../i18n";
import type { Build } from "../types/keyboard";

vi.mock("../services/api", () => ({
  api: { volumes: vi.fn(), flash: vi.fn(), selectVolume: vi.fn() },
}));
const drive = { path: "/test/UF2", name: "UF2", board: "Test" };
beforeEach(() => {
  vi.clearAllMocks();
  useAppPreferences.setState({ locale: "en" });
  vi.mocked(api.volumes).mockResolvedValue([drive]);
  vi.mocked(api.flash).mockResolvedValue({ status: "sent", detail: "" });
});
afterEach(() => vi.useRealTimers());

function openModal(connect = true) {
  const { plugin } = fixture();
  plugin.variants[0].targets.push({
    id: "right",
    name: "Right",
    board: "test",
    shield: "right",
    artifact: "right.uf2",
  });
  const build: Build = {
    id: "build",
    revision: "saved",
    pluginId: "test",
    variantId: "test",
    status: "success",
    stage: "finished",
    startedAt: "",
    finishedAt: "",
    error: "",
    logs: [],
    artifacts: [
      { targetId: "left", name: "left.uf2", size: 512, sha256: "" },
      { targetId: "right", name: "right.uf2", size: 512, sha256: "" },
    ],
  };
  const onClose = vi.fn();
  render(<FlashModal build={build} plugin={plugin} onClose={onClose} />);
  if (connect) {
    fireEvent.click(screen.getByRole("button", { name: "Left" }));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  }
  return onClose;
}
async function sendLeft() {
  const next = screen.getByRole("button", { name: "Next step" });
  await waitFor(() => expect(next).toBeEnabled());
  fireEvent.click(next);
  const send = screen.getByRole("button", { name: "Send firmware — Left" });
  await waitFor(() => expect(send).toBeEnabled());
  fireEvent.click(send);
}

it("guides the user through required selections, preserves them on back, and sends only after review", async () => {
  openModal(false);
  expect(screen.getByRole("heading", { name: "Which half are you flashing?" })).toHaveFocus();
  expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Previous step" })).toBeDisabled();
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(api.volumes).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Left" }));
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Next step" })).toBeEnabled());
  expect(screen.getByRole("heading", { name: "Connect Left by USB" })).toHaveFocus();
  expect(api.flash).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
  expect(screen.getByRole("button", { name: "Left" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Right" }));
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Next step" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  expect(screen.getByRole("heading", { name: "Review and send" })).toHaveFocus();
  expect(screen.getByText("right.uf2")).toBeInTheDocument();
  expect(screen.getByText(drive.path)).toBeInTheDocument();
  expect(api.flash).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Send firmware — Right" }));
  expect(await screen.findByRole("status")).toHaveTextContent("File sent — Right");
  expect(api.flash).toHaveBeenCalledWith("build", "right", drive.path);
});

it("returns to the connection step if the detected drive disappears during review", async () => {
  vi.useFakeTimers();
  openModal();
  await act(async () => {});
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  expect(screen.getByRole("button", { name: "Send firmware — Left" })).toBeEnabled();
  vi.mocked(api.volumes).mockResolvedValue([]);
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(screen.getByRole("heading", { name: "Connect Left by USB" })).toHaveFocus();
  expect(screen.queryByRole("button", { name: "Send firmware — Left" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
  expect(api.flash).not.toHaveBeenCalled();
});

it("keeps a final write failure unconfirmed until the user tests and confirms the keyboard", async () => {
  vi.mocked(api.flash).mockResolvedValue({
    status: "unconfirmed",
    detail: "sync /test/UF2/left.uf2: input/output error",
  });
  openModal();
  await sendLeft();
  const warning = await screen.findByRole("alert");
  expect(warning).toHaveTextContent("Transfer not confirmed — Left");
  expect(warning).toHaveTextContent("input/output error");
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.queryByText("Confirmed by you")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Right" })).not.toBeInTheDocument();
  expect(api.flash).toHaveBeenCalledTimes(1);

  // The warning remains understandable when switching language while it is open.
  act(() => useAppPreferences.getState().setLocale("pt-BR"));
  expect(warning).toHaveTextContent("Envio não confirmado — Esquerda");
  fireEvent.click(screen.getByRole("button", { name: "Teclado funcionando — confirmar" }));
  expect(screen.getByRole("status")).toHaveTextContent(
    "Funcionamento do teclado confirmado por você",
  );
  expect(screen.getByText("Confirmado por você")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Gravar próxima metade" }));
  expect(screen.getByRole("button", { name: "Direita" })).toBeEnabled();
  expect(api.flash).toHaveBeenCalledTimes(1);
});

it("allows reconnecting and retrying an unconfirmed transfer without marking it sent", async () => {
  vi.mocked(api.flash).mockResolvedValueOnce({ status: "unconfirmed", detail: "close: I/O error" });
  openModal();
  await sendLeft();
  fireEvent.click(await screen.findByRole("button", { name: "Reconnect and retry" }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  await sendLeft();
  expect(await screen.findByRole("status")).toHaveTextContent("File sent — Left");
  expect(api.flash).toHaveBeenNthCalledWith(2, "build", "left", drive.path);
});

it("does not offer confirmation for a copy interrupted before its final flush", async () => {
  vi.mocked(api.flash).mockRejectedValue(new Error("Transfer interrupted: input/output error"));
  openModal();
  await sendLeft();
  expect(await screen.findByRole("alert")).toHaveTextContent("Transfer interrupted");
  expect(
    screen.queryByRole("button", { name: "Keyboard works — confirm" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("clears a disconnected detected drive instead of retaining a stale selection", async () => {
  vi.useFakeTimers();
  openModal();
  await act(async () => {});
  expect(screen.getByRole("button", { name: "Next step" })).toBeEnabled();
  vi.mocked(api.volumes).mockResolvedValue([]);
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(screen.getByRole("combobox", { name: "Bootloader volume" })).toHaveValue("");
  expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
});

it("requires a choice when multiple volumes are present and supports a manually selected drive", async () => {
  vi.mocked(api.volumes).mockResolvedValue([
    drive,
    { ...drive, path: "/test/other", name: "Other" },
  ]);
  vi.mocked(api.selectVolume).mockResolvedValue({ ...drive, path: "/manual/UF2" });
  openModal();
  const select = screen.getByRole("combobox", { name: "Bootloader volume" });
  await waitFor(() => expect(within(select).getAllByRole("option")).toHaveLength(3));
  expect(select).toHaveValue("");
  expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Select volume manually" }));
  await waitFor(() => expect(select).toHaveValue("/manual/UF2"));
  await sendLeft();
  expect(api.flash).toHaveBeenCalledWith("build", "left", "/manual/UF2");
});

it("prevents closing or starting another transfer while sending", async () => {
  let finish!: (value: { status: string; detail: string }) => void;
  vi.mocked(api.flash).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const close = openModal();
  await sendLeft();
  expect(screen.getByRole("button", { name: "Sending firmware…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(close).not.toHaveBeenCalled();
  await act(async () => finish({ status: "sent", detail: "" }));
  for (const button of screen.getAllByRole("button", { name: "Close" })) {
    expect(button).toBeEnabled();
  }
  fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
  expect(close).toHaveBeenCalledOnce();
});

it("flashes all three dongle-profile devices through the shared wizard", async () => {
  const { plugin, build } = dongleFixture();
  render(<FlashModal build={build} plugin={plugin} onClose={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Keyboard firmware" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    screen.getByRole("heading", { name: "Which device are you flashing?" }),
  ).toBeInTheDocument();
  for (const name of ["USB dongle", "Left", "Right"])
    expect(screen.getByRole("button", { name })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "USB dongle" }));
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Next step" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  fireEvent.click(screen.getByRole("button", { name: "Send firmware — USB dongle" }));
  await screen.findByText("File sent — USB dongle");
  expect(api.flash).toHaveBeenCalledWith("build", "dongle", drive.path);
});

it("keeps reset progress separate and sends the reset artifact to each selected device", async () => {
  const { plugin, build } = dongleFixture();
  render(<FlashModal build={build} plugin={plugin} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Reset pairing first" }));
  expect(screen.getByRole("note")).toHaveTextContent("clears Bluetooth bonds");
  for (const name of ["USB dongle", "Left", "Right"]) {
    fireEvent.click(screen.getByRole("button", { name }));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Next step" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByText(/Reset pairing — reset.uf2/)).toBeInTheDocument();
    expect(screen.getByText("reset.uf2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: `Send firmware — ${name}` }));
    await screen.findByText(`Reset transfer acknowledged — ${name}`);
    if (name !== "Right")
      fireEvent.click(screen.getByRole("button", { name: "Flash next device" }));
  }
  expect(api.flash).toHaveBeenCalledTimes(3);
  for (const call of vi.mocked(api.flash).mock.calls)
    expect(call).toEqual(["build", "settings_reset", drive.path]);
  fireEvent.click(screen.getByRole("button", { name: "Continue with keyboard firmware" }));
  expect(screen.getByRole("button", { name: "Keyboard firmware" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.queryByText("File sent")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
});

it("acknowledges an uncertain reset reboot without claiming keyboard operation or resending", async () => {
  const { plugin, build } = dongleFixture();
  vi.mocked(api.flash).mockResolvedValueOnce({ status: "unconfirmed", detail: "sync: I/O error" });
  render(<FlashModal build={build} plugin={plugin} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Reset pairing first" }));
  fireEvent.click(screen.getByRole("button", { name: "Left" }));
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Next step" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  fireEvent.click(screen.getByRole("button", { name: "Send firmware — Left" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "does not verify that settings were cleared",
  );
  expect(
    screen.queryByRole("button", { name: "Keyboard works — confirm" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Controller restarted — acknowledge" }));
  expect(screen.getByRole("status")).toHaveTextContent("Reset transfer acknowledged — Left");
  expect(screen.getByRole("status")).not.toHaveTextContent("Keyboard operation confirmed");
  expect(api.flash).toHaveBeenCalledTimes(1);
});
