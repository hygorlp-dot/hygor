import {fmt} from "../../../legacy/format.js";
import {TaskDisclosure} from "../../../design-system/patterns/TaskDisclosure.jsx";
import {calcOrcadoComprado} from "../budget-tracking.js";
import {purchaseItemTrace} from "../purchase-dossier.js";
import {purchaseUnitOf} from "../unit-conversion.js";

const quantity=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:4});
const itemQuantity=(item,value)=>`${quantity.format(Number(value)||0)} ${purchaseUnitOf(item)}`.trim();

export function PurchaseOriginTrace({data,dossier}){
  const {request,quote,orders}=dossier;
  const rows=purchaseItemTrace(dossier);
  const workId=request?.obraId||quote?.obraId||orders[0]?.obraId;
  const budget=workId?calcOrcadoComprado(data,workId):null;
  const orderIds=new Set(orders.map(order=>String(order.id)));
  const budgetLines=budget?.linhas.flatMap(line=>{
    const entries=line.pedidos.filter(order=>orderIds.has(order.id));
    return entries.length?[{line,committed:entries.reduce((total,order)=>total+(order.rascunho?0:order.valor),0)}]:[];
  })||[];
  const unallocated=budget?.pedidosSemApropriacao?.some(order=>orderIds.has(String(order.id)));
  const materials=new Map((data.materiais||[]).map(item=>[item.id,item.descricao]));
  const stageName=item=>{
    const stageId=item.orcNivel1Id||budget?.orc?.itens?.find(entry=>entry.id===item.orcItemId)?.etapaId;
    return budget?.orc?.etapas?.find(entry=>entry.id===stageId)?.nome||
      (stageId||item.orcItemId?"Etapa vinculada fora do orçamento de controle":"Sem etapa orçamentária vinculada");
  };
  return <>
    <h3>Itens e orçamento</h3>
    <p>Confira a quantidade e a etapa registradas em cada vínculo da compra.</p>
    {!rows.length&&<p>Nenhum item disponível para rastrear.</p>}
    {rows.map(row=>{
      const item=row.requestItem||row.quotes[0]||row.orders[0]?.item;
      const label=item.descricaoRef||materials.get(item.materialId)||"Material não informado";
      return <TaskDisclosure key={row.id} summary={label}>
        <ul>
          <li>{row.requestItem?`Solicitação ${request.numero||request.id} · ${itemQuantity(row.requestItem,row.requestItem.quantidade)} · ${stageName(row.requestItem)}`:"Item da solicitação sem vínculo confirmado"}</li>
          {row.quotes.map(quoted=><li key={quoted.id}>Cotação {quote.numero||quote.id} · {itemQuantity(quoted,quoted.qtd??quoted.quantidade)} · {stageName(quoted)}</li>)}
          {row.orders.map(({order,item:ordered})=><li key={`${order.id}:${ordered.id}`}>Pedido {order.numero||order.id} · {itemQuantity(ordered,ordered.qtd)} · {stageName(ordered)} · {fmt(Number(ordered.qtd||0)*Number(ordered.precoUnit||0))}{order.status==="rascunho"?" · Rascunho":order.status==="cancelado"?" · Cancelado":""}</li>)}
          {row.conflict&&<li>Os vínculos de origem divergem. Confira a solicitação e a cotação.</li>}
        </ul>
      </TaskDisclosure>;
    })}
    <h4>Comprometido no orçamento da obra</h4>
    {!budget?.orc?<p>Orçamento de controle indisponível para comparação. Confira a versão aprovada da obra.</p>
      :!budgetLines.length&&<p>Nenhum pedido desta compra foi localizado nas etapas do orçamento de controle.</p>}
    {budgetLines.map(({line,committed})=><p key={line.it.id}><strong>{line.it.descricao}</strong> · Nesta compra {fmt(committed)} · Comprometido na etapa {fmt(line.comprometido)} de {fmt(line.orcado)}</p>)}
    {unallocated&&<p>Há itens comprometidos sem etapa de orçamento. Confira a apropriação no pedido.</p>}
    <p>Rascunhos não entram no comprometido. O custo reconhecido no DRE segue a conferência fiscal.</p>
  </>;
}
