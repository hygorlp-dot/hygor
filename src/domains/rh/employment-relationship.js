import {validDate} from './date-validation.js';

export const EMPLOYMENT_RELATIONSHIP_OPTIONS=Object.freeze([
  {v:'',l:'Não informado'},
  {v:'clt',l:'Empregado CLT'},
  {v:'autonomous',l:'Prestador autônomo'},
  {v:'other',l:'Outro vínculo informado'},
]);
const allowed=new Set(EMPLOYMENT_RELATIONSHIP_OPTIONS.map(option=>option.v));
const normalize=value=>String(value??'').trim().toLowerCase();

// Remuneração diária/mensal não identifica o contrato. O legado permanece
// desconhecido até uma decisão explícita do RH, com data e responsável.
export function employmentRelationshipOnDate(employee,date){
  const history=Array.isArray(employee?.employmentRelationshipHistory)?employee.employmentRelationshipHistory:[];
  const applicable=history.filter(item=>validDate(item.date)&&item.date<=date&&allowed.has(item.relationship))
    .sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
  if(applicable)return applicable.relationship;
  if(history.length||employee?.employmentRelationshipEffectiveFrom&&employee.employmentRelationshipEffectiveFrom>date)return '';
  const relationship=normalize(employee?.employmentRelationship);
  return allowed.has(relationship)?relationship:'';
}

export function prepareEmploymentRelationship({before,raw,mode,protectedUntil='',actorId,now}){
  const previous=normalize(before?.employmentRelationship);
  const relationship=raw.employmentRelationship==null?previous:normalize(raw.employmentRelationship);
  if(!allowed.has(relationship))return {ok:false,reason:'Vínculo contratual inválido.'};
  if(previous&&!relationship)return {ok:false,reason:'Não é possível apagar um vínculo já definido. Registre a alteração contratual com vigência e motivo.'};
  if(mode==='clt'&&relationship&&relationship!=='clt')return {ok:false,reason:'A modalidade mensal CLT é incompatível com o vínculo informado. Confira contrato e remuneração.'};
  const changed=before?relationship!==previous:!!relationship;
  const effectiveFrom=changed?String(raw.employmentRelationshipEffectiveFrom||(!before?raw.startDate:'')):before?.employmentRelationshipEffectiveFrom||'';
  const reason=String(raw.employmentRelationshipReason||'').trim().slice(0,1000);
  if(changed&&(!validDate(effectiveFrom)||effectiveFrom<raw.startDate))return {ok:false,reason:'Informe uma vigência do vínculo igual ou posterior à admissão.'};
  if(before&&changed&&protectedUntil&&effectiveFrom<=protectedUntil)return {ok:false,reason:`A vigência do vínculo deve ser posterior a ${protectedUntil}; fechamentos anteriores são preservados.`};
  if(before&&changed&&reason.length<10)return {ok:false,reason:'Informe o motivo da definição ou alteração do vínculo (ao menos 10 caracteres).'};
  const savedHistory=Array.isArray(before?.employmentRelationshipHistory)?before.employmentRelationshipHistory:[];
  const lastDate=savedHistory.map(item=>item.date).filter(validDate).sort().at(-1)||'';
  if(changed&&lastDate&&effectiveFrom<lastDate)return {ok:false,reason:`A nova vigência do vínculo não pode anteceder ${lastDate}. Solicite revisão identificada do histórico.`};
  const baseline=before&&validDate(before.startDate)&&!savedHistory.length?[{date:before.employmentRelationshipEffectiveFrom||before.startDate,relationship:previous,source:'baseline_preservada'}]:savedHistory;
  const history=changed?[...baseline,{date:effectiveFrom,relationship,reason:reason||'Definição no cadastro inicial',changedAt:now,changedBy:actorId}]:savedHistory;
  return {ok:true,fields:{employmentRelationship:relationship,
    employmentRelationshipEffectiveFrom:effectiveFrom,
    employmentRelationshipReason:changed?reason:before?.employmentRelationshipReason||'',
    employmentRelationshipHistory:history}};
}
