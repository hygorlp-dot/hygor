import { contar } from "../../../design-system/copy.js";
import {useMemo} from "react";
import {Button} from "../../../design-system/primitives/Button.jsx";
import {Select} from "../../../design-system/primitives/Select.jsx";
import {planningPurchaseNeeds} from "../purchase-needs.js";
import {fmtDateFull} from "../../../legacy/format.js";

export default function PlanningPurchaseNeeds({data,obraId,tasks,taskId,onTask,onClose,onPrepare,onRequest,onOrder,canRequest}){
 const needs=useMemo(()=>planningPurchaseNeeds(data,{obraId,taskId}),[data,obraId,taskId]);
 return <section className="planning-purchase-needs" aria-label="Materiais e compras da etapa" tabIndex={-1}>
  <header><h3>Materiais e compras da etapa</h3><Button variant="ghost" size="sm" onClick={onClose}>Fechar materiais</Button></header>
  <Select label="Etapa do planejamento" value={taskId} onChange={e=>onTask(e.target.value)} options={tasks.filter(t=>t.etapaId&&!t.titulo).map(t=>({value:t.id,label:t.nome}))}/>
  {needs.error?<p role="status">{needs.error}</p>:<>
   <p>Necessidade no cronograma <strong>{needs.needDate?fmtDateFull(needs.needDate):"Data não definida"}</strong>. {needs.preliminary&&"Orçamento em rascunho. Quantitativos preliminares."}</p>
   {needs.requests.length>0?<div className="planning-purchase-actions">{needs.requests.map(request=><Button key={request.id} variant="secondary" disabled={!canRequest} onClick={()=>onRequest(request)}>Abrir solicitação {request.numero||"da etapa"}</Button>)}</div>
    :<Button disabled={!canRequest||!needs.rows.some(row=>row.valid)} onClick={()=>onPrepare(needs)}>Preparar solicitação em Compras</Button>}
   {needs.requests.length>0&&<div>
    <h4>Pedidos da etapa</h4>
    {needs.linkedOrders.length?<ul>{needs.linkedOrders.map(order=><li key={order.id}>
      <div><Button variant="secondary" disabled={!canRequest} onClick={()=>onOrder(order)}>Abrir pedido {order.number}</Button></div>
      <span>{order.stage}{order.receivedOn&&` · Último recebimento em ${fmtDateFull(order.receivedOn)}`}{order.receiptMissing&&" · Recebimento sem data registrada"}</span>
      {(order.nextDelivery||order.missingForecast)&&<span>{order.nextDelivery&&`Próxima entrega prevista em ${fmtDateFull(order.nextDelivery)}`}{order.missingForecast&&`${order.nextDelivery?" · ":""}Há saldo sem previsão de entrega`}</span>}
    </li>)}</ul>:<p>Nenhum pedido vinculado às solicitações desta etapa.</p>}
   </div>}
   <p>Quantidades abaixo representam a etapa inteira. Estoque e pedidos são compartilhados pela obra; confirme quanto solicitar.</p>
   {needs.rows.some(row=>!row.valid)&&<p role="status">Itens sem vínculo confirmado ou com unidade incompatível ficam fora da solicitação. Revise essas linhas no orçamento.</p>}
   {!needs.rows.length?<p>Nenhum insumo identificado nesta etapa. Vincule materiais ou abra a composição no orçamento para preparar a solicitação.</p>:<ul>{needs.rows.map(row=><li key={JSON.stringify([row.materialId,row.unidade,row.itemOrcamentoIds])}>
    <strong>{row.descricao}</strong><span>Referência da etapa: {row.quantidade.toLocaleString("pt-BR")} {row.unidade}</span>
    {row.valid?<><span>Estoque livre na obra: {row.stock.toLocaleString("pt-BR")} {row.unidade}</span><span>{contar(row.orders.length,"pedido","pedidos")} da obra com entrega pendente{row.orders.map(p=>` · ${p.numero}${p.previsao?` (${fmtDateFull(p.previsao)})`:""}`).join("")}</span></>:<span role="status">Vínculo ou unidade pendente. Revise no orçamento antes de solicitar.</span>}
   </li>)}</ul>}
  </>}
 </section>;
}
