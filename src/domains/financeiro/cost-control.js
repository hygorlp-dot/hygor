import {getActiveBudgetBaseline} from '../orcamentos/calculations.js';
import {active,buildFinancialLedger,invoiceAmount} from './ledger.js';
import {calcOrcadoComprado} from '../compras/budget-tracking.js';
import {isDateInClosedPeriod,isCompetenceInClosedPeriod} from './workflows.js';

export const COST_CONTROL_COMMAND=Object.freeze({COST_ALLOCATION_SAVED:'APROPRIACAO_CUSTO_SALVA',COST_FORECAST_SAVED:'PREVISAO_CONCLUSAO_SALVA'});
export const COST_CONTROL_COMMAND_TYPES=new Set(Object.values(COST_CONTROL_COMMAND));
const sources={nota_fiscal:'notasFiscais',outra_despesa:'outrasDesp',medicao_terceiro:'medicoesTerc'};
const norm=text=>String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const costControlWorkId=(data,command)=>String(command.payload?.obraId||'');
export function costControlStages(data,obraId){
 const candidate=getActiveBudgetBaseline(data,obraId,'controle').budget;
 const budget=candidate?.obraId===obraId?candidate:null;
 return {budget,stages:(budget?.etapas||[]).filter(s=>!s.parentId)};
}
// Assina fatos econômicos, sem depender de defaults ou textos normalizados
// apenas no cliente. Custos suplementares também são conferidos pela base
// numérica da etapa ao consumir a revisão em workStageCosts.
export function costPlanningFingerprint(data,obraId){
 const work=(data.obras||[]).find(w=>w.id===obraId);
 const tracking=calcOrcadoComprado(data,obraId);
 const events=buildFinancialLedger(data).events.filter(e=>e.obraId===obraId).map(e=>[e.id,e.effect,e.date||'',e.competence||'',e.amountCents]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 const links=Object.entries(sources).flatMap(([type,key])=>(data[key]||[]).filter(r=>r.obraId===obraId||r.rateios?.some(a=>a.obraId===obraId)).map(r=>[type,String(r.id),Number(r.version||0),r.etapaId||'',r.orcNivel1Id||'',(r.rateios||[]).filter(a=>a.obraId===obraId).map(a=>[a.id||'',a.etapaId||''])]));
 const basis={budgetId:tracking.orc?.id||'',stages:(tracking.orc?.etapas||[]).map(s=>[s.id,s.parentId||'']),rows:tracking.linhas.map(r=>[r.it.id,Math.round(r.orcado*100),Math.round(r.comprometido*100),Math.round(r.recebido*100)]),unassigned:Math.round((tracking.semApropriacao||0)*100),unassignedReceived:Math.round((tracking.semApropriacaoRecebida||0)*100)};
 const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
 const json=JSON.stringify(stable({startDate:work?.startDate||'',contractStart:work?.contractStart||'',events,links,basis}));
 let a=2166136261,b=5381;for(let i=0;i<json.length;i++){a=Math.imul(a^json.charCodeAt(i),16777619);b=Math.imul(b,33)^json.charCodeAt(i);}
 return `${json.length}-${a>>>0}-${b>>>0}`;
}
export function allocationSuggestions(data,report,obraId){
 const unassigned=report.rows.find(r=>r.id==='unassigned');
 const roots=new Map((report.budget?.etapas||[]).map(s=>[s.id,s]));
 const root=id=>{let s=roots.get(id);const seen=new Set();while(s?.parentId){if(seen.has(s.id))return '';seen.add(s.id);s=roots.get(s.parentId);}return s?.id||'';};
 return (unassigned?.entries.incurred||[]).filter(e=>e.amountCents>0).map(entry=>{
   const record=entry.record;
   const texts=[record?.descricao,...(record?.itensNota||[]).map(i=>i.descricao)].map(norm).filter(Boolean);
   const matches=new Set((report.budget?.itens||[]).filter(i=>i.tipo!=='titulo'&&texts.includes(norm(i.descricao||i.nome))).map(i=>root(i.etapaId)).filter(Boolean));
   const supported=Boolean(sources[entry.sourceType]&&record);
   const reason=matches.size===1?'Descrição idêntica a item do orçamento; confirme a etapa.':matches.size>1?'Descrição presente em mais de uma etapa. Escolha após conferir a origem.':'Sem correspondência inequívoca. Confira o lançamento e escolha a etapa.';
   return {id:entry.id,entry,supported,suggestedStageId:matches.size===1?[...matches][0]:'',reason,obraId};
 });
}
export function applyCostControlCommand(data,command,now=new Date().toISOString()){
 if(!COST_CONTROL_COMMAND_TYPES.has(command.type))return null;
 const fail=reason=>({ok:false,reason});
 const p=command.payload||{},obraId=costControlWorkId(data,command);
 const work=(data.obras||[]).find(w=>w.id===obraId);
 if(!work)return fail('Obra não encontrada.');
 if(!command.actorId)return fail('Sessão indisponível para revisar custos.');
 const {budget,stages}=costControlStages(data,obraId);
 if(!budget||budget.id!==p.budgetId)return fail('O orçamento de controle mudou. Atualize a conferência.');
 if(!stages.some(s=>s.id===p.stageId))return fail('Escolha uma etapa de primeiro nível do orçamento de controle.');
 const note=String(p.note||'').trim();
 if(note.length<5||note.length>2000)return fail('Informe uma justificativa entre 5 e 2.000 caracteres.');
 const audit={at:now,byId:String(command.actorId),by:String(command.actorName||'Usuário autenticado'),note};
 if(command.type===COST_CONTROL_COMMAND.COST_FORECAST_SAVED){
   const version=Number(work.costPlanning?.version||0);
   if(command.expectedVersion==null||Number(command.expectedVersion)!==version)return fail('A previsão foi revisada por outra pessoa. Atualize a tela.');
   if(p.fingerprint!==costPlanningFingerprint(data,obraId))return fail('Os custos ou o orçamento mudaram. Atualize a previsão.');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(p.asOf||'')||!Number.isFinite(Date.parse(p.asOf))||new Date(`${p.asOf}T12:00:00Z`).toISOString().slice(0,10)!==p.asOf||p.asOf>now.slice(0,10))return fail('Informe uma data de revisão válida até hoje.');
   if(typeof p.remainingCents!=='number'||!Number.isSafeInteger(p.remainingCents)||p.remainingCents<0)return fail('O custo restante precisa ser um valor válido, maior ou igual a zero.');
   if(!p.basis||['incurred','committed','budget'].some(k=>!Number.isSafeInteger(p.basis[k])))return fail('A memória de cálculo está incompleta. Atualize a previsão.');
   const revision={...audit,budgetId:budget.id,stageId:p.stageId,asOf:p.asOf,remainingCents:p.remainingCents,basis:{incurred:p.basis.incurred,committed:p.basis.committed,budget:p.basis.budget},fingerprint:p.fingerprint,version:version+1};
   const planning={...work.costPlanning,version:version+1,stages:{...work.costPlanning?.stages,[p.stageId]:revision},history:[...(work.costPlanning?.history||[]),revision].slice(-100)};
   return {ok:true,entityId:work.id,data:{...data,obras:data.obras.map(w=>w.id===work.id?{...w,costPlanning:planning}:w)}};
 }
 const key=sources[p.sourceType],record=(data[key]||[]).find(r=>String(r.id)===String(p.sourceId));
 if(!key||!record||!active(record))return fail('Origem não encontrada ou inativa. Confira o lançamento original.');
 if(command.expectedVersion==null||Number(record.version||0)!==Number(command.expectedVersion))return fail('O lançamento foi alterado por outra pessoa. Atualize a conferência.');
 if(isDateInClosedPeriod(data,record.emissao||record.dataEmissao||record.data)||isCompetenceInClosedPeriod(data,String(record.competencia||record.emissao||record.dataEmissao||record.data||'').slice(0,7)))return fail('O período deste custo está fechado. Reabra antes de alterar sua apropriação.');
 let patch;
 if(p.sourceType==='nota_fiscal'){
   const allocations=record.rateios?.length?record.rateios:[{id:'principal',obraId:record.obraId,valor:invoiceAmount(record)/100,percentual:100}];
   const matches=allocations.filter(r=>active(r)&&r.obraId===obraId&&(record.rateios?.length?String(r.id)===String(p.sourceSubId):true));
   if(matches.length!==1)return fail('O rateio não é único ou não pertence à obra selecionada. Confira a nota fiscal.');
   const selected=matches[0];
   patch={rateios:allocations.map(r=>r===selected?{...r,etapaId:p.stageId}:r)};
 }else{
   if(record.obraId!==obraId)return fail('O lançamento pertence a outra obra.');
   patch={etapaId:p.stageId};
 }
 const saved={...record,...patch,version:Number(record.version||0)+1,updatedAt:now,updatedById:audit.byId,updatedBy:audit.by,costAllocationHistory:[...(record.costAllocationHistory||[]),{...audit,stageId:p.stageId,budgetId:budget.id,sourceSubId:p.sourceSubId||'',previousStageId:record.rateios?.find(r=>String(r.id)===String(p.sourceSubId))?.etapaId||record.etapaId||''}].slice(-100)};
 return {ok:true,entityId:saved.id,data:{...data,[key]:data[key].map(r=>r===record?saved:r)}};
}
