import {buildRequestedDreProjectionRows} from "./dre-projection.js";
import {closedCompanyDreEntries} from "./financial-closing-read.js";
import {buildFinancialLedger} from "../src/domains/financeiro/ledger.js";
import {createMonthlyClosingSnapshot} from "../src/domains/financeiro/workflows.js";
import {cobrancaLocacao,diasLocacaoNoPeriodo} from "../src/domains/equipamentos/calculations.js";

const normalize=value=>{
  if(typeof value==="number"){
    if(!Number.isFinite(value))return null;
    return Object.is(value,-0)?0:value;
  }
  if(Array.isArray(value))return value.map(normalize);
  if(value&&typeof value==="object"){
    return Object.fromEntries(
      Object.keys(value).sort().map(key=>[key,normalize(value[key])]),
    );
  }
  return value??null;
};

const fingerprint=value=>JSON.stringify(normalize(value));

const flatten=(value,prefix="",out=new Map())=>{
  if(Array.isArray(value)){
    value.forEach((item,index)=>flatten(item,`${prefix}[${index}]`,out));
    return out;
  }
  if(value&&typeof value==="object"){
    Object.keys(value).sort().forEach(key=>
      flatten(value[key],prefix?`${prefix}.${key}`:key,out));
    return out;
  }
  out.set(prefix,value??null);
  return out;
};

const differences=(expected,actual,limit=20)=>{
  const left=flatten(normalize(expected)),right=flatten(normalize(actual));
  const paths=[...new Set([...left.keys(),...right.keys()])].sort();
  const result=[];
  for(const path of paths){
    if(Object.is(left.get(path),right.get(path)))continue;
    result.push({path,closed:left.get(path)??null,recomputed:right.get(path)??null});
    if(result.length>=limit)break;
  }
  return result;
};

const closedByCompetence=data=>new Map(
  closedCompanyDreEntries(data).map(item=>[item.competencia,item]),
);

const competenceOfDate=value=>{
  const raw=String(value||"");
  return /^\d{4}-\d{2}/.test(raw)?raw.slice(0,7):"";
};

export const closedCompetenceForDate=(data,date)=>{
  const ym=competenceOfDate(date);
  return ym?closedByCompetence(data).get(ym)||null:null;
};

const eventProjection=event=>event?{
  id:String(event.id||""),
  effect:String(event.effect||""),
  amountCents:Number(event.amountCents||0),
  date:String(event.date||"").slice(0,10),
  competence:String(event.competence||"").slice(0,7),
  obraId:String(event.obraId||""),
  category:String(event.category||""),
  sourceType:String(event.sourceType||""),
  sourceId:String(event.sourceId||""),
  sourceSubId:String(event.sourceSubId||""),
  settlesSourceType:String(event.settlesSourceType||""),
  settlesSourceId:String(event.settlesSourceId||""),
  transactionId:String(event.transactionId||""),
  status:String(event.status||""),
  unallocated:!!event.unallocated,
  dueDate:String(event.metadata?.dueDate||"").slice(0,10),
}:null;

const eventTouchesClosed=(event,closed)=>{
  if(!event)return null;
  const projection=eventProjection(event);
  // Caixa e baixa pertencem à data da própria liquidação. A competência
  // herdada do título continua sendo útil ao razão, mas não transforma um
  // recebimento de agosto em uma alteração do reconhecimento de julho.
  const isSettlement=[
    "cash_in","cash_out","receivable_decrease","payable_decrease","third_party_payment",
  ].includes(projection.effect);
  const competences=isSettlement?[competenceOfDate(projection.date)]:[
    projection.competence,
    competenceOfDate(projection.date),
    competenceOfDate(projection.dueDate),
  ];
  for(const ym of competences){
    if(ym&&closed.has(ym))return closed.get(ym);
  }
  return null;
};

const closedLedgerChanges=(before,after)=>{
  const closed=closedByCompetence(before);
  if(!closed.size)return [];
  const beforeEvents=new Map(buildFinancialLedger(before).events.map(event=>[event.id,event]));
  const afterEvents=new Map(buildFinancialLedger(after).events.map(event=>[event.id,event]));
  const ids=[...new Set([...beforeEvents.keys(),...afterEvents.keys()])].sort();
  const changes=[];
  for(const id of ids){
    const previous=beforeEvents.get(id)||null;
    const current=afterEvents.get(id)||null;
    const previousProjection=eventProjection(previous);
    const currentProjection=eventProjection(current);
    if(fingerprint(previousProjection)===fingerprint(currentProjection))continue;
    const closing=eventTouchesClosed(previous,closed)||eventTouchesClosed(current,closed);
    if(!closing)continue;
    changes.push({
      competence:closing.competencia,
      code:"closed_financial_event_changed",
      eventId:id,
      sourceType:String(current?.sourceType||previous?.sourceType||""),
      sourceId:String(current?.sourceId||previous?.sourceId||""),
      differences:differences(previousProjection,currentProjection),
    });
  }
  return changes;
};

const bankProjection=row=>row?{
  id:String(row.id||""),
  date:String(row.data||"").slice(0,10),
  amount:Number(row.valor||0),
  status:String(row.status||""),
  obraId:String(row.obraId||""),
  statementId:String(row.extratoId||""),
  description:String(row.descricao||""),
}:null;

const closedBankChanges=(before,after)=>{
  const beforeMap=new Map((before?.transacoes||[])
    .map(item=>[String(item?.id||""),item]).filter(([id])=>id));
  const afterMap=new Map((after?.transacoes||[])
    .map(item=>[String(item?.id||""),item]).filter(([id])=>id));
  const ids=[...new Set([...beforeMap.keys(),...afterMap.keys()])].sort();
  const changes=[];
  for(const id of ids){
    const previous=beforeMap.get(id)||null,current=afterMap.get(id)||null;
    const previousProjection=bankProjection(previous),currentProjection=bankProjection(current);
    if(fingerprint(previousProjection)===fingerprint(currentProjection))continue;
    const closing=closedCompetenceForDate(before,previous?.data)
      ||closedCompetenceForDate(before,current?.data);
    if(!closing)continue;
    changes.push({
      competence:closing.competencia,
      code:"closed_bank_transaction_changed",
      transactionId:id,
      differences:differences(previousProjection,currentProjection),
    });
  }
  return changes;
};

const closedMonthBounds=competence=>{
  const [year,month]=String(competence||"").split("-").map(Number);
  if(!Number.isInteger(year)||!Number.isInteger(month)||month<1||month>12)return null;
  return {
    start:`${competence}-01`,
    end:`${competence}-${String(new Date(year,month,0).getDate()).padStart(2,"0")}`,
  };
};

const equipmentById=(data,id)=>(data?.equipamentos||[])
  .find(item=>String(item?.id||"")===String(id||""))||null;

const rentalEffect=(data,row,competence)=>{
  if(!row||String(row.status||"")==="cancelada")return null;
  const bounds=closedMonthBounds(competence);
  if(!bounds)return null;
  const days=diasLocacaoNoPeriodo(row,bounds.start,bounds.end);
  if(!days)return null;
  const equipment=equipmentById(data,row.equipamentoId);
  const billing=cobrancaLocacao(row,equipment,days);
  const money=value=>Math.round(Number(value||0)*100);
  return {
    equipmentId:String(row.equipamentoId||""),
    obraId:String(row.obraId||""),
    days,
    quantity:Math.max(1,Number(row.quantidade||1)),
    revenueCents:money(billing.liquido),
    discountCents:money(billing.desconto),
    ownerCostCents:equipment?.proprietarioId?money(billing.liquido):0,
  };
};

const maintenanceEffect=(row,competence)=>{
  if(!row)return null;
  const date=String(row.data||row.inicio||"").slice(0,10);
  if(competenceOfDate(date)!==competence)return null;
  if(String(row.status||"")==="cancelada"||String(row.pagoPor||"")==="proprietario")return null;
  return {
    equipmentId:String(row.equipamentoId||""),
    obraId:String(row.obraId||""),
    date,
    costCents:Math.round(Number(row.custo||0)*100),
    payer:String(row.pagoPor||""),
  };
};

const rowsById=rows=>new Map((rows||[])
  .map(row=>[String(row?.id||""),row]).filter(([id])=>id));

const closedEquipmentChanges=(before,after)=>{
  const changes=[];
  const closed=closedCompanyDreEntries(before);
  if(!closed.length)return changes;

  const beforeRentals=rowsById(before?.locacoesEquip);
  const afterRentals=rowsById(after?.locacoesEquip);
  for(const id of [...new Set([...beforeRentals.keys(),...afterRentals.keys()])].sort()){
    const previous=beforeRentals.get(id)||null,current=afterRentals.get(id)||null;
    for(const closing of closed){
      const previousEffect=rentalEffect(before,previous,closing.competencia);
      const currentEffect=rentalEffect(after,current,closing.competencia);
      if(fingerprint(previousEffect)===fingerprint(currentEffect))continue;
      changes.push({
        competence:closing.competencia,
        code:"closed_equipment_rental_changed",
        rentalId:id,
        differences:differences(previousEffect,currentEffect),
      });
    }
  }

  const beforeMaintenances=rowsById(before?.manutencoesEquip);
  const afterMaintenances=rowsById(after?.manutencoesEquip);
  for(const id of [...new Set([...beforeMaintenances.keys(),...afterMaintenances.keys()])].sort()){
    const previous=beforeMaintenances.get(id)||null,current=afterMaintenances.get(id)||null;
    for(const closing of closed){
      const previousEffect=maintenanceEffect(previous,closing.competencia);
      const currentEffect=maintenanceEffect(current,closing.competencia);
      if(fingerprint(previousEffect)===fingerprint(currentEffect))continue;
      changes.push({
        competence:closing.competencia,
        code:"closed_equipment_maintenance_changed",
        maintenanceId:id,
        differences:differences(previousEffect,currentEffect),
      });
    }
  }
  return changes;
};

const snapshotProjection=closing=>closing?{
  competencia:String(closing.competencia||""),
  status:String(closing.status||""),
  snapshot:closing.snapshot||null,
}:null;

const closedSnapshotChanges=(before,after)=>{
  const beforeClosed=closedByCompetence(before);
  const afterClosed=closedByCompetence(after);
  const changes=[];
  for(const [competence,entry] of beforeClosed){
    const beforeClosing=(before?.fechamentosFinanceiros||[])
      .find(item=>String(item?.id||"")===entry.closingId);
    const afterEntry=afterClosed.get(competence);
    const afterClosing=afterEntry&&(after?.fechamentosFinanceiros||[])
      .find(item=>String(item?.id||"")===afterEntry.closingId);
    if(fingerprint(snapshotProjection(beforeClosing))===fingerprint(snapshotProjection(afterClosing)))continue;
    changes.push({
      competence,
      code:"closed_snapshot_modified",
      differences:differences(snapshotProjection(beforeClosing),snapshotProjection(afterClosing)),
    });
  }
  return changes;
};

/**
 * Regra de escrita depois do fechamento:
 * congela fatos históricos datados, não parâmetros mestres.
 *
 * Alterar salário, alíquota, nome da empresa ou contrato vigente não reabre
 * julho; a leitura de julho usa o snapshot fechado. Já incluir/editar/remover
 * um recebimento, pagamento, documento, banco, locação ou manutenção que toca
 * julho é uma alteração do fato histórico e é recusada.
 */
export const validateClosedCompanyDreMutation=({before={},after={}}={})=>{
  if(!closedCompanyDreEntries(before).length)return{ok:true,changes:[]};
  const changes=[
    ...closedSnapshotChanges(before,after),
    ...closedLedgerChanges(before,after),
    ...closedBankChanges(before,after),
    ...closedEquipmentChanges(before,after),
  ];
  return{ok:changes.length===0,changes};
};

const removeCompetenceClosing=(data,competence)=>({
  ...data,
  fechamentosFinanceiros:(data?.fechamentosFinanceiros||[])
    .filter(item=>String(item?.competencia||"")!==competence),
});

const derivedFinancialSnapshot=(data,competence)=>{
  const [year,month]=competence.split("-").map(Number);
  const dreRow=buildRequestedDreProjectionRows(data,[{
    year,month:month-1,period:"mes",scope:"company_dre",
  }])[0];
  const closing=createMonthlyClosingSnapshot(removeCompetenceClosing(data,competence),{
    competencia:competence,
    canonicalDreSnapshot:{payload:dreRow?.payload||{}},
  });
  if(!closing?.ok)return{ok:false,error:closing?.error||"Falha ao recomputar a competência."};
  const snapshot=closing.closing.snapshot||{};
  return{ok:true,value:{
    revenueCents:Number(snapshot.revenueCents||0),
    costCents:Number(snapshot.costCents||0),
    resultCents:Number(snapshot.resultCents||0),
    cashInCents:Number(snapshot.cashInCents||0),
    cashOutCents:Number(snapshot.cashOutCents||0),
    cashBalanceCents:Number(snapshot.cashBalanceCents||0),
    receivableCents:Number(snapshot.receivableCents||0),
    payableCents:Number(snapshot.payableCents||0),
    commitmentCents:Number(snapshot.commitmentCents||0),
    canonicalDre:dreRow?.payload||{},
  }};
};

/**
 * Usado apenas para mudanças de REPRESENTAÇÃO (arquivar/restaurar ponto):
 * os fatos continuam os mesmos, portanto a projeção derivada antes/depois
 * precisa permanecer idêntica. Comparamos before × after, não contra o
 * snapshot histórico, para não confundir mudança posterior de parâmetros
 * mestres com alteração da quinzena.
 */
export const validateClosedRepresentationPreservation=({before={},after={}}={})=>{
  const changes=[];
  for(const closing of closedCompanyDreEntries(before)){
    const previous=derivedFinancialSnapshot(before,closing.competencia);
    const current=derivedFinancialSnapshot(after,closing.competencia);
    if(!previous.ok||!current.ok){
      changes.push({
        competence:closing.competencia,
        code:"closed_representation_recompute_failed",
        error:previous.error||current.error||"Falha ao recomputar a competência.",
        differences:[],
      });
      continue;
    }
    if(fingerprint(previous.value)===fingerprint(current.value))continue;
    changes.push({
      competence:closing.competencia,
      code:"closed_representation_changed",
      differences:differences(previous.value,current.value),
    });
  }
  return{ok:changes.length===0,changes};
};
