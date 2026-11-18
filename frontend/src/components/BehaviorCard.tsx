import { ResourceVisibility } from "../utils/resourceVisibility";
import { useLayoutEffect, useId, useRef, useState, type ReactNode } from "react";
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
  const id = useId();
  const body = useRef<HTMLDivElement>(null);
  const clip = useRef<HTMLDivElement>(null);
  const startHeight = useRef(0);
  useLayoutEffect(() => {
    const element = body.current;
    if (!element || !mounted) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !element.animate) {
      if (!expanded) setMounted(false);
      return;
    }
    // Fix the content outside normal flow while the small outer wrapper changes
    // height, so every frame does not recalculate the form/keyboard grid inside.
    element.dataset.animating = "true";
    const target = expanded ? (clip.current?.getBoundingClientRect().height ?? 0) : 0;
    const animation = element.animate(
      [{ height: `${startHeight.current}px` }, { height: `${target}px` }],
      { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "both" },
    );
    animation.onfinish = () => {
      delete element.dataset.animating;
      animation.cancel();
      if (!expanded) setMounted(false);
    };
    return () => {
      animation.onfinish = null;
      animation.cancel();
      delete element.dataset.animating;
    };
  }, [expanded, mounted]);
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
            startHeight.current = body.current?.getBoundingClientRect().height ?? 0;
            setMounted(true);
            setExpanded(!expanded);
          }}
        >
          <ChevronRight size={17} aria-hidden="true" />
        </button>
        {toolbar}
      </div>
      <div
        id={id}
        ref={body}
        aria-hidden={!expanded}
        inert={!expanded}
        className="behavior-body"
        style={{ height: expanded ? "auto" : 0, visibility: mounted ? "visible" : "hidden" }}
      >
        <div ref={clip} className="behavior-body-clip">
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
