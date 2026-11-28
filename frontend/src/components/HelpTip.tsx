import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";
import { tr } from "../i18n";

export function HelpTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);
  const rect = button.current?.getBoundingClientRect();
  const width = Math.min(320, window.innerWidth - 24);
  return (
    <>
      <button
        ref={button}
        type="button"
        className="help-tip"
        aria-label={tr("Help")}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.stopPropagation();
            setOpen(false);
          }
        }}
      >
        <CircleHelp size={15} aria-hidden="true" />
      </button>
      {open &&
        rect &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            className="help-tooltip"
            style={{
              width,
              left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
              ...(rect.top > window.innerHeight / 2
                ? { bottom: window.innerHeight - rect.top + 8 }
                : { top: rect.bottom + 8 }),
            }}
          >
            {text}
          </span>,
          document.body,
        )}
    </>
  );
}
