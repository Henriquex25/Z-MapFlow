import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { FlashModal } from "./FlashModal";
import { dongleFixture } from "../test/dongleFixture";
import { api } from "../services/api";
import { useAppPreferences } from "../i18n";
import type { FlashPlan } from "../types/keyboard";

vi.mock("../services/api", () => ({
  api: {
    volumes: vi.fn(),
    selectVolume: vi.fn(),
    flash: vi.fn(),
    flashDevice: vi.fn(),
    onFlashProgress: vi.fn(() => () => {}),
    getFlashPlan: vi.fn(),
    setInstalledTopology: vi.fn(),
    undoFlashSetupSelection: vi.fn(),
    setResetController: vi.fn(),
    skipRetiredReset: vi.fn(),
    reportExternalFlash: vi.fn(),
    acknowledgeFlash: vi.fn(),
  },
}));
const drive = { path: "/simulated/UF2", name: "UF2", board: "nRF52840" };
let plan: FlashPlan;
let latestDevice = "";
function setup(returning = false) {
  const { plugin, build } = dongleFixture();
  for (const v of plugin.variants) {
    v.features = [...(v.features ?? []), "pairing-migration"];
  }
  const reset = plugin.variants[1].targets.find((t) => t.kind === "settings-reset")!;
  plugin.variants[0].targets.push(structuredClone(reset));
  if (returning) {
    build.variantId = plugin.variants[0].id;
    build.artifacts = plugin.variants[0].targets.map((t) => ({
      targetId: t.id,
      name: t.artifact,
      size: 512,
      sha256: "",
    }));
  }
  plan = {
    supported: true,
    needsSetup: false,
    required: true,
    canFlash: false,
    needsRebuild: false,
    from: returning ? "USB dongle" : "Left central",
    to: returning ? "Left central" : "USB dongle",
    options: [],
    resetDevices: plugin.variants[1].targets
      .filter((t) => t.kind !== "settings-reset")
      .map((t) => ({
        id: t.id,
        name: t.name,
        kind: t.kind ?? "",
        family: 0xada52840,
        retired: returning && t.id === "dongle",
      })),
    resetDone: {},
    firmwareDone: {},
  };
  vi.mocked(api.getFlashPlan).mockImplementation(async () => structuredClone(plan));
  vi.mocked(api.flashDevice).mockImplementation(async (_build, id, _path, reset) => {
    latestDevice = id;
    if (!reset) plan.firmwareDone[id] = "sent";
    return { status: "sent", detail: "", receiptId: `receipt-${id}` };
  });
  vi.mocked(api.acknowledgeFlash).mockImplementation(async (_build, token) => {
    if (token !== `receipt-${latestDevice}`) throw Error("invalid receipt");
    plan.resetDone[latestDevice] = "confirmed";
    plan.canFlash = plan.resetDevices.every((d) => !!plan.resetDone[d.id]);
    return structuredClone(plan);
  });
  return { plugin, build };
}
beforeEach(() => {
  vi.clearAllMocks();
  useAppPreferences.setState({ locale: "en" });
  vi.mocked(api.volumes).mockResolvedValue([drive]);
});
async function send(name: string) {
  fireEvent.click(await screen.findByRole("button", { name }));
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Next step" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Next step" }));
  fireEvent.click(screen.getByRole("button", { name: `Send firmware — ${name}` }));
}

it("makes all three reset transfers and reboot acknowledgements mandatory before final firmware", async () => {
  const { plugin, build } = setup();
  render(<FlashModal build={build} plugin={plugin} onClose={() => {}} />);
  expect(
    await screen.findByText("Pairing reset is required before keyboard firmware."),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /2\. Install keyboard firmware/ })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Keyboard firmware" })).not.toBeInTheDocument();
  for (const name of ["USB dongle", "Left", "Right"]) {
    await send(name);
    await screen.findByText(`Reset file sent — ${name}`);
    expect(screen.getByRole("button", { name: /2\. Install keyboard firmware/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Flash next device" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Controller restarted — acknowledge" }));
    await screen.findByText(`Reset transfer acknowledged — ${name}`);
    if (name !== "Right")
      fireEvent.click(screen.getByRole("button", { name: "Flash next device" }));
  }
  expect(screen.getByRole("button", { name: /2\. Install keyboard firmware/ })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Continue with keyboard firmware" }));
  await send("Left");
  await screen.findByText("File sent — Left");
  expect(api.flash).not.toHaveBeenCalled();
  expect(api.flashDevice).toHaveBeenLastCalledWith("build", "left", drive.path, false);
  expect(api.acknowledgeFlash).toHaveBeenCalledTimes(3);
});

it("includes the retired dongle in cleanup on returning, then offers only the halves for firmware", async () => {
  const { plugin, build } = setup(true);
  plan.resetDone = { dongle: "confirmed", left: "confirmed", right: "confirmed" };
  plan.canFlash = true;
  render(<FlashModal build={build} plugin={plugin} onClose={() => {}} />);
  await screen.findByText(/Reset the retired dongle too/);
  expect(screen.queryByRole("button", { name: "USB dongle" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /1\. Reset every device/ }));
  expect(screen.getByRole("button", { name: "USB dongle" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /2\. Install keyboard firmware/ }));
  expect(screen.getByRole("button", { name: "Left" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Right" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "USB dongle" })).not.toBeInTheDocument();
});

it("can acknowledge a migrated controller restart before the remaining keyboard firmware is installed", async () => {
  const { plugin, build } = setup();
  plan.resetDone = { dongle: "confirmed", left: "confirmed", right: "confirmed" };
  plan.canFlash = true;
  vi.mocked(api.flashDevice).mockResolvedValue({
    status: "unconfirmed",
    detail: "USB restart",
    receiptId: "firmware-receipt",
  });
  vi.mocked(api.acknowledgeFlash).mockImplementation(async () => {
    plan.firmwareDone.dongle = "confirmed";
    return structuredClone(plan);
  });
  render(<FlashModal build={build} plugin={plugin} onClose={() => {}} />);
  await send("USB dongle");
  await screen.findByText("Transfer not confirmed — USB dongle");
  expect(
    screen.queryByRole("button", { name: "Keyboard works — confirm" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Controller restarted — acknowledge" }));
  await screen.findByText("Firmware restart acknowledged — USB dongle");
  expect(
    screen.queryByText("Keyboard operation confirmed by you — USB dongle"),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Flash next device" })).toBeEnabled();
});

it("asks about the actual installed setup before a first tracked flash", async () => {
  const { plugin, build } = setup();
  plan.needsSetup = true;
  plan.options = [
    { variantId: "test", name: "Left central", dongle: false },
    { variantId: "dongle", name: "USB central", dongle: true },
  ];
  vi.mocked(api.setInstalledTopology).mockImplementation(async () => {
    plan.needsSetup = false;
    return structuredClone(plan);
  });
  render(<FlashModal build={build} plugin={plugin} onClose={() => {}} />);
  await screen.findByRole("heading", { name: "Which setup is installed on your keyboard now?" });
  expect(screen.queryByRole("button", { name: "Next step" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "A keyboard half is central" }));
  await screen.findByText("Pairing reset is required before keyboard firmware.");
  expect(api.setInstalledTopology).toHaveBeenCalledWith("build", "test");
  expect(api.flashDevice).not.toHaveBeenCalled();
});

it("keeps routine firmware updates on the current topology free of mandatory cleanup", async () => {
  const { plugin, build } = setup();
  plan.required = false;
  plan.canFlash = true;
  render(<FlashModal build={build} plugin={plugin} onClose={() => {}} />);
  expect(await screen.findByRole("button", { name: "Keyboard firmware" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    screen.queryByText("Pairing reset is required before keyboard firmware."),
  ).not.toBeInTheDocument();
  await send("USB dongle");
  await screen.findByText("File sent — USB dongle");
  expect(api.flashDevice).toHaveBeenCalledWith("build", "dongle", drive.path, false);
  expect(api.acknowledgeFlash).not.toHaveBeenCalled();
});

it("resumes a completed reset awaiting reboot acknowledgement without resending", async () => {
  const { plugin, build } = setup();
  latestDevice = "left";
  plan.resetDone = { dongle: "confirmed" };
  plan.pending = {
    buildId: "earlier-build",
    receiptId: "receipt-left",
    deviceId: "left",
    reset: true,
    status: "unconfirmed",
    detail: "USB final write",
  };
  vi.mocked(api.acknowledgeFlash).mockImplementation(async () => {
    plan.resetDone.left = "confirmed";
    delete plan.pending;
    return structuredClone(plan);
  });
  render(<FlashModal build={build} plugin={plugin} onClose={() => {}} />);
  await screen.findByText("Transfer not confirmed — Left");
  fireEvent.click(screen.getByRole("button", { name: "Controller restarted — acknowledge" }));
  await screen.findByText("Reset transfer acknowledged — Left");
  expect(api.acknowledgeFlash).toHaveBeenCalledWith("earlier-build", "receipt-left");
  expect(api.flashDevice).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /2\. Install keyboard firmware/ })).toBeDisabled();
});

it("refuses to advance on an acknowledgement error or a build missing reset firmware", async () => {
  const { plugin, build } = setup();
  plan.pending = {
    buildId: "build",
    receiptId: "receipt-left",
    deviceId: "left",
    reset: true,
    status: "sent",
    detail: "",
  };
  vi.mocked(api.acknowledgeFlash).mockRejectedValue(Error("could not save acknowledgement"));
  const view = render(<FlashModal build={build} plugin={plugin} onClose={() => {}} />);
  await screen.findByText("Reset file sent — Left");
  fireEvent.click(screen.getByRole("button", { name: "Controller restarted — acknowledge" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("button", { name: /2\. Install keyboard firmware/ })).toBeDisabled();
  view.unmount();
  delete plan.pending;
  plan.needsRebuild = true;
  render(<FlashModal build={build} plugin={plugin} onClose={() => {}} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("compatible current profile");
  expect(screen.queryByRole("button", { name: "Next step" })).not.toBeInTheDocument();
  expect(api.flashDevice).not.toHaveBeenCalled();
});

it.each([false, true])(
  "requires identification of an unknown retired controller (multiple reset boards: %s)",
  async (mixed) => {
    const { plugin, build } = setup(true);
    const normal = plugin.variants[0];
    const original = normal.targets.find((t) => t.kind === "settings-reset")!;
    original.controller = "nice";
    if (mixed)
      normal.targets.push({
        ...original,
        id: "reset_xiao",
        name: "Reset XIAO pairing",
        controller: "xiao",
        board: "xiao_ble//zmk",
        artifact: "xiao-reset.uf2",
      });
    build.artifacts.push({ targetId: "reset_xiao", name: "xiao-reset.uf2", size: 512, sha256: "" });
    for (const d of plan.resetDevices) if (d.id !== "dongle") d.controller = "nice";
    vi.mocked(api.setResetController).mockImplementation(async (_build, id, controller) => {
      plan.resetDevices.find((d) => d.id === id)!.controller = controller;
      return structuredClone(plan);
    });
    render(<FlashModal plugin={plugin} build={build} onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "USB dongle" }));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    await screen.findByText(/Bootloader detected/);
    expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Controller in the retired device" }), {
      target: { value: mixed ? "xiao" : "nice" },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Next step" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getAllByText(mixed ? /xiao-reset.uf2/ : /reset.uf2/)[0]).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Send firmware/ }));
    await waitFor(() =>
      expect(api.flashDevice).toHaveBeenCalledWith(build.id, "dongle", drive.path, true),
    );
  },
);

it.each(["A keyboard half is central", "I'm not sure — guide me through a full reset"])(
  "lets the user undo %s before any transfer and correct the installed setup",
  async (choice) => {
    const { plugin, build } = setup();
    plan.needsSetup = true;
    plan.required = false;
    plan.options = [
      { variantId: "test", name: "Left central", dongle: false },
      { variantId: "dongle", name: "USB central", dongle: true },
    ];
    vi.mocked(api.setInstalledTopology).mockImplementation(async (_build, id) => {
      plan.needsSetup = false;
      plan.canUndoSetup = true;
      plan.required = id !== "dongle";
      plan.canFlash = !plan.required;
      return structuredClone(plan);
    });
    vi.mocked(api.undoFlashSetupSelection).mockImplementation(async () => {
      plan.needsSetup = true;
      plan.canUndoSetup = false;
      plan.required = false;
      plan.canFlash = false;
      return structuredClone(plan);
    });
    render(<FlashModal build={build} plugin={plugin} onClose={() => {}} />);
    await screen.findByRole("heading", { name: "Which setup is installed on your keyboard now?" });
    expect(screen.getByRole("dialog")).toHaveClass("choosing-setup");
    fireEvent.click(screen.getByRole("button", { name: choice }));
    await screen.findByText("Pairing reset is required before keyboard firmware.");
    expect(screen.getByRole("dialog")).not.toHaveClass("choosing-setup");
    // The correction remains accessible even after reaching the connection step.
    fireEvent.click(screen.getByRole("button", { name: "Left" }));
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo setup choice" }));
    await screen.findByRole("heading", { name: "Which setup is installed on your keyboard now?" });
    expect(screen.queryByRole("button", { name: "Next step" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "USB dongle is central" }));
    expect(await screen.findByRole("button", { name: "Keyboard firmware" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.queryByText("Pairing reset is required before keyboard firmware."),
    ).not.toBeInTheDocument();
    expect(api.undoFlashSetupSelection).toHaveBeenCalledWith("build");
    expect(api.flashDevice).not.toHaveBeenCalled();
  },
);

it("locks undo while sending and refreshes the plan after an interrupted write", async () => {
  const { plugin, build } = setup();
  plan.canUndoSetup = true;
  let reject!: (reason: Error) => void;
  vi.mocked(api.flashDevice).mockImplementation(() => {
    plan.canUndoSetup = false;
    return new Promise((_resolve, fail) => {
      reject = fail;
    });
  });
  render(<FlashModal build={build} plugin={plugin} onClose={() => {}} />);
  await send("Left");
  expect(screen.getByRole("button", { name: "Undo setup choice" })).toBeDisabled();
  reject(new Error("Interrupted USB write"));
  await screen.findByText("Transfer failed — Left");
  expect(screen.queryByRole("button", { name: "Undo setup choice" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /2\. Install keyboard firmware/ })).toBeDisabled();
  expect(api.undoFlashSetupSelection).not.toHaveBeenCalled();
});

it("shows an undo error without hiding the required cleanup or changing progress", async () => {
  const { plugin, build } = setup();
  plan.canUndoSetup = true;
  vi.mocked(api.undoFlashSetupSelection).mockRejectedValue(new Error("Choice is locked"));
  render(<FlashModal build={build} plugin={plugin} onClose={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: "Undo setup choice" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Choice is locked");
  expect(screen.getByRole("button", { name: /2\. Install keyboard firmware/ })).toBeDisabled();
  expect(api.flashDevice).not.toHaveBeenCalled();
});

it("requires acknowledging the warning to skip retired cleanup and excludes the dongle from final firmware", async () => {
  const { plugin, build } = setup(true);
  plan.resetDone = { left: "confirmed", right: "confirmed" };
  vi.mocked(api.skipRetiredReset).mockImplementation(async () => {
    plan.resetDone.dongle = "skipped";
    plan.canFlash = true;
    return structuredClone(plan);
  });
  render(<FlashModal build={build} plugin={plugin} onClose={() => {}} />);
  fireEvent.click(await screen.findByRole("button", { name: "Skip cleanup for this device" }));
  expect(api.skipRetiredReset).not.toHaveBeenCalled();
  expect(screen.getByRole("alertdialog")).toHaveTextContent(
    "Reusing it without cleanup may cause connection and pairing problems.",
  );
  fireEvent.click(screen.getByRole("button", { name: "I understand, skip cleanup" }));
  await waitFor(() => expect(api.skipRetiredReset).toHaveBeenCalledWith("build", "dongle"));
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(screen.getAllByText("Cleanup skipped").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: /2. Install keyboard firmware/ }));
  expect(screen.queryByRole("button", { name: "USB dongle" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Left" })).toBeInTheDocument();
});
