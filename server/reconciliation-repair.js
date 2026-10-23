import {active} from "../src/domains/financeiro/ledger.js";
import {decodeAppData,encodeAppData} from "./data-codec.js";
import {buildLegacyFinancialFacts} from "./financial-shadow.js";
import {isDeepStrictEqual} from "node:util";

// Evidence reviewed on 23/10/2026. Never infer a new payment or invoice.
const repairs=[
  {transactionId:"2f9mi4zbxupv",section:"despesasEmpresa",documentId:"0kjw0yag16sh",value:-108.77},
  {transactionId:"budlh0lmxrta",section:"outrasDesp",documentId:"r94yv49z1ltd",value:-1320},
  {transactionId:"l4bigx6gxrta",section:"outrasDesp",documentId:"h8uh6em62hkb",value:-2200},
  {transactionId:"mt7l9lt5xrta",section:"despesasEmpresa",documentId:"e9qk6c3xh3a1",value:7160,pending:true},
];

export const repairAuditedReconciliation=(data,companyId)=>{
  let next=data;
  const changes=[];
  if(companyId!=="arcd")return {data,changes};
  for(const repair of repairs){
    const transaction=(next.transacoes||[]).find(item=>item.id===repair.transactionId);
    if(!transaction||transaction.reconciliationRepair?.revision==="20261023")continue;
    // A user may have formally corrected the association in the meantime.
    if(transaction.status!=="conciliado")continue;
    const document=(next[repair.section]||[]).find(item=>item.id===repair.documentId);
    const evidence=(transaction.gerados||[]).length===1&&transaction.gerados[0]===repair.documentId;
    if(!document||!evidence||Number(transaction.valor)!==repair.value||
      Number(document.valor)!==-repair.value||
      active(document)===Boolean(repair.pending))throw new Error(`Historical reconciliation evidence changed: ${repair.transactionId}`);
    if(!repair.pending&&document.transacaoId&&document.transacaoId!==transaction.id)throw new Error("Historical document already linked elsewhere");
    const audit={revision:"20261023",reason:repair.pending?"inactive_document":"restore_existing_association",
      previous:{status:transaction.status,vinculo:transaction.vinculo||null,gerados:transaction.gerados}};
    next={...next,
      ...(!repair.pending?{[repair.section]:next[repair.section].map(item=>item.id===document.id?{...item,transacaoId:transaction.id}:item)}:{}),
      transacoes:next.transacoes.map(item=>item.id!==transaction.id?item:{...item,reconciliationRepair:audit,
        ...(repair.pending?{status:"pendente",vinculo:null,gerados:[],valorVinculado:0,saldoNaoVinculado:Math.abs(repair.value)}:{})}),
    };
    changes.push({transactionId:transaction.id,documentId:document.id,action:audit.reason});
  }
  return {data:next,changes};
};

// Preserve all actual titles, settlements, amounts, dates and DRE recognition.
// Restoring the bank association also restores the cash presentation that the
// source DRE omitted, although the canonical settlement already existed.
const economicSnapshot=data=>{
  const snapshot=buildLegacyFinancialFacts(data);
  return {facts:snapshot.facts.map(fact=>({...fact,settlements:fact.settlements.map(({bankTransactionLegacyId:_bank,...payment})=>payment)})),
    dreSnapshots:snapshot.dreSnapshots.map(row=>({...row,payload:Object.fromEntries(Object.entries(row.payload||{}).filter(([key])=>!["saidasCaixa","saldoCaixa"].includes(key)))}))};
};

// Caller holds a transaction and the source-row lock through canonical sync.
export const repairLockedReconciliation=async(tx,source,companyId)=>{
  const before=decodeAppData(source.value);
  const repaired=repairAuditedReconciliation(before,companyId);
  if(!repaired.changes.length)return {data:before,changes:[]};
  if(!isDeepStrictEqual(economicSnapshot(before),economicSnapshot(repaired.data)))throw new Error("Repair would change financial facts or DRE recognition");
  await tx`update company_app_data set value=${tx.json(encodeAppData(repaired.data))},updated_at=now() where company_id=${companyId} and key=${"arced_ponto_v1"}`;
  await tx`insert into audit_events(company_id,aggregate_type,aggregate_id,action,actor_id,payload)
    values(${companyId},${"bank_reconciliation"},${"20261023"},${"REPAIR_EXISTING_ASSOCIATIONS"},${"system:production-deploy"},${tx.json({changes:repaired.changes,paymentsPreserved:true})})`;
  return repaired;
};
