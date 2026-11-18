import type { Project } from "../types/keyboard";
import { configEntries } from "./firmwareSettings";

export function targetFlag(p: Project, targetId: string, name: string, fallback: string) {
  const global = configEntries(p.extraConfig ?? "")
    .filter((f) => f.name === name)
    .at(-1)?.value;
  const target = p.buildTargets
    ?.find((t) => t.targetId === targetId)
    ?.cmakeArgs?.map((arg) => /^-D(CONFIG_\w+)(?::[^=]+)?=(.*)$/.exec(arg))
    .filter((arg) => arg?.[1] === name)
    .at(-1)?.[2];
  return target ?? global ?? fallback;
}
export function setTargetFlag(p: Project, targetId: string, name: string, value: string) {
  p.buildTargets ??= [];
  let target = p.buildTargets.find((t) => t.targetId === targetId);
  if (!target) {
    target = { targetId };
    p.buildTargets.push(target);
  }
  target.cmakeArgs = (target.cmakeArgs ?? []).filter(
    (arg) => !new RegExp(`^-D${name}(?::[^=]+)?=`).test(arg),
  );
  target.cmakeArgs.push(`-D${name}=${value}`);
}
