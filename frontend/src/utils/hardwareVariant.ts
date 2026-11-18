import { oledRotationTargets, OLED_ROTATION_SNIPPET } from "./oledRotation";
import type { Plugin, Project } from "../types/keyboard";
import { tr } from "../i18n";
import { configEntries, enableStudioUSB } from "./firmwareSettings";

export function managedTargetConfig(
  p: Project,
  target: Plugin["variants"][number]["targets"][number],
) {
  const config = { ...target.config };
  if (p.options.peripheralStatusSync && target.role === "peripheral") {
    const display = p.options.display ? "y" : "n";
    Object.assign(config, {
      CONFIG_ZMK_DISPLAY: display,
      CONFIG_ZMK_DISPLAY_STATUS_SCREEN_BUILT_IN: "n",
      CONFIG_ZMK_DISPLAY_STATUS_SCREEN_CUSTOM: display,
      CONFIG_ZMK_DISPLAY_WORK_QUEUE_DEDICATED: display,
      CONFIG_ZMK_WIDGET_LAYER_STATUS: "n",
      CONFIG_ZMK_WIDGET_BATTERY_STATUS: "n",
      CONFIG_ZMK_WIDGET_BATTERY_STATUS_SHOW_PERCENTAGE: "n",
      CONFIG_ZMK_WIDGET_OUTPUT_STATUS: "n",
    });
  }
  return config;
}

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
    if (!oledRotationTargets(next).some((t) => t.id === settings.targetId))
      settings.snippets = settings.snippets?.filter((s) => s !== OLED_ROTATION_SNIPPET);
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
    if (
      settings.snippets?.includes(OLED_ROTATION_SNIPPET) &&
      !oledRotationTargets(variant).some((t) => t.id === settings.targetId)
    )
      return tr("OLED rotation requires a supported keyboard display target.");
    for (const arg of settings.cmakeArgs ?? []) {
      const parts = /^-D(CONFIG_[A-Za-z0-9_]+)(?::[^=]+)?=(.*)$/.exec(arg);
      if (parts?.[1] === "CONFIG_ZMAPFLOW_STATUS_SYNC")
        return tr("CONFIG_ZMAPFLOW_STATUS_SYNC: use the synchronization option.");
      const expected = parts && target ? managedTargetConfig(p, target)[parts[1]] : undefined;
      if (parts && expected !== undefined && expected !== parts[2])
        return `${target!.name}: ${parts![1]}=${expected}`;
    }
  }
  return "";
}
