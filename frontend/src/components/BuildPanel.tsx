import { Toast } from "./Toast";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Build, Plugin, Volume } from "../types/keyboard";
import { api } from "../services/api";

const statusLabels: Record<string, string> = {
  running: "Compilando",
  success: "Firmware pronto",
  failed: "Falha na compilação",
  cancelled: "Compilação cancelada",
};
const stageLabels: Record<string, string> = {
  preparing: "Preparando ambiente Docker",
  cache: "Aguardando acesso ao cache de compilação",
  dependencies: "Preparando dependências ZMK (primeiro build pode demorar)",
  left: "Compilando metade esquerda",
  right: "Compilando metade direita",
  finished: "Concluído",
  interrupted: "Interrompido",
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
        setToast(`Firmware exportado com sucesso para ${dir}`);
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
            {shown ? statusLabels[shown.status] : "Pronto para configurar"}
          </strong>
        )}
        {notice && (
          <div className="build-notice" role="status">
            <span title={notice}>{notice}</span>
            <button aria-label="Fechar mensagem" onClick={onDismissNotice}>
              ×
            </button>
          </div>
        )}
        {shown && (
          <>
            <span className="hint">{stageLabels[shown.stage] || shown.stage}</span>
            <span className="badge">Revisão {shown.revision.slice(0, 8)}</span>
            {shown.revision !== currentRevision && (
              <span className="hint text-amber-300!">Firmware de outra revisão salva</span>
            )}
          </>
        )}
        <div className="ml-auto flex gap-2">
          {shown?.status === "running" && (
            <button className="btn" onClick={() => api.cancelBuild().catch(onError)}>
              Cancelar
            </button>
          )}
          {shown && (
            <button className="btn" onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Ocultar logs" : "Ver logs"}
            </button>
          )}
          <button className="btn" onClick={() => setShowHistory((v) => !v)}>
            Histórico
          </button>
          {shown?.status === "success" && (
            <>
              <button className="btn" disabled={exporting} onClick={exportFiles}>
                {exporting ? "Exportando…" : "Exportar firmware"}
              </button>
              <button className="btn primary" onClick={() => setFlash(true)}>
                Fazer flash
              </button>
            </>
          )}
        </div>
      </div>
      {shown?.error && (
        <p className="text-sm text-rose-300 mt-2" role="alert">
          {shown.error}
        </p>
      )}
      {exported && <p className="hint mt-2">Firmware exportado para {exported}</p>}
      {showHistory && (
        <div className="flex flex-wrap gap-2 mt-3">
          <button className={`btn ${!selected ? "primary" : ""}`} onClick={() => setSelected(null)}>
            Atual
          </button>
          {history.map((b) => (
            <button
              key={b.id}
              className={`btn ${selected?.id === b.id ? "primary" : ""}`}
              onClick={() => api.getBuild(b.id).then(setSelected).catch(onError)}
            >
              {new Date(b.startedAt).toLocaleString("pt-BR")} · {statusLabels[b.status]} ·{" "}
              {b.revision.slice(0, 8)}
            </button>
          ))}
          {!history.length && <span className="hint">Nenhuma compilação anterior.</span>}
        </div>
      )}
      {expanded && shown && (
        <pre ref={logRef} className="build-logs" aria-label="Logs da compilação">
          {shown.logs?.join("\n") || "Aguardando saída do compilador…"}
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
        "Arquivo enviado. Aguarde a reinicialização do teclado. Para continuar, conecte a outra metade em bootloader.",
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
          <h2 id="flash-title">Gravar firmware no teclado</h2>
          <button className="btn" disabled={busy} onClick={onClose} autoFocus>
            Fechar
          </button>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{variant.instructions}</p>
        <ol className="my-5 text-sm space-y-2">
          <li>1. Conecte uma metade por USB e ative o bootloader.</li>
          <li>2. Informe qual metade foi conectada.</li>
          <li>3. Confira o volume e envie o firmware.</li>
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
                {t.name}
              </button>
            ))}
        </div>
        <label className="form-label">
          Volume do bootloader
          <select
            className="field w-full"
            disabled={busy}
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
          >
            <option value="">
              {volumes.length ? "Selecione o volume" : "Aguardando teclado em bootloader…"}
            </option>
            {volumes.map((v) => (
              <option key={v.path} value={v.path}>
                {v.name} — {v.path} — {v.board}
              </option>
            ))}
          </select>
        </label>
        <button className="btn mt-3" disabled={busy} onClick={manual}>
          Selecionar volume manualmente
        </button>
        {error && (
          <p className="notice error mt-4" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="notice mt-4" role="status">
            {message}
          </p>
        )}
        <p className="hint mt-4">
          Revisão {build.revision.slice(0, 8)}. O aplicativo envia o arquivo correspondente à metade
          escolhida. A confirmação de funcionamento ocorre no próprio teclado.
        </p>
        <button
          className="btn primary w-full mt-5"
          disabled={!target || !volume || busy}
          onClick={send}
        >
          {busy
            ? "Enviando firmware…"
            : `Enviar firmware${target ? ` — ${variant.targets.find((t) => t.id === target)?.name}` : ""}`}
        </button>
      </section>
    </div>
  );
}
