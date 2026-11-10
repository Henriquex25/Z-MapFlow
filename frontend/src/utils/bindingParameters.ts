import type { Project } from "../types/keyboard";

export function bindingParts(code: string): string[] {
  const result: string[] = [];
  let start = 0,
    depth = 0;
  for (let i = 0; i < code.length; i++) {
    if (code[i] === "(") depth++;
    if (code[i] === ")") depth--;
    if (/\s/.test(code[i]) && depth === 0) {
      if (i > start) result.push(code.slice(start, i));
      start = i + 1;
    }
  }
  if (start < code.length) result.push(code.slice(start));
  return result;
}
export function layerArguments(name: string, p: Project, seen = new Set<string>()): number[] {
  if (seen.has(name)) return [];
  seen = new Set(seen).add(name);
  if (["mo", "to", "tog", "sl", "lt"].includes(name)) return [1];
  const b = p.layout.behaviors.find((b) => (b.target || b.id) === name);
  if (b) {
    if (["toggle-layer", "momentary-layer", "to-layer"].includes(b.kind)) return [1];
    if (b.kind === "hold-tap" || b.kind === "sticky-key")
      return b.bindings.flatMap((code, i) =>
        layerArguments(bindingParts(code)[0]?.slice(1) ?? "", p, seen).length ? [i + 1] : [],
      );
  }
  const m = p.layout.macros.find((m) => m.id === name);
  if (!m) return [];
  const routes = new Map<number, number>(),
    result: number[] = [];
  for (const s of m.steps) {
    if (s.kind === "control") {
      const match = s.binding.match(/^&macro_param_([12])to([12])$/);
      if (match) routes.set(Number(match[2]), Number(match[1]));
      continue;
    }
    if (s.kind === "wait") continue;
    for (const index of layerArguments(bindingParts(s.binding)[0]?.slice(1) ?? "", p, seen)) {
      const from = routes.get(index);
      if (from) result.push(from);
    }
    routes.clear();
  }
  return result;
}
export function normalizeBinding(code: string, p: Project): string {
  const parts = bindingParts(code.trim());
  if (!parts.length) return code;
  for (const index of layerArguments(parts[0].replace(/^&/, ""), p)) {
    const value = parts[index];
    if (value && /^\d+$/.test(value)) {
      const layer = p.layout.layers[Number(value)];
      if (layer) parts[index] = `@{${layer.id}}`;
    }
  }
  return parts.join(" ");
}
