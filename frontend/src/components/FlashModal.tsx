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
} from "lucide-react";
import { localizeMessage, tr, useLocale } from "../i18n";
import type { Build, Plugin, Volume } from "../types/keyboard";
import { api } from "../services/api";

type Step = 0 | 1 | 2 | 3;

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
  const targets = variant.targets.filter((t) => build.artifacts.some((a) => a.targetId === t.id));
  const [step, setStep] = useState<Step>(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [volume, setVolume] = useState("");
  const [manualVolume, setManualVolume] = useState<Volume | null>(null);
  const [target, setTarget] = useState("");
  const [completed, setCompleted] = useState<Record<string, "sent" | "confirmed">>({});
  const [notice, setNotice] = useState<{ target: string; confirmed: boolean } | null>(null);
  const [unconfirmed, setUnconfirmed] = useState<{ target: string; detail: string } | null>(null);
  const [error, setError] = useState("");
  const [scanError, setScanError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const locked = busy || selecting;
  const targetName = (id: string) => tr(targets.find((t) => t.id === id)?.name ?? id);
  const resultKind = unconfirmed ? "unconfirmed" : notice ? "sent" : "error";
  const sendIssue = step === 3 ? (unconfirmed ? "unconfirmed" : error ? "failed" : "") : "";
  const allSent = targets.length > 0 && targets.every((t) => completed[t.id]);

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
      if (e.key === "Escape" && !locked) onClose();
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
    setBusy(true);
    setError("");
    setNotice(null);
    setUnconfirmed(null);
    setCompleted((old) => Object.fromEntries(Object.entries(old).filter(([id]) => id !== target)));
    try {
      const result = await api.flash(build.id, target, volume);
      if (result.status === "unconfirmed") setUnconfirmed({ target, detail: result.detail });
      else if (result.status === "sent") {
        setCompleted((old) => ({ ...old, [target]: "sent" }));
        setNotice({ target, confirmed: false });
      } else setError(tr("Unexpected transfer response. Check the keyboard before trying again."));
    } catch (e) {
      setError(String(e));
    } finally {
      clearVolume();
      setStep(3);
      setBusy(false);
    }
  };
  const confirm = () => {
    if (!unconfirmed) return;
    setCompleted((old) => ({ ...old, [unconfirmed.target]: "confirmed" }));
    setNotice({ target: unconfirmed.target, confirmed: true });
    setUnconfirmed(null);
  };
  const restart = (retry: boolean) => {
    clearVolume();
    setError("");
    setNotice(null);
    setUnconfirmed(null);
    if (!retry) setTarget("");
    setStep(retry ? 1 : 0);
  };
  const titles = [
    tr("Which half are you flashing?"),
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

  return (
    <div className="modal-backdrop">
      <section
        className="modal-card flash-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="flash-title"
        aria-busy={locked}
      >
        <div className="section-toolbar">
          <div>
            <h2 id="flash-title">{tr("Flash firmware to keyboard")}</h2>
            <p className="hint">{tr("One half at a time. Follow the steps below.")}</p>
          </div>
          <button className="btn" disabled={locked} onClick={onClose}>
            {tr("Close")}
          </button>
        </div>

        <ol className="flash-progress" aria-label={tr("Flashing steps")}>
          {["Choose half", "Connect", "Send", "Result"].map((label, index) => (
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
          ))}
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
                {tr("Select the half you will connect. The app will choose its matching firmware.")}
              </p>
              <div className="flash-targets" role="group" aria-label={tr("Connected half")}>
                {targets.map((t) => (
                  <button
                    key={t.id}
                    className={`btn flash-target ${target === t.id ? "primary" : ""}`}
                    aria-label={tr(t.name)}
                    aria-pressed={target === t.id}
                    onClick={() => {
                      setTarget(t.id);
                      clearVolume();
                    }}
                  >
                    <Keyboard size={28} aria-hidden="true" />
                    <span>{tr(t.name)}</span>
                    {completed[t.id] && (
                      <small>
                        <Check size={16} aria-hidden="true" />
                        {completed[t.id] === "confirmed" ? tr("Confirmed by you") : tr("File sent")}
                      </small>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <p>{tr(variant.instructions)}</p>
              <div className="flash-volume-state" aria-live="polite">
                {volume ? (
                  <HardDrive size={24} aria-hidden="true" />
                ) : (
                  <LoaderCircle className="flash-spinner" size={24} aria-hidden="true" />
                )}
                <span>{volume ? tr("Bootloader detected") : tr("Waiting for bootloader…")}</span>
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
              <p>{tr("Check the half and drive before sending the firmware.")}</p>
              <dl className="flash-review">
                <div>
                  <dt>
                    <Keyboard size={20} aria-hidden="true" />
                    {tr("Connected half")}
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
                  <dd>{build.artifacts.find((a) => a.targetId === target)?.name}</dd>
                </div>
              </dl>
              <div className="flash-restart-note">
                <Info size={18} aria-hidden="true" />
                <p>
                  {tr(
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
                  {tr(
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
          {step === 3 && error && (
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
                  {notice.confirmed
                    ? tr("Keyboard operation confirmed by you — {0}", targetName(notice.target))
                    : tr("File sent — {0}", targetName(notice.target))}
                </strong>
                <p>
                  {notice.confirmed
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

        {Object.keys(completed).length > 0 && (
          <div className="flash-completed" aria-label={tr("Transfer progress")}>
            {targets.map((t) => (
              <span key={t.id} className={completed[t.id] ? "complete" : ""}>
                {completed[t.id] ? (
                  <CircleCheck size={16} aria-hidden="true" />
                ) : (
                  <Keyboard size={16} aria-hidden="true" />
                )}
                {tr(t.name)}
                {completed[t.id] && (
                  <small>
                    {completed[t.id] === "confirmed" ? tr("Confirmed by you") : tr("File sent")}
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
                  disabled={locked || (step === 0 ? !target : !volume)}
                  onClick={() => setStep(step === 0 ? 1 : 2)}
                >
                  {tr("Next step")}
                  <ArrowRight size={20} aria-hidden="true" />
                </button>
              ) : (
                <button
                  className="btn primary flash-send-button"
                  disabled={locked || !target || !volume}
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
              <button className="btn" onClick={() => restart(true)}>
                <RotateCcw size={20} aria-hidden="true" />
                {tr("Reconnect and retry")}
              </button>
              <button className="btn primary" onClick={confirm}>
                <CircleCheck size={20} aria-hidden="true" />
                {tr("Keyboard works — confirm")}
              </button>
            </>
          )}
          {step === 3 && error && (
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
          {step === 3 && notice && (
            <>
              <button className="btn" onClick={allSent ? () => restart(false) : onClose}>
                {allSent ? tr("Flash again") : tr("Close")}
              </button>
              <button className="btn primary" onClick={allSent ? onClose : () => restart(false)}>
                {allSent ? (
                  <Check size={20} aria-hidden="true" />
                ) : (
                  <ArrowRight size={20} aria-hidden="true" />
                )}
                {allSent ? tr("Finish") : tr("Flash next half")}
              </button>
            </>
          )}
        </div>
        <p className="flash-revision hint">
          {tr("Revision")} {build.revision.slice(0, 8)}
        </p>
      </section>
    </div>
  );
}
