import { currentCompany } from "./company-context.js";
import { buildPurchaseRequestLiveRow } from "./purchase-request-live-write.js";
import { buildPurchaseOrderLiveRow, buildQuotationLiveRow } from "./purchase-quote-order-live-write.js";

export function createProcurementLiveSync(db) {
  // As projeções são sincronizadas depois da gravação principal. Falhas
  // nessas escritas são registradas sem desfazer o comando já persistido.
  const sincronizarSolicitacaoCompraAoVivo=async({companyId,requestId,mergedData,actor})=>{
    if(!requestId)return;
    const record=(mergedData?.solicitacoesCompra||[]).find(item=>String(item?.id)===String(requestId));
    if(!record)return;
    try{
      const { error }=await db
        .from("purchase_requests")
        .upsert(buildPurchaseRequestLiveRow(companyId,record),{onConflict:"company_id,id"});
      if(error)throw error;
    }catch(err){
      console.error(`Falha ao sincronizar solicitação de compra ${requestId} em purchase_requests (ator=${actor?.id||"desconhecido"}):`,err.message);
    }
  };

  const sincronizarCotacaoAoVivo=async({companyId,quoteId,mergedData,actor})=>{
    if(!quoteId)return;
    const record=(mergedData?.cotacoes||[]).find(item=>String(item?.id)===String(quoteId));
    if(!record)return;
    try{
      const { error }=await db
        .from("core_quotations")
        .upsert(buildQuotationLiveRow(companyId,record),{onConflict:"company_id,id"});
      if(error)throw error;
    }catch(err){
      console.error(`Falha ao sincronizar cotação ${quoteId} em core_quotations (ator=${actor?.id||"desconhecido"}):`,err.message);
    }
  };

  const sincronizarPedidoAoVivo=async({companyId,orderId,mergedData,actor})=>{
    if(!orderId)return;
    const record=(mergedData?.pedidos||[]).find(item=>String(item?.id)===String(orderId));
    if(!record)return;
    try{
      const { error }=await db
        .from("core_purchase_orders")
        .upsert(buildPurchaseOrderLiveRow(companyId,record),{onConflict:"company_id,id"});
      if(error)throw error;
    }catch(err){
      console.error(`Falha ao sincronizar pedido ${orderId} em core_purchase_orders (ator=${actor?.id||"desconhecido"}):`,err.message);
    }
  };

  const sincronizarComprasAlteradas=async(before,after,actor)=>{
    for(const [section,sync,idKey] of [
      ["solicitacoesCompra",sincronizarSolicitacaoCompraAoVivo,"requestId"],
      ["cotacoes",sincronizarCotacaoAoVivo,"quoteId"],
      ["pedidos",sincronizarPedidoAoVivo,"orderId"],
    ]){
      const previous=new Map((before?.[section]||[]).map(record=>[record.id,record]));
      for(const record of after?.[section]||[]){
        if(JSON.stringify(previous.get(record.id))===JSON.stringify(record))continue;
        await sync({companyId:currentCompany(),[idKey]:record.id,mergedData:after,actor});
      }
    }
  };

  const sincronizarPedidosConciliacao=async(data,command,actor)=>{
    const entry=(data.reconciliationCommandLog||[]).find(item=>item.idempotencyKey===command.idempotencyKey);
    const ids=new Set(entry?.purchaseOrderIds||[]);
    const payload=command.payload||{};
    if(["pedido","pagamentoPedido"].includes(payload.targetType))ids.add(payload.targetId);
    if(["nota","pagamentoNota"].includes(payload.targetType)){
      const note=(data.notasFiscais||[]).find(item=>item.id===payload.targetId);
      if(note?.pedidoId)ids.add(note.pedidoId);
    }
    for(const order of data.pedidos||[]){
      if((order.pagamentos||[]).some(payment=>payment.transacaoId===payload.transactionId))ids.add(order.id);
    }
    for(const orderId of ids)await sincronizarPedidoAoVivo({companyId:currentCompany(),orderId,mergedData:data,actor});
  };

  return {
    sincronizarSolicitacaoCompraAoVivo,
    sincronizarCotacaoAoVivo,
    sincronizarPedidoAoVivo,
    sincronizarComprasAlteradas,
    sincronizarPedidosConciliacao,
  };
}
