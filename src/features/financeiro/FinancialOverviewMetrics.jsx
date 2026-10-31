import {Button} from "../../components/ui/button.jsx";
import "./financial-overview.css";

const currency = value => value==null?"Não disponível":Number(value).toLocaleString("pt-BR", {style:"currency", currency:"BRL"});

function Metric({label,value,detail,tone,primary=false,onClick}) {
  return <div className="financial-metric" data-primary={primary || undefined} data-tone={tone}>
    <dt>{label}</dt><dd>{onClick?<Button className="financial-metric__value" variant="link" onClick={onClick} aria-label={`Consultar memorial: ${label}`}>{currency(value)}</Button>:currency(value)}{detail && <small>{detail}</small>}</dd>
  </div>;
}

/** Presentation only. All amounts come from the existing canonical summary. */
export function FinancialOverviewMetrics({totals,margin,onSelect}) {
  return <div className="financial-summary">
    <section aria-labelledby="financial-result-heading"><h3 id="financial-result-heading">Resultado por competência</h3>
      <p className="financial-summary__description">Receitas e custos reconhecidos no período, independentemente do pagamento.</p>
      <dl><Metric label="Resultado" value={totals.result} onClick={onSelect?()=>onSelect("result"):undefined} primary tone={totals.result<0?"danger":undefined} detail={`Margem de ${margin.toLocaleString("pt-BR",{minimumFractionDigits:1,maximumFractionDigits:1})}%`}/>
        <Metric label="Receita reconhecida" value={totals.revenue} onClick={onSelect?()=>onSelect("revenue"):undefined}/><Metric label="Custos incorridos" value={totals.costs} onClick={onSelect?()=>onSelect("costs"):undefined}/></dl>
    </section>
    <section aria-labelledby="financial-cash-heading"><h3 id="financial-cash-heading">Movimento de caixa</h3>
      <p className="financial-summary__description">Valores efetivamente recebidos ou pagos no período.</p>
      <dl><Metric label="Entradas de caixa" value={totals.cashIn} onClick={onSelect?()=>onSelect("cashIn"):undefined}/><Metric label="Saídas de caixa" value={totals.cashOut} onClick={onSelect?()=>onSelect("cashOut"):undefined}/></dl>
    </section>
    <section aria-labelledby="financial-obligations-heading"><h3 id="financial-obligations-heading">Obrigações e recebimentos</h3>
      <p className="financial-summary__description">Saldos acumulados em aberto até o fim do mês selecionado.</p>
      <dl><Metric label="Contas a receber" value={totals.receivable} onClick={onSelect?()=>onSelect("receivable"):undefined}/><Metric label="Contas a pagar" value={totals.payable} onClick={onSelect?()=>onSelect("payable"):undefined}/></dl>
    </section>
  </div>;
}
