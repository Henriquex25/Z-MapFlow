import type { Plugin, Project } from "../types/keyboard";
import { tr } from "../i18n";
import { configEntries, enableStudioUSB } from "./firmwareSettings";

export function changeHardwareVariant(p: Project, plugin: Plugin, id: string) {
  const previous = plugin.variants.find((v) => v.id === p.variantId);
  const next = plugin.variants.find((v) => v.id === id);
  if (!next || next === previous) return;
  const oldCentral = previous?.targets.find((t) => t.role === "central" || t.role === "standalone");
  const newCentral = next.targets.find((t) => t.role === "central" || t.role === "standalone");
  const studio = p.buildTargets?.find((t) => t.targetId === oldCentral?.id);
  const globalStudio =
    new Map(configEntries(p.extraConfig ?? "").map((f) => [f.name, f.value])).get(
      "CONFIG_ZMK_STUDIO",
    ) === "y";
  const moveStudio =
    oldCentral?.id !== newCentral?.id &&
    !!newCentral &&
    !!studio?.snippets?.includes("studio-rpc-usb-uart") &&
    (globalStudio ||
      !!studio?.cmakeArgs?.some((a) => /^-DCONFIG_ZMK_STUDIO(?::[^=]+)?=y$/.test(a)));
  if (moveStudio && studio) {
    studio.snippets = studio.snippets?.filter((s) => s !== "studio-rpc-usb-uart");
    studio.cmakeArgs = studio.cmakeArgs?.filter(
      (a) => !/^-DCONFIG_ZMK_(STUDIO|USB)(?::[^=]+)?=/.test(a),
    );
  }
  if (p.buildTargets)
    p.buildTargets = p.buildTargets.filter((s) => next.targets.some((t) => t.id === s.targetId));
  for (const settings of p.buildTargets ?? []) {
    const managed = previous?.targets.find((t) => t.id === settings.targetId)?.config ?? {};
    settings.cmakeArgs = settings.cmakeArgs?.filter((arg) => {
      const parts = /^-D(CONFIG_[A-Za-z0-9_]+)(?::[^=]+)?=(.*)$/.exec(arg);
      return !parts || managed[parts[1]] !== parts[2];
    });
  }
  p.variantId = id;
  if (!next.features?.includes("peripheral-status-sync")) p.options.peripheralStatusSync = false;
  if (moveStudio && newCentral) enableStudioUSB(p, newCentral.id);
}

export function hardwareConfigError(p: Project, plugin: Plugin | null) {
  const variant = plugin?.variants.find((v) => v.id === p.variantId);
  if (p.options.peripheralStatusSync && !variant?.features?.includes("peripheral-status-sync"))
    return tr("Peripheral status synchronization is not supported by this profile.");
  if (configEntries(p.extraConfig ?? "").some((f) => f.name === "CONFIG_ZMAPFLOW_STATUS_SYNC"))
    return tr("CONFIG_ZMAPFLOW_STATUS_SYNC: use the synchronization option.");
  for (const settings of p.buildTargets ?? []) {
    const target = variant?.targets.find((t) => t.id === settings.targetId);
    for (const arg of settings.cmakeArgs ?? []) {
      const parts = /^-D(CONFIG_[A-Za-z0-9_]+)(?::[^=]+)?=(.*)$/.exec(arg);
      if (parts?.[1] === "CONFIG_ZMAPFLOW_STATUS_SYNC")
        return tr("CONFIG_ZMAPFLOW_STATUS_SYNC: use the synchronization option.");
      const expected = parts ? target?.config?.[parts[1]] : undefined;
      if (parts && expected !== undefined && expected !== parts[2])
        return `${target!.name}: ${parts![1]}=${expected}`;
    }
  }
  return "";
}
