import { projectDataForUser } from "./data-projection.js";
import { verifiedOfxEvidence } from "./dre-ofx-evidence.js";

// Os motores de comando preservam as referências das seções que não foram
// alteradas. Usar essa propriedade evita serializar e devolver todo o cadastro
// da empresa depois de uma mutação pequena.
export const changedTopLevelSections = (before = {}, after = {}) =>
  [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])]
    .filter(key => before?.[key] !== after?.[key]);

export const projectChangedSectionsPatch = (
  before,
  after,
  user,
  { exclude = [] } = {},
) => {
  const excluded = new Set(exclude);
  const projected = projectDataForUser(after, user);
  const changed=changedTopLevelSections(before,after);
  if(projected.dreBankSource&&changed.some(key=>['contasBancarias','fechamentosBancarios','extratos'].includes(key)))changed.push('dreBankSource');
  if (
    projected.dreOfxEvidence &&
    !excluded.has("dreOfxEvidence") &&
    changed.some(key => ["transacoes", "extratos", "contasBancarias"].includes(key)) &&
    JSON.stringify(projected.dreOfxEvidence) !== JSON.stringify(verifiedOfxEvidence(before || {}))
  ) {
    changed.push("dreOfxEvidence");
  }
  return Object.fromEntries(
    changed
      .filter(key => !excluded.has(key))
      .filter(key => Object.prototype.hasOwnProperty.call(projected, key))
      .map(key => [key, projected[key]]),
  );
};
