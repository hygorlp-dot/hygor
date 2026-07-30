import {
  changedTopLevelSections,
  projectChangedSectionsPatch,
} from "./section-patch.js";

// Os comandos de conciliação preservam as referências das seções que não
// alteraram. Isso permite responder somente com o delta confirmado, evitando
// baixar e normalizar novamente todo o cadastro da empresa após cada PIX.
export const reconciliationChangedSections = (before = {}, after = {}) =>
  changedTopLevelSections(before, after);

export const projectReconciliationPatch = (before, after, user) =>
  projectChangedSectionsPatch(before, after, user);
