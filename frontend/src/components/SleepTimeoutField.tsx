import { useEffect, useRef, useState } from "react";
import { localizeMessage, tr, useLocale } from "../i18n";
import { api } from "../services/api";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { useDraftError } from "../utils/useDraftError";

const validationKey = "pending:sleep-timeout";
let requestSequence = 0;

export function SleepTimeoutField() {
  useLocale();
  const value = useKeyboardStore((s) => s.project?.options.sleepTimeoutMs ?? 900000);
  const initial = useKeyboardStore((s) => s.initialProject);
  const [draft, setDraft] = useState(String(value / 60000));
  const [error, setError] = useState("");
  const pending = useKeyboardStore((s) => !!s.draftErrors[validationKey]);
  const mounted = useRef(true);
  const awaiting = useRef(false);
  useDraftError(localizeMessage(error));
  useEffect(() => {
    setDraft(String(value / 60000));
    setError("");
  }, [value, initial]);
  useEffect(() => {
    if (!pending && awaiting.current) {
      awaiting.current = false;
      setDraft(String(value / 60000));
      setError("");
    }
  }, [pending, value]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function change(text: string) {
    const current = ++requestSequence;
    setDraft(text);
    awaiting.current = false;
    useKeyboardStore.getState().setDraftError(validationKey, "");
    const minutes = Number(text);
    if (!text.trim() || !Number.isFinite(minutes) || minutes < 1 / 60 || minutes > 1440) {
      setError("Use a sleep timeout between 1 second and 24 hours.");
      return;
    }
    setError("");
    // Keep saving blocked even if the user switches tabs before Go responds.
    // Import/discard clear this marker, cancelling the pending edit as well.
    awaiting.current = true;
    useKeyboardStore.getState().setDraftError(validationKey, tr("Checking sleep timeout…"));
    try {
      const milliseconds = await api.sleepTimeoutMilliseconds(minutes);
      const state = useKeyboardStore.getState();
      if (
        current !== requestSequence ||
        !state.draftErrors[validationKey] ||
        state.initialProject !== initial ||
        state.project?.options.sleepTimeoutMs !== value
      ) {
        if (current === requestSequence && mounted.current) {
          awaiting.current = false;
          setDraft(String((state.project?.options.sleepTimeoutMs ?? value) / 60000));
        }
        return;
      }
      awaiting.current = false;
      state.edit((p) => {
        p.options.sleepTimeoutMs = milliseconds;
      });
    } catch (e) {
      const state = useKeyboardStore.getState();
      if (
        current === requestSequence &&
        state.draftErrors[validationKey] &&
        state.initialProject === initial
      ) {
        awaiting.current = false;
        const message = e instanceof Error ? e.message : String(e);
        if (mounted.current) setError(message);
        else useKeyboardStore.setState({ error: message });
      }
    } finally {
      if (current === requestSequence) useKeyboardStore.getState().setDraftError(validationKey, "");
    }
  }
  return (
    <label className="form-label">
      {tr("Sleep timeout (minutes)")}
      <input
        className={`field w-28${error ? " invalid-field" : ""}`}
        type="number"
        min={1 / 60}
        max={1440}
        step="any"
        value={draft}
        aria-invalid={!!error}
        aria-busy={pending}
        onChange={(e) => void change(e.target.value)}
      />
      {error && (
        <span className="binding-error" role="alert">
          {localizeMessage(error)}
        </span>
      )}
    </label>
  );
}
