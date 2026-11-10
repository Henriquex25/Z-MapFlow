import { tr, useAppPreferences, useLocale, type AppLocale } from "../i18n";

export function AppSettings() {
  const locale = useLocale();
  const setLocale = useAppPreferences((state) => state.setLocale);
  return (
    <section className="resource-card app-preferences" aria-labelledby="app-settings-title">
      <h3 id="app-settings-title">{tr("Application")}</h3>
      <label className="form-label mt-3">
        {tr("Interface language")}
        <select
          className="field"
          aria-label={tr("Interface language")}
          value={locale}
          onChange={(e) => setLocale(e.target.value as AppLocale)}
        >
          <option value="en">English</option>
          <option value="pt-BR">Português (Brasil)</option>
        </select>
      </label>
      <p className="hint mt-3">
        {tr(
          "This preference is saved on this computer. It does not change your keyboard layout or firmware.",
        )}
      </p>
      <a href="https://henriquex25.github.io/Z-MapFlow/" target="_blank" rel="noreferrer">
        {tr("Documentation")}
      </a>
    </section>
  );
}
