import {buildAccumulatedWorkLedger} from "./dre-projection.js";
import {selectDRE,selectCashFlow} from "../src/domains/financeiro/ledger.js";
import {workStageCosts} from "../src/domains/financeiro/work-stage-costs.js";

export function buildClientFinancialRows({data,projectId,asOf,canonicalEvents=[],issues=[]}){
  const [year,month]=asOf.split("-").map(Number);
  const {ledger,missingStart}=buildAccumulatedWorkLedger(data,{year,month:month-1,obraIds:[projectId],asOf},canonicalEvents);
  const dre=selectDRE(ledger,{obraId:projectId,endDate:asOf.slice(0,7)});
  const cash=selectCashFlow(ledger,{obraId:projectId,endDate:asOf});
  const pending=missingStart.includes(projectId)||issues.some(issue=>!issue.obraId||issue.obraId===projectId)||ledger.issues.some(issue=>issue.severity==="error"&&(!issue.obraId||issue.obraId===projectId));
  const stages=workStageCosts(data,ledger,projectId,asOf);
  // Somente agregados. Nenhum salário, beneficiário ou evento individual sai.
  const groups=new Map();
  for(const [category,amountCents] of Object.entries(dre.costByCategoryCents))groups.set(category,{category,recognized:amountCents/100,paid:0});
  for(const event of [...cash.events.filter(event=>event.effect==="cash_out"),...cash.thirdPartyEvents]){
    const row=groups.get(event.category)||{category:event.category,recognized:0,paid:0};
    row.paid=(Math.round(row.paid*100)+event.amountCents)/100;groups.set(event.category,row);
  }
  return [
    {domain:"cost_summary",payload:{id:`custos-${projectId}`,asOf,available:!pending,recognized:pending?null:dre.costCents/100,paid:(cash.cashOutCents+cash.thirdPartyPaidCents)/100,laborToDate:pending?null:(groups.get("mao_obra")?.recognized||0),laborBenefitsToDate:pending?null:(groups.get("beneficios")?.recognized||0),categories:pending?[]:[...groups.values()]}},
    {domain:"stage_budget",payload:{id:`etapas-${projectId}`,asOf,available:!pending,hasBudget:Boolean(stages.budget),rows:stages.rows.map(row=>({id:row.id,name:row.label,budget:stages.budget?row.budget/100:null,recognized:pending?null:row.incurred/100,paid:(row.paid+row.clientPaid)/100,committed:row.committed/100})),budgetName:stages.budget?.nome||""}},
  ];
}
