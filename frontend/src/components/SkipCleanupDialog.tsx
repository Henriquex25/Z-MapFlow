import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { TriangleAlert } from "lucide-react";
import { tr, localizeMessage } from "../i18n";

export function SkipCleanupDialog({
  device,
  busy,
  error,
  onCancel,
  onAcknowledge,
}: {
  device: string;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onAcknowledge: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const acknowledge = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    acknowledge.current?.focus();
    return () => previous?.focus();
  }, []);
  return createPortal(
    <div className="modal-backdrop cleanup-warning-backdrop">
      <section
        ref={dialog}
        className="modal-card cleanup-warning"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="skip-reset-title"
        aria-describedby="skip-reset-warning"
        aria-busy={busy}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) {
            event.stopPropagation();
            onCancel();
          }
          if (event.key === "Tab") {
            const buttons =
              dialog.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
            if (!buttons?.length) {
              event.preventDefault();
              return;
            }
            const first = buttons[0],
              last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <TriangleAlert size={32} aria-hidden="true" />
        <p className="hint">{device}</p>
        <h2 id="skip-reset-title">{tr("This device's cleanup will be skipped")}</h2>
        <p id="skip-reset-warning">
          {tr(
            "Keep this device powered off and disconnected while using the new setup. Before using it again, clear its pairing settings. Reusing it without cleanup may cause connection and pairing problems.",
          )}
        </p>
        {error && (
          <p className="notice error" role="alert">
            {localizeMessage(error)}
          </p>
        )}
        <div className="cleanup-warning-actions">
          <button className="btn" disabled={busy} onClick={onCancel}>
            {tr("Cancel")}
          </button>
          <button ref={acknowledge} className="btn primary" disabled={busy} onClick={onAcknowledge}>
            {tr("I understand, skip cleanup")}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
