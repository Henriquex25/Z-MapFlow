import { useLocale } from "../i18n";
import { useEffect, useRef, useState } from "react";
import type { Plugin, ILayer } from "../types/keyboard";
import { DroppableKey } from "./DroppableKey";
import { Sensor } from "./Sensor";

// Geometry and binding order are supplied by the plugin; the renderer knows no keyboards.
export function KeyboardLayout({
  plugin,
  layer,
  selection,
  onSelect,
  fit = false,
  zoom = 1,
  onEdit,
}: {
  plugin: Plugin;
  layer: ILayer;
  selection?: number[];
  onSelect?: (index: number) => void;
  fit?: boolean;
  zoom?: number;
  onEdit?: (index: number) => void;
}) {
  useLocale();
  const unit = 62;
  const viewport = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const scale = fitScale * zoom;
  useEffect(() => {
    if (!fit || !viewport.current) return;
    const el = viewport.current;
    const resize = () => {
      const bounds = el.getBoundingClientRect();
      if (bounds.width && bounds.height) {
        setFitScale(
          Math.min(1, bounds.width / (plugin.width * unit), bounds.height / (plugin.height * unit)),
        );
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit, plugin.width, plugin.height]);
  return (
    <div ref={viewport} className={`keyboard-viewport ${fit ? "flex-1 min-h-0" : ""}`}>
      <div
        className="keyboard-canvas relative"
        style={{
          width: plugin.width * unit * scale,
          height: plugin.height * unit * scale,
        }}
      >
        <div
          className="absolute top-0 left-0"
          style={{
            width: plugin.width * unit,
            height: plugin.height * unit,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {plugin.positions.map((position) => {
            const key = layer.keys.find((k) => k.keymapIndex === position.keymapIndex);
            if (!key) return null;
            const sensor = position.sensorId
              ? layer.sensors.find((s) => s.id === position.sensorId)
              : null;
            return (
              <div
                key={position.id}
                className="absolute"
                style={{
                  left: position.x * unit,
                  top: position.y * unit,
                  width: position.width * unit - 6,
                  height: position.height * unit - 6,
                  transform: `rotate(${position.rotation}deg)`,
                }}
              >
                {sensor && !onSelect ? (
                  <Sensor sensor={sensor} />
                ) : (
                  <DroppableKey
                    action={key}
                    className="w-full h-full"
                    selected={selection?.includes(position.keymapIndex)}
                    onClick={onSelect ? () => onSelect(position.keymapIndex) : undefined}
                    onEdit={onEdit ? () => onEdit(position.keymapIndex) : undefined}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
