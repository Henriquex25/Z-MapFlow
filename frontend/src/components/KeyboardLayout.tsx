import { useLocale } from "../i18n";
import { keyboardGeometry, keyboardUnit } from "../utils/keyboardGeometry";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const unit = keyboardUnit;
  const geometry = useMemo(() => keyboardGeometry(plugin), [plugin]);
  const viewport = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(1);
  const scale = fitScale * zoom;
  useEffect(() => {
    if (!fit || !viewport.current) return;
    const el = viewport.current;
    const resize = () => {
      if (el.clientWidth && el.clientHeight) {
        setFitScale(
          Math.min(
            1,
            (el.clientWidth - 1) / geometry.width,
            (el.clientHeight - 1) / geometry.height,
          ),
        );
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit, geometry]);
  return (
    <div ref={viewport} className={`keyboard-viewport ${fit ? "flex-1 min-h-0" : ""}`}>
      <div
        className="keyboard-canvas relative"
        style={{
          width: geometry.width * scale,
          height: geometry.height * scale,
        }}
      >
        <div
          className="absolute top-0 left-0"
          style={{
            width: geometry.width,
            height: geometry.height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {plugin.positions.map((position) => {
            if (position.hidden) return null;
            const key = layer.keys.find((k) => k.keymapIndex === position.keymapIndex);
            const sensor = position.sensorId
              ? layer.sensors.find((s) => s.id === position.sensorId)
              : null;
            if ((!key && !sensor) || (!key && onSelect)) return null;
            return (
              <div
                key={position.id}
                className="absolute"
                style={{
                  left: position.x * unit + geometry.offsetX,
                  top: position.y * unit + geometry.offsetY,
                  width: position.width * unit - 6,
                  height: position.height * unit - 6,
                  transform: `rotate(${position.rotation}deg)`,
                }}
              >
                {sensor && !onSelect ? (
                  <Sensor sensor={sensor} />
                ) : key ? (
                  <DroppableKey
                    action={key}
                    className="w-full h-full"
                    selected={selection?.includes(position.keymapIndex)}
                    onClick={onSelect ? () => onSelect(position.keymapIndex) : undefined}
                    onEdit={onEdit ? () => onEdit(position.keymapIndex) : undefined}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
