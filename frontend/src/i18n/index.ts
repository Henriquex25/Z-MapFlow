import errorSlots from "../../../internal/i18n/error-slots.json";
import portuguese from "../../../internal/i18n/pt-BR.json";
import { useAppPreferences } from "./preferences";
export { useLocale, useAppPreferences, type AppLocale } from "./preferences";
const catalog: Record<string, string> = portuguese;
const legacy = new Map(Object.entries(catalog).map(([en, pt]) => [pt, en]));
/** English is the canonical source language; parameters are never translated. */
export function tr(message: string, ...values: unknown[]): string {
  const key = legacy.get(message) ?? message;
  const text = useAppPreferences.getState().locale === "pt-BR" ? (catalog[key] ?? key) : key;
  return text.replace(/\{(\d+)\}/g, (token, index: string) =>
    Number(index) < values.length ? String(values[Number(index)]) : token,
  );
}
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = Object.entries(catalog)
  .sort(([a], [b]) => b.replace(/\{\d+\}/g, "").length - a.replace(/\{\d+\}/g, "").length)
  .flatMap(([en, pt]) => {
    if (!/\{\d+\}/.test(en)) return [];
    if (en.replace(/\{\d+\}/g, "").replace(/[^A-Za-z]/g, "").length < 5 && !(en in errorSlots))
      return [];
    return [en, pt].map((source) => {
      const slots: number[] = [];
      const parts = source.split(/(\{\d+\})/g).map((part) => {
        if (/^\{\d+\}$/.test(part)) {
          slots.push(Number(part.slice(1, -1)));
          return "([\\s\\S]+?)";
        }
        return escape(part);
      });
      return { en, slots, regex: new RegExp(`^${parts.join("")}$`) };
    });
  });
/** Localize stored/native errors at display time while preserving paths and codes. */
export function localizeMessage(value: unknown, depth = 0): string {
  if (depth > 6) return String(value);
  const message = value instanceof Error ? value.message : String(value);
  if (message.length > 8192) return message;
  if (catalog[message] || legacy.has(message)) return tr(message);
  for (const { en, slots, regex } of patterns) {
    const match = message.match(regex);
    if (match) {
      const values: string[] = [];
      slots.forEach((slot, i) => {
        values[slot] = (errorSlots as Record<string, number[]>)[en]?.includes(slot)
          ? localizeMessage(match[i + 1], depth + 1)
          : match[i + 1];
      });
      return tr(en, ...values);
    }
  }
  const colon = message.indexOf(": ");
  if (colon >= 0)
    return message.slice(0, colon + 2) + localizeMessage(message.slice(colon + 2), depth + 1);
  return message;
}
