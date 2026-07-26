import { Button } from "../primitives/Button.jsx";
import { Select } from "../primitives/Select.jsx";
import { themeRegistry } from "../themes/themeRegistry.js";
import { useTheme } from "./ThemeProvider.jsx";
import { DEFAULT_DENSITY, densityOptions } from "./themeValidation.js";

const densityLabels = Object.freeze({ compact: "Compacta", comfortable: "Confortável", spacious: "Espaçosa" });

// O seletor só lista temas habilitados. Hoje isso mantém Carbon como aparência
// única e expõe apenas a densidade — sem prometer temas ainda não homologados.
export function ThemeSettings() {
  const { theme, density, setTheme, setDensity } = useTheme();
  const availableThemes = Object.values(themeRegistry).filter(item => item.enabled);
  const restoreDefaults = () => { setTheme("carbon"); setDensity(DEFAULT_DENSITY); };
  return <section className="arcd-form-section" aria-labelledby="theme-settings-title">
    <h2 id="theme-settings-title" className="arcd-form-section__title">Aparência operacional</h2>
    <p className="arcd-form-section__description">A densidade altera apenas a leitura e o tamanho dos controles. Dados e permissões não são modificados.</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(13rem, 1fr))", gap: "var(--arcd-layout-gap)" }}>
      <Select label="Tema" value={theme} onChange={event => setTheme(event.target.value)} options={availableThemes.map(item => ({ value: item.id, label: item.label }))} />
      <Select label="Densidade" value={density} onChange={event => setDensity(event.target.value)} options={densityOptions.map(value => ({ value, label: densityLabels[value] }))} />
    </div>
    <div className="arcd-page-header__actions" style={{ marginTop: "var(--arcd-space-5)" }}>
      <Button variant="secondary" onClick={restoreDefaults}>Restaurar padrão</Button>
    </div>
  </section>;
}
