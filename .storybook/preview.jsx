import { useEffect } from "react";
import "../src/index.css";

function ThemeCanvas({ Story, theme, density }) {
  useEffect(() => {
    const previousTheme = document.documentElement.dataset.theme;
    const previousDensity = document.documentElement.dataset.density;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
    return () => {
      document.documentElement.dataset.theme = previousTheme;
      document.documentElement.dataset.density = previousDensity;
    };
  }, [theme, density]);

  return <div className="min-h-screen bg-[var(--arcd-surface-page)] p-6 text-[var(--arcd-text-primary)]"><Story /></div>;
}

export const globalTypes = {
  theme: {
    description: "Tema ARCD",
    defaultValue: "carbon",
    toolbar: { items: ["carbon", "light", "dark", "high-contrast"] },
  },
  density: {
    description: "Densidade ARCD",
    defaultValue: "comfortable",
    toolbar: { items: ["comfortable", "compact"] },
  },
};

export const decorators = [(Story, context) => <ThemeCanvas Story={Story} theme={context.globals.theme} density={context.globals.density} />];

export const parameters = {
  controls: { expanded: true },
  layout: "padded",
};
