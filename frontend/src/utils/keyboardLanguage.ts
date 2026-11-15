import abnt2Header from "../../../internal/firmware/keys_pt_abnt2.h?raw";
import type { Project } from "../types/keyboard";

export const abnt2HeaderName = "keys_pt_abnt2.h";

// Selecting a palette language adds its source once. Existing assignments can
// keep using that header when the user later selects a different language.
export function setKeyboardLanguage(project: Project, locale: string) {
  for (const language of new Set([project.options.locale, locale])) {
    if (language === "pt-br") {
      project.headers = { [abnt2HeaderName]: abnt2Header, ...project.headers };
    }
    const name =
      language === "pt-br"
        ? abnt2HeaderName
        : language.startsWith("header:")
          ? language.slice(7)
          : "";
    if (
      name &&
      project.headers?.[name] !== undefined &&
      !(project.preamble ?? "").includes(`"${name}"`)
    ) {
      project.preamble = `${project.preamble ?? ""}\n#include "${name}"\n`;
    }
  }
  project.options.locale = locale;
}

function localInclude(parent: string, child: string) {
  const parts = parent.split("/").slice(0, -1);
  for (const part of child.split("/")) {
    if (part === "..") {
      if (!parts.length) return "";
      parts.pop();
    } else if (part && part !== ".") parts.push(part);
  }
  return parts.join("/");
}

// Show only the selected language and its declared local dependencies. This is
// an alias list, not a replacement for ZMK's C preprocessor or host OS layout.
export function keyboardLanguageHeaders(project: Project): Record<string, string> {
  const files = { ...project.headers };
  let root = "";
  if (project.options.locale === "pt-br") {
    root = abnt2HeaderName;
    files[root] ??= abnt2Header;
  } else if (project.options.locale.startsWith("header:")) {
    root = project.options.locale.slice(7);
  }
  const selected: Record<string, string> = {};
  const visit = (name: string) => {
    if (Object.hasOwn(selected, name) || !Object.hasOwn(files, name)) return;
    selected[name] = files[name];
    for (const include of files[name].matchAll(/^\s*#\s*include\s+"([^"]+)"/gm)) {
      visit(localInclude(name, include[1]));
    }
  };
  if (root) visit(root);
  return selected;
}

// Locale-generator headers annotate characters with comments such as /* ñ */.
// Use only these explicit annotations; never infer Unicode from a HID position.
function annotatedCharacters(sources: string[]) {
  const labels = new Map<string, string>();
  const references = new Map<string, string>();
  for (const source of sources) {
    let character: string | undefined;
    for (const line of source.split(/\r?\n/)) {
      const comment = /^\s*\/\*\s*(.*?)\s*\*\/\s*$/.exec(line);
      if (comment) {
        character = [...comment[1]].length === 1 && !/\s/.test(comment[1]) ? comment[1] : undefined;
        continue;
      }
      const alias = /^\s*#\s*define\s+([A-Z][A-Z0-9]*_[A-Z0-9_]+)[ \t]+(.+)/.exec(line);
      if (alias) {
        labels.delete(alias[1]);
        references.delete(alias[1]);
        if (character) labels.set(alias[1], character);
        const value = alias[2]
          .split("//")[0]
          .trim()
          .replace(/^\(([^()]*)\)$/, "$1")
          .trim();
        if (/^[A-Z][A-Z0-9_]+$/.test(value)) references.set(alias[1], value);
        character = undefined;
      } else if (!line.trim().startsWith("//")) character = undefined;
    }
  }
  const resolve = (name: string, seen = new Set<string>()): string | undefined => {
    if (labels.has(name)) return labels.get(name);
    if (seen.has(name) || seen.size > 32 || !references.has(name)) return;
    seen.add(name);
    const label = resolve(references.get(name)!, seen);
    if (label) labels.set(name, label);
    return label;
  };
  for (const name of references.keys()) resolve(name);
  return labels;
}
const builtinCharacters = annotatedCharacters([abnt2Header]);
const characterCache = new WeakMap<object, Map<string, string>>();
export function headerCharacter(code: string, project: Project): string | undefined {
  const symbol = /^&kp\s+([A-Z][A-Z0-9_]+)$/.exec(code)?.[1];
  if (!symbol) return;
  if (project.headers) {
    let characters = characterCache.get(project.headers);
    if (!characters) {
      characters = annotatedCharacters(Object.values(project.headers));
      characterCache.set(project.headers, characters);
    }
    if (characters.has(symbol)) return characters.get(symbol);
  }
  if (project.options.locale === "pt-br" && project.headers?.[abnt2HeaderName] === undefined) {
    return builtinCharacters.get(symbol);
  }
}
