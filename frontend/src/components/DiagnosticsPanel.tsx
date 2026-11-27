import { useEffect, useRef, useState } from "react";
import { tr, useLocale, localizeMessage } from "../i18n";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { api } from "../services/api";
import { setUSBLogging, hasUSBLogging, hasManualUSBLogging } from "../utils/diagnostics";
import type { diagnostics } from "../../wailsjs/go/models";

export function DiagnosticsPanel() {
  useLocale();
  const { project, plugin, edit } = useKeyboardStore();
  const [ports, setPorts] = useState<string[]>([]);
  const [port, setPort] = useState("");
  const [capture, setCapture] = useState<diagnostics.Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [follow, setFollow] = useState(true);
  const output = useRef<HTMLPreElement>(null);
  const variant = plugin?.variants.find((v) => v.id === project?.variantId);
  const refresh = async () => {
    try {
      const p = await api.listDiagnosticPorts();
      setPorts(p);
      setPort((current) => (p.includes(current) ? current : p.length === 1 ? p[0] : ""));
      setError("");
    } catch (e) {
      setError(String(e));
    }
  };
  useEffect(() => {
    let alive = true,
      pending = false;
    void refresh();
    const poll = async () => {
      if (pending) return;
      pending = true;
      try {
        const s = await api.getDiagnostics();
        if (alive) setCapture(s);
      } catch (e) {
        if (alive) setError(String(e));
      } finally {
        pending = false;
      }
    };
    void poll();
    const timer = setInterval(poll, 500);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (follow && output.current) output.current.scrollTop = output.current.scrollHeight;
  }, [capture?.text, follow]);
  const run = async (f: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await f();
      setCapture(await api.getDiagnostics());
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="diagnostics-panel">
      <section className="resource-card">
        <h3>{tr("Firmware USB logging")}</h3>
        <p className="hint">
          {tr(
            "Enable logging only on the device you are investigating, then save, build and flash that device. No pairing reset is needed for logging alone. Disable it and flash again after diagnosis.",
          )}
        </p>
        <div className="diagnostic-targets">
          {variant?.targets
            .filter((t) => t.kind !== "settings-reset")
            .map((t) => (
              <label key={t.id}>
                <input
                  type="checkbox"
                  disabled={!!project && hasManualUSBLogging(project, t.id)}
                  checked={!!project && hasUSBLogging(project, t.id)}
                  onChange={(e) => edit((p) => setUSBLogging(p, t.id, e.target.checked))}
                />
                {tr("USB logs — {0}", tr(t.name))}
              </label>
            ))}
        </div>
        {project && variant?.targets.some((t) => hasManualUSBLogging(project, t.id)) && (
          <p className="notice">
            {tr(
              "Manual CONFIG_ZMK_USB_LOGGING flags are present. Remove those flags under Keyboard and firmware before using these logging controls.",
            )}
          </p>
        )}
        <p className="hint">
          {tr(
            "Logging increases power consumption and can change timing. This setting is compiled into firmware; it does not start a live capture by itself.",
          )}
        </p>
      </section>
      <section className="resource-card">
        <h3>{tr("Live firmware logs")}</h3>
        <p className="hint">
          {tr(
            "Connect the device by USB in normal firmware mode, not bootloader mode. Select its logging serial port, not a ZMK Studio port. Capture is receive-only at 115200 baud and continues when you switch tabs.",
          )}
        </p>
        <div className="diagnostic-controls">
          <label className="form-label">
            {tr("Serial port")}
            <select
              className="field"
              aria-label={tr("Serial port")}
              value={port}
              disabled={busy || capture?.running}
              onChange={(e) => setPort(e.target.value)}
            >
              <option value="">{tr("Select a serial port")}</option>
              {ports.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <button
            className="btn"
            disabled={busy || capture?.running}
            onClick={() => void refresh()}
          >
            {tr("Refresh ports")}
          </button>
          <button
            className="btn primary"
            disabled={busy || !port || capture?.running}
            onClick={() => void run(() => api.startDiagnostics(port))}
          >
            {tr("Start capture")}
          </button>
          <button
            className="btn"
            disabled={busy || !capture?.running}
            onClick={() => void run(api.stopDiagnostics)}
          >
            {tr("Stop capture")}
          </button>
          <button className="btn" disabled={busy} onClick={() => void run(api.clearDiagnostics)}>
            {tr("Clear logs")}
          </button>
          <button
            className="btn"
            disabled={busy || !capture?.text}
            onClick={() =>
              void run(async () => {
                const path = await api.exportDiagnostics();
                if (path) setNotice(tr("Firmware logs exported."));
              })
            }
          >
            {tr("Export firmware logs")}
          </button>
        </div>
        {!ports.length && (
          <p className="notice">
            {tr(
              "No serial ports found. Enable USB logging, build and flash the selected device, then refresh. On Linux, check your serial-port permissions; close other serial monitors.",
            )}
          </p>
        )}
        <p role="status">
          {capture?.running ? tr("Capturing — {0}", capture.port) : tr("Capture stopped")}
        </p>
        {capture?.error && (
          <p className="notice error" role="alert">
            {tr("Capture ended: {0}", localizeMessage(capture.error))}
          </p>
        )}
        {error && (
          <p className="notice error" role="alert">
            {localizeMessage(error)}
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {capture?.truncated && (
          <p className="hint">
            {tr("Only the latest 256 KiB are retained. Earlier output was discarded.")}
          </p>
        )}
        <label className="diagnostic-follow">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          {tr("Follow latest output")}
        </label>
        <pre
          ref={output}
          className="diagnostic-output"
          aria-label={tr("Firmware log output")}
          tabIndex={0}
        >
          {capture?.text || tr("Waiting for serial output…")}
        </pre>
        <p className="hint">
          {tr(
            "Capture stops before flashing or updating the app, on disconnection, or when the app closes. Logs can contain device identifiers and key events; review them before sharing.",
          )}
        </p>
      </section>
    </div>
  );
}
