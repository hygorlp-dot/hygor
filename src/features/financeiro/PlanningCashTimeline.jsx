import {useMemo,useState} from 'react';
import {Button} from '../../components/ui/button.jsx';
import {planningCashTimeline} from '../../domains/financeiro/planning-cash-timeline.js';
import {financialDateLabel} from '../../domains/financeiro/dates.js';
import {useWorkflow} from '../workflow/WorkflowNavigation.jsx';
import {podeAcessarAba} from '../../domains/administracao/abas-acesso.js';
import PlanningCoverage from './PlanningCoverage.jsx';

export default function PlanningCashTimeline({data,today,days,obraId,forecast,onOpen,currentUser,view,onChange}){
 const [local,setLocal]=useState({chosen:'',shift:0});
 const state=view??local,{chosen='',shift=0}=state;
 const update=patch=>(onChange??setLocal)({...state,...patch});
 const {navigate}=useWorkflow();
 const work=obraId==='all'?chosen:obraId;
 const works=(data.obras||[]).filter(w=>!currentUser?.obraId||String(w.id)===String(currentUser.obraId));
 const validWork=works.some(w=>String(w.id)===String(work));
 const report=useMemo(()=>validWork?planningCashTimeline(data,{obraId:work,today,days,shift,forecastRows:forecast.rows}):null,[data,work,validWork,today,days,shift,forecast]);
 const openTitles=()=>onOpen({title:'Títulos previstos da obra',items:report.titles,context:`${financialDateLabel(today)} a ${financialDateLabel(report.end)} · vencimentos mantidos · cenário local`});
 return <details className="planning-cash-timeline" open={state.open||undefined} onToggle={event=>{if(event.currentTarget.open!==Boolean(state.open))update({open:event.currentTarget.open});}}><summary>Planejamento, compras e vencimentos</summary><h3>Necessidades e compromissos no tempo</h3>
 <p>Compare as datas das etapas com as compras vinculadas e os títulos da previsão. Referências do cronograma não são novas saídas de caixa.</p>
 {obraId==='all'&&<label>Obra da consulta temporal<select value={chosen} onChange={e=>update({chosen:e.target.value,shift:0})}><option value="">Selecione uma obra</option>{works.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
 {!report?<p role="status">Selecione uma obra para comparar as origens. O saldo da empresa não será atribuído à obra.</p>:<>
 <div className="cash-forecast__controls"><label>Deslocamento das etapas na simulação<select value={shift} onChange={e=>update({shift:Number(e.target.value)})}>{[-30,-14,-7,0,7,14,30].map(n=><option key={n} value={n}>{n===0?'Datas atuais':n>0?`Adiar ${n} dias`:`Antecipar ${-n} dias`}</option>)}</select></label></div>
 <p role="status">Etapas neste horizonte: {report.originalCount} nas datas atuais → {report.simulatedCount} na simulação. {report.undated} etapa(s) com datas pendentes.</p>
 <p>O deslocamento muda apenas esta comparação. Datas de entrega, necessidades das solicitações e vencimentos financeiros permanecem cadastrados como estão. Estoque compartilhado não é descontado automaticamente.</p>
 <div className="cash-forecast__actions"><Button variant="outline" onClick={openTitles}>Ver títulos previstos · {report.titles.length}</Button>{navigate&&currentUser&&podeAcessarAba(currentUser,'plan')&&<Button variant="outline" onClick={()=>navigate('plan',{obraId:work})}>Abrir planejamento da obra</Button>}</div>
 <ol className="planning-cash-timeline__stages">{report.rows.map(row=><li key={row.id}>
 <header><h4>{row.label}</h4><span>{row.inSimulation?'No horizonte':row.simulated?'Fora do horizonte':'Sem data válida'}</span></header>
 <dl><div><dt>Referência da etapa</dt><dd>{financialDateLabel(row.date,'Data não definida')}</dd></div><div><dt>Data simulada</dt><dd>{financialDateLabel(row.simulated,'Não calculada')}</dd></div><div><dt>Solicitações vinculadas</dt><dd>{row.requests.length}</dd></div><div><dt>Pedidos comprometidos</dt><dd>{row.orders.length}</dd></div></dl>
 <p>{row.requests.length?`${row.uncommitted.length} solicitação(ões) com cobertura incompleta ou pendente de conferência. Quantidades já comprovadas não reaparecem como necessidade adicional.`:'Sem necessidade revisada em solicitação. A etapa inteira é apenas referência; confirme materiais, unidade e quantidade no planejamento.'}</p>
 {row.invalidDates>0&&<p>Há atividade sem data válida nesta etapa.</p>}{row.invalidQuantities>0&&<p>Quantidade ou unidade pendente em {row.invalidQuantities} solicitação(ões).</p>}
 {row.lateOrders.length>0&&<p>Conferir prazo: {row.lateOrders.length} pedido(s) com entrega posterior à data simulada da etapa.</p>}
 {row.orders.map(o=><p key={o.id}>Pedido {o.numero||o.id} · entrega: {financialDateLabel(o.previsao,'Não definida')} · compromisso de compra, não vencimento financeiro.</p>)}
 {row.titles.length?<Button variant="outline" onClick={()=>onOpen({title:`${row.label} · títulos vinculados`,items:row.titles,context:'Vínculo explícito pelo pedido · vencimentos mantidos na simulação'})}>Ver títulos vinculados à etapa · {row.titles.length}</Button>:<p>Sem título previsto com vínculo comprovado aos pedidos desta etapa, neste recorte.</p>}
 {row.coverage.length>0&&<PlanningCoverage coverage={row.coverage} onRequest={navigate&&currentUser&&podeAcessarAba(currentUser,'cmp')?request=>navigate('cmp',{obraId:work},{action:'open-request',record:{requestId:request.id}}):null} onOrder={navigate&&currentUser&&podeAcessarAba(currentUser,'cmp')?orderId=>navigate('cmp',{obraId:work},{action:'open-order',record:{pedidoId:orderId}}):null}/>}
 </li>)}</ol>{!report.rows.length&&<p>Nenhuma etapa vinculada disponível no planejamento desta obra.</p>}
 <p>{report.unlinkedOrders.length} pedido(s), {report.unknownRequests.length} solicitação(ões) e {report.unlinkedTitles.length} título(s) sem vínculo comprovado com estas etapas. Não foram distribuídos por semelhança de nome ou material.</p>
 <p>Obrigações monetárias vêm dos títulos em aberto do motor financeiro, no horizonte e conta previstos acima. Títulos sem data ou conta permanecem nas filas da previsão. Esta consulta não distribui saldo bancário nem soma orçamento, pedidos e títulos entre si.</p>
 </>}
 </details>;
}
