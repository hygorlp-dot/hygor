import {active,buildFinancialLedger,selectAccountsPayable,toCents} from "../financeiro/ledger.js";
import {isActiveThirdPartyContract,isThirdPartyRecordActive,isVisibleThirdPartyContract} from "../terceirizados/lifecycle.js";
import {thirdPartyMeasurementsForProject} from "../terceirizados/obra-measurements.js";

const same=(a,b)=>a!=null&&b!=null&&String(a)!==""&&String(a)===String(b);
const money=value=>Number.isFinite(Number(value))?Number(value):0;
const sum=(rows,key)=>rows.reduce((total,row)=>total+Number(row[key]||0),0);

// Projeção somente leitura: contratos e medições continuam em Terceiros;
// obrigação e baixa são lidas do razão, incluindo pagamentos via nota fiscal.
export function serviceContractPositions(data,{workIds=[],includeInactive=false}={}){
 const allowed=new Set(workIds.filter(id=>id!=null&&String(id)!=="").map(String));
 const contracts=(data.terceirizados||[]).filter(c=>allowed.has(String(c.obraId))&&!c.deletedAt&&(includeInactive||isVisibleThirdPartyContract(c))&&(c.tipoContrato==="medicao"||(c.etapas||[]).length));
 if(!contracts.length)return [];
 const ledger=buildFinancialLedger(data),positions=selectAccountsPayable(ledger).items;
 return contracts.map(contract=>{
  const linked=(data.medicoesTerc||[]).filter(m=>same(m.tercId,contract.id)&&isThirdPartyRecordActive(m)&&!m.deletedAt&&m.ativo!==false);
  const measurements=linked.filter(m=>same(m.obraId,contract.obraId)).sort((a,b)=>String(b.data||b.dataMedicao||"").localeCompare(String(a.data||a.dataMedicao||""))||String(b.id).localeCompare(String(a.id)));
  const ids=new Set(measurements.map(m=>String(m.id)));
  const amounts=positions.filter(p=>p.sourceType==="medicao_terceiro"&&ids.has(p.sourceId)&&same(p.obraId,contract.obraId));
  const pending=measurements.filter(m=>m.status==="rascunho");
  const approvedCents=sum(amounts,"increaseCents"),paidCents=sum(amounts,"decreaseCents"),balanceCents=sum(amounts,"balanceCents"),overpaidCents=sum(amounts,"overpaidCents");
  const events=ledger.events.filter(e=>same(e.obraId,contract.obraId)&&((e.sourceType==="medicao_terceiro"&&ids.has(e.sourceId))||(e.settlesSourceType==="medicao_terceiro"&&ids.has(e.settlesSourceId))));
  const issues=ledger.issues.filter(i=>same(i.obraId,contract.obraId)&&((i.sourceType==="medicao_terceiro"&&ids.has(String(i.sourceId)))||events.some(e=>e.sourceType===i.sourceType&&e.sourceId===String(i.sourceId))));
  if(linked.length!==measurements.length)issues.push({code:"CONTRACT_MEASUREMENT_WORK_MISMATCH",description:"Há medição com obra ausente ou divergente. Confira o vínculo em Terceiros; ela não foi agregada neste recorte."});
  const unallocatedIds=new Set((data.pagsTerceiros||[]).filter(p=>same(p.tercId,contract.id)&&active(p)&&!p.medicaoTercId&&!p.medicaoId).map(p=>String(p.id)));
  const unallocated=ledger.events.filter(e=>same(e.obraId,contract.obraId)&&e.sourceType==="pagamento_terceiro_legado"&&unallocatedIds.has(e.sourceId)&&e.effect==="cash_out");
  const progress=thirdPartyMeasurementsForProject({...data,terceirizados:[contract],medicoesTerc:measurements},contract.obraId)[0];
  const contractCents=toCents(money(contract.contractValue)||sum(contract.etapas||[],"valor"));
  const pendingCents=pending.reduce((total,m)=>total+toCents(money(m.total)),0);
  const invoices=(data.notasFiscais||[]).filter(n=>same(n.obraId,contract.obraId)&&(ids.has(String(n.medicaoTercId))||measurements.some(m=>same(m.notaFiscalId,n.id))));
  return {contract,measurements,invoices,events,issues,unallocated,canMeasure:isActiveThirdPartyContract(contract),contractCents,approvedCents,paidCents,balanceCents,overpaidCents,pendingCents,
   measuredCents:approvedCents+pendingCents,remainingCents:Math.max(0,contractCents-approvedCents),progress:progress?.avancoAprovado??null,
   measurementsDetail:measurements.map(m=>({measurement:m,position:amounts.find(p=>same(p.sourceId,m.id))||null})),
   counts:{pending:pending.length,toPay:amounts.filter(p=>p.balanceCents>1).length,rejected:measurements.filter(m=>m.status==="rejeitada").length}};
 }).sort((a,b)=>b.counts.pending-a.counts.pending||b.balanceCents-a.balanceCents||String(a.contract.name).localeCompare(String(b.contract.name)));
}

export function serviceContractsTotals(rows){
 return Object.fromEntries(["contractCents","measuredCents","approvedCents","paidCents","balanceCents","pendingCents"].map(key=>[key,sum(rows,key)]));
}
