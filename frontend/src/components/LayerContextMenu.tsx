import { useEffect, useRef } from "react";

interface LayerContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onReset: () => void;
  onClear: () => void;
}

export function LayerContextMenu({ x, y, onClose, onReset, onClear }: LayerContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div ref={menuRef} style={{ top: y, left: x }} className="context-menu fixed z-50">
      <button
        onClick={() => {
          onReset();
          onClose();
        }}
        className="context-menu-item"
      >
        Restaurar padrão
      </button>
      <button
        className="context-menu-item"
        onClick={() => {
          onClear();
          onClose();
        }}
      >
        Limpar bindings
      </button>
    </div>
  );
}
