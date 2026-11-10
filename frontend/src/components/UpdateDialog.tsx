import { localizeMessage, tr, useLocale } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { isDirty, useKeyboardStore } from "../store/useKeyboardStore";
import { projectBindingError } from "../utils/bindingValidation";
import type { updates } from "../../wailsjs/go/models";

const stages: Record<string, string> = {
  checking: "Checking the version…",
  downloading: "Downloading update…",
  verifying: "Verifying integrity…",
  installing: "Installing update…",
  restarting: "Restarting Z-MapFlow…",
};
export function UpdateDialog() {
  useLocale();
  const [update, setUpdate] = useState<updates.Info | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<updates.Progress | null>(null);
  const [status, setStatus] = useState("");
  const started = useRef(false);
  const store = useKeyboardStore();
  const dirty = isDirty(store.project, store.savedProject ?? store.initialProject);
  const needsSave = !!store.project && (!store.savedProject || dirty);
  const invalid =
    Object.values(store.draftErrors)[0] ||
    (store.project ? projectBindingError(store.project, store.plugin) : "");
  const check = async () => {
    setChecking(true);
    setError("");
    try {
      const info = await api.checkUpdates();
      setStatus(
        info.available
          ? tr("Update v{0} available", info.latestVersion)
          : info.message || tr("Version {0}", info.currentVersion),
      );
      if (info.available) setUpdate(info);
    } catch (e) {
      setStatus(tr("Could not check for updates. Try again."));
    } finally {
      setChecking(false);
    }
  };
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      check();
    }
  }, []);
  useEffect(() => {
    if (!busy) return;
    let alive = true;
    const poll = async () => {
      try {
        const p = await api.updateProgress();
        if (alive) setProgress(p);
      } catch {
        /* installation promise reports errors */
      }
    };
    poll();
    const timer = setInterval(poll, 400);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [busy]);
  const install = async () => {
    if (!update || invalid || busy) return;
    setBusy(true);
    setError("");
    setProgress(null);
    try {
      const build = await api.status();
      if (build?.status === "running")
        throw new Error(tr("Wait for the firmware build to finish or cancel it before updating."));
      if (store.project && needsSave) {
        const saved = await api.save(store.project);
        store.markSaved(saved);
      }
      await api.installUpdate(update.latestVersion);
      setProgress({ stage: "restarting", downloaded: 0, total: 0 } as updates.Progress);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <>
      <button
        className="update-status"
        disabled={checking || busy}
        onClick={check}
        title={localizeMessage(status)}
        aria-label={tr("Check for updates")}
      >
        {checking ? tr("Checking for updates…") : localizeMessage(status || tr("Updates"))}
      </button>
      {update && (
        <div className="modal-backdrop update-backdrop">
          <section
            className="modal-card small"
            role="dialog"
            aria-modal="true"
            aria-labelledby="update-title"
          >
            <div className="section-toolbar">
              <h2 id="update-title">{tr("New version available")}</h2>
              <span className="badge">v{update.latestVersion}</span>
            </div>
            <p className="hint">
              {tr("Your version:")} {update.currentVersion}
              {tr(". Update to get the latest features and fixes.")}{" "}
            </p>
            {update.notes && (
              <details className="update-notes">
                <summary>{tr("What’s new in this release")}</summary>
                <pre>{update.notes}</pre>
              </details>
            )}
            {!update.supported && (
              <p className="notice">
                {localizeMessage(
                  update.message || tr("Automatic updates are not available on this system yet."),
                )}{" "}
                <a href={update.releaseUrl} target="_blank" rel="noreferrer">
                  {tr("Open releases")}{" "}
                </a>
              </p>
            )}
            {needsSave && (
              <p className="hint">
                {tr("Your configuration will be saved before installing and restarting.")}
              </p>
            )}
            {invalid && (
              <p className="binding-error" role="alert">
                {tr("Fix invalid fields before updating:")} {localizeMessage(invalid)}
              </p>
            )}
            {error && (
              <p className="notice error" role="alert">
                {localizeMessage(error)}
              </p>
            )}
            {busy && (
              <div role="status" className="update-progress">
                <p>{stages[progress?.stage ?? ""] || tr("Preparing update…")}</p>
                <progress
                  max={progress?.total || undefined}
                  value={progress?.total ? progress.downloaded : undefined}
                />
              </div>
            )}
            <div className="flex justify-end gap-3 mt-5">
              <button className="btn" disabled={busy} autoFocus onClick={() => setUpdate(null)}>
                {tr("Not now")}{" "}
              </button>
              {update.supported && (
                <button className="btn primary" disabled={busy || !!invalid} onClick={install}>
                  {busy ? tr("Updating…") : needsSave ? tr("Save and update") : tr("Update")}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
