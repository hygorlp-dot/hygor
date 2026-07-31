import { CONSTRAINT_CATEGORIES, CONSTRAINT_STATUS, LOOKAHEAD_HORIZONS } from "./constants.js";

const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))&&!Number.isNaN(Date.parse(`${value}T12:00:00Z`));
export const validateLookahead=(lookahead={})=>{
  const errors=[];
  if(!lookahead.id)errors.push("Lookahead sem identificação.");
  if(!lookahead.obraId)errors.push("Lookahead sem obra.");
  if(!LOOKAHEAD_HORIZONS.includes(Number(lookahead.horizonteSemanas)))errors.push("Horizonte do Lookahead deve ser de 3, 4 ou 6 semanas.");
  if(!validDate(lookahead.semanaInicio)||!validDate(lookahead.semanaFim))errors.push("Período do Lookahead inválido.");
  return {ok:!errors.length,errors};
};
export const validateConstraint=(constraint={})=>{
  const errors=[];
  if(!constraint.id||!constraint.obraId||!constraint.pacoteId)errors.push("Restrição precisa de identificação, obra e pacote.");
  if(!CONSTRAINT_CATEGORIES.includes(constraint.categoria))errors.push("Categoria da restrição inválida.");
  if(!String(constraint.descricao||"").trim())errors.push("Descreva a restrição.");
  if(!validDate(constraint.dataIdentificacao)||!validDate(constraint.dataNecessidade))errors.push("Informe as datas de identificação e necessidade.");
  if(!Object.values(CONSTRAINT_STATUS).includes(constraint.status||CONSTRAINT_STATUS.OPEN))errors.push("Status da restrição inválido.");
  return {ok:!errors.length,errors};
};
