import {Button} from '../../components/ui/button.jsx';
import {financialDateLabel,isFinancialDate} from '../../domains/financeiro/dates.js';
const labels={covered:'Cobertura comprovada',partial:'Cobertura parcial',uncovered:'Sem compra vinculada',review:'Conferência necessária'};
const number=value=>value==null?'Não informada':value.toLocaleString('pt-BR',{maximumFractionDigits:4});
export default function PlanningCoverage({coverage,onRequest,onOrder}){
 return <section className="planning-coverage" aria-label="Cobertura das necessidades revisadas"><h5>Cobertura das necessidades revisadas</h5>
 {coverage.map(group=><div className="planning-coverage__request" key={group.request.id}>
 <header><strong>Solicitação {group.request.numero||group.request.id}</strong>{onRequest&&<Button variant="outline" onClick={()=>onRequest(group.request)}>Conferir solicitação {group.request.numero||group.request.id}</Button>}</header><p>Necessidade cadastrada: {financialDateLabel(group.request.necessidade,'Não definida')}. Prazo comparado com a data simulada da etapa; revise as datas na origem.</p>
 {!group.rows.length&&<p role="status">Sem itens revisados. Abra a solicitação para conferir a necessidade.</p>}
 <ul>{group.rows.map(row=><li key={row.id}><header><strong>{row.label}</strong><span>{labels[row.status]}</span></header>
 <dl><div><dt>Necessidade revisada</dt><dd>{number(row.quantity)} {row.unit}</dd></div><div><dt>Compra comprovada</dt><dd>{number(row.committed)} {row.unit}</dd></div><div><dt>{row.status==='review'?'Diferença a conferir':'Ainda sem compra'}</dt><dd>{number(row.uncovered)} {row.unit}</dd></div></dl>
 {row.status==='review'&&<p>O saldo é apenas uma diferença das quantidades comprovadas. Revise os vínculos pendentes antes de solicitar outra compra.</p>}
 {row.reasons.map((reason,index)=><p key={index}>{reason}</p>)}
 {row.excess>1e-6&&<p>Compra acima da necessidade revisada: {number(row.excess)} {row.unit}. Confira a solicitação antes de ampliar a compra.</p>}
 {row.commitments.map((line,index)=><div className="planning-coverage__order" key={`${line.orderId}:${index}`}><span>Pedido {line.numero} · {number(line.quantity)} {row.unit} · entrega: {financialDateLabel(line.date,'Não definida')}{isFinancialDate(line.date)&&line.late?' · Rever prazo da entrega':''}{!isFinancialDate(line.date)?' · Conferir data da entrega':''}</span>{onOrder&&<Button variant="link" onClick={()=>onOrder(line.orderId)}>Conferir pedido {line.numero}</Button>}</div>)}
 </li>)}</ul>{group.unmatched.length>0&&<p role="status">{group.unmatched.length} item(ns) de pedido sem vínculo comprovado com a solicitação. Confira a origem; essa quantidade não foi descontada.</p>}
 </div>)}<p>Estoque livre é compartilhado pela obra e exige reserva/conferência na origem. A cobertura acima compara quantidades de compra; não soma orçamento, pedidos e títulos nem comprova recebimento ou pagamento.</p>
 </section>;
}
