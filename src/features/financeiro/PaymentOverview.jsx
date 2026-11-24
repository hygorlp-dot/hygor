import {Button} from '../../components/ui/button.jsx';
import './payment-workspace.css';

export default function PaymentOverview({metrics,stages,filter,onStage,onMetric,formatMoney}){
 return <>
 <dl className="mrc-kpi-strip mrc-kpi-strip--summary" aria-label="Resumo financeiro">{metrics.map(metric=><div className="mrc-kpi-strip__item" key={metric.label} data-tone={metric.label==='Vencido'&&metric.valor>0?'danger':undefined}>
 <dt className="sr-only">{metric.label}</dt><dd><Button variant="ghost" className="mrc-kpi__action" aria-label={`Consultar memorial: ${metric.label}`} onClick={()=>onMetric(metric.label)}><span className="mrc-kpi__label">{metric.label}</span><strong className="mrc-kpi__value">{formatMoney(metric.valor)}</strong><small className="mrc-kpi__detail">{metric.apoio}</small></Button></dd>
 </div>)}</dl>
 <section className="payment-stage-navigation" aria-label="Etapas do fluxo de pagamento"><h3>Fluxo de pagamento</h3><div role="group" aria-label="Filtrar etapas de pagamento">{stages.map(stage=>{const value=stage.numero===1?'fila':stage.filtro;return <Button key={stage.numero} variant={filter===value?'secondary':'outline'} aria-pressed={filter===value} onClick={()=>onStage(value)}><span>{stage.label}</span><strong>{stage.valor}</strong></Button>;})}</div></section>
 </>;
}
