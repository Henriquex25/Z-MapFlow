import { useEffect, useState } from "react";
import { api } from "../services/api";
import { tr } from "../i18n";
import type { flash } from "../../wailsjs/go/models";
export function FlashGuidance({ buildId }: { buildId: string }) {
  const [items, setItems] = useState<flash.Recommendation[]>([]);
  const [error, setError] = useState(false);
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let alive = true;
    // Older tests/integrations can omit advice; it never controls the flash gate.
    if (api.getFlashGuidance)
      void api
        .getFlashGuidance(buildId)
        .then((list) => {
          if (alive) setItems(list);
        })
        .catch(() => {
          if (alive) setError(true);
        });
    return () => {
      alive = false;
    };
  }, [buildId, generation]);
  if (error)
    return (
      <p className="notice">
        {tr("Update advice is unavailable. Update every destination device if you are unsure.")}
      </p>
    );
  if (!items.length) return null;
  return (
    <section className="flash-guidance" aria-label={tr("Which devices should I update?")}>
      <h4>{tr("Which devices should I update?")}</h4>
      <ul className="flash-guidance-devices">
        {items.map((item) => (
          <li key={item.deviceId}>
            <strong>
              {tr(item.name)} — {tr(item.update ? "Update recommended" : "No relevant changes")}
            </strong>
          </li>
        ))}
      </ul>
      <details>
        <summary>{tr("How this advice works")}</summary>
        <ul>
          {items.map((item) => (
            <li key={item.deviceId}>
              {tr(item.name)}: {tr(item.reason)}
            </li>
          ))}
        </ul>
        <p className="hint">
          {tr(
            "Advice compares firmware inputs with transfers recorded on this computer. It cannot inspect installed firmware or detect external flashes. You can still flash any destination device and close the guide after updating only the central when appropriate.",
          )}
        </p>
        <button
          className="btn"
          onClick={async () => {
            try {
              await api.forgetFlashGuidance(buildId);
              setGeneration((v) => v + 1);
            } catch {
              setError(true);
            }
          }}
        >
          {tr("Forget recorded transfers")}
        </button>
      </details>
    </section>
  );
}
