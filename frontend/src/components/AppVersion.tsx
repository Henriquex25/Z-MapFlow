import { useEffect, useState } from "react";
import { api } from "../services/api";
import { tr, useLocale } from "../i18n";

export function AppVersion() {
  useLocale();
  const [version, setVersion] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const info = await api.appInfo();
        if (alive) setVersion(info.version);
      } catch {
        /* Version lookup must not block the editor. */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  return version ? (
    <span
      className="app-version"
      aria-label={tr("Application version")}
      title={tr("Application version")}
    >
      v{version}
    </span>
  ) : null;
}
