import {useMemo} from "react";
import {Button} from "../../../design-system/primitives/Button.jsx";
import {Select} from "../../../design-system/primitives/Select.jsx";
import {planningPurchaseNeeds} from "../purchase-needs.js";

export default function PlanningPurchaseNeeds({data,obraId,tasks,taskId,onTask,onClose,onPrepare,onRequest,canRequest}){
 const needs=useMemo(()=>planningPurchaseNeeds(data,{obraId,taskId}),[data,obraId,taskId]);
 return <section className="planning-purchase-needs" aria-label="Materiais e compras da etapa" tabIndex={-1}>
  <header><h3>Materiais e compras da etapa</h3><Button variant="ghost" size="sm" onClick={onClose}>Fechar materiais</Button></header>
  <Select label="Etapa do planejamento" value={taskId} onChange={e=>onTask(e.target.value)} options={tasks.filter(t=>t.etapaId&&!t.titulo).map(t=>({value:t.id,label:t.nome}))}/>
  {needs.error?<p role="status">{needs.error}</p>:<>
   <p>Necessidade no cronograma: <strong>{needs.needDate?needs.needDate.split("-").reverse().join("/"):"Data não definida"}</strong>. {needs.preliminary&&"Orçamento em rascunho: quantitativos preliminares."}</p>
   <p>Quantidades abaixo representam a etapa inteira. Estoque e pedidos são compartilhados pela obra; confirme quanto solicitar.</p>
   {needs.rows.some(row=>!row.valid)&&<p role="status">Itens sem vínculo confirmado ou com unidade incompatível ficam fora da solicitação. Revise essas linhas no orçamento.</p>}
   {!needs.rows.length?<p>Nenhum insumo identificado nesta etapa. Vincule materiais ou abra a composição no orçamento para preparar a solicitação.</p>:<ul>{needs.rows.map(row=><li key={row.materialId||row.descricao}>
    <strong>{row.descricao}</strong><span>Referência da etapa: {row.quantidade.toLocaleString("pt-BR")} {row.unidade}</span>
    {row.valid?<><span>Estoque livre na obra: {row.stock.toLocaleString("pt-BR")} {row.unidade}</span><span>{row.orders.length} pedido(s) com entrega pendente{row.orders.map(p=>` · ${p.numero}${p.previsao?` (${p.previsao.split("-").reverse().join("/")})`:""}`).join("")}</span></>:<span role="status">Vínculo ou unidade pendente. Revise no orçamento antes de solicitar.</span>}
   </li>)}</ul>}
   {needs.requests.length>0?<div className="planning-purchase-actions"><p>Já existe solicitação vinculada a esta etapa.</p>{needs.requests.map(request=><Button key={request.id} variant="secondary" disabled={!canRequest} onClick={()=>onRequest(request)}>Abrir solicitação {request.numero||"da etapa"}</Button>)}</div>
    :<Button disabled={!canRequest||!needs.rows.some(row=>row.valid)} onClick={()=>onPrepare(needs)}>Preparar solicitação em Compras</Button>}
  </>}
 </section>;
}
