import { tr, useLocale } from "../i18n";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { GripHorizontal } from "lucide-react";

export function WorkspaceSplit({ children, palette }: { children: ReactNode; palette: ReactNode }) {
  useLocale();
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; height: number } | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [share, setShare] = useState(34);
  useEffect(() => {
    const el = host.current;
    const palette = el?.querySelector(".palette");
    if (!el || !palette) return;
    const measure = () => {
      if (el.clientHeight > 0)
        setShare(Math.round((palette.getBoundingClientRect().height / el.clientHeight) * 100));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    observer.observe(palette);
    measure();
    return () => observer.disconnect();
  }, []);
  const resize = (next: number) => {
    const available = host.current?.clientHeight ?? 700;
    setHeight(Math.round(Math.max(110, Math.min(available - 190, next))));
  };
  return (
    <div
      className="workspace-content"
      ref={host}
      style={
        { "--palette-height": height === null ? undefined : `${height}px` } as React.CSSProperties
      }
    >
      {children}
      <div
        className="workspace-splitter"
        role="separator"
        aria-label={tr("Adjust keyboard and palette space")}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={share}
        aria-valuetext={tr("{0}% of space for the palette", share)}
        tabIndex={0}
        title={tr("Drag to split space · Arrow keys to adjust · Double-click to reset")}
        onDoubleClick={() => setHeight(null)}
        onKeyDown={(e) => {
          if (e.key === "Home") {
            e.preventDefault();
            setHeight(null);
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            resize(
              (host.current?.querySelector(".palette")?.getBoundingClientRect().height ?? 260) +
                (e.key === "ArrowUp" ? 24 : -24),
            );
          }
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          drag.current = {
            y: e.clientY,
            height: host.current?.querySelector(".palette")?.getBoundingClientRect().height ?? 260,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current) resize(drag.current.height + drag.current.y - e.clientY);
        }}
        onPointerUp={(e) => {
          drag.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <GripHorizontal size={18} aria-hidden="true" />
      </div>
      {palette}
    </div>
  );
}
