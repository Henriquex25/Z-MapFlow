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

function openModal() {
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
  fireEvent.click(screen.getByRole("button", { name: "Left" }));
  return onClose;
}
async function sendLeft() {
  const send = screen.getByRole("button", { name: "Send firmware — Left" });
  await waitFor(() => expect(send).toBeEnabled());
  fireEvent.click(send);
}

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
  expect(screen.getByRole("button", { name: "Right" })).toBeDisabled();
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
  expect(screen.getByRole("button", { name: "Send firmware — Left" })).toBeEnabled();
  vi.mocked(api.volumes).mockResolvedValue([]);
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(screen.getByRole("combobox", { name: "Bootloader volume" })).toHaveValue("");
  expect(screen.getByRole("button", { name: "Send firmware — Left" })).toBeDisabled();
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
  expect(screen.getByRole("button", { name: "Send firmware — Left" })).toBeDisabled();
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
  expect(screen.getByRole("button", { name: "Close" })).toBeEnabled();
});
