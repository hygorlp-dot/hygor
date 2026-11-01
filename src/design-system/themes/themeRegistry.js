export const DEFAULT_THEME = "saas";

// Themes change semantic roles. Components never need to know a theme's ID.
const shared = Object.freeze({
  "--arcd-surface-card":"#ffffff", "--arcd-surface-elevated":"#ffffff",
  "--arcd-action-primary-text":"#ffffff", "--arcd-text-inverse":"#ffffff",
  "--arcd-success-text":"#24634b", "--arcd-success-surface":"#edf7f1", "--arcd-success-border":"#8cbba0",
  "--arcd-warning-text":"#805517", "--arcd-warning-surface":"#fff7e8", "--arcd-warning-border":"#d8b36f",
  "--arcd-danger-text":"#a2323b", "--arcd-danger-surface":"#fff0f1", "--arcd-danger-border":"#d8949b",
  "--arcd-info-text":"#285c91", "--arcd-info-surface":"#eef5fc", "--arcd-info-border":"#94b7dd",
  "--arcd-neutral-text":"#526174", "--arcd-neutral-surface":"#f0f2f5", "--arcd-neutral-border":"#dce1e7",
  "--arcd-type-page-title":"1.5rem", "--arcd-type-section-title":"1.125rem", "--arcd-type-card-title":".9375rem",
  "--arcd-type-body":".875rem", "--arcd-type-label":".875rem", "--arcd-type-caption":".8125rem",
  "--arcd-type-control":".875rem", "--arcd-type-table":".875rem", "--arcd-type-dialog-title":"1.125rem",
  "--arcd-type-control-touch":"1rem", "--arcd-page-padding":"1.5rem", "--arcd-page-padding-mobile":".875rem",
  "--arcd-radius-control":".375rem", "--arcd-radius-lg":".5rem",
});
const theme = (id,label,description,tokens) => Object.freeze({id,label,description,enabled:true,tokens:Object.freeze({...shared,...tokens})});
export const themeRegistry = Object.freeze({
  saas:theme("saas","MARCELL Claro","Navegação clara, superfícies neutras e ações em azul.",{
    "--arcd-font-sans":"Inter, 'Helvetica Neue', Arial, sans-serif",
    "--arcd-surface-page":"#f6f7f9", "--arcd-surface-muted":"#f0f2f5", "--arcd-surface-subtle":"#f8f9fb",
    "--arcd-surface-inverse":"#202c3d", "--arcd-surface-overlay":"rgb(21 32 48 / 44%)",
    "--arcd-text-primary":"#202c3d", "--arcd-text-secondary":"#526174", "--arcd-text-muted":"#607086",
    "--arcd-border-subtle":"#e9edf2", "--arcd-border-default":"#dce1e7", "--arcd-border-strong":"#8995a5",
    "--arcd-action-primary":"#235bb0", "--arcd-action-primary-hover":"#19498e", "--arcd-action-primary-active":"#143b74",
    "--arcd-action-primary-subtle":"#edf3fc", "--arcd-focus-ring":"#235bb0",
    "--arcd-nav-surface":"#ffffff", "--arcd-nav-text":"#526174", "--arcd-nav-active-text":"#19498e",
    "--arcd-nav-active-surface":"#edf3fc", "--arcd-nav-hover-surface":"#f0f2f5", "--arcd-nav-hover-text":"#202c3d",
    "--arcd-nav-border":"#e4e8ee", "--arcd-nav-brand-text":"#0d1b2e",
  }),
  marcell:theme("marcell","MARCELL Institucional","Navegação azul-marinho e seleção em ouro.",{
    "--arcd-font-sans":"'Source Sans 3', 'Helvetica Neue', Arial, sans-serif",
    "--arcd-surface-page":"#f5f6f8", "--arcd-surface-muted":"#edf0f4", "--arcd-surface-subtle":"#f5f6f8",
    "--arcd-surface-inverse":"#0d1b2e", "--arcd-surface-overlay":"rgb(13 27 46 / 56%)",
    "--arcd-text-primary":"#0d1b2e", "--arcd-text-secondary":"#536171", "--arcd-text-muted":"#637081",
    "--arcd-border-subtle":"#e8ebef", "--arcd-border-default":"#d9dde2", "--arcd-border-strong":"#8a96a5",
    "--arcd-action-primary":"#0d1b2e", "--arcd-action-primary-hover":"#18304c", "--arcd-action-primary-active":"#243348",
    "--arcd-action-primary-subtle":"#eee5d5", "--arcd-focus-ring":"#7b6030",
    "--arcd-nav-surface":"#0d1b2e", "--arcd-nav-text":"#c4cfda", "--arcd-nav-active-text":"#d1b17a",
    "--arcd-nav-active-surface":"#243348", "--arcd-nav-hover-surface":"#1b2c42", "--arcd-nav-hover-text":"#ffffff",
    "--arcd-nav-border":"#304056", "--arcd-nav-brand-text":"#ffffff",
  }),
});
export const enabledThemeIds = Object.freeze(Object.values(themeRegistry).filter(theme=>theme.enabled).map(theme=>theme.id));
