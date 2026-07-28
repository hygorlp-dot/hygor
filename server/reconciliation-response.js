import { projectDataForUser } from "./data-projection.js";

// Os comandos de conciliação preservam as referências das seções que não
// alteraram. Isso permite responder somente com o delta confirmado, evitando
// baixar e normalizar novamente todo o cadastro da empresa após cada PIX.
export const reconciliationChangedSections = (before = {}, after = {}) =>
  [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
    .filter(key => before?.[key] !== after?.[key]);

export const projectReconciliationPatch = (before, after, user) => {
  const projected=projectDataForUser(after,user);
  return Object.fromEntries(reconciliationChangedSections(before,after)
    .filter(key=>Object.prototype.hasOwnProperty.call(projected,key))
    .map(key=>[key,projected[key]]));
};
