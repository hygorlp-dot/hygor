import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeProvider.jsx";
import { ThemeSettings } from "./ThemeSettings.jsx";
import { DEFAULT_THEME } from "../themes/themeRegistry.js";
import { THEME_STORAGE_KEYS } from "./themeStorage.js";
import { DEFAULT_DENSITY, isValidThemeColor, normalizeDensity, normalizeTheme, validateThemeTokens } from "./themeValidation.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mounted = [];
function render(ui) { const container = document.createElement("div"); document.body.append(container); const root = createRoot(container); act(() => root.render(ui)); mounted.push({ container, root }); return container; }
function Probe() { const { theme, density, setTheme, setDensity } = useTheme(); return <><output data-testid="theme">{theme}</output><output data-testid="density">{density}</output><button onClick={() => setTheme("unknown")}>Tema inválido</button><button onClick={() => setDensity("compact")}>Compacto</button></>; }

afterEach(() => {
  while (mounted.length) { const { container, root } = mounted.pop(); act(() => root.unmount()); container.remove(); }
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.density;
});

describe("ARCD Theme Engine", () => {
  it("inicia Carbon confortável e persiste atributos no documento", () => {
    const container = render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(container.querySelector('[data-testid="theme"]').textContent).toBe(DEFAULT_THEME);
    expect(container.querySelector('[data-testid="density"]').textContent).toBe(DEFAULT_DENSITY);
    expect(document.documentElement.dataset.theme).toBe("carbon");
    expect(document.documentElement.dataset.density).toBe("comfortable");
    expect(localStorage.getItem(THEME_STORAGE_KEYS.theme)).toBe("carbon");
  });

  it("aceita densidade válida e faz fallback de tema desconhecido", () => {
    const container = render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => [...container.querySelectorAll("button")].find(button => button.textContent === "Compacto").click());
    expect(document.documentElement.dataset.density).toBe("compact");
    act(() => [...container.querySelectorAll("button")].find(button => button.textContent === "Tema inválido").click());
    expect(document.documentElement.dataset.theme).toBe("carbon");
  });

  it("valida preferências e tokens obrigatórios", () => {
    expect(normalizeTheme("architectural")).toBe("architectural");
    expect(normalizeTheme("dark")).toBe(DEFAULT_THEME);
    expect(normalizeDensity("wide")).toBe(DEFAULT_DENSITY);
    expect(validateThemeTokens(token => token === "--arcd-focus-ring" ? "" : "#ffffff")).toEqual({ valid: false, missing: ["--arcd-focus-ring"], invalid: [] });
    expect(validateThemeTokens(() => "#ffffff")).toEqual({ valid: true, missing: [], invalid: [] });
    expect(validateThemeTokens(token => token === "--arcd-focus-ring" ? "not-a-color" : "#ffffff")).toEqual({ valid: false, missing: [], invalid: ["--arcd-focus-ring"] });
    expect(isValidThemeColor("var(--arcd-action-primary)")).toBe(true);
  });

  it("permite ajustar densidade e restaurar o padrão no seletor", () => {
    const container = render(<ThemeProvider><ThemeSettings /></ThemeProvider>);
    const selects = container.querySelectorAll("select");
    expect([...selects[0].options].map(option => option.value)).toEqual(["carbon", "architectural"]);
    act(() => { selects[0].value = "architectural"; selects[0].dispatchEvent(new Event("change", { bubbles: true })); });
    expect(document.documentElement.dataset.theme).toBe("architectural");
    act(() => { selects[1].value = "spacious"; selects[1].dispatchEvent(new Event("change", { bubbles: true })); });
    expect(document.documentElement.dataset.density).toBe("spacious");
    act(() => [...container.querySelectorAll("button")].find(button => button.textContent === "Restaurar padrão").click());
    expect(document.documentElement.dataset.theme).toBe(DEFAULT_THEME);
    expect(document.documentElement.dataset.density).toBe(DEFAULT_DENSITY);
  });

  it("mantém TabRow e PageHero legados conectados a classes semânticas", () => {
    const source = readFileSync(resolve(process.cwd(), "src/LegacyApp.jsx"), "utf8");
    const pageHero = source.slice(source.indexOf("function PageHero"), source.indexOf("function TabRow"));
    const tabRow = source.slice(source.indexOf("function TabRow"), source.indexOf("function ReportMetric"));
    const kpiCard = source.slice(source.indexOf("function KpiCard"), source.indexOf("function HeroWeatherScene"));
    expect(pageHero).toContain('className="page-hero"');
    expect(pageHero).not.toContain("style={{");
    expect(tabRow).toContain('className="tab-row"');
    expect(tabRow).toContain('aria-pressed={isActive}');
    expect(kpiCard).toContain('className="dashboard-kpi"');
    expect(kpiCard).not.toContain("style={{");
  });
});
