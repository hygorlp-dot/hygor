// COMP-001: a cadeia Solicitação → Cotação → Pedido → Recebimento/NF deve
// manter os mesmos IDs e a mesma obra. A validação fica no servidor porque a
// interface pode estar desatualizada ou ser contornada por uma requisição.
const records=value=>Array.isArray(value)?value:[];
const index=value=>new Map(records(value).map(item=>[String(item?.id||""),item]).filter(([id])=>id));
const sameWork=(left,right)=>String(left?.obraId||"")===String(right?.obraId||"");
// Mapa de cotação (C1.3) gera um pedido por fornecedor: a cotação e a
// solicitação listam todos em `pedidoIds`, e `pedidoId` guarda o primeiro.
const linkedOrderIds=record=>new Set([record?.pedidoId,...records(record?.pedidoIds)].filter(Boolean).map(String));
// Pedido cancelado é histórico: mantém o cotacaoId de origem, mas a cotação
// volta a ficar aberta sem apontar para ele.
const cancelled=order=>String(order?.status||"")==="cancelado";

export const validateProcurementChain=(data={})=>{
  const requests=index(data.solicitacoesCompra);
  const quotes=index(data.cotacoes);
  const orders=index(data.pedidos);

  for(const request of requests.values()){
    if(request.pedidoId){
      const order=orders.get(String(request.pedidoId));
      if(!order)return "Solicitação de compra aponta para um pedido inexistente.";
      if(!sameWork(request,order))return "Solicitação e pedido devem pertencer à mesma obra.";
    }
    for(const orderId of records(request.pedidoIds)){
      const order=orders.get(String(orderId));
      if(!order)return "Solicitação de compra aponta para um pedido inexistente.";
      if(!sameWork(request,order))return "Solicitação e pedido devem pertencer à mesma obra.";
    }
    for(const quoteId of records(request.cotacaoIds)){
      const quote=quotes.get(String(quoteId));
      if(!quote)return "Solicitação de compra aponta para uma cotação inexistente.";
      if(String(quote.solicitacaoId||"")!==String(request.id)||!sameWork(request,quote))return "Cotação vinculada à solicitação possui origem ou obra divergente.";
    }
  }

  for(const quote of quotes.values()){
    if(quote.solicitacaoId){
      const request=requests.get(String(quote.solicitacaoId));
      if(!request)return "Cotação aponta para uma solicitação inexistente.";
      if(!sameWork(quote,request))return "Cotação e solicitação devem pertencer à mesma obra.";
    }
    for(const orderId of linkedOrderIds(quote)){
      const order=orders.get(orderId);
      if(!order)return "Cotação aponta para um pedido inexistente.";
      if(!sameWork(quote,order)||String(order.cotacaoId||"")!==String(quote.id))return "Pedido gerado pela cotação possui vínculo ou obra divergente.";
    }
  }

  for(const order of orders.values()){
    if(order.cotacaoId){
      const quote=quotes.get(String(order.cotacaoId));
      if(!quote)return "Pedido aponta para uma cotação inexistente.";
      if(!sameWork(order,quote)||(!cancelled(order)&&!linkedOrderIds(quote).has(String(order.id))))return "Pedido e cotação devem apontar um para o outro na mesma obra.";
    }
    if(order.solicitacaoId){
      const request=requests.get(String(order.solicitacaoId));
      if(!request)return "Pedido aponta para uma solicitação inexistente.";
      if(!sameWork(order,request))return "Pedido e solicitação devem pertencer à mesma obra.";
    }
  }

  for(const note of records(data.notasFiscais)){
    if(!note.pedidoId)continue;
    const order=orders.get(String(note.pedidoId));
    if(!order)return "Nota fiscal aponta para um pedido inexistente.";
    if(!sameWork(note,order))return "Nota fiscal e pedido devem pertencer à mesma obra.";
  }
  return "";
};
