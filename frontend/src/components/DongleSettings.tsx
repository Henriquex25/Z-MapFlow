import { tr, useLocale } from "../i18n";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { targetFlag, setTargetFlag } from "../utils/targetSettings";
import type { Plugin } from "../types/keyboard";

const fetchFlag = "CONFIG_ZMK_SPLIT_BLE_CENTRAL_BATTERY_LEVEL_FETCHING";
const proxyFlag = "CONFIG_ZMK_SPLIT_BLE_CENTRAL_BATTERY_LEVEL_PROXY";
const intervalFlag = "CONFIG_ZMK_SPLIT_BLE_PREF_INT";
export function DongleSettings({ variant }: { variant: Plugin["variants"][number] }) {
  useLocale();
  const { project, edit } = useKeyboardStore();
  const central = variant.targets.find((t) => t.kind === "dongle");
  if (!project || !central) return null;
  const fetching = targetFlag(project, central.id, fetchFlag, "n") === "y";
  const proxy = targetFlag(project, central.id, proxyFlag, "n") === "y";
  const interval = targetFlag(project, central.id, intervalFlag, "6");
  return (
    <div className="dongle-settings">
      <h4>{tr("Dongle options")}</h4>
      {variant.features?.includes("oled-rotate-180") && (
        <div className="mt-3">
          <h4>{tr("OLED orientation")}</h4>
          <div className="flex flex-wrap gap-4 mt-2">
            {variant.targets
              .filter((t) => t.role === "peripheral")
              .map((target) => (
                <label key={target.id}>
                  <input
                    type="checkbox"
                    disabled={!project.options.display}
                    checked={
                      !!project.buildTargets
                        ?.find((t) => t.targetId === target.id)
                        ?.snippets?.includes("zmapflow-oled-flip-180")
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
                          (s) => s !== "zmapflow-oled-flip-180",
                        );
                        if (event.target.checked) settings.snippets.push("zmapflow-oled-flip-180");
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
      )}

      <div className="flex flex-wrap gap-4 mt-3">
        <label>
          <input
            type="checkbox"
            checked={fetching}
            onChange={(e) =>
              edit((p) => {
                setTargetFlag(p, central.id, fetchFlag, e.target.checked ? "y" : "n");
                if (!e.target.checked) setTargetFlag(p, central.id, proxyFlag, "n");
              })
            }
          />
          {tr("Fetch battery levels from both halves")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={proxy}
            onChange={(e) =>
              edit((p) => {
                setTargetFlag(p, central.id, proxyFlag, e.target.checked ? "y" : "n");
                if (e.target.checked) setTargetFlag(p, central.id, fetchFlag, "y");
              })
            }
          />
          {tr("Report peripheral batteries to Bluetooth hosts")}
        </label>
      </div>
      <p className="hint mt-2">
        {tr(
          "Battery reporting uses Bluetooth Battery Service; USB does not expose these extra batteries. Host support varies.",
        )}
      </p>
      <label className="form-label mt-3">
        {tr("Split Bluetooth connection interval")}
        <select
          className="field w-fit"
          value={interval}
          onChange={(e) => edit((p) => setTargetFlag(p, central.id, intervalFlag, e.target.value))}
        >
          {!["6", "12", "24"].includes(interval) && (
            <option value={interval}>{Number(interval) * 1.25} ms</option>
          )}
          <option value="6">{tr("7.5 ms — lowest latency (default)")}</option>
          <option value="12">15 ms</option>
          <option value="24">30 ms</option>
        </select>
      </label>
      <p className="hint mt-2">
        {tr(
          "A longer interval trades response time for fewer radio connection events. Rebuild and flash the dongle after changing these options.",
        )}
      </p>
    </div>
  );
}
