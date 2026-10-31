import {decisoesDaCotacao,itensDaCotacao,itensPendentesDaCotacao} from './quote-map';
import {statusPedido} from './calculations';

export const quantityLabel=(count,singular,plural=`${singular}s`)=>`${count} ${count===1?singular:plural}`;

// Read-only links by identity and work. Similar descriptions never establish coverage.
export function purchaseRecordFlow(data,type,record){
 const sameWork=item=>item.obraId===record.obraId;
 const quotes=(data.cotacoes||[]).filter(sameWork).filter(q=>q.status!=='cancelada');
 const orders=(data.pedidos||[]).filter(sameWork);
 const requests=(data.solicitacoesCompra||[]).filter(sameWork);
 const link=(kind,item)=>({type:kind,id:item.id,obraId:item.obraId,label:`${{request:'Solicitação',quote:'Cotação',order:'Pedido'}[kind]} ${item.numero||item.id}`});
 if(type==='request'){
  const relatedQuotes=quotes.filter(q=>q.solicitacaoId===record.id);
  const quoteIds=new Set(relatedQuotes.map(q=>q.id));
  const relatedOrders=orders.filter(o=>o.solicitacaoId===record.id||o.id===record.pedidoId||quoteIds.has(o.cotacaoId));
  const approval=(data.instanciasAprovacao||[]).find(a=>a.id===record.aprovacaoInstanciaId);
  const pending=relatedQuotes.reduce((sum,q)=>sum+(q.status==='aberta'?itensPendentesDaCotacao(q).length:0),0);
  const next=record.status==='cancelada'?'Solicitação cancelada. Consulte o histórico antes de iniciar outra compra.'
   :approval&&approval.status!=='aprovada'?'Confira a aprovação pendente ou recusada. A compra pode seguir com aviso, sem alterar a decisão existente.'
   :pending?`${quantityLabel(pending,'item de cotação','itens de cotação')} ainda sem decisão. Continue no comparativo vinculado.`
   :relatedOrders.length?'Consulte os pedidos vinculados para acompanhar envio e entrega. O vínculo não comprova atendimento integral das quantidades.'
   :relatedQuotes.length?'Confira as propostas e os vínculos da cotação antes de gerar pedidos.'
   :'Compras deve analisar os itens e preparar a cotação.';
  return {next,detail:`Cotações vinculadas: ${relatedQuotes.length} · Pedidos vinculados: ${relatedOrders.length}`,
   links:[...relatedQuotes.map(q=>link('quote',q)),...relatedOrders.map(o=>link('order',o))]};
 }
 if(type==='quote'){
  const decisions=decisoesDaCotacao(record),ids=new Set([record.pedidoId,...Object.values(decisions).map(d=>d.pedidoId)].filter(Boolean));
  const relatedOrders=orders.filter(o=>o.cotacaoId===record.id||ids.has(o.id));
  const request=requests.find(r=>r.id===record.solicitacaoId);
  const pending=itensPendentesDaCotacao(record).length,total=itensDaCotacao(record).length;
  const reviews=(record.respostasFornecedor||[]).filter(r=>r.status==='pendente').length;
  const next=record.status==='cancelada'?'Cotação cancelada. Consulte os pedidos existentes e o histórico da compra.'
   :pending&&!(record.propostas||[]).length?'Adicione as propostas dos fornecedores antes de comparar e decidir.'
   :pending?`${quantityLabel(pending,'item','itens')} ainda sem decisão.${reviews?` Há ${quantityLabel(reviews,'resposta')} para revisar antes de usar os novos preços.`:' Compare preço, prazo e condições antes de decidir.'}`
   :'Decisão registrada. Acompanhe os pedidos vinculados; entrega e pagamento têm confirmações próprias.';
  return {next,detail:`${total-pending} de ${total} ${total===1?'item decidido':'itens decididos'} · ${quantityLabel(relatedOrders.length,'pedido')} ${relatedOrders.length===1?'vinculado':'vinculados'}`,
   links:[...(request?[link('request',request)]:[]),...relatedOrders.map(o=>link('order',o))]};
 }
 const quote=quotes.find(q=>q.id===record.cotacaoId||q.pedidoId===record.id||Object.values(decisoesDaCotacao(q)).some(d=>d.pedidoId===record.id));
 const request=requests.find(r=>r.id===(record.solicitacaoId||quote?.solicitacaoId)||r.pedidoId===record.id);
 const status=statusPedido(record),pending=(record.itens||[]).filter(i=>Number(i.qtd)>Number(i.qtdRecebida||0)).length;
 return {next:status==='cancelado'?'Pedido cancelado. Consulte o histórico e os documentos da compra.'
  :status==='rascunho'?'Confira o pedido e suas condições antes de enviar ao fornecedor.'
  :status==='recebido'?'Recebimento concluído. Confira notas e anexos na ficha da compra; isso não confirma pagamento.'
  :`${quantityLabel(pending,'item','itens')} com saldo de entrega. Registre somente o material que chegou à obra.`,
  detail:status==='parcial'?'Entrega parcial · confira o saldo de cada item. Recebimento físico e pagamento são controles separados.'
   :'Recebimento físico e pagamento são controles separados.',
  links:[...(request?[link('request',request)]:[]),...(quote?[link('quote',quote)]:[])]};
}
