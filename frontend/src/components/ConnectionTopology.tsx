import { ArrowRight, Bluetooth, Keyboard, Usb } from "lucide-react";
import { tr, useLocale } from "../i18n";
import type { Plugin } from "../types/keyboard";
import { useKeyboardStore } from "../store/useKeyboardStore";

export function ConnectionTopology({ variant }: { variant: Plugin["variants"][number] }) {
  useLocale();
  const { project, edit } = useKeyboardStore();
  const central = variant.targets.find((t) => t.kind === "dongle");
  if (!central) return null;
  return (
    <div className="connection-topology">
      <h4>{tr("Connection topology")}</h4>
      <div
        className="topology-diagram"
        aria-label={tr("Both keyboard halves connect to the USB dongle over Bluetooth.")}
      >
        <div className="topology-peripherals">
          {variant.targets
            .filter((t) => t.role === "peripheral")
            .map((t) => (
              <span key={t.id}>
                <Keyboard size={24} />
                {tr(t.name)}
                <Bluetooth size={18} />
              </span>
            ))}
        </div>
        <ArrowRight size={24} />
        <span className="topology-central">
          <Usb size={30} />
          {tr(central.name)}
          <small>{tr("Central · USB to computer")}</small>
        </span>
      </div>
      <p className="hint">
        {tr(
          "Your keymap runs on the dongle. Both halves require the peripheral firmware from this profile. Without the dongle, these halves cannot type directly into a computer.",
        )}
      </p>
      <p className="hint">
        {tr(
          "Display and sleep controls apply to the keyboard halves. The USB dongle has no OLED or local encoder and stays awake.",
        )}
      </p>
      <p className="hint">
        {tr("With synchronization off, peripheral OLEDs show local battery/status only.")}
      </p>
      {variant.features?.includes("peripheral-status-sync") && project && (
        <>
          <label className="topology-sync-option">
            <input
              type="checkbox"
              checked={!!project.options.peripheralStatusSync}
              onChange={(e) =>
                edit((p) => {
                  p.options.peripheralStatusSync = e.target.checked;
                })
              }
            />
            <span>{tr("Synchronize layer and connection with the halves")}</span>
          </label>
          <p className="hint">
            {tr(
              "Optional and off by default. Sends the active layer, selected Bluetooth profile and actual USB/Bluetooth output over the paired link. Rebuild and flash the dongle and both halves when changing this option.",
            )}
          </p>
          {project.options.peripheralStatusSync && (
            <p className="hint">
              {tr(
                "With Display enabled, the OLEDs show synchronized state and local battery. They show a waiting message if the link or synchronized state is lost. The firmware sends changes and a small heartbeat every five seconds.",
              )}
            </p>
          )}
        </>
      )}
    </div>
  );
}
