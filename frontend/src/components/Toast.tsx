import { localizeMessage } from "../i18n";
import { tr, useLocale } from "../i18n";
import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useLocale();
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 6500);
    return () => clearTimeout(timer);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div className="toast-success" role="status" aria-live="polite">
      <CheckCircle2 size={20} aria-hidden="true" />
      <span>{localizeMessage(message)}</span>
      <button className="icon-button" aria-label={tr("Dismiss notification")} onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}
