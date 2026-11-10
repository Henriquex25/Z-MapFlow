import { localizeMessage, tr, useLocale } from "../i18n";
import { Toast } from "./Toast";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlashModal } from "./FlashModal";
import type { Build, Plugin } from "../types/keyboard";
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
