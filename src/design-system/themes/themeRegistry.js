export const DEFAULT_THEME = "marcell";
export const themeRegistry = Object.freeze({marcell:Object.freeze({id:"marcell",label:"MARCELL",description:"Azul-marinho, ouro acetinado e areia. Identidade oficial MARCELL.",enabled:true})});
export const enabledThemeIds = Object.freeze(Object.values(themeRegistry).filter(theme=>theme.enabled).map(theme=>theme.id));
