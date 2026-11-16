import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Coffee, Star, X } from "lucide-react";
import { tr, useLocale } from "../i18n";
import { api, type CommunityKind } from "../services/api";

/** A non-modal invitation: never steals focus or interrupts editing/firmware work. */
export function CommunitySupport({ paused = false }: { paused?: boolean }) {
  useLocale();
  const [kind, setKind] = useState<CommunityKind | null>(null);
  const [available, setAvailable] = useState(false);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const answered = useRef(false);

  useEffect(() => {
    let alive = true;
    let polling = false;
    let activeMs = 0;
    let lastTick = performance.now();
    let lastActivity = lastTick;
    const started = lastTick;
    const foreground = () => document.visibilityState === "visible" && document.hasFocus();
    let wasActive = foreground();
    const activity = () => {
      lastActivity = performance.now();
    };
    const acceptStatus = (status: { prompt: string }) => {
      if (!alive || answered.current) return;
      setKind(status.prompt === "star" || status.prompt === "donation" ? status.prompt : null);
    };
    async function load() {
      try {
        acceptStatus(await api.communityStatus());
      } catch {
        // Optional invitations must never prevent the editor from loading.
      }
    }
    void load();
    const tick = async () => {
      const now = performance.now();
      const active = foreground() && now - lastActivity <= 60_000;
      if (active && wasActive) activeMs += Math.min(now - lastTick, 5_000);
      lastTick = now;
      wasActive = active;
      setAvailable(foreground() && now - started >= 60_000);
      if (activeMs < 60_000 || polling) return;
      activeMs -= 60_000;
      polling = true;
      try {
        acceptStatus(await api.recordCommunityMinute());
      } catch {
        // A storage failure disables this invitation, not the main workflow.
        if (alive) setKind(null);
      } finally {
        polling = false;
      }
    };
    const timer = window.setInterval(() => void tick(), 5_000);
    const resetForeground = () => {
      wasActive = false;
      setAvailable(false);
    };
    const events = ["pointerdown", "keydown", "wheel"] as const;
    events.forEach((name) => window.addEventListener(name, activity, { passive: true }));
    window.addEventListener("blur", resetForeground);
    document.addEventListener("visibilitychange", resetForeground);
    const checkModal = () =>
      setModal(!!document.querySelector('[role="dialog"][aria-modal="true"], .modal-backdrop'));
    checkModal();
    const observer = new MutationObserver(checkModal);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      alive = false;
      window.clearInterval(timer);
      observer.disconnect();
      events.forEach((name) => window.removeEventListener(name, activity));
      window.removeEventListener("blur", resetForeground);
      document.removeEventListener("visibilitychange", resetForeground);
    };
  }, []);

  async function respond(choice: CommunityKind, open: boolean, manual = false) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    let saved = false;
    try {
      await api.dismissCommunityPrompt(choice);
      answered.current = true;
      setKind(null);
      saved = true;
    } catch {
      setError(tr("Could not save your choice. Please try again."));
    }
    // Manual support links remain usable even if local preferences cannot be saved.
    if (open && (saved || manual)) {
      try {
        await api.openCommunityPage(choice);
      } catch {
        setError(tr("Could not open your browser. Please try again."));
      }
    }
    pending.current = false;
    setBusy(false);
  }
  const donation = kind === "donation";
  const Icon = donation ? Coffee : Star;
  const show = kind && available && !paused && !modal;
  return (
    <>
      <nav className="community-links" aria-label={tr("Support the project")}>
        <button className="btn" disabled={busy} onClick={() => void respond("star", true, true)}>
          <Star size={14} aria-hidden="true" />
          {tr("Star on GitHub")}
        </button>
        <button
          className="btn community-coffee"
          disabled={busy}
          onClick={() => void respond("donation", true, true)}
        >
          <Coffee size={14} aria-hidden="true" />
          {tr("Buy me a coffee")}
        </button>
        {error && !show && (
          <span className="community-error" role="alert">
            {error}
          </span>
        )}
      </nav>
      {show &&
        createPortal(
          <aside
            className="community-prompt"
            aria-labelledby="community-title"
            role="region"
            aria-live="polite"
          >
            <div className="community-prompt-heading">
              <Icon size={21} aria-hidden="true" />
              <h2 id="community-title">
                {tr(donation ? "Support Z-MapFlow" : "Enjoying Z-MapFlow?")}
              </h2>
              <button
                className="btn icon-btn"
                disabled={busy}
                aria-label={tr("Dismiss invitation")}
                onClick={() => void respond(kind, false)}
              >
                <X size={16} />
              </button>
            </div>
            <p>
              {tr(
                donation
                  ? "If Z-MapFlow has been useful, consider buying me a coffee to support its development."
                  : "Would you give Z-MapFlow a star on GitHub? It helps others discover the project.",
              )}
            </p>
            <p className="hint">
              {tr(
                "Either choice dismisses this invitation permanently on this computer. The buttons in the header remain available.",
              )}
            </p>
            {error && (
              <p className="community-error" role="alert">
                {error}
              </p>
            )}
            <div className="community-prompt-actions">
              <button className="btn" disabled={busy} onClick={() => void respond(kind, false)}>
                {tr("No, thanks")}
              </button>
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => void respond(kind, true)}
              >
                <Icon size={15} aria-hidden="true" />
                {tr(donation ? "Buy me a coffee" : "Star on GitHub")}
              </button>
            </div>
          </aside>,
          document.body,
        )}
    </>
  );
}
