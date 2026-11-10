import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { isDirty, useKeyboardStore } from "../store/useKeyboardStore";
import { projectBindingError } from "../utils/bindingValidation";
import type { updates } from "../../wailsjs/go/models";

const stages: Record<string, string> = {
  checking: "Conferindo a versão…",
  downloading: "Baixando atualização…",
  verifying: "Conferindo a integridade…",
  installing: "Instalando atualização…",
  restarting: "Reiniciando o Z-MapFlow…",
};
export function UpdateDialog() {
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
          ? `Atualização v${info.latestVersion} disponível`
          : info.message || `Versão ${info.currentVersion}`,
      );
      if (info.available) setUpdate(info);
    } catch (e) {
      setStatus("Não foi possível verificar atualizações. Tente novamente.");
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
        throw new Error("Aguarde ou cancele a compilação antes de atualizar.");
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
        title={status}
        aria-label="Verificar atualizações"
      >
        {checking ? "Verificando atualizações…" : status || "Atualizações"}
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
              <h2 id="update-title">Nova versão disponível</h2>
              <span className="badge">v{update.latestVersion}</span>
            </div>
            <p className="hint">
              Sua versão: {update.currentVersion}. Atualize para receber as novidades e correções.
            </p>
            {update.notes && (
              <details className="update-notes">
                <summary>Novidades desta versão</summary>
                <pre>{update.notes}</pre>
              </details>
            )}
            {!update.supported && (
              <p className="notice">
                {update.message ||
                  "A atualização automática ainda não está disponível neste sistema."}{" "}
                <a href={update.releaseUrl} target="_blank" rel="noreferrer">
                  Abrir releases
                </a>
              </p>
            )}
            {needsSave && (
              <p className="hint">Sua configuração será salva antes de instalar e reiniciar.</p>
            )}
            {invalid && (
              <p className="binding-error" role="alert">
                Corrija os campos inválidos antes de atualizar: {invalid}
              </p>
            )}
            {error && (
              <p className="notice error" role="alert">
                {error}
              </p>
            )}
            {busy && (
              <div role="status" className="update-progress">
                <p>{stages[progress?.stage ?? ""] || "Preparando atualização…"}</p>
                <progress
                  max={progress?.total || undefined}
                  value={progress?.total ? progress.downloaded : undefined}
                />
              </div>
            )}
            <div className="flex justify-end gap-3 mt-5">
              <button className="btn" disabled={busy} autoFocus onClick={() => setUpdate(null)}>
                Agora não
              </button>
              {update.supported && (
                <button className="btn primary" disabled={busy || !!invalid} onClick={install}>
                  {busy ? "Atualizando…" : needsSave ? "Salvar e atualizar" : "Atualizar"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
