import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  Cable,
  Check,
  CircleCheck,
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
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [volume, setVolume] = useState("");
  const [manualVolume, setManualVolume] = useState<Volume | null>(null);
  const [target, setTarget] = useState("");
  const [completed, setCompleted] = useState<Record<string, "sent" | "confirmed">>({});
  const [notice, setNotice] = useState<{ target: string; confirmed: boolean } | null>(null);
  const [unconfirmed, setUnconfirmed] = useState<{ target: string; detail: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const locked = busy || selecting;
  const targetName = (id: string) => tr(targets.find((t) => t.id === id)?.name ?? id);

  useEffect(() => {
    if (locked) return;
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
        setVolume((current) =>
          available.some((v) => v.path === current)
            ? current
            : available.length === 1
              ? available[0].path
              : "",
        );
      } catch (e) {
        if (alive) setError(String(e));
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
  }, [build.id, locked, manualVolume, scanKey]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !locked) onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [locked, onClose]);

  const manual = async () => {
    setSelecting(true);
    try {
      const v = await api.selectVolume(build.id);
      if (v.path) {
        setManualVolume(v);
        setVolume(v.path);
        setError("");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setSelecting(false);
    }
  };
  const clearVolume = () => {
    setVolume("");
    setManualVolume(null);
    setVolumes([]);
    setScanKey((v) => v + 1);
  };
  const send = async () => {
    if (!target || !volume || locked || unconfirmed) return;
    setBusy(true);
    setError("");
    setNotice(null);
    // Re-sending a target invalidates its earlier completion indicator.
    setCompleted((old) => Object.fromEntries(Object.entries(old).filter(([id]) => id !== target)));
    try {
      const result = await api.flash(build.id, target, volume);
      clearVolume();
      if (result.status === "unconfirmed") {
        setUnconfirmed({ target, detail: result.detail });
      } else if (result.status === "sent") {
        setCompleted((old) => ({ ...old, [target]: "sent" }));
        setNotice({ target, confirmed: false });
        setTarget("");
      } else {
        setError(tr("Unexpected transfer response. Check the keyboard before trying again."));
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const confirm = () => {
    if (!unconfirmed) return;
    setCompleted((old) => ({ ...old, [unconfirmed.target]: "confirmed" }));
    setNotice({ target: unconfirmed.target, confirmed: true });
    setUnconfirmed(null);
    setTarget("");
    clearVolume();
  };
  const ready = Boolean(target && volume && !unconfirmed);
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
            <p className="hint">{tr("One half at a time. Connect, choose and send.")}</p>
          </div>
          <button className="btn" disabled={locked} onClick={onClose} autoFocus>
            {tr("Close")}
          </button>
        </div>

        <ol className="flash-steps" aria-label={tr("Flashing steps")}>
          <li className="flash-step">
            <span className="flash-step-number" aria-hidden="true">
              1
            </span>
            <Cable className="flash-step-icon" size={42} aria-hidden="true" />
            <h3>{tr("Connect by USB")}</h3>
            <p>{tr("Connect one half and enter bootloader mode.")}</p>
            <details className="flash-instructions">
              <summary>{tr("Bootloader instructions")}</summary>
              <p>{tr(variant.instructions)}</p>
            </details>
          </li>
          <li className={`flash-step ${target ? "ready" : ""}`}>
            <span className="flash-step-number" aria-hidden="true">
              2
            </span>
            <Keyboard className="flash-step-icon" size={42} aria-hidden="true" />
            <h3>{tr("Choose the connected half")}</h3>
            <div className="flash-targets" role="group" aria-label={tr("Connected half")}>
              {targets.map((t) => (
                <button
                  key={t.id}
                  className={`btn flash-target ${target === t.id ? "primary" : ""}`}
                  aria-label={tr(t.name)}
                  aria-pressed={target === t.id}
                  disabled={locked || !!unconfirmed}
                  onClick={() => setTarget(t.id)}
                >
                  <span>{tr(t.name)}</span>
                  {completed[t.id] && <Check size={18} aria-hidden="true" />}
                  {completed[t.id] && (
                    <small>
                      {completed[t.id] === "confirmed" ? tr("Confirmed by you") : tr("File sent")}
                    </small>
                  )}
                </button>
              ))}
            </div>
          </li>
          <li className={`flash-step ${volume ? "ready" : ""}`}>
            <span className="flash-step-number" aria-hidden="true">
              3
            </span>
            <HardDrive className="flash-step-icon" size={42} aria-hidden="true" />
            <h3>{tr("Check the bootloader drive")}</h3>
            <label className="form-label" htmlFor="flash-volume">
              {tr("Bootloader volume")}
            </label>
            <select
              id="flash-volume"
              className="field"
              disabled={locked || !!unconfirmed}
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
            <button className="btn" disabled={locked || !!unconfirmed} onClick={manual}>
              <FolderOpen size={18} aria-hidden="true" />
              {tr("Select volume manually")}
            </button>
          </li>
        </ol>

        {unconfirmed && (
          <div className="flash-warning" role="alert">
            <TriangleAlert size={26} aria-hidden="true" />
            <div>
              <h3>{tr("Transfer not confirmed — {0}", targetName(unconfirmed.target))}</h3>
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
              <div className="flash-warning-actions">
                <button className="btn primary" onClick={confirm}>
                  <CircleCheck size={20} aria-hidden="true" />
                  {tr("Keyboard works — confirm")}
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setUnconfirmed(null);
                    clearVolume();
                  }}
                >
                  <RotateCcw size={20} aria-hidden="true" />
                  {tr("Reconnect and retry")}
                </button>
              </div>
            </div>
          </div>
        )}
        {error && (
          <p className="notice error" role="alert">
            {localizeMessage(error)}
          </p>
        )}
        {notice && (
          <div className="flash-success" role="status">
            <CircleCheck size={24} aria-hidden="true" />
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

        <div className="flash-restart-note">
          <Info size={18} aria-hidden="true" />
          <p>
            {tr(
              "The bootloader drive may disappear when the controller restarts. A final write warning can occur even if flashing worked; check the keyboard before retrying.",
            )}
          </p>
        </div>
        {!unconfirmed && (
          <div className="flash-send">
            {!ready && !busy && (
              <p className="hint">
                {!target
                  ? tr("Choose the connected half to continue.")
                  : tr("Connect in bootloader mode and select its drive to continue.")}
              </p>
            )}
            <button
              className="btn primary flash-send-button"
              disabled={!ready || locked}
              onClick={send}
            >
              {busy ? (
                <LoaderCircle className="flash-spinner" size={24} aria-hidden="true" />
              ) : (
                <ArrowDownToLine size={24} aria-hidden="true" />
              )}
              {busy
                ? tr("Sending firmware…")
                : tr("Send firmware{0}", target ? ` — ${targetName(target)}` : "")}
            </button>
          </div>
        )}
        <p className="flash-revision hint">
          {tr("Revision")} {build.revision.slice(0, 8)}
        </p>
      </section>
    </div>
  );
}
