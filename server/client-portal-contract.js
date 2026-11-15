import {active,statusOf} from "../src/domains/financeiro/facts.js";
import {valorContratoVigente} from "../src/domains/obras/contract-amendments.js";
import {uniquePortalRecords} from './client-portal-records.js';
const amount=value=>Math.round((Number(value)||0)*100)/100;
export const clientContractMeasurements=(data,projectId,asOf)=>uniquePortalRecords((data.medicoes||[]).filter(item=>String(item.obraId)===projectId&&active(item)&&statusOf(item)!=="preparacao"&&(!item.dataEmissao||item.dataEmissao<=asOf)&&Boolean(item.dataEmissao||!item.competencia||item.competencia<=asOf.slice(0,7))));
export function clientMeasurementReceipts(measurement,asOf){
  if(measurement.recebimentos?.length)return uniquePortalRecords(measurement.recebimentos.filter(receipt=>active(receipt)&&receipt.data&&receipt.data<=asOf));
  const value=Number(measurement.valorRecebido||0);
  return value>0&&(!measurement.dataPagamento||measurement.dataPagamento<=asOf)?[{id:`recebimento-${measurement.id}`,valor:value,data:measurement.dataPagamento||measurement.dataVencimento}]:[];
}
export function buildClientContractPosition({data,projectId,asOf}){
  const work=data.obras?.find(item=>String(item.id)===projectId);
  if(!work)return null;
  const measurements=clientContractMeasurements(data,projectId,asOf);
  const receipts=item=>clientMeasurementReceipts(item,asOf).reduce((sum,receipt)=>sum+Number(receipt.valor||0),0);
  const open=measurements.map(item=>({id:item.id,description:item.descricao||item.numeroParcela||"Parcela do contrato",dueDate:/^\d{4}-\d{2}-\d{2}$/.test(item.dataVencimento||'')?item.dataVencimento:'',amount:amount(item.valorPrevisto),paid:amount(receipts(item)),balance:amount(Math.max(0,Number(item.valorPrevisto||0)-receipts(item))),accumulatedPercentage:item.tipo==="percentual"?Number(item.percentualAcumulado):null,periodPercentage:item.tipo==="percentual"?Number(item.percentualPeriodo):null})).filter(item=>item.balance>0).sort((a,b)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999')||String(a.id).localeCompare(String(b.id)));
  const percentages=measurements.filter(item=>item.tipo==="percentual"&&(!item.competencia||item.competencia<=asOf.slice(0,7))).sort((a,b)=>String(a.dataEmissao||a.competencia||"").localeCompare(String(b.dataEmissao||b.competencia||""))||String(a.dataVencimento||"").localeCompare(String(b.dataVencimento||"")));
  const latest=percentages.at(-1),percentage=latest?Math.max(0,Math.min(100,Number(latest.percentualAcumulado)||0)):null;
  const contract=valorContratoVigente(work);
  return {domain:"contract_position",payload:{id:`contrato-${projectId}`,asOf,frequency:work.billingFrequency||"",measurementKind:latest?'percentual':measurements.length?'valor':'sem_medicao',contractCurrent:contract,accumulatedPercentage:percentage,accumulatedAmount:percentage===null?null:amount(contract*percentage/100),openInstallments:open}};
}
