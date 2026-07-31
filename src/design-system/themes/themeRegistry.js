export const DEFAULT_THEME = "carbon";

// Outros temas só entram no registry quando tiverem cobertura visual e de
// acessibilidade completa. O provider aceita apenas entradas habilitadas.
export const themeRegistry = Object.freeze({
  carbon: Object.freeze({
    id: "carbon",
    label: "ARCD Carbon",
    description: "Tema técnico padrão da ARCD.",
    enabled: true,
  }),
  architectural: Object.freeze({
    id: "architectural",
    label: "ARCD Estrutural",
    description: "Carbon com navegação escura e leitura arquitetônica.",
    enabled: true,
  }),
});

export const enabledThemeIds = Object.freeze(Object.values(themeRegistry).filter(theme => theme.enabled).map(theme => theme.id));
