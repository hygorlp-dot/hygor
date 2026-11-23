// Fonte central da escala comum. Cores/fontes por tema: themes/themeRegistry.js.
// Densidade: tokens/density.css. Espaçamentos de composição: tokens/spacing.css.
export const foundationTokens = Object.freeze({
  // Escala compacta aprovada em 19/11/2026 (direção Plataforma): título 22px, indicador 18px, corpo e tabela 13px.
  "--arcd-type-page-title":"1.375rem", "--arcd-type-section-title":".9375rem", "--arcd-type-card-title":".875rem",
  "--arcd-type-body":".8125rem", "--arcd-type-label":".8125rem", "--arcd-type-caption":".75rem", "--arcd-type-kpi":"1.125rem",
  "--arcd-type-control":".8125rem", "--arcd-type-table":".8125rem", "--arcd-type-dialog-title":"1rem",
  "--arcd-type-control-touch":"1rem", "--arcd-page-padding":"1.5rem", "--arcd-page-padding-mobile":".875rem",
  "--arcd-type-distance-title":"clamp(1.5rem, 2.3vw, 2rem)",
  "--arcd-button-weight":"500", "--arcd-button-line-height":"1.35",
  "--arcd-button-gap":".5rem", "--arcd-button-padding":"0 .875rem",
  "--arcd-button-padding-sm":"0 .625rem", "--arcd-button-padding-lg":"0 1.25rem",
  "--arcd-button-height-sm":"2.25rem", "--arcd-button-height-lg":"3rem", "--arcd-touch-target":"2.75rem",
  "--arcd-textarea-min-height":"6rem",
  "--arcd-dialog-media-width":"80rem", "--arcd-media-thumbnail-width":"20rem", "--arcd-media-thumbnail-max-height":"24rem",
  // Caixa padrão (docs/REGRAS-UX-UI.md §8): um raio de caixa, um raio de controle, recuo pela densidade, uma distância entre caixas.
  "--arcd-box-radius":"var(--arcd-radius-lg)", "--arcd-box-padding":"var(--arcd-panel-padding)",
  "--arcd-box-gap":"var(--arcd-space-4)", "--arcd-box-header-gap":"var(--arcd-space-3)",
  "--arcd-sheet-row-height":"1.625rem", "--arcd-sheet-line-height":"1.125rem",
  "--arcd-sheet-cell-padding":"var(--arcd-space-1)", "--arcd-sheet-type-body":"var(--arcd-type-caption)",
});
