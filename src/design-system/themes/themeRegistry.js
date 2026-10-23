export const DEFAULT_THEME = "executive";
export const themeRegistry = Object.freeze({
  executive: Object.freeze({id:"executive", label:"ARCD Executivo claro", description:"Marfim, grafite e bronze discreto. Leitura clara e estados consistentes.", enabled:true}),
});
export const enabledThemeIds = Object.freeze(Object.values(themeRegistry).filter(theme => theme.enabled).map(theme => theme.id));
