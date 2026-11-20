import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Cable,
  Check,
  CircleCheck,
  CircleX,
  FolderOpen,
  HardDrive,
  Info,
  Keyboard,
  LoaderCircle,
  RotateCcw,
  TriangleAlert,
  Usb,
} from "lucide-react";
import { localizeMessage, tr, useLocale } from "../i18n";
import type { Build, Plugin, Volume, FlashPlan } from "../types/keyboard";
import { FlashTopology } from "./FlashTopology";
import { api, type FlashProgress } from "../services/api";

type Step = 0 | 1 | 2 | 3;
const untrackedPlan: FlashPlan = {
  supported: false,
  needsSetup: false,
  required: false,
  canFlash: true,
  needsRebuild: false,
  from: "",
  to: "",
  options: [],
  resetDevices: [],
  resetDone: {},
  firmwareDone: {},
};

export function FlashModal({
  build,
  plugin,
  onClose,
}: {
  build: Build;
  plugin: Plugin;
  onClose: () => void;
}) {
  useLocale();
  const variant = plugin.variants.find((v) => v.id === build.variantId)!;
  const available = variant.targets.filter((t) => build.artifacts.some((a) => a.targetId === t.id));
  const resetTargets = available.filter((t) => t.kind === "settings-reset");
  const firmwareTargets = available.filter((t) => t.kind !== "settings-reset");
  const [resetting, setResetting] = useState(false);
  const tracking = variant.features?.includes("pairing-migration") ?? false;
  const [plan, setPlan] = useState<FlashPlan | null>(tracking ? null : untrackedPlan);
  const [planError, setPlanError] = useState("");
  const [setupError, setSetupError] = useState("");
  const [skipDevice, setSkipDevice] = useState("");
  const [configuring, setConfiguring] = useState(false);
  const [receipt, setReceipt] = useState("");
  const targets = resetting && plan?.supported ? plan.resetDevices : firmwareTargets;
  const hasDongle = targets.some((t) => t.kind === "dongle");
  const [step, setStep] = useState<Step>(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [volume, setVolume] = useState("");
  const [manualVolume, setManualVolume] = useState<Volume | null>(null);
  const [target, setTarget] = useState("");
  const resetDevice = plan?.resetDevices.find((d) => d.id === target);
  const resetController = resetDevice
    ? resetDevice.controller
    : firmwareTargets.find((t) => t.id === target)?.controller;
  const resetTarget = resetTargets.find((t) =>
    resetController ? t.controller === resetController : !t.controller,
  );
  const [firmwareCompleted, setFirmwareCompleted] = useState<
    Record<string, "sent" | "confirmed" | "skipped">
  >({});
  const [resetCompleted, setResetCompleted] = useState<
    Record<string, "sent" | "confirmed" | "skipped">
  >({});
  const completed = resetting ? resetCompleted : firmwareCompleted;
  const setCompleted = resetting ? setResetCompleted : setFirmwareCompleted;
  const [notice, setNotice] = useState<{
    target: string;
    confirmed: boolean;
    restartOnly?: boolean;
  } | null>(null);
  const [unconfirmed, setUnconfirmed] = useState<{ target: string; detail: string } | null>(null);
  const [error, setError] = useState("");
  const [scanError, setScanError] = useState("");
  const [busy, setBusy] = useState(false);
  const [transfer, setTransfer] = useState<(FlashProgress & { changedAt: number }) | null>(null);
  const [now, setNow] = useState(Date.now());
  const [selecting, setSelecting] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const locked = busy || selecting || configuring || !plan;
  const targetName = (id: string) =>
    tr([...targets, ...(plan?.resetDevices ?? [])].find((t) => t.id === id)?.name ?? id);
  const resultKind = unconfirmed ? "unconfirmed" : notice ? "sent" : "error";
  const sendIssue = step === 3 ? (unconfirmed ? "unconfirmed" : error ? "failed" : "") : "";
  const allSent = targets.length > 0 && targets.every((t) => completed[t.id]);
  const applyPlan = (next: FlashPlan) => {
    setPlan(next);
    if (next.supported) {
      setResetCompleted(next.resetDone as Record<string, "sent" | "confirmed" | "skipped">);
      setFirmwareCompleted(next.firmwareDone as Record<string, "sent" | "confirmed" | "skipped">);
    }
  };
  useEffect(() => {
    if (!tracking) return;
    let alive = true;
    api
      .getFlashPlan(build.id)
      .then((next) => {
        if (!alive) return;
        applyPlan(next);
        setResetting(next.required && !next.canFlash);
        if (next.pending) {
          setResetting(next.pending.reset);
          setTarget(next.pending.deviceId);
          setReceipt(next.pending.receiptId);
          if (next.pending.status === "unconfirmed")
            setUnconfirmed({ target: next.pending.deviceId, detail: next.pending.detail });
          else setNotice({ target: next.pending.deviceId, confirmed: false });
          setStep(3);
        }
      })
      .catch((e) => {
        if (alive) setPlanError(String(e));
      });
    return () => {
      alive = false;
    };
  }, [build.id, tracking]);
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  const stalled = busy && transfer && now - transfer.changedAt >= 30000;
  const phaseLabels = {
    checking: "Checking the bootloader drive…",
    opening: "Opening the firmware file on the drive…",
    copying: "Copying firmware to the operating system…",
    syncing: "Waiting for the final USB write…",
    closing: "Closing the firmware file…",
  };

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [step, step === 3 ? resultKind : ""]);
  useEffect(() => {
    if (locked || (step !== 1 && step !== 2)) return;
    let alive = true;
    let pending = false;
    const scan = async () => {
      if (pending) return;
      pending = true;
      try {
        const found = await api.volumes(build.id);
        if (!alive) return;
        const available =
          manualVolume && !found.some((v) => v.path === manualVolume.path)
            ? [...found, manualVolume]
            : found;
        setVolumes(available);
        setScanError("");
        setVolume((current) =>
          available.some((v) => v.path === current)
            ? current
            : available.length === 1
              ? available[0].path
              : "",
        );
      } catch (e) {
        if (alive) setScanError(String(e));
      } finally {
        pending = false;
      }
    };
    void scan();
    const timer = setInterval(scan, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [build.id, locked, manualVolume, scanKey, step]);
  useEffect(() => {
    if (step === 2 && !volume && !locked) setStep(1);
  }, [step, volume, locked]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy && !selecting && !configuring) onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [locked, onClose]);

  const clearVolume = () => {
    setVolume("");
    setManualVolume(null);
    setVolumes([]);
    setScanError("");
    setScanKey((v) => v + 1);
  };
  const manual = async () => {
    setSelecting(true);
    setError("");
    try {
      const v = await api.selectVolume(build.id);
      if (v.path) {
        setManualVolume(v);
        setVolumes((old) => [v, ...old.filter((item) => item.path !== v.path)]);
        setVolume(v.path);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSelecting(false);
    }
  };
  const send = async () => {
    if (step !== 2 || !target || !volume || locked) return;
    if (plan?.supported && !resetting && !plan.canFlash) return;
    if (resetting && !resetTarget) return;
    setBusy(true);
    const artifactTarget = resetting && resetTarget ? resetTarget.id : target;
    setNow(Date.now());
    setTransfer({
      buildId: build.id,
      targetId: artifactTarget,
      stage: "checking",
      written: 0,
      total: 0,
      changedAt: Date.now(),
    });
    let unsubscribe = () => {};
    setError("");
    setNotice(null);
    setUnconfirmed(null);
    setCompleted((old) => Object.fromEntries(Object.entries(old).filter(([id]) => id !== target)));
    try {
      unsubscribe = api.onFlashProgress((progress) => {
        if (progress.buildId !== build.id || progress.targetId !== artifactTarget) return;
        setTransfer({ ...progress, changedAt: Date.now() });
      });
      const result = plan?.supported
        ? await api.flashDevice(build.id, target, volume, resetting)
        : await api.flash(build.id, artifactTarget, volume);
      setReceipt(result.receiptId ?? "");
      if (result.status === "unconfirmed") setUnconfirmed({ target, detail: result.detail });
      else if (result.status === "sent") {
        if (!plan?.supported || !resetting) setCompleted((old) => ({ ...old, [target]: "sent" }));
        setNotice({ target, confirmed: false });
      } else setError(tr("Unexpected transfer response. Check the keyboard before trying again."));
      if (plan?.supported) applyPlan(await api.getFlashPlan(build.id));
    } catch (e) {
      setError(String(e));
      if (plan?.supported) {
        try {
          applyPlan(await api.getFlashPlan(build.id));
        } catch {
          /* Preserve the original transfer error. */
        }
      }
    } finally {
      unsubscribe();
      clearVolume();
      setStep(3);
      setBusy(false);
    }
  };
  const confirm = async () => {
    const id = unconfirmed?.target ?? notice?.target;
    if (!id || locked) return;
    const restartOnly = resetting || !!(plan?.supported && plan.required);
    setConfiguring(true);
    try {
      if (plan?.supported) {
        await api.acknowledgeFlash(plan.pending?.buildId ?? build.id, receipt);
        applyPlan(await api.getFlashPlan(build.id));
      } else setCompleted((old) => ({ ...old, [id]: "confirmed" }));
      setNotice({ target: id, confirmed: true, restartOnly });
      setUnconfirmed(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setConfiguring(false);
    }
  };
  const restart = (retry: boolean) => {
    clearVolume();
    setError("");
    setNotice(null);
    setUnconfirmed(null);
    setReceipt("");
    if (!retry) setTarget("");
    setStep(retry ? 1 : 0);
  };
  const titles = [
    hasDongle ? tr("Which device are you flashing?") : tr("Which half are you flashing?"),
    tr("Connect {0} by USB", targetName(target)),
    tr("Review and send"),
    tr("Check the result"),
  ];
  const PanelIcon =
    step === 0
      ? Keyboard
      : step === 1
        ? Cable
        : step === 2
          ? ArrowDownToLine
          : unconfirmed
            ? TriangleAlert
            : error
              ? CircleX
              : CircleCheck;
  const selectedVolume = volumes.find((v) => v.path === volume);
  const resetNeedsAcknowledgement = !!(plan?.supported && resetting && notice && !notice.confirmed);
  const changePhase = (reset: boolean) => {
    if (locked || (!reset && plan?.supported && !plan.canFlash)) return;
    setResetting(reset);
    if (reset && !plan?.required) setResetCompleted({});
    restart(false);
  };
  const declareSetup = async (variantID: string) => {
    setConfiguring(true);
    setSetupError("");
    try {
      const next = await api.setInstalledTopology(build.id, variantID);
      applyPlan(next);
      setResetting(next.required && !next.canFlash);
    } catch (e) {
      setSetupError(String(e));
    } finally {
      setConfiguring(false);
    }
  };
  const chooseResetController = async (controller: string) => {
    setConfiguring(true);
    setError("");
    clearVolume();
    try {
      applyPlan(await api.setResetController(build.id, target, controller));
    } catch (e) {
      setError(String(e));
    } finally {
      setConfiguring(false);
    }
  };
  const reportExternal = async () => {
    setConfiguring(true);
    setSetupError("");
    try {
      applyPlan(await api.reportExternalFlash(build.id));
      setResetting(true);
      restart(false);
    } catch (e) {
      setSetupError(String(e));
    } finally {
      setConfiguring(false);
    }
  };

  const undoSetup = async () => {
    if (locked) return;
    setConfiguring(true);
    setSetupError("");
    try {
      const next = await api.undoFlashSetupSelection(build.id);
      applyPlan(next);
      setResetting(next.required && !next.canFlash);
      restart(false);
    } catch (e) {
      setSetupError(String(e));
    } finally {
      setConfiguring(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <section
        className={`modal-card flash-modal ${plan?.supported ? "with-topology" : ""} ${plan?.needsSetup ? "choosing-setup" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="flash-title"
        aria-busy={locked}
      >
        <div className="section-toolbar">
          <div>
            <h2 id="flash-title">
              {resetting ? tr("Reset keyboard pairing") : tr("Flash firmware to keyboard")}
            </h2>
            <p className="hint">
              {tr(
                hasDongle
                  ? "One device at a time. Follow the steps below."
                  : "One half at a time. Follow the steps below.",
              )}
            </p>
          </div>
          <button className="btn" disabled={busy || selecting || configuring} onClick={onClose}>
            {tr("Close")}
          </button>
        </div>

        {!plan && (
          <div className="notice flash-transfer-status" role={planError ? "alert" : "status"}>
            {planError ? localizeMessage(planError) : tr("Checking the required flashing steps…")}
          </div>
        )}
        {plan?.supported && (
          <FlashTopology
            plan={plan}
            busy={locked}
            resetting={resetting}
            onDeclare={declareSetup}
            onExternal={reportExternal}
            onPhase={changePhase}
            onUndoSetup={undoSetup}
          />
        )}
        {setupError && (
          <p className="notice error" role="alert">
            {localizeMessage(setupError)}
          </p>
        )}

        {plan && !plan.needsSetup && !plan.needsRebuild && (
          <>
            {step === 0 && resetTargets.length > 0 && !plan.required && (
              <div className="flash-mode">
                <div className="flex gap-3 flex-wrap">
                  <button
                    className={`btn ${!resetting ? "primary" : ""}`}
                    aria-pressed={!resetting}
                    onClick={() => {
                      changePhase(false);
                    }}
                  >
                    {tr("Keyboard firmware")}
                  </button>
                  <button
                    className={`btn ${resetting ? "primary" : ""}`}
                    aria-pressed={resetting}
                    onClick={() => {
                      changePhase(true);
                    }}
                  >
                    <RotateCcw size={18} />
                    {tr("Reset pairing first")}
                  </button>
                </div>
                <p className="hint mt-2">
                  {tr(
                    "For ordinary keymap updates, keep pairing. Starting a manual reset requires resetting all listed devices before their keyboard firmware.",
                  )}
                </p>
              </div>
            )}
            {resetting && !plan.required && (
              <p className="notice" role="note">
                {tr(
                  "Reset firmware clears Bluetooth bonds and stored ZMK settings, including Studio changes. Send it to each device, let it restart, then re-enter the bootloader and install its keyboard firmware. It does not erase the bootloader or your project in this app.",
                )}
              </p>
            )}

            <ol className="flash-progress" aria-label={tr("Flashing steps")}>
              {[hasDongle ? "Choose device" : "Choose half", "Connect", "Send", "Result"].map(
                (label, index) => (
                  <li
                    key={label}
                    className={`${index === step ? "current" : ""} ${index === 2 && sendIssue ? sendIssue : index < step ? "complete" : ""}`}
                    aria-current={index === step ? "step" : undefined}
                  >
                    <span className="flash-progress-number" aria-hidden="true">
                      {index === 2 && sendIssue ? (
                        unconfirmed ? (
                          <TriangleAlert size={18} />
                        ) : (
                          <CircleX size={18} />
                        )
                      ) : index < step ? (
                        <Check size={18} />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span>{tr(label)}</span>
                  </li>
                ),
              )}
            </ol>

            <section
              className={`flash-wizard-panel ${step === 3 ? resultKind : ""}`}
              aria-labelledby="flash-step-title"
            >
              <div className="flash-panel-heading">
                <PanelIcon className="flash-panel-icon" size={48} aria-hidden="true" />
                <div>
                  <p className="hint">{tr("Step {0} of {1}", step + 1, 4)}</p>
                  <h3 id="flash-step-title" tabIndex={-1} ref={heading}>
                    {titles[step]}
                  </h3>
                </div>
              </div>

              {step === 0 && (
                <>
                  <p>
                    {tr(
                      hasDongle
                        ? "Select the device you will connect. The app will choose its matching firmware."
                        : "Select the half you will connect. The app will choose its matching firmware.",
                    )}
                  </p>
                  <div
                    className="flash-targets"
                    role="group"
                    aria-label={tr(hasDongle ? "Connected device" : "Connected half")}
                  >
                    {targets.map((t) => (
                      <div key={t.id} className="flex flex-col gap-2 min-w-0">
                        <button
                          className={`btn flash-target ${target === t.id ? "primary" : ""}`}
                          aria-label={tr(t.name)}
                          aria-pressed={target === t.id}
                          onClick={() => {
                            setTarget(t.id);
                            clearVolume();
                          }}
                        >
                          {t.kind === "dongle" ? (
                            <Usb size={28} aria-hidden="true" />
                          ) : (
                            <Keyboard size={28} aria-hidden="true" />
                          )}
                          <span>{tr(t.name)}</span>
                          {completed[t.id] && (
                            <small>
                              {completed[t.id] === "skipped" ? (
                                <Info size={16} aria-hidden="true" />
                              ) : (
                                <Check size={16} aria-hidden="true" />
                              )}
                              {completed[t.id] === "skipped"
                                ? tr("Cleanup skipped")
                                : completed[t.id] === "confirmed"
                                  ? tr("Confirmed by you")
                                  : tr("File sent")}
                            </small>
                          )}
                        </button>
                        {resetting &&
                          plan.required &&
                          "retired" in t &&
                          t.retired &&
                          !completed[t.id] && (
                            <button
                              className="btn"
                              disabled={locked || !!plan.pending}
                              onClick={() => setSkipDevice(t.id)}
                            >
                              {tr("Skip cleanup for this device")}
                            </button>
                          )}
                      </div>
                    ))}
                  </div>
                  {skipDevice && (
                    <div
                      role="alertdialog"
                      aria-labelledby="skip-reset-title"
                      aria-describedby="skip-reset-warning"
                      className="notice mt-3"
                    >
                      <p>{targetName(skipDevice)}</p>
                      <strong id="skip-reset-title">
                        {tr("This device's cleanup will be skipped")}
                      </strong>
                      <p id="skip-reset-warning">
                        {tr(
                          "Keep this device powered off and disconnected while using the new setup. Before using it again, clear its pairing settings. Reusing it without cleanup may cause connection and pairing problems.",
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button className="btn" disabled={locked} onClick={() => setSkipDevice("")}>
                          {tr("Cancel")}
                        </button>
                        <button
                          autoFocus
                          className="btn primary"
                          disabled={locked}
                          onClick={async () => {
                            setConfiguring(true);
                            setSetupError("");
                            try {
                              applyPlan(await api.skipRetiredReset(build.id, skipDevice));
                              setSkipDevice("");
                            } catch (e) {
                              setSetupError(String(e));
                            } finally {
                              setConfiguring(false);
                            }
                          }}
                        >
                          {tr("I understand, skip cleanup")}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {step === 1 && (
                <>
                  {resetting &&
                    resetDevice?.retired &&
                    (resetTargets.length > 1 ||
                      (!resetDevice.controller && resetTargets.some((t) => t.controller))) && (
                      <label className="form-label mb-3">
                        {tr("Controller in the retired device")}
                        <select
                          className="field"
                          aria-label={tr("Controller in the retired device")}
                          value={resetDevice.controller ?? ""}
                          disabled={locked}
                          onChange={(e) => void chooseResetController(e.target.value)}
                        >
                          <option value="" disabled>
                            {tr("Select the actual controller")}
                          </option>
                          {resetTargets.map((t) => (
                            <option key={t.id} value={t.controller}>
                              {tr(t.name)} · {t.board}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  {resetting && !resetTarget && (
                    <p className="notice" role="alert">
                      {tr(
                        "Identify the controller before resetting. A matching UF2 family alone does not make reset firmware compatible.",
                      )}
                    </p>
                  )}

                  <p>
                    {resetting &&
                    targets.find((t) => t.id === target)?.kind === "dongle" &&
                    !firmwareTargets.some((t) => t.kind === "dongle")
                      ? tr(
                          "Connect the retired USB dongle, enter its UF2 bootloader, reset it, then disconnect it. It does not receive the final keyboard firmware.",
                        )
                      : tr(variant.instructions)}
                  </p>
                  <div className="flash-volume-state" aria-live="polite">
                    {volume ? (
                      <HardDrive size={24} aria-hidden="true" />
                    ) : (
                      <LoaderCircle className="flash-spinner" size={24} aria-hidden="true" />
                    )}
                    <span>
                      {volume ? tr("Bootloader detected") : tr("Waiting for bootloader…")}
                    </span>
                  </div>
                  <label className="form-label" htmlFor="flash-volume">
                    {tr("Bootloader volume")}
                  </label>
                  <div className="flash-drive-controls">
                    <select
                      id="flash-volume"
                      className="field"
                      disabled={locked}
                      value={volume}
                      onChange={(e) => setVolume(e.target.value)}
                    >
                      <option value="">
                        {volumes.length ? tr("Select a volume") : tr("Waiting for bootloader…")}
                      </option>
                      {volumes.map((v) => (
                        <option key={v.path} value={v.path}>
                          {v.name} — {v.path} — {v.board}
                        </option>
                      ))}
                    </select>
                    <button className="btn" disabled={locked} onClick={manual}>
                      <FolderOpen size={18} aria-hidden="true" />
                      {tr("Select volume manually")}
                    </button>
                  </div>
                  {volume && <p className="flash-volume-path">{volume}</p>}
                  {(error || scanError) && (
                    <p className="notice error" role="alert">
                      {localizeMessage(error || scanError)}
                    </p>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  {resetting && plan.supported && plan.required && !busy && (
                    <p className="notice flash-transfer-status" role="note">
                      {tr(
                        "Reset clears stored Bluetooth and Studio settings. Your saved project is kept.",
                      )}
                    </p>
                  )}
                  {busy && transfer && (
                    <div className="notice flash-transfer-status" aria-live="polite">
                      <strong>{tr(phaseLabels[transfer.stage])}</strong>
                      {transfer.total > 0 && (
                        <p>
                          {tr(
                            "{0} / {1} bytes accepted by the operating system",
                            transfer.written,
                            transfer.total,
                          )}
                        </p>
                      )}
                      <p>
                        {tr(
                          "Copied bytes do not confirm that the controller has finished flashing.",
                        )}
                      </p>
                    </div>
                  )}
                  {stalled && (
                    <div className="notice flash-transfer-status stalled" role="alert">
                      <strong>{tr("The USB transfer is taking longer than expected.")}</strong>
                      <p>
                        {tr(
                          "The operating system has not completed this step. If the device stays stuck, disconnect the selected controller, reconnect it in bootloader mode and wait for the pending transfer to return before retrying. Do not start another copy at the same time.",
                        )}
                      </p>
                      <p>
                        {tr("The app will not retry automatically or mark this device as flashed.")}
                      </p>
                    </div>
                  )}
                  <p>
                    {tr(
                      hasDongle
                        ? "Check the device and drive before sending the firmware."
                        : "Check the half and drive before sending the firmware.",
                    )}
                  </p>
                  {resetting && (
                    <strong>
                      {tr("Reset pairing")} — {resetTarget?.artifact}
                    </strong>
                  )}
                  <dl className="flash-review">
                    <div>
                      <dt>
                        <Keyboard size={20} aria-hidden="true" />
                        {tr(hasDongle ? "Connected device" : "Connected half")}
                      </dt>
                      <dd>{targetName(target)}</dd>
                    </div>
                    <div>
                      <dt>
                        <HardDrive size={20} aria-hidden="true" />
                        {tr("Bootloader volume")}
                      </dt>
                      <dd>
                        {selectedVolume?.name}
                        <span className="flash-volume-path">{volume}</span>
                      </dd>
                    </div>
                    <div>
                      <dt>
                        <ArrowDownToLine size={20} aria-hidden="true" />
                        {tr("Firmware")}
                      </dt>
                      <dd>
                        {
                          build.artifacts.find(
                            (a) =>
                              a.targetId === (resetting && resetTarget ? resetTarget.id : target),
                          )?.name
                        }
                      </dd>
                    </div>
                  </dl>
                  <div className="flash-restart-note">
                    <Info size={18} aria-hidden="true" />
                    <p>
                      {resetting
                        ? tr(
                            "Wait for the controller to restart. Confirming a restart does not verify that settings were cleared. Re-enter the bootloader and install the keyboard firmware before testing keys.",
                          )
                        : tr(
                            "The bootloader drive may disappear when the controller restarts. A final write warning can occur even if flashing worked; check the keyboard before retrying.",
                          )}
                    </p>
                  </div>
                  {scanError && (
                    <p className="notice error" role="alert">
                      {localizeMessage(scanError)}
                    </p>
                  )}
                </>
              )}

              {step === 3 && unconfirmed && (
                <div className="flash-warning" role="alert">
                  <div>
                    <strong>
                      {tr("Transfer not confirmed — {0}", targetName(unconfirmed.target))}
                    </strong>
                    <p>
                      {tr(
                        "The file copy finished, but the system could not confirm the final write. The controller may have restarted, or an I/O error may have occurred.",
                      )}
                    </p>
                    <p>
                      {resetting
                        ? tr(
                            "Wait for the controller to restart. Confirming a restart does not verify that settings were cleared. Re-enter the bootloader and install the keyboard firmware before testing keys.",
                          )
                        : plan?.supported && plan.required
                          ? tr(
                              "During migration, acknowledge this controller's restart to continue with the other devices. Test keyboard operation after all matching firmwares are installed.",
                            )
                          : tr(
                              "Wait for the keyboard to restart and test the new layout. Confirm only if it works. Otherwise, reconnect in bootloader mode and retry.",
                            )}
                    </p>
                    <details>
                      <summary>{tr("Technical details")}</summary>
                      <pre>{unconfirmed.detail}</pre>
                    </details>
                  </div>
                </div>
              )}
              {step === 3 && error && !notice && !unconfirmed && (
                <div className="flash-failure" role="alert">
                  <strong>{tr("Transfer failed — {0}", targetName(target))}</strong>
                  <p>{localizeMessage(error)}</p>
                  <p>{tr("Reconnect the selected half in bootloader mode to try again.")}</p>
                </div>
              )}
              {step === 3 && notice && (
                <div className="flash-success" role="status">
                  <div>
                    <strong>
                      {resetting
                        ? tr(
                            resetNeedsAcknowledgement
                              ? "Reset file sent — {0}"
                              : "Reset transfer acknowledged — {0}",
                            targetName(notice.target),
                          )
                        : notice.restartOnly
                          ? tr("Firmware restart acknowledged — {0}", targetName(notice.target))
                          : notice.confirmed
                            ? tr(
                                "Keyboard operation confirmed by you — {0}",
                                targetName(notice.target),
                              )
                            : tr("File sent — {0}", targetName(notice.target))}
                    </strong>
                    <p>
                      {resetting
                        ? resetNeedsAcknowledgement
                          ? tr(
                              "Wait for this controller to restart, then acknowledge it below. This does not verify that stored settings were erased.",
                            )
                          : tr(
                              "Let the controller restart, then reset the next device. After resetting all devices, install their keyboard firmware before testing keys.",
                            )
                        : notice.restartOnly
                          ? tr(
                              "Finish installing the matching firmware on all devices, then test the keyboard. A restart acknowledgement does not confirm keyboard operation.",
                            )
                          : notice.confirmed
                            ? tr(
                                "You can now connect the next half in bootloader mode, or close this window.",
                              )
                            : tr(
                                "Wait for the keyboard to restart and test the new layout. Then connect the next half in bootloader mode if needed.",
                              )}
                    </p>
                  </div>
                </div>
              )}
            </section>
            {step === 3 && error && (notice || unconfirmed) && (
              <p className="notice error" role="alert">
                {localizeMessage(error)}
              </p>
            )}

            {Object.keys(completed).length > 0 && (
              <div className="flash-completed" aria-label={tr("Transfer progress")}>
                {targets.map((t) => (
                  <span key={t.id} className={completed[t.id] ? "complete" : ""}>
                    {completed[t.id] === "skipped" ? (
                      <Info size={16} aria-hidden="true" />
                    ) : completed[t.id] ? (
                      <CircleCheck size={16} aria-hidden="true" />
                    ) : (
                      <Keyboard size={16} aria-hidden="true" />
                    )}
                    {tr(t.name)}
                    {completed[t.id] && (
                      <small>
                        {completed[t.id] === "skipped"
                          ? tr("Cleanup skipped")
                          : completed[t.id] === "confirmed"
                            ? tr("Confirmed by you")
                            : tr("File sent")}
                      </small>
                    )}
                  </span>
                ))}
              </div>
            )}

            <div className="flash-wizard-footer">
              {step < 3 && (
                <>
                  <button
                    className="btn"
                    disabled={step === 0 || locked}
                    onClick={() => {
                      setError("");
                      setStep(step === 2 ? 1 : 0);
                    }}
                  >
                    <ArrowLeft size={20} aria-hidden="true" />
                    {tr("Previous step")}
                  </button>
                  {step < 2 ? (
                    <button
                      className="btn primary"
                      disabled={
                        locked || (step === 0 ? !target : !volume || (resetting && !resetTarget))
                      }
                      onClick={() => setStep(step === 0 ? 1 : 2)}
                    >
                      {tr("Next step")}
                      <ArrowRight size={20} aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      className="btn primary flash-send-button"
                      disabled={locked || !target || !volume || (resetting && !resetTarget)}
                      onClick={send}
                    >
                      {busy ? (
                        <LoaderCircle className="flash-spinner" size={22} aria-hidden="true" />
                      ) : (
                        <ArrowDownToLine size={22} aria-hidden="true" />
                      )}
                      {busy
                        ? tr("Sending firmware…")
                        : tr("Send firmware{0}", ` — ${targetName(target)}`)}
                    </button>
                  )}
                </>
              )}
              {step === 3 && unconfirmed && (
                <>
                  <button className="btn" disabled={locked} onClick={() => restart(true)}>
                    <RotateCcw size={20} aria-hidden="true" />
                    {tr("Reconnect and retry")}
                  </button>
                  <button className="btn primary" disabled={locked} onClick={confirm}>
                    <CircleCheck size={20} aria-hidden="true" />
                    {tr(
                      resetting || (plan?.supported && plan.required)
                        ? "Controller restarted — acknowledge"
                        : "Keyboard works — confirm",
                    )}
                  </button>
                </>
              )}
              {step === 3 && error && !notice && !unconfirmed && (
                <>
                  <button className="btn" onClick={() => restart(false)}>
                    {tr("Choose another half")}
                  </button>
                  <button className="btn primary" onClick={() => restart(true)}>
                    <RotateCcw size={20} aria-hidden="true" />
                    {tr("Reconnect and retry")}
                  </button>
                </>
              )}
              {step === 3 && notice && !resetNeedsAcknowledgement && (
                <>
                  <button className="btn" onClick={allSent ? () => restart(false) : onClose}>
                    {allSent ? tr("Flash again") : tr("Close")}
                  </button>
                  <button
                    className="btn primary"
                    onClick={
                      allSent
                        ? resetting
                          ? () => {
                              setResetting(false);
                              restart(false);
                            }
                          : onClose
                        : () => restart(false)
                    }
                  >
                    {allSent ? (
                      <Check size={20} aria-hidden="true" />
                    ) : (
                      <ArrowRight size={20} aria-hidden="true" />
                    )}
                    {allSent
                      ? tr(resetting ? "Continue with keyboard firmware" : "Finish")
                      : tr(hasDongle ? "Flash next device" : "Flash next half")}
                  </button>
                </>
              )}
              {step === 3 && resetNeedsAcknowledgement && (
                <>
                  <button className="btn" disabled={locked} onClick={() => restart(true)}>
                    {tr("Reconnect and retry")}
                  </button>
                  <button className="btn primary" disabled={locked} onClick={confirm}>
                    <Check size={20} />
                    {tr("Controller restarted — acknowledge")}
                  </button>
                </>
              )}
            </div>
            <p className="flash-revision hint">
              {tr("Revision")} {build.revision.slice(0, 8)}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
