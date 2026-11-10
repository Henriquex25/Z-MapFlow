import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type AppLocale = "en" | "pt-BR";
const storage = {
  getItem(name: string) {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name: string, value: string) {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* Keep the session preference if storage is unavailable. */
    }
  },
  removeItem(name: string) {
    try {
      localStorage.removeItem(name);
    } catch {
      /* Storage may be unavailable. */
    }
  },
};
const locale = (value: unknown): AppLocale => (value === "pt-BR" ? "pt-BR" : "en");
export const useAppPreferences = create<{
  locale: AppLocale;
  setLocale: (value: AppLocale) => void;
}>()(
  persist((set) => ({ locale: "en", setLocale: (value) => set({ locale: locale(value) }) }), {
    name: "z-mapflow.preferences",
    version: 1,
    storage: createJSONStorage(() => storage),
    partialize: (state) => ({ locale: state.locale }),
    merge: (stored, current) => ({
      ...current,
      locale: locale((stored as { locale?: unknown } | undefined)?.locale),
    }),
  }),
);
export const useLocale = () => useAppPreferences((state) => state.locale);
function updateDocumentLanguage() {
  if (typeof document !== "undefined")
    document.documentElement.lang = useAppPreferences.getState().locale;
}
updateDocumentLanguage();
useAppPreferences.subscribe(updateDocumentLanguage);
