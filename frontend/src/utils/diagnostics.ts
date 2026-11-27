import type { Project } from "../types/keyboard";
const snippet = "zmk-usb-logging";
export function hasUSBLogging(p: Project, targetId: string) {
  return p.buildTargets?.find((t) => t.targetId === targetId)?.snippets?.includes(snippet) ?? false;
}
export function setUSBLogging(p: Project, targetId: string, enabled: boolean) {
  p.buildTargets ??= [];
  let target = p.buildTargets.find((t) => t.targetId === targetId);
  if (!target) {
    if (!enabled) return;
    target = { targetId, snippets: [], cmakeArgs: [] };
    p.buildTargets.push(target);
  }
  target.snippets = (target.snippets ?? []).filter((s) => s !== snippet);
  if (enabled) target.snippets.push(snippet);
}

export function hasManualUSBLogging(p: Project, targetId: string) {
  return (
    /^\s*(?:#\s*)?CONFIG_ZMK_USB_LOGGING(?:\s*=| is not set)/m.test(p.extraConfig ?? "") ||
    !!p.buildTargets
      ?.find((t) => t.targetId === targetId)
      ?.cmakeArgs?.some((arg) => /^-DCONFIG_ZMK_USB_LOGGING(?::[^=]+)?=/.test(arg))
  );
}
