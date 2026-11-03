import {getActiveBudgetBaseline} from '../orcamentos/calculations.js';
import {isFinancialDate} from '../financeiro/dates.js';
import {shiftDay} from '../financeiro/cash-forecast.js';
import {productionNumber,productionUnit} from '../diario-obra/production.js';

export const BASELINE_COMMAND=Object.freeze({SCHEDULE_BASELINE_PROPOSED:'BASE_PLANEJAMENTO_PROPOSTA',SCHEDULE_BASELINE_APPROVED:'BASE_PLANEJAMENTO_APROVADA'});
export const BASELINE_COMMAND_TYPES=new Set(Object.values(BASELINE_COMMAND));
export const baselineRecords=(data,obraId)=>(data.scheduleBaselines||[]).filter(row=>row.schemaVersion===2&&row.obraId===obraId);
export const approvedVersions=(data,obraId)=>baselineRecords(data,obraId).filter(row=>row.status==='aprovada').sort((a,b)=>a.approvedAt.localeCompare(b.approvedAt)||a.number-b.number);
const fail=reason=>({ok:false,reason});
const range=row=>isFinancialDate(row.inicio)&&isFinancialDate(row.fim)&&row.inicio<=row.fim&&Date.parse(row.fim)-Date.parse(row.inicio)<=3660*86400000;
const safeSum=values=>{const value=values.reduce((a,b)=>a+b,0);return Number.isSafeInteger(value)?value:null;};
const workingDay=(day,cal)=>cal.weekdays.includes(new Date(`${day}T12:00:00Z`).getUTCDay())&&!cal.holidays.includes(day);
export function plannedFraction(start,finish,asOf,calendar){
 let total=0,elapsed=0;
 for(let day=start;day<=finish;day=shiftDay(day,1))if(workingDay(day,calendar)){total++;if(day<=asOf)elapsed++;}
 return {total,elapsed};
}

// Sources are read on the server. No client-supplied approved values are accepted.
export function proposeBaselineSnapshot(data,obraId){
 const plans=(data.planos||[]).filter(row=>row.obraId===obraId);
 if(plans.length!==1)return fail('A obra deve ter um único planejamento cadastrado.');
 const plan=plans[0],{budget,baseline}=getActiveBudgetBaseline(data,obraId,'controle');
 if(!budget||budget.obraId!==obraId||budget.versionStatus!=='aprovado'||!budget.lockedAt)return fail('A linha de base exige orçamento de controle aprovado e bloqueado.');
 const priced=(budget.itens||[]).filter(item=>item.tipo!=='titulo');
 if(!priced.length)return fail('O orçamento de controle não tem itens executivos.');
 const stages=budget.etapas||[];
 const tasks=(plan.tarefas||[]).filter(task=>task.status!=='cancelado'&&!task.titulo&&!(task.etapaId&&stages.some(stage=>stage.parentId===task.etapaId)&&!priced.some(item=>item.etapaId===task.etapaId&&Number(item.quantidade)*Number(item.precoUnit)>0)));
 if(!plan.id||!tasks.length||tasks.some(task=>!task.id||!range(task)||tasks.filter(other=>other.id===task.id).length!==1))return fail('Confira identificação única, início e fim de todas as atividades executivas (até 10 anos por atividade).');
 const weekdays=plan.diasSemana||[1,2,3,4,5,6];
 if(!Array.isArray(weekdays)||!weekdays.length||weekdays.some(day=>!Number.isInteger(day)||day<0||day>6))return fail('Confira os dias trabalhados do calendário do plano.');
 const holidays=(plan.feriados||[]).map(row=>typeof row==='string'?row:row.data);
 if(holidays.some(day=>!isFinancialDate(day)))return fail('O calendário contém feriado sem data válida.');
 const calendar={weekdays:[...new Set(weekdays)].sort(),holidays:plan.pularFeriados===false?[]:[...new Set(holidays)].sort()};
 const activities=tasks.map(task=>({id:task.id,name:task.nome||task.id,stageId:task.etapaId||'',start:task.inicio,finish:task.fim}));
 if(activities.some(task=>!plannedFraction(task.start,task.finish,task.finish,calendar).total))return fail('Há atividade sem dia trabalhado entre início e fim; confira o calendário.');
 const items=[];
 for(const item of priced){
  const quantity=productionNumber(item.quantidade),price=productionNumber(item.precoUnit),amount=quantity===null||price===null?NaN:Math.round(quantity*price*100);
  if(!item.id||priced.filter(other=>other.id===item.id).length!==1||quantity===null||price===null||!Number.isFinite(quantity)||!Number.isFinite(price)||quantity<0||price<0||!Number.isSafeInteger(amount))return fail('Confira identificação, quantidade e preço dos itens do orçamento.');
  if(amount===0)continue;
  let stageId=item.etapaId,matched=[];const visited=new Set();
  while(stageId&&!visited.has(stageId)){
   visited.add(stageId);matched=activities.filter(task=>task.stageId===stageId);
   if(matched.length)break;
   stageId=stages.find(stage=>stage.id===stageId)?.parentId;
  }
  if(matched.length!==1)return fail(`O item ${item.descricao||item.id} precisa de uma única atividade executiva na sua etapa ou ancestral mais próximo. Não há rateio presumido.`);
  const task=matched[0];
  items.push({id:item.id,taskId:task.id,name:item.descricao||item.id,unit:productionUnit(item.unidade),quantity,unitPrice:price,budgetCents:amount,start:task.start,finish:task.finish});
 }
 const budgetCents=safeSum(items.map(item=>item.budgetCents));
 if(!budgetCents||items.some(item=>!item.unit||item.quantity<=0))return fail('A base deve ter valor positivo, quantidades e unidades válidas, dentro do limite numérico.');
 const snapshot={planId:plan.id,budgetId:budget.id,budgetVersionId:budget.versionId||budget.id,budgetBaselineId:baseline.id,calendar,activities,items,budgetCents,method:'linear_dias_trabalhados_v1'};
 return {ok:true,snapshot,signature:JSON.stringify(snapshot)};
}

export function applyBaselineCommand(data,command,now){
 if(!BASELINE_COMMAND_TYPES.has(command.type))return null;
 const p=command.payload||{},work=(data.obras||[]).find(row=>row.id===p.obraId);
 const role=command.actorRole;
 if(!work||!command.actorId||!['admin','diretoria','engenheiro','engenheiro_auditor','planejamento'].includes(role))return fail('Seu perfil não pode propor uma linha de base desta obra.');
 const records=baselineRecords(data,work.id),latest=approvedVersions(data,work.id).at(-1);
 if(command.type===BASELINE_COMMAND.SCHEDULE_BASELINE_PROPOSED){
  if(!p.id||(data.scheduleBaselines||[]).some(row=>row.id===p.id))return fail('Identificação da proposta já usada ou ausente.');
  const number=Math.max(0,...records.map(row=>row.number||0))+1;
  if(command.expectedVersion!==number-1)return fail('O histórico de versões mudou. Atualize a conferência.');
  if(String(p.reason||'').trim().length<10)return fail('Descreva a justificativa da proposta ou revisão com pelo menos 10 caracteres.');
  const built=proposeBaselineSnapshot(data,work.id);
  if(!built.ok)return built;
  if(p.signature!==built.signature)return fail('As datas, o orçamento ou o calendário mudaram. Confira novamente a proposta.');
  const row={id:p.id,obraId:work.id,schemaVersion:2,status:'rascunho',number,version:1,revisionOf:latest?.id||'',reason:String(p.reason).trim(),createdAt:now,createdById:command.actorId,createdBy:command.actorName||'',snapshot:built.snapshot,sourceSignature:built.signature};
  return {ok:true,entityId:row.id,data:{...data,scheduleBaselines:[...(data.scheduleBaselines||[]),row]}};
 }
 if(!['admin','diretoria'].includes(role))return fail('Somente administrador ou diretoria podem aprovar a linha de base.');
 const row=records.find(item=>item.id===p.id);
 if(!row||row.status!=='rascunho'||row.version!==command.expectedVersion)return fail('A proposta mudou ou já foi aprovada. Atualize a conferência.');
 if(row.revisionOf!==(latest?.id||''))return fail('Outra revisão foi aprovada. Prepare nova proposta ligada à versão vigente.');
 const built=proposeBaselineSnapshot(data,work.id);
 if(!built.ok)return built;
 if(built.signature!==row.sourceSignature)return fail('O planejamento ou orçamento mudou desde a proposta. Prepare nova proposta antes de aprovar.');
 const approved={...row,status:'aprovada',version:row.version+1,approvedAt:now,approvedOn:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(now)),approvedById:command.actorId,approvedBy:command.actorName||''};
 return {ok:true,entityId:row.id,data:{...data,scheduleBaselines:data.scheduleBaselines.map(item=>item.id===row.id?approved:item)}};
}

function itemMeasurement(data,obraId,budgetId,item,asOf){
 const logs=(data.rdos||[]).filter(log=>log.obraId===obraId&&isFinancialDate(log.data)&&log.data<=asOf&&log.status!=='cancelado');
 let result={progress:null,sourceId:'',sourceDate:'',reason:'Item sem medição acumulada revisada.'};
 for(const log of logs.filter(log=>log.status==='concluido'&&log.revisaoEngenheiro?.aprovado).sort((a,b)=>a.data.localeCompare(b.data))){
  const matches=(log.servicos||[]).filter(service=>service.budgetItemId===item.id);
  if(!matches.length)continue;
  const service=matches[0],value=productionNumber(service.progressoAte);
  const valid=matches.length===1&&(log.servicos||[]).filter(row=>row.tarefaId===item.taskId).length===1&&logs.filter(other=>other.data===log.data).length===1&&service.tarefaId===item.taskId&&service.budgetId===budgetId&&productionUnit(service.unidade)===item.unit&&Number(service.budgetQuantity)===item.quantity&&value!==null&&Number.isFinite(value)&&value>=0&&value<=100;
  result={progress:valid?value:null,sourceId:log.id,sourceDate:log.data,reason:valid?'':'Medição duplicada, inválida ou incompatível com o item, atividade e orçamento congelados.'};
 }
 return result;
}

export function scheduleSpi(data,{obraId,asOf,baselineId}={}){
 const versions=approvedVersions(data,obraId).filter(row=>isFinancialDate(row.approvedOn||row.approvedAt?.slice(0,10))&&(row.approvedOn||row.approvedAt.slice(0,10))<=asOf);
 const baseline=baselineId?versions.find(row=>row.id===baselineId):versions.at(-1);
 const unavailable={spi:null,pv:null,ev:null,sv:null,budgetCents:null,coverage:null,baselineId:'',number:null,approvedAt:'',approvedOn:'',approvedBy:'',rows:[],reason:'Sem linha de base versionada aprovada até a referência.'};
 if(!isFinancialDate(asOf)||!baseline)return unavailable;
 const snapshot=baseline.snapshot;
 if(!snapshot||baseline.sourceSignature!==JSON.stringify(snapshot)||!snapshot.items?.length)return {...unavailable,reason:'Integridade da versão aprovada inválida; confira o histórico.'};
 const rows=snapshot.items.map(item=>{
  const fraction=plannedFraction(item.start,item.finish,asOf,snapshot.calendar),measurement=itemMeasurement(data,obraId,snapshot.budgetId,item,asOf);
  const plannedCents=fraction.total?Number(BigInt(item.budgetCents)*BigInt(fraction.elapsed)/BigInt(fraction.total)):null;
  return {...item,...measurement,plannedCents,earnedCents:measurement.progress===null?null:Math.round(item.budgetCents*measurement.progress/100),plannedDays:fraction.total,elapsedDays:fraction.elapsed};
 });
 const measured=rows.filter(row=>row.earnedCents!==null),pv=safeSum(rows.map(row=>row.plannedCents)),ev=measured.length===rows.length?safeSum(rows.map(row=>row.earnedCents)):null;
 const coverage=safeSum(measured.map(row=>row.budgetCents))/snapshot.budgetCents;
 const reason=ev===null?'Falta medição revisada compatível de todos os itens com valor da versão aprovada.':pv===null||pv<=0?'Valor planejado nulo ou inválido na referência; SPI indisponível.':'';
 return {baselineId:baseline.id,number:baseline.number,approvedAt:baseline.approvedAt,approvedOn:baseline.approvedOn||baseline.approvedAt.slice(0,10),approvedBy:baseline.approvedBy,budgetCents:snapshot.budgetCents,pv,ev,sv:ev===null||pv===null?null:ev-pv,coverage,spi:!reason?ev/pv:null,reason,rows};
}
