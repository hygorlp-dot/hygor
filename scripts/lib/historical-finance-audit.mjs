import {createHash} from 'node:crypto';
import {buildFinancialLedger,selectDRE} from '../../src/domains/financeiro/ledger.js';
import {canonicalDreEvents} from '../../server/financial-dre-integration.js';
import {buildRequestedDreProjectionRows} from '../../server/dre-projection.js';
import {annualSourceValues} from '../../src/domains/dre/annual-statement.js';
import {createMonthlyClosingSnapshot} from '../../src/domains/financeiro/workflows.js';
import {getPlanningBudget} from '../../src/domains/orcamentos/calculations.js';
import {legacyPlanSyncIssue} from '../../src/domains/planejamento/legacy-plan-sync.js';

export const historicalFingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const cents=value=>Math.round(Number(value||0)*100);
const derivedSources=new Set(['deducaoISS','deducaoPIS','deducaoCOFINS','provisaoIR','provisaoCSLL']);
const occurrences=(value,target)=>{
 if(value===target)return 1;
 if(!value||typeof value!=='object')return 0;
 return Object.values(value).reduce((sum,child)=>sum+occurrences(child,target),0);
};

// This plan changes identifiers only. It never deletes events, repairs work
// links by name, changes a financial amount or writes to the source database.
export function planHistoricalSanitation(data){
 const groups=new Map(),patches=[],pending=[];
 for(const [index,row] of (data.changeLog||[]).entries()){
  if(!row?.id)continue;
  if(!groups.has(row.id))groups.set(row.id,[]);
  groups.get(row.id).push({index,row});
 }
 const used=new Set((data.changeLog||[]).map(row=>row.id));
 for(const [id,entries] of groups){
  if(entries.length<2)continue;
  const records=new Set(entries.map(({row})=>historicalFingerprint(row)));
  if(records.size!==entries.length||occurrences(data,id)!==entries.length){
   pending.push({code:'HISTORY_ID_REQUIRES_REVIEW',id,count:entries.length});continue;
  }
  for(const {index,row} of entries.slice(1)){
   const after=`${id}-historical-${historicalFingerprint(row).slice(0,12)}`;
   if(used.has(after))throw new Error('Colisão na identificação proposta; saneamento interrompido.');
   used.add(after);patches.push({collection:'changeLog',index,field:'id',before:id,after,recordFingerprint:historicalFingerprint(row)});
  }
 }
 return {sourceFingerprint:historicalFingerprint(data),patches,pending};
}

export function applyHistoricalSanitation(data,plan){
 if(historicalFingerprint(data)!==plan.sourceFingerprint)throw new Error('A cópia mudou depois da conferência; gere um novo plano.');
 const next=structuredClone(data);
 for(const patch of plan.patches){
  if(patch.collection!=='changeLog'||patch.field!=='id')throw new Error('Alteração fora do escopo do saneamento.');
  const row=next.changeLog?.[patch.index];
  if(!row||row.id!==patch.before||historicalFingerprint(row)!==patch.recordFingerprint)throw new Error('Registro histórico não corresponde à origem conferida.');
  row.id=patch.after;
 }
 return next;
}

export function memorialConference(payload){
 const values=annualSourceValues(payload),deltas=[],checks=[];
 for(const source of new Set([...Object.keys(values),...Object.keys(payload.memorial||{})])){
  if(derivedSources.has(source)){
   const rate=payload.memorialRates?.[source];
   const base=source.startsWith('deducao')?Math.max(0,Number(payload.faturamentoTotal||0)-Number(payload.descontoLocacoes||0)):Math.max(0,Number(payload.lair||0));
   const actual=rate==null?null:cents(base*Number(rate)/100);
   const check={source,expected:values[source]||0,actual,kind:'calculated',ok:actual===(values[source]||0)};
   checks.push(check);if(!check.ok)deltas.push(check);continue;
  }
  const actual=(payload.memorial?.[source]||[]).reduce((sum,item)=>sum+Number(item.amountCents||0),0);
  const check={source,expected:values[source]||0,actual,kind:'records',ok:actual===(values[source]||0)};
  checks.push(check);if(!check.ok)deltas.push(check);
 }
 return {ok:deltas.length===0,checks,deltas};
}

export function auditHistoricalFinance(data,{tables={},years,accountingPeriods=[],companyId='arcd'}={}){
 if(!years?.length||years.some(y=>!Number.isInteger(y)||y<2000||y>2100))throw new Error('Informe os anos exatos da revisão.');
 const startFingerprint=historicalFingerprint(data);
 const canonical=canonicalDreEvents({titles:tables.financial_titles||[],settlements:tables.settlements||[],banks:tables.bank_transactions||[]});
 const ledger=buildFinancialLedger(data,{supplementalEvents:canonical.events});
 const duplicateIds=[],orphanWorks=[],plans=[];
 const works=new Set((data.obras||[]).map(w=>w.id));
 for(const [collection,records] of Object.entries(data)){
  if(!Array.isArray(records))continue;const seen=new Set();
  for(const record of records){
   if(record?.id&&seen.has(record.id))duplicateIds.push({collection,id:record.id});seen.add(record?.id);
   if(record?.obraId&&!works.has(record.obraId))orphanWorks.push({collection,id:record.id,obraId:record.obraId});
  }
 }
 for(const plan of data.planos||[]){
  const {budget,source}=getPlanningBudget(data,plan.obraId,plan);
  plans.push({id:plan.id,obraId:plan.obraId,source,budgetId:budget?.id||'',issue:legacyPlanSyncIssue(data,plan.obraId,plan,budget,source),orphanWork:!works.has(plan.obraId)});
 }
 // An archived registry row explains a historical reference; it does not
 // authorize restoring the work, promoting a budget or rewriting the link.
 const historicalWorkReferences=[],unresolvedWorkReferences=[];
 for(const reference of orphanWorks){
  const candidates=(tables.core_projects||[]).filter(row=>row.company_id===companyId&&row.id===reference.obraId);
  const archived=candidates.length===1?candidates[0]:null;
  if(archived?.active===false&&archived.payload?.id===reference.obraId&&archived.archived_at&&Number.isFinite(Date.parse(archived.archived_at))){
   historicalWorkReferences.push({...reference,name:archived.name||'',archivedAt:archived.archived_at,source:'core_projects'});
  }else unresolvedWorkReferences.push(reference);
 }
 const requests=years.flatMap(year=>Array.from({length:12},(_,month)=>({year,month,scope:'company_dre',includeMemorial:true})));
 const projections=buildRequestedDreProjectionRows(data,requests,canonical.events),monthly=[];
 for(const row of projections){
  const payload=row.payload,ym=payload.ym,dre=selectDRE(ledger,{competence:ym});
  const preview=createMonthlyClosingSnapshot(data,{competencia:ym,supplementalEvents:canonical.events,canonicalDreSnapshot:{sourceId:row.sourceId,payload}});
  // This bridge explains the extra managerial sources. It must close in cents;
  // an unexplained difference is retained rather than forced into a residual.
  const sourceAmounts=Object.fromEntries(Object.entries(payload.memorial||{}).map(([source,items])=>[source,items.reduce((sum,item)=>sum+item.amountCents,0)]));
  const workSupplemental=Object.values(payload.memorial||{}).flat().filter(item=>['ponto','equipamento'].includes(item.sourceType)).reduce((sum,item)=>sum+item.amountCents,0);
  const bridge={canonicalResultCents:dre.resultCents,laborAndWorkEquipmentCents:workSupplemental,rentalRevenueCents:cents(payload.receitaLocacoes),rentalDiscountCents:cents(payload.descontoLocacoes),rentalOwnerCents:cents(payload.repasseEquipamentosTerceiros),rentalMaintenanceCents:cents(payload.manutencaoLocacoes),revenueTaxesCents:cents(payload.deducoesTributarias),incomeTaxesCents:cents(payload.totalImpostoLucro)};
  bridge.expectedCompanyResultCents=bridge.canonicalResultCents-bridge.laborAndWorkEquipmentCents+bridge.rentalRevenueCents-bridge.rentalDiscountCents-bridge.rentalOwnerCents-bridge.rentalMaintenanceCents-bridge.revenueTaxesCents-bridge.incomeTaxesCents;
  bridge.actualCompanyResultCents=cents(payload.lucroLiquido);
  bridge.differenceCents=bridge.actualCompanyResultCents-bridge.expectedCompanyResultCents;
  monthly.push({ym,canonical:{revenueCents:dre.revenueCents,costCents:dre.costCents,resultCents:dre.resultCents},company:{revenueCents:cents(payload.faturamentoTotal),costCents:cents(payload.totalCSP),operatingCents:cents(payload.totalDespOp),resultCents:cents(payload.lucroLiquido)},sourceAmounts,memorial:memorialConference(payload),bridge,preview:{ok:preview.ok,error:preview.error||'',checks:preview.conference?.checks||preview.closing?.conference?.checks||[]}});
 }
 const closings=(data.fechamentosFinanceiros||[]).map(closing=>{
  const snapshot=closing.snapshot?.canonicalDre;
  return {id:closing.id,competence:closing.competencia,status:closing.status,hasCanonicalPayload:Boolean(snapshot?.payload),memorial:snapshot?.payload?.memorial?memorialConference(snapshot.payload):null};
 });
 if(historicalFingerprint(data)!==startFingerprint)throw new Error('A conferência alterou a origem em memória.');
 return {sourceFingerprint:startFingerprint,years,duplicateIds,orphanWorks,historicalWorkReferences,unresolvedWorkReferences,plans,canonicalIssues:canonical.issues,ledgerIssues:ledger.issues,accountingPeriods,closings,monthly};
}
