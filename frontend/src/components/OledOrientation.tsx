import { tr, useLocale } from "../i18n";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { oledRotationTargets, OLED_ROTATION_SNIPPET } from "../utils/oledRotation";
import type { Plugin } from "../types/keyboard";

export function OledOrientation({ variant }: { variant: Plugin["variants"][number] }) {
  useLocale();
  const project = useKeyboardStore((s) => s.project);
  const edit = useKeyboardStore((s) => s.edit);
  const targets = oledRotationTargets(variant);
  if (!project || !targets.length) return null;
  return (
    <div className="mt-3">
      <h4>{tr("OLED orientation")}</h4>
      <div className="flex flex-wrap gap-4 mt-2">
        {targets.map((target) => (
          <label key={target.id}>
            <input
              type="checkbox"
              disabled={!project.options.display}
              checked={
                !!project.buildTargets
                  ?.find((t) => t.targetId === target.id)
                  ?.snippets?.includes(OLED_ROTATION_SNIPPET)
              }
              onChange={(event) =>
                edit((p) => {
                  p.buildTargets ??= [];
                  let settings = p.buildTargets.find((t) => t.targetId === target.id);
                  if (!settings) {
                    settings = { targetId: target.id };
                    p.buildTargets.push(settings);
                  }
                  settings.snippets = (settings.snippets ?? []).filter(
                    (s) => s !== OLED_ROTATION_SNIPPET,
                  );
                  if (event.target.checked) settings.snippets.push(OLED_ROTATION_SNIPPET);
                })
              }
            />
            {tr("Rotate {0} OLED 180°", tr(target.name))}
          </label>
        ))}
      </div>
      <p className="hint mt-2">
        {tr(
          "Keeps the horizontal status layout and flips only the selected half. Save, rebuild and flash that half; no pairing reset is needed for orientation alone.",
        )}
      </p>
    </div>
  );
}
