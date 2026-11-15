import { useState } from "react";
import { tr } from "../i18n";
import { api } from "../services/api";
import { useKeyboardStore } from "../store/useKeyboardStore";
import { abnt2HeaderName, setKeyboardLanguage } from "../utils/keyboardLanguage";

export function useImportLanguageHeaders() {
  const [importing, setImporting] = useState(false);
  const importHeaders = async () => {
    if (importing) return false;
    setImporting(true);
    try {
      const bundle = await api.importHeaders();
      const state = useKeyboardStore.getState();
      if (!bundle?.name || !state.project) return false;
      const conflicts = Object.keys(bundle.files).filter(
        (name) =>
          state.project!.headers?.[name] !== undefined &&
          state.project!.headers[name] !== bundle.files[name],
      );
      if (conflicts.length) {
        state.selectAction(null);
        useKeyboardStore.setState({
          error: tr(
            "Headers already exist with different contents: {0}. Rename or edit the existing header.",
            conflicts.join(", "),
          ),
        });
        return false;
      }
      state.edit((p) => {
        p.headers = { ...p.headers, ...bundle.files };
        setKeyboardLanguage(p, bundle.name === abnt2HeaderName ? "pt-br" : `header:${bundle.name}`);
      });
      state.selectAction(null);
      return true;
    } catch (error) {
      useKeyboardStore.setState({ error: String(error) });
      return false;
    } finally {
      setImporting(false);
    }
  };
  return { importHeaders, importing };
}
