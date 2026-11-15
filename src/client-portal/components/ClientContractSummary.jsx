import {portalMoney,portalDate,portalPercent} from "../format.js";
import {Button} from "../../design-system/primitives/Button.jsx";
export function ClientContractSummary({position,onViewContract}){
  if(!position)return <p className="arcd-client-muted">A equipe ainda não liberou a posição do contrato e das cobranças.</p>;
  const next=position.openInstallments?.[0];
  const due=(position.openInstallments||[]).filter(item=>item.dueDate===next?.dueDate);
  const sum=key=>due.reduce((total,item)=>total+item[key],0);
  return <section className="arcd-client-stack" aria-label="Contrato e cobrança do período"><h3>Contrato e {position.frequency==="quinzenal"?"quinzena":"cobrança do período"}</h3><div className="arcd-client-financial-grid">
    <article><span>Percentual acumulado do contrato</span><strong>{position.accumulatedPercentage===null?(position.measurementKind==="valor"?"Contrato por valor":"Aguardando medição"):portalPercent(position.accumulatedPercentage)}</strong><small>Valor correspondente: {portalMoney(position.accumulatedAmount)}</small><p>{position.measurementKind==="valor"?"As medições cadastradas são por valor, sem percentual acumulado informado.":"Percentual das medições emitidas do contrato. É diferente do avanço físico da obra."}</p></article>
    <article><span>{position.frequency==="quinzenal"?"Quinzena a pagar":"Parcela em aberto"}</span><strong>{next?portalMoney(sum("balance")):"Sem cobrança em aberto"}</strong><small>{next?`${next.description} · vencimento ${portalDate(next.dueDate,"A confirmar")}`:"Aguarde a emissão pela equipe."}</small>{next&&<small>Valor emitido {portalMoney(sum("amount"))} · recebido {portalMoney(sum("paid"))}{next.periodPercentage!==null?` · percentual do período ${portalPercent(next.periodPercentage)}`:""}</small>}{onViewContract&&<Button variant="secondary" onClick={onViewContract}>Ver contrato e recebimentos</Button>}</article>
  </div><p className="arcd-client-muted">Contrato vigente: {portalMoney(position.contractCurrent)} · posição em {portalDate(position.asOf)}. O acumulado é uma referência; o valor a pagar é o saldo das parcelas emitidas para o vencimento indicado.</p></section>;
}
