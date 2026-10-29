import { Inp, fmt } from "../../../LegacyApp";
import { CAMPOS_CUSTO_FINAL, custoFinalDaProposta } from "../final-cost";
import "./purchase-dossier.css";

export function CommercialTerms({proposal,onChange,disabled=false}){
  return <fieldset disabled={disabled} className="purchase-commercial-terms"><legend>Custo final da proposta</legend>
    <p>Valores em reais para todos os itens cotados. Informe 0 se não houver cobrança. Impostos já incluídos no preço não devem ser repetidos.</p>
    {Object.entries(CAMPOS_CUSTO_FINAL).map(([key,label])=><Inp key={key} label={`${label} (R$)`} type="number" value={proposal.custoFinal?.[key]??""} onChange={value=>onChange("custoFinal",{...(proposal.custoFinal||{}),[key]:value})} placeholder="Não informado"/>)}
    <Inp label="Condições de pagamento" value={proposal.condicoesPagamento||""} onChange={value=>onChange("condicoesPagamento",value)} placeholder="Ex.: 30/60 dias, sem juros"/>
  </fieldset>;
}

export function CostComparison({quote,supplierName}){
  const rows=(quote.propostas||[]).map(proposal=>({proposal,...custoFinalDaProposta(quote,proposal)}));
  const comparable=rows.filter(r=>r.complete&&r.coberturaCompleta);
  const minimum=comparable.length>1?Math.min(...comparable.map(r=>r.total)):null;
  return <section className="purchase-cost-comparison"><h3>Comparativo de custo final</h3>
    <p>Frete, desconto e despesas entram no custo dos itens por rateio proporcional. Compras parciais com adicionais exigem revisão da oferta. Só propostas completas para a mesma cesta recebem destaque.</p>
    <div className="purchase-cost-scroll"><table><thead><tr><th>Fornecedor</th><th>Itens</th><th>Frete</th><th>Desconto</th><th>Impostos adicionais</th><th>Despesas</th><th>Custo final</th><th>Entrega / pagamento</th></tr></thead><tbody>
      {rows.map(r=><tr key={r.proposal.id}><th>{supplierName(r.proposal.fornecedorId)}</th><td>{fmt(r.subtotal)}{!r.coberturaCompleta&&<small>Cesta incompleta</small>}</td>
        {Object.keys(CAMPOS_CUSTO_FINAL).map(key=><td key={key}>{r.missing.includes(key)?"Não informado":r.invalid.includes(key)?"Valor inválido":fmt(Number(r.proposal.custoFinal[key]))}</td>)}
        <td><strong>{r.complete?fmt(r.total):"A revisar"}</strong>{minimum!==null&&r.coberturaCompleta&&r.total===minimum&&<small>Menor custo final</small>}</td>
        <td>{r.proposal.prazoDias==null||r.proposal.prazoDias===""?"Prazo não informado":`${r.proposal.prazoDias} dias`}<small>{r.proposal.condicoesPagamento||"Pagamento não informado"}</small></td></tr>)}
    </tbody></table></div>
  </section>;
}
