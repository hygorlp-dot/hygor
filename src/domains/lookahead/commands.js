import { CONSTRAINT_STATUS, DEFAULT_LOOKAHEAD_HORIZON, LOOKAHEAD_PACKAGE_STATUS } from "./constants.js";
import { projectLookaheadReadiness } from "./calculations.js";
import { validateConstraint, validateLookahead } from "./validations.js";

const fail=error=>({ok:false,error});
const appendHistory=(constraint,event)=>({...constraint,historico:[...(constraint.historico||[]),event]});
export const createLookahead=(input={},{actor={},now=""}={})=>{
  const lookahead={...input,horizonteSemanas:Number(input.horizonteSemanas||DEFAULT_LOOKAHEAD_HORIZON),status:input.status||"rascunho",criadoEm:input.criadoEm||now,criadoPor:input.criadoPor||actor.nome||actor.name||"",pacotes:input.pacotes||[],restricoes:input.restricoes||[],compromissos:input.compromissos||[]};
  const validation=validateLookahead(lookahead);return validation.ok?{ok:true,lookahead}:{ok:false,error:validation.errors.join(" ")};
};
export const addConstraint=(lookahead={},input={}, {actor={},now=""}={})=>{
  if(!(lookahead.pacotes||[]).some(item=>item.id===input.pacoteId))return fail("Pacote de trabalho não encontrado no Lookahead.");
  const constraint={...input,status:input.status||CONSTRAINT_STATUS.OPEN,dataIdentificacao:input.dataIdentificacao||String(now).slice(0,10),historico:input.historico||[{tipo:"criada",em:now,porId:actor.id||"",por:actor.nome||actor.name||""}]};
  const validation=validateConstraint(constraint);if(!validation.ok)return fail(validation.errors.join(" "));
  const packageWithLink=(lookahead.pacotes||[]).map(item=>item.id===constraint.pacoteId?{...item,restricaoIds:[...(item.restricaoIds||[]),constraint.id]}:item);
  return {ok:true,lookahead:projectLookaheadReadiness({...lookahead,pacotes:packageWithLink,restricoes:[...(lookahead.restricoes||[]),constraint]},[...(lookahead.restricoes||[]),constraint],String(now).slice(0,10))};
};
export const releaseConstraint=(lookahead={},constraintId,{evidenceIds=[],actor={},now=""}={})=>{
  const current=(lookahead.restricoes||[]).find(item=>item.id===constraintId);
  if(!current)return fail("Restrição não encontrada.");
  if(!Array.isArray(evidenceIds)||!evidenceIds.length)return fail("A liberação da restrição exige evidência.");
  const released=appendHistory({...current,status:CONSTRAINT_STATUS.RELEASED,dataLiberacao:String(now).slice(0,10),resolvidaEm:now,resolvidaPorId:actor.id||"",evidenciaIds:[...new Set([...(current.evidenciaIds||[]),...evidenceIds])]}, {tipo:"liberada",em:now,porId:actor.id||"",por:actor.nome||actor.name||""});
  const constraints=(lookahead.restricoes||[]).map(item=>item.id===constraintId?released:item);
  return {ok:true,lookahead:projectLookaheadReadiness({...lookahead,restricoes:constraints},constraints,String(now).slice(0,10))};
};
export const commitWorkPackage=(lookahead={},packageId,{exceptionReason="",now=""}={})=>{
  const current=(lookahead.pacotes||[]).find(item=>item.id===packageId);
  if(!current)return fail("Pacote de trabalho não encontrado.");
  const readiness=projectLookaheadReadiness(lookahead,lookahead.restricoes||[],String(now).slice(0,10)).pacotes.find(item=>item.id===packageId);
  if(!readiness.ready&&!String(exceptionReason).trim())return fail("O pacote não está pronto: libere as restrições bloqueantes ou justifique a exceção.");
  const pacotes=(lookahead.pacotes||[]).map(item=>item.id===packageId?{...readiness,status:LOOKAHEAD_PACKAGE_STATUS.COMMITTED,comprometido:true,excecaoCompromisso:readiness.ready?"":String(exceptionReason).trim()}:item);
  return {ok:true,lookahead:{...lookahead,pacotes}};
};
