import { useId, useRef, useState, type ReactNode } from "react";
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
              '[aria-invalid="true"], .invalid-field, .binding-drop.is-invalid',
            );
            if (expanded && invalid) {
              invalid.focus();
              return;
            }
            setExpanded(!expanded);
          }}
        >
          <ChevronRight size={17} aria-hidden="true" />
        </button>
        {toolbar}
      </div>
      <div id={id} ref={body} hidden={!expanded} className="behavior-body">
        {expanded ? children : null}
      </div>
    </article>
  );
}
