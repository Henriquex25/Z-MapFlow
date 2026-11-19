import { Keyboard, Usb, RotateCcw, LockKeyhole, Check, ArrowRight } from "lucide-react";
import { tr } from "../i18n";
import type { FlashPlan } from "../types/keyboard";

export function FlashTopology({
  plan,
  busy,
  resetting,
  onDeclare,
  onExternal,
  onPhase,
  onUndoSetup,
}: {
  plan: FlashPlan;
  busy: boolean;
  resetting: boolean;
  onDeclare: (variantId: string) => void;
  onExternal: () => void;
  onPhase: (reset: boolean) => void;
  onUndoSetup: () => void;
}) {
  if (!plan.supported) return null;
  if (plan.needsSetup)
    return (
      <section className="flash-topology-setup flash-topology-choice">
        <h3>{tr("Which setup is installed on your keyboard now?")}</h3>
        <p>
          {tr(
            "The app cannot read installed roles from the bootloader drive. Select the setup currently installed, not the one you want to install. Future changes made through this app are tracked automatically.",
          )}
        </p>
        <div className="flash-targets">
          {plan.options.map((option) => (
            <button
              className="btn flash-target"
              key={option.variantId}
              disabled={busy}
              title={option.name}
              aria-label={
                tr(option.dongle ? "USB dongle is central" : "A keyboard half is central") +
                (plan.options.filter((o) => o.dongle === option.dongle).length > 1
                  ? ` — ${tr(option.name)}`
                  : "")
              }
              onClick={() => onDeclare(option.variantId)}
            >
              {option.dongle ? <Usb size={28} /> : <Keyboard size={28} />}
              <span>
                {tr(option.dongle ? "USB dongle is central" : "A keyboard half is central")}
              </span>
              <small>{tr(option.name)}</small>
            </button>
          ))}
        </div>
        <button className="btn mt-3" disabled={busy} onClick={() => onDeclare("")}>
          {tr("I'm not sure — guide me through a full reset")}
        </button>
      </section>
    );
  return (
    <>
      {plan.canUndoSetup && (
        <div className="flash-setup-back">
          <button className="btn" disabled={busy} onClick={onUndoSetup}>
            <RotateCcw size={18} aria-hidden="true" />
            {tr("Undo setup choice")}
          </button>
          <p className="hint">
            {tr("No firmware has been sent since this choice. You can go back and correct it.")}
          </p>
        </div>
      )}
      <div className="flash-topology-setup">
        {plan.required && (
          <div className="notice flash-transfer-status" role="note">
            <strong>{tr("Pairing reset is required before keyboard firmware.")}</strong>
            <details>
              <summary>{tr("Setup details")}</summary>
              <p>{tr("Changing the central requires new Bluetooth pairings on every device.")}</p>
              <p>
                {tr(
                  "Reset clears stored Bluetooth and Studio settings. Your saved project is kept.",
                )}
              </p>
              {plan.from && <p>{tr("Installed setup: {0}", tr(plan.from))}</p>}
              <p>{tr("New setup: {0}", tr(plan.to))}</p>
              {plan.resetDevices.some((d) => d.retired) && (
                <p>
                  {tr(
                    "Reset the retired dongle too, then disconnect it. Only the keyboard halves receive the final firmware for this setup.",
                  )}
                </p>
              )}
            </details>
          </div>
        )}
        {plan.needsRebuild && (
          <p className="notice error" role="alert">
            {tr(
              "This build lacks reset firmware for an affected controller. Select a compatible current profile and rebuild before changing the topology.",
            )}
          </p>
        )}
        {plan.required && (
          <ol className="flash-topology-phases" aria-label={tr("Topology migration steps")}>
            <li
              className={resetting ? "current" : ""}
              aria-current={resetting ? "step" : undefined}
            >
              <button
                className={`btn ${resetting ? "primary" : ""}`}
                disabled={busy || plan.needsRebuild}
                onClick={() => onPhase(true)}
              >
                {plan.canFlash ? <Check size={18} /> : <RotateCcw size={18} />}
                {tr("1. Reset every device")}
              </button>
            </li>
            <li
              className={!resetting ? "current" : ""}
              aria-current={!resetting ? "step" : undefined}
            >
              <button
                className={`btn ${!resetting ? "primary" : ""}`}
                disabled={busy || !plan.canFlash}
                onClick={() => onPhase(false)}
              >
                {plan.canFlash ? <ArrowRight size={18} /> : <LockKeyhole size={18} />}{" "}
                {tr("2. Install keyboard firmware")}
              </button>
            </li>
          </ol>
        )}
        {!plan.required && (
          <button className="btn mt-2" disabled={busy} onClick={onExternal}>
            {tr("I flashed outside the app or changed controllers")}
          </button>
        )}
      </div>
    </>
  );
}
