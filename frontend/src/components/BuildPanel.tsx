import { localizeMessage, tr, useLocale } from "../i18n";
import { Toast } from "./Toast";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Build, Plugin, Volume } from "../types/keyboard";
import { api } from "../services/api";

const statusLabels: Record<string, string> = {
  running: "Building",
  success: "Firmware ready",
  failed: "Build failed",
  cancelled: "Build cancelled",
};
const stageLabels: Record<string, string> = {
  preparing: "Preparing Docker environment",
  cache: "Waiting for access to the build cache",
  dependencies: "Preparing ZMK dependencies (the first build may take a while)",
  left: "Building left half",
  right: "Building right half",
  finished: "Completed",
  interrupted: "Interrupted",
};
export function BuildPanel({
  build,
  plugins,
  currentRevision,
  onError,
  notice = "",
  onDismissNotice,
}: {
  build: Build | null;
  plugins: Plugin[];
  currentRevision: string;
  onError: (error: unknown) => void;
  notice?: string;
  onDismissNotice?: () => void;
}) {
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [flash, setFlash] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState("");
  const [toast, setToast] = useState("");
  const closeToast = useCallback(() => setToast(""), []);
  const [history, setHistory] = useState<Build[]>([]);
  const [selected, setSelected] = useState<Build | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);
  useEffect(() => {
    api.listBuilds().then(setHistory).catch(onError);
  }, [build?.id, build?.status]);
  useEffect(() => {
    setSelected(null);
    setExported("");
  }, [build?.id]);
  const shown = selected || build;
  const plugin = plugins.find((p) => p.id === shown?.pluginId);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [shown?.logs?.length, expanded]);
  const exportFiles = async () => {
    if (!shown) return;
    setExporting(true);
    try {
      const dir = await api.exportFirmware(shown.id);
      if (dir) {
        setExported(dir);
        setToast(tr("Firmware successfully exported to {0}", dir));
      }
    } catch (e) {
      onError(e);
    } finally {
      setExporting(false);
    }
  };
  return (
    <section className="build-panel">
      <Toast message={toast} onClose={closeToast} />
      <div className="flex gap-3 items-center flex-wrap">
        <span className={`status-dot ${shown?.status || "idle"}`} />
        {(shown || !notice) && (
          <strong className="text-sm">
            {shown ? tr(statusLabels[shown.status] ?? shown.status) : tr("Ready to configure")}
          </strong>
        )}
        {notice && (
          <div className="build-notice" role="status">
            <span title={localizeMessage(notice)}>{localizeMessage(notice)}</span>
            <button aria-label={tr("Dismiss message")} onClick={onDismissNotice}>
              ×
            </button>
          </div>
        )}
        {shown && (
          <>
            <span className="hint">{tr(stageLabels[shown.stage] || shown.stage)}</span>
            <span className="badge">
              {tr("Revision")} {shown.revision.slice(0, 8)}
            </span>
            {shown.revision !== currentRevision && (
              <span className="hint text-amber-300!">
                {tr("Firmware from a different saved revision")}
              </span>
            )}
          </>
        )}
        <div className="ml-auto flex gap-2">
          {shown?.status === "running" && (
            <button className="btn" onClick={() => api.cancelBuild().catch(onError)}>
              {tr("Cancel")}{" "}
            </button>
          )}
          {shown && (
            <button className="btn" onClick={() => setExpanded((v) => !v)}>
              {expanded ? tr("Hide logs") : tr("View logs")}
            </button>
          )}
          <button className="btn" onClick={() => setShowHistory((v) => !v)}>
            {tr("History")}{" "}
          </button>
          {shown?.status === "success" && (
            <>
              <button className="btn" disabled={exporting} onClick={exportFiles}>
                {exporting ? tr("Exporting…") : tr("Export firmware")}
              </button>
              <button className="btn primary" onClick={() => setFlash(true)}>
                {tr("Flash firmware")}{" "}
              </button>
            </>
          )}
        </div>
      </div>
      {shown?.error && (
        <p className="text-sm text-rose-300 mt-2" role="alert">
          {localizeMessage(shown.error)}
        </p>
      )}
      {exported && (
        <p className="hint mt-2">
          {tr("Firmware exported to")} {exported}
        </p>
      )}
      {showHistory && (
        <div className="flex flex-wrap gap-2 mt-3">
          <button className={`btn ${!selected ? "primary" : ""}`} onClick={() => setSelected(null)}>
            {tr("Current")}{" "}
          </button>
          {history.map((b) => (
            <button
              key={b.id}
              className={`btn ${selected?.id === b.id ? "primary" : ""}`}
              onClick={() => api.getBuild(b.id).then(setSelected).catch(onError)}
            >
              {new Date(b.startedAt).toLocaleString(locale)} ·{" "}
              {tr(statusLabels[b.status] ?? b.status)} · {b.revision.slice(0, 8)}
            </button>
          ))}
          {!history.length && <span className="hint">{tr("No previous builds.")}</span>}
        </div>
      )}
      {expanded && shown && (
        <pre ref={logRef} className="build-logs" aria-label={tr("Build logs")}>
          {shown.logs?.map((line) => localizeMessage(line)).join("\n") ||
            tr("Waiting for compiler output…")}
        </pre>
      )}
      {flash && shown && plugin && (
        <FlashModal build={shown} plugin={plugin} onClose={() => setFlash(false)} />
      )}
    </section>
  );
}
function FlashModal({
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
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [volume, setVolume] = useState("");
  const [target, setTarget] = useState("");
  const [sent, setSent] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true,
      pending = false;
    const scan = async () => {
      if (pending) return;
      pending = true;
      try {
        const found = await api.volumes(build.id);
        if (alive) {
          setVolumes((previous) => [
            ...found,
            ...previous.filter((p) => !found.some((f) => f.path === p.path) && p.path === volume),
          ]);
          if (found.length === 1) setVolume((v) => v || found[0].path);
        }
      } catch (e) {
        if (alive) setError(String(e));
      } finally {
        pending = false;
      }
    };
    scan();
    const timer = setInterval(scan, 2000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [build.id, volume]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [busy, onClose]);
  const manual = async () => {
    try {
      const v = await api.selectVolume(build.id);
      if (v.path) {
        setVolumes((old) => [v, ...old.filter((x) => x.path !== v.path)]);
        setVolume(v.path);
        setError("");
      }
    } catch (e) {
      setError(String(e));
    }
  };
  const send = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.flash(build.id, target, volume);
      setSent((old) => [...new Set([...old, target])]);
      setTarget("");
      setVolume("");
      setMessage(
        tr(
          "File sent. Wait for the keyboard to restart. To continue, connect the other half in bootloader mode.",
        ),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="flash-title">
        <div className="section-toolbar">
          <h2 id="flash-title">{tr("Flash firmware to keyboard")}</h2>
          <button className="btn" disabled={busy} onClick={onClose} autoFocus>
            {tr("Close")}{" "}
          </button>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{tr(variant.instructions)}</p>
        <ol className="my-5 text-sm space-y-2">
          <li>{tr("1. Connect one half by USB and enter bootloader mode.")}</li>
          <li>{tr("2. Select the half you connected.")}</li>
          <li>{tr("3. Check the volume and send the firmware.")}</li>
        </ol>
        <div className="flex gap-3 mb-4">
          {variant.targets
            .filter((t) => build.artifacts.some((a) => a.targetId === t.id))
            .map((t) => (
              <button
                disabled={busy}
                className={`btn ${target === t.id ? "primary" : ""}`}
                key={t.id}
                onClick={() => setTarget(t.id)}
              >
                {sent.includes(t.id) ? "✓ " : ""}
                {tr(t.name)}
              </button>
            ))}
        </div>
        <label className="form-label">
          {tr("Bootloader volume")}{" "}
          <select
            className="field w-full"
            disabled={busy}
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
          >
            <option value="">
              {volumes.length
                ? tr("Select a volume")
                : tr("Waiting for a keyboard in bootloader mode…")}
            </option>
            {volumes.map((v) => (
              <option key={v.path} value={v.path}>
                {tr(v.name)} — {v.path} — {v.board}
              </option>
            ))}
          </select>
        </label>
        <button className="btn mt-3" disabled={busy} onClick={manual}>
          {tr("Select volume manually")}{" "}
        </button>
        {error && (
          <p className="notice error mt-4" role="alert">
            {localizeMessage(error)}
          </p>
        )}
        {message && (
          <p className="notice mt-4" role="status">
            {localizeMessage(message)}
          </p>
        )}
        <p className="hint mt-4">
          {tr("Revision")} {build.revision.slice(0, 8)}
          {tr(
            ". The app sends the file for the selected half. Verify that the firmware works on your keyboard.",
          )}{" "}
        </p>
        <button
          className="btn primary w-full mt-5"
          disabled={!target || !volume || busy}
          onClick={send}
        >
          {busy
            ? tr("Sending firmware…")
            : tr(
                "Send firmware{0}",
                target
                  ? ` — ${tr(variant.targets.find((t) => t.id === target)?.name ?? target)}`
                  : "",
              )}
        </button>
      </section>
    </div>
  );
}
