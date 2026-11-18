import { ResourceVisibility } from "../utils/resourceVisibility";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { tr, useLocale } from "../i18n";

export function BehaviorCard({
  name,
  toolbar,
  children,
}: {
  name: string;
  toolbar: ReactNode;
  children: ReactNode;
}) {
  useLocale();
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (expanded) return;
    const duration = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 240;
    const timer = setTimeout(() => setMounted(false), duration);
    return () => clearTimeout(timer);
  }, [expanded]);
  const id = useId();
  const body = useRef<HTMLDivElement>(null);
  return (
    <article className={`resource-card behavior-card${expanded ? " expanded" : ""}`}>
      <div className="behavior-toolbar">
        <button
          className="btn icon-btn behavior-toggle"
          aria-expanded={expanded}
          aria-controls={id}
          aria-label={tr(expanded ? "Hide settings for {0}" : "Show settings for {0}", name)}
          title={tr(expanded ? "Hide settings for {0}" : "Show settings for {0}", name)}
          onClick={() => {
            // Keep invalid drafts visible and registered with save validation.
            const invalid = body.current?.querySelector<HTMLElement>(
              'input[aria-invalid="true"], textarea[aria-invalid="true"], select[aria-invalid="true"], .invalid-field',
            );
            if (expanded && invalid) {
              invalid.focus();
              return;
            }
            setMounted(true);
            setExpanded(!expanded);
          }}
        >
          <ChevronRight size={17} aria-hidden="true" />
        </button>
        {toolbar}
      </div>
      <div id={id} ref={body} aria-hidden={!expanded} inert={!expanded} className="behavior-body">
        <div className="behavior-body-clip">
          <div className="behavior-body-content">
            <ResourceVisibility.Provider value={expanded}>
              {mounted ? children : null}
            </ResourceVisibility.Provider>
          </div>
        </div>
      </div>
    </article>
  );
}
