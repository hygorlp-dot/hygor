import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_THEME } from "../themes/themeRegistry.js";
import { readThemePreference, THEME_STORAGE_KEYS, writeThemePreference } from "./themeStorage.js";
import { DEFAULT_DENSITY, normalizeDensity, normalizeTheme } from "./themeValidation.js";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => normalizeTheme(readThemePreference(THEME_STORAGE_KEYS.theme) || DEFAULT_THEME));
  const [density, setDensityState] = useState(() => normalizeDensity(readThemePreference(THEME_STORAGE_KEYS.density) || DEFAULT_DENSITY));
  const setTheme = value => setThemeState(normalizeTheme(value));
  const setDensity = value => setDensityState(normalizeDensity(value));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeThemePreference(THEME_STORAGE_KEYS.theme, theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.density = density;
    writeThemePreference(THEME_STORAGE_KEYS.density, density);
  }, [density]);

  const value = useMemo(() => ({ theme, density, setTheme, setDensity }), [theme, density]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme deve ser usado dentro do ThemeProvider.");
  return value;
}
