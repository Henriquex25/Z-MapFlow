import type { Project } from "../types/keyboard";

export function configEntries(source: string) {
  return source.split("\n").flatMap((line) => {
    const m = /^\s*(CONFIG_[A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) return [{ name: m[1], value: m[2] }];
    const unset = /^\s*#\s*(CONFIG_[A-Za-z0-9_]+) is not set\s*$/.exec(line);
    return unset ? [{ name: unset[1], value: "n" }] : [];
  });
}
export function setConfig(source: string, name: string, value?: string) {
  const lines = source.split("\n").filter((line) => {
    const key = /^\s*(CONFIG_[A-Za-z0-9_]+)\s*=/.exec(line)?.[1];
    const unset = /^\s*#\s*(CONFIG_[A-Za-z0-9_]+) is not set\s*$/.exec(line)?.[1];
    return key !== name && unset !== name;
  });
  if (value !== undefined) lines.push(`${name}=${value}`);
  return lines.join("\n").trim();
}
export function enableStudioUSB(p: Project, targetId: string) {
  // Studio is enabled on the central target, including when an imported .conf
  // previously enabled it for both halves.
  p.extraConfig = setConfig(p.extraConfig ?? "", "CONFIG_ZMK_STUDIO");
  p.buildTargets ??= [];
  let settings = p.buildTargets.find((s) => s.targetId === targetId);
  if (!settings) {
    settings = { targetId, snippets: [], cmakeArgs: [] };
    p.buildTargets.push(settings);
  }
  settings.snippets = [...new Set([...(settings.snippets ?? []), "studio-rpc-usb-uart"])];
  settings.cmakeArgs = (settings.cmakeArgs ?? []).filter(
    (arg) => !/^-DCONFIG_ZMK_(STUDIO|USB)(?::[^=]+)?=/.test(arg),
  );
  settings.cmakeArgs.push("-DCONFIG_ZMK_STUDIO=y", "-DCONFIG_ZMK_USB=y");
}

// Header aliases remain symbolic until ZMK's own preprocessor compiles them.
// No attempt is made to translate keycodes to Unicode without the host layout.
export function headerSymbols(headers: Record<string, string> = {}) {
  return [
    ...new Set(
      Object.values(headers).flatMap((source) =>
        [
          ...source
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .matchAll(/^\s*#\s*define\s+([A-Z][A-Z0-9]*_[A-Z0-9_]+)[ \t]+([^\n]+)/gm),
        ]
          .filter((m) => !m[1].startsWith("CONFIG_") && !/^(?:1|0)?\s*(?:\/\/.*)?$/.test(m[2]))
          .map((m) => m[1]),
      ),
    ),
  ].sort();
}
